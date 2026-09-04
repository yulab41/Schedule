/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEPENDENCY_MARKER_SCHEMA_VERSION = 2;
export const DEFAULT_DEPENDENCY_MODE = 'ReuseOnly';
export const REQUIRED_ROOT_EXECUTABLES = ['eslint', 'prettier', 'tsc', 'vitest'];
export const PNPM_LAYOUT_CONFIG_KEYS = [
  'enableGlobalVirtualStore',
  'nodeLinker',
  'packageImportMethod',
  'recursiveInstall',
  'sideEffectsCache',
  'storeDir',
  'virtualStoreType',
  'verifyDepsBeforeRun',
  'strictDepBuilds',
];
export const PNPM_INSTALL_ARGUMENTS = [
  'install',
  '--frozen-lockfile',
  '--offline',
  '--config.strictDepBuilds=false',
];
export const MAX_MAINTENANCE_AUTHORIZATION_MINUTES = 15;
export const MAINTENANCE_AUTHORIZATION_SCHEMA_VERSION = 2;
export const L2_RECONCILIATION_AUDIT_SCHEMA_VERSION = 1;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEPENDENCY_MARKER = 'dependencies-v2.json';
const DEPENDENCY_LOCK = 'dependency-install.lock';
const L2_RECONCILIATION_AUDIT = 'l2-reconciliation-v1.json';
const PROJECT_RUNTIME_DIRECTORY = 'runtime';
const SCHEDULE_MARKERS = [
  'pnpm-workspace.yaml',
  'apps/miniprogram',
  'apps/api',
  'infra/docker/compose.prod.yml',
];

function fail(message, code = 'SCHEDULE_DEPENDENCY_ERROR') {
  const error = new Error(`[schedule:deps] ${message}`);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeRelativePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//u, '');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  let real = resolved;
  try { real = fs.realpathSync.native(resolved); } catch { /* a marker may be checked before it exists */ }
  return process.platform === 'win32' ? real.toLocaleLowerCase('en-US') : real;
}

export function getWorktreeStateKey(worktree) {
  return sha256(canonicalPath(worktree)).slice(0, 24);
}

function isPathInside(parent, child) {
  const relative = path.relative(canonicalPath(parent), canonicalPath(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function assertScheduleRoot(root) {
  const normalizedRoot = path.resolve(root);
  const packagePath = path.join(normalizedRoot, 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    fail(`not a readable Schedule repository: ${normalizedRoot}`, 'NOT_SCHEDULE_REPOSITORY');
  }
  if (packageJson.name !== 'medical-staff-scheduling-system' || packageJson.private !== true) {
    fail(`package identity does not match Schedule: ${normalizedRoot}`, 'NOT_SCHEDULE_REPOSITORY');
  }
  for (const marker of SCHEDULE_MARKERS) {
    if (!fs.existsSync(path.join(normalizedRoot, marker))) {
      fail(`Schedule marker is missing: ${marker}`, 'NOT_SCHEDULE_REPOSITORY');
    }
  }
  return normalizedRoot;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON: ${filePath} (${error instanceof Error ? error.message : String(error)})`);
  }
}

function readWorkspacePatterns(root) {
  const workspacePath = path.join(root, 'pnpm-workspace.yaml');
  const lines = fs.readFileSync(workspacePath, 'utf8').split(/\r?\n/u);
  const patterns = [];
  let inPackages = false;
  for (const line of lines) {
    if (/^packages:\s*$/u.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S/u.test(line)) break;
    if (inPackages) {
      const match = line.match(/^\s*-\s+(.+?)\s*$/u);
      if (!match) continue;
      const value = match[1].replace(/\s+#.*$/u, '').trim().replace(/^['"]|['"]$/gu, '');
      if (value) patterns.push(value);
    }
  }
  const inline = fs
    .readFileSync(workspacePath, 'utf8')
    .match(/^packages:\s*\[([^\]]+)\]/mu)?.[1]
    ?.split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/gu, ''))
    .filter(Boolean);
  return [...new Set([...(inline ?? []), ...patterns])];
}

function globPatternToRegExp(pattern) {
  const normalized = normalizeRelativePath(pattern).replace(/^\.\//u, '').replace(/\/$/u, '');
  let source = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*') {
      if (normalized[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else source += '[^/]*';
    } else if (character === '?') source += '[^/]';
    else source += /[\\^$+?.()|{}[\]]/u.test(character) ? `\\${character}` : character;
  }
  return new RegExp(`${source}$`, 'u');
}

function collectPackageJsonFiles(directory, root, results = []) {
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'runtime', 'dist', 'coverage'].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectPackageJsonFiles(absolutePath, root, results);
    else if (entry.isFile() && entry.name === 'package.json') {
      results.push(normalizeRelativePath(path.relative(root, absolutePath)));
    }
  }
  return results;
}

export function discoverWorkspacePackages(root) {
  const normalizedRoot = assertScheduleRoot(root);
  const patterns = readWorkspacePatterns(normalizedRoot);
  const includes = patterns.filter((pattern) => !pattern.startsWith('!')).map(globPatternToRegExp);
  const excludes = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => globPatternToRegExp(pattern.slice(1)));
  const manifests = collectPackageJsonFiles(normalizedRoot, normalizedRoot).filter((relativePath) => {
    return includes.some((pattern) => pattern.test(relativePath.replace(/\/package\.json$/u, ''))) &&
      !excludes.some((pattern) => pattern.test(relativePath.replace(/\/package\.json$/u, '')));
  });
  return manifests
    .map((relativePath) => {
      const manifestPath = path.join(normalizedRoot, relativePath);
      return {
        directory: path.dirname(manifestPath),
        manifestPath,
        manifest: readJson(manifestPath),
      };
    })
    .filter((workspacePackage) => typeof workspacePackage.manifest.name === 'string')
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name, 'en'));
}

function collectFilesRecursively(directory, root, results = []) {
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'runtime'].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFilesRecursively(absolutePath, root, results);
    else if (entry.isFile()) results.push(normalizeRelativePath(path.relative(root, absolutePath)));
  }
  return results;
}

export function collectDependencyInputPaths(root, workspacePackages = discoverWorkspacePackages(root)) {
  const normalizedRoot = path.resolve(root);
  const inputs = new Set(['package.json']);
  for (const workspacePackage of workspacePackages) {
    inputs.add(normalizeRelativePath(path.relative(normalizedRoot, workspacePackage.manifestPath)));
  }
  for (const fileName of [
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'pnpm-workspace.yml',
    '.npmrc',
    '.pnpmrc',
    '.nvmrc',
    '.node-version',
  ]) {
    if (fs.existsSync(path.join(normalizedRoot, fileName))) inputs.add(fileName);
  }
  for (const entry of fs.readdirSync(normalizedRoot, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name === '.pnpmfile.cjs' || entry.name.startsWith('.pnpmfile.'))) {
      inputs.add(entry.name);
    }
  }
  for (const relativePath of collectFilesRecursively(path.join(normalizedRoot, 'patches'), normalizedRoot)) {
    inputs.add(relativePath);
  }
  return [...inputs].sort((left, right) => left.localeCompare(right, 'en'));
}

export function createDependencySnapshot({ root, inputPaths, environment }) {
  const normalizedRoot = path.resolve(root);
  const inputs = [...new Set(inputPaths.map(normalizeRelativePath))]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((relativePath) => {
      const absolutePath = path.resolve(normalizedRoot, relativePath);
      if (!isPathInside(normalizedRoot, absolutePath)) fail(`dependency input escapes worktree: ${relativePath}`);
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        fail(`dependency input is missing: ${relativePath}`);
      }
      return { path: relativePath, sha256: sha256(fs.readFileSync(absolutePath)) };
    });
  const normalizedEnvironment = stableValue(environment);
  return {
    schemaVersion: DEPENDENCY_MARKER_SCHEMA_VERSION,
    fingerprint: sha256(stableJson({ environment: normalizedEnvironment, inputs })),
    inputs,
    environment: normalizedEnvironment,
  };
}

function compareObject(previous, current, prefix = '') {
  const changes = [];
  const keys = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(current ?? {})])].sort(
    (left, right) => left.localeCompare(right, 'en'),
  );
  for (const key of keys) {
    const before = previous?.[key];
    const after = current?.[key];
    const field = prefix ? `${prefix}.${key}` : key;
    if (
      before !== null && after !== null &&
      typeof before === 'object' && typeof after === 'object' &&
      !Array.isArray(before) && !Array.isArray(after)
    ) changes.push(...compareObject(before, after, field));
    else if (stableJson(before) !== stableJson(after)) changes.push(`${field}:changed`);
  }
  return changes;
}

export function diffDependencySnapshots(previous, current) {
  if (previous === undefined || previous === null) return ['marker:missing'];
  if (previous.schemaVersion !== current.schemaVersion) return ['marker:schema-changed'];
  if (previous.fingerprint === current.fingerprint) return [];
  const previousInputs = new Map((previous.inputs ?? []).map((entry) => [entry.path, entry.sha256]));
  const currentInputs = new Map((current.inputs ?? []).map((entry) => [entry.path, entry.sha256]));
  const changes = [];
  for (const inputPath of [...new Set([...previousInputs.keys(), ...currentInputs.keys()])].sort()) {
    if (!previousInputs.has(inputPath)) changes.push(`input:${inputPath}:added`);
    else if (!currentInputs.has(inputPath)) changes.push(`input:${inputPath}:removed`);
    else if (previousInputs.get(inputPath) !== currentInputs.get(inputPath)) {
      changes.push(`input:${inputPath}:changed`);
    }
  }
  changes.push(...compareObject(previous.environment, current.environment, 'environment'));
  return changes.length === 0 ? ['fingerprint:changed'] : changes;
}

function parseModulesMetadata(source) {
  try {
    return JSON.parse(source);
  } catch {
    const metadata = {};
    for (const key of ['nodeLinker', 'packageManager', 'storeDir', 'virtualStoreDir']) {
      const match = source.match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\r\\n]+)`, 'mu'));
      if (match?.[1] !== undefined) metadata[key] = match[1].trim();
    }
    return metadata;
  }
}

function workspaceDependencyNames(manifest) {
  const names = [];
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (typeof specifier === 'string' && specifier.startsWith('workspace:')) names.push(name);
    }
  }
  return names;
}

export function inspectDependencyHealth({
  root,
  storePath,
  workspacePackages,
  expectedPnpmVersion,
  platform = process.platform,
  allowGlobalVirtualStore = false,
}) {
  const normalizedRoot = path.resolve(root);
  const nodeModulesPath = path.join(normalizedRoot, 'node_modules');
  const modulesPath = path.join(nodeModulesPath, '.modules.yaml');
  const reasons = [];
  if (!fs.existsSync(nodeModulesPath)) return { healthy: false, reasons: ['node-modules-missing'] };
  try {
    if (fs.lstatSync(nodeModulesPath).isSymbolicLink()) reasons.push('node-modules-root-is-linked');
  } catch {
    reasons.push('node-modules-root-unreadable');
  }
  if (!fs.existsSync(modulesPath)) reasons.push('modules-metadata-missing');
  let metadata = {};
  if (fs.existsSync(modulesPath)) {
    try {
      metadata = parseModulesMetadata(fs.readFileSync(modulesPath, 'utf8'));
    } catch {
      reasons.push('modules-metadata-unreadable');
    }
  }
  if (!storePath || !fs.existsSync(storePath)) reasons.push('pnpm-store-unavailable');
  else {
    try { fs.accessSync(storePath, fs.constants.R_OK); }
    catch { reasons.push('pnpm-store-unreadable'); }
  }
  if (expectedPnpmVersion && metadata.packageManager !== `pnpm@${expectedPnpmVersion}`) {
    reasons.push('modules-pnpm-version-mismatch');
  }
  if (metadata.storeDir === undefined) reasons.push('modules-store-metadata-missing');
  else if (storePath) {
    try {
      const expectedStorePaths = new Set([canonicalPath(storePath)]);
      const pnpmMajor = String(expectedPnpmVersion ?? '').match(/^(\d+)/u)?.[1];
      if (pnpmMajor !== undefined) expectedStorePaths.add(canonicalPath(path.join(storePath, `v${pnpmMajor}`)));
      if (!expectedStorePaths.has(canonicalPath(metadata.storeDir))) reasons.push('modules-store-mismatch');
    } catch { reasons.push('modules-store-unreadable'); }
  }
  if (metadata.virtualStoreDir === undefined || !fs.existsSync(metadata.virtualStoreDir)) {
    reasons.push('virtual-store-missing');
  } else if (!allowGlobalVirtualStore) {
    try {
      if (!isPathInside(nodeModulesPath, metadata.virtualStoreDir)) {
        reasons.push('virtual-store-not-worktree-local');
      }
    } catch { reasons.push('virtual-store-unreadable'); }
  }
  const suffix = platform === 'win32' ? '.CMD' : '';
  for (const executable of REQUIRED_ROOT_EXECUTABLES) {
    const candidates = [
      path.join(nodeModulesPath, '.bin', `${executable}${suffix}`),
      path.join(nodeModulesPath, '.bin', executable),
    ];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      reasons.push(`root-executable-missing:${executable}`);
    }
  }
  const packagesByName = new Map(workspacePackages.map((workspacePackage) => [workspacePackage.manifest.name, workspacePackage]));
  for (const workspacePackage of workspacePackages) {
    for (const dependencyName of workspaceDependencyNames(workspacePackage.manifest)) {
      const dependency = packagesByName.get(dependencyName);
      if (!dependency) {
        reasons.push(`workspace-dependency-not-found:${workspacePackage.manifest.name}->${dependencyName}`);
        continue;
      }
      const linkPath = path.join(workspacePackage.directory, 'node_modules', ...dependencyName.split('/'));
      if (!fs.existsSync(linkPath)) {
        reasons.push(`workspace-link-missing:${workspacePackage.manifest.name}->${dependencyName}`);
        continue;
      }
      try {
        if (canonicalPath(linkPath) !== canonicalPath(dependency.directory)) {
          reasons.push(`workspace-link-wrong-target:${workspacePackage.manifest.name}->${dependencyName}`);
        }
      } catch {
        reasons.push(`workspace-link-unreadable:${workspacePackage.manifest.name}->${dependencyName}`);
      }
    }
  }
  return { healthy: reasons.length === 0, reasons: [...new Set(reasons)].sort() };
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    fail(`${command} ${arguments_.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout ?? '';
}

export function resolvePnpmInvocation(environment = process.env, platform = process.platform, nodeExecutable = process.execPath) {
  const explicitCli = environment.npm_execpath;
  if (explicitCli && fs.existsSync(explicitCli)) return { argumentsPrefix: [explicitCli], command: nodeExecutable };
  if (platform === 'win32') {
    const candidates = [
      environment.APPDATA ? path.join(environment.APPDATA, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs') : undefined,
      path.join(path.dirname(nodeExecutable), 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      path.join(path.dirname(nodeExecutable), 'node_modules', 'corepack', 'dist', 'pnpm.js'),
    ];
    const cliPath = candidates.find((candidate) => candidate && fs.existsSync(candidate));
    if (cliPath) return { argumentsPrefix: [cliPath], command: nodeExecutable };
    return { argumentsPrefix: [], command: 'pnpm.cmd' };
  }
  return { argumentsPrefix: [], command: 'pnpm' };
}

function runPnpm(root, arguments_, options = {}) {
  const invocation = resolvePnpmInvocation(options.environment ?? process.env);
  return run(invocation.command, [...invocation.argumentsPrefix, ...arguments_], {
    cwd: root,
    env: options.environment,
    stdio: options.stdio,
  });
}

function sanitizeConfigValue(key, value) {
  const pathKeys = new Set(['storeDir', 'virtualStoreDir']);
  if (pathKeys.has(key) && value && value !== 'undefined' && path.isAbsolute(value)) {
    return `sha256:${sha256(canonicalPath(value))}`;
  }
  return value;
}

export function inspectRuntimeEnvironment(root, { projectHome = resolveCanonicalProjectHome(root) } = {}) {
  const targetStorePath = resolveProjectLocalStorePath(projectHome);
  const environment = { ...process.env, npm_config_store_dir: targetStorePath };
  const storePath = path.resolve(runPnpm(root, ['store', 'path', `--store-dir=${targetStorePath}`]).trim());
  const pnpmVersion = runPnpm(root, ['--version'], { environment }).trim();
  const layout = Object.fromEntries(
    PNPM_LAYOUT_CONFIG_KEYS.map((key) => {
      const value = runPnpm(root, ['config', 'get', key], { environment }).trim() || 'undefined';
      return [key, sanitizeConfigValue(key, value)];
    }),
  );
  return {
    environment: {
      architecture: process.arch,
      nodeVersion: process.version,
      os: `${os.platform()}-${os.release()}`,
      pnpmVersion,
      storePathHash: sha256(canonicalPath(storePath)),
      storeVolume: path.parse(storePath).root.replace(/[\\/]+$/u, '').toLocaleLowerCase('en-US'),
      targetStorePath: 'runtime/pnpm-store',
      targetStorePathHash: sha256(canonicalPath(targetStorePath)),
      targetStoreVolume: path.parse(targetStorePath).root.replace(/[\\/]+$/u, '').toLocaleLowerCase('en-US'),
      storePolicy: 'project-local-target',
      layout,
    },
    storePath,
    targetStorePath,
  };
}

function gitCommonDirectory(root) {
  return path.resolve(root, run('git', ['rev-parse', '--git-common-dir'], { cwd: root }).trim());
}

export function resolveCanonicalProjectHome(root) {
  const commonDirectory = gitCommonDirectory(path.resolve(root));
  const projectHome = path.dirname(commonDirectory);
  return assertScheduleRoot(fs.realpathSync.native(projectHome));
}

export function resolveProjectLocalState(root) {
  const worktreeRoot = path.resolve(root);
  const projectHome = resolveCanonicalProjectHome(worktreeRoot);
  const stateRoot = path.join(projectHome, PROJECT_RUNTIME_DIRECTORY, 'codex');
  const worktreeKey = getWorktreeStateKey(worktreeRoot);
  const fingerprintRoot = path.join(stateRoot, 'fingerprints', worktreeKey);
  return {
    projectHome,
    stateRoot,
    fingerprintRoot,
    leaseRoot: path.join(stateRoot, 'leases'),
    worktreeKey,
    dependencyMarkerPath: path.join(fingerprintRoot, DEPENDENCY_MARKER),
    dependencyLockPath: path.join(fingerprintRoot, DEPENDENCY_LOCK),
    l2ReconciliationAuditPath: path.join(fingerprintRoot, L2_RECONCILIATION_AUDIT),
  };
}

export function resolveProjectLocalStorePath(projectHome) {
  return path.join(path.resolve(projectHome), PROJECT_RUNTIME_DIRECTORY, 'pnpm-store');
}

function readMarker(markerPath) {
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    return marker.schemaVersion === DEPENDENCY_MARKER_SCHEMA_VERSION ? marker : undefined;
  } catch {
    return undefined;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function readL2ReconciliationAudit(filePath) {
  if (!fs.existsSync(filePath)) {
    return { schemaVersion: L2_RECONCILIATION_AUDIT_SCHEMA_VERSION, attempts: [] };
  }
  let audit;
  try {
    audit = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`invalid L2 reconciliation audit: ${filePath} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (
    audit?.schemaVersion !== L2_RECONCILIATION_AUDIT_SCHEMA_VERSION ||
    !Array.isArray(audit.attempts)
  ) {
    fail(`invalid L2 reconciliation audit schema: ${filePath}`);
  }
  for (const attempt of audit.attempts) {
    if (!/^[a-f0-9]{64}$/u.test(attempt?.fingerprint ?? '') || attempt?.installInvoked !== true) {
      fail(`invalid L2 reconciliation audit attempt: ${filePath}`);
    }
  }
  return audit;
}

export function findL2ReconciliationAttempt(audit, fingerprint) {
  if (audit?.schemaVersion !== L2_RECONCILIATION_AUDIT_SCHEMA_VERSION || !Array.isArray(audit.attempts)) {
    throw new Error('L2 reconciliation audit must have schemaVersion 1 and an attempts array.');
  }
  return audit.attempts.find((attempt) => attempt.fingerprint === fingerprint);
}

export function recordL2ReconciliationAttempt(filePath, attempt) {
  if (!/^[a-f0-9]{64}$/u.test(attempt?.fingerprint ?? '')) {
    throw new Error('L2 reconciliation attempt fingerprint must be a SHA-256 digest.');
  }
  if (attempt.installInvoked !== true) {
    throw new Error('L2 reconciliation attempts must record an invoked frozen install.');
  }
  const audit = readL2ReconciliationAudit(filePath);
  const existingIndex = audit.attempts.findIndex(({ fingerprint }) => fingerprint === attempt.fingerprint);
  if (existingIndex === -1) audit.attempts.push({ ...attempt });
  else audit.attempts[existingIndex] = { ...audit.attempts[existingIndex], ...attempt };
  writeJsonAtomic(filePath, audit);
  return audit.attempts[existingIndex === -1 ? audit.attempts.length - 1 : existingIndex];
}

function findSlotLease(leaseRoot, worktree) {
  if (!leaseRoot || !fs.existsSync(leaseRoot)) return undefined;
  for (const entry of fs.readdirSync(leaseRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const leasePath = path.join(leaseRoot, entry.name);
    try {
      const lease = JSON.parse(fs.readFileSync(leasePath, 'utf8'));
      if (lease?.path && canonicalPath(lease.path) === canonicalPath(worktree)) return { leasePath, lease };
    } catch {
      // An unreadable lease is handled as a busy condition by the caller only when it owns the path.
    }
  }
  return undefined;
}

function hasActiveLocalLock(stateDirectory, leaseRoot, worktree, leaseToken) {
  const dependencyLock = path.join(stateDirectory, DEPENDENCY_LOCK);
  if (fs.existsSync(dependencyLock)) return 'dependency-install-lock-present';
  const slotLease = findSlotLease(leaseRoot, worktree);
  if (!slotLease) return leaseToken ? 'slot-lease-not-found' : undefined;
  if (!leaseToken) return 'slot-lease-present';
  if (slotLease.lease.token !== leaseToken) return 'slot-lease-owned-by-another-task';
  return undefined;
}

function createExclusiveDirectory(directoryPath) {
  fs.mkdirSync(path.dirname(directoryPath), { recursive: true });
  try {
    fs.mkdirSync(directoryPath);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
}

export function maintenanceCommandArguments({
  root,
  storePath = resolveProjectLocalStorePath(resolveCanonicalProjectHome(root)),
}) {
  return [...PNPM_INSTALL_ARGUMENTS, `--store-dir=${canonicalPath(storePath)}`];
}

export function maintenanceCommandHash({ commonDir, root, storePath }) {
  const arguments_ = maintenanceCommandArguments({ root, storePath });
  return sha256(`${canonicalPath(commonDir)}\n${canonicalPath(root)}\n${stableJson(arguments_)}`);
}

export function validateMaintenanceAuthorization({
  filePath,
  commonDir,
  root,
  storePath = resolveProjectLocalStorePath(resolveCanonicalProjectHome(root)),
  pnpmVersion,
  nodeVersion = process.version,
  now = new Date(),
}) {
  if (!filePath || !fs.existsSync(filePath)) return { valid: false, reason: 'authorization-file-missing' };
  let authorization;
  try { authorization = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return { valid: false, reason: 'authorization-file-invalid' }; }
  const record = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!record || record.schemaVersion !== MAINTENANCE_AUTHORIZATION_SCHEMA_VERSION || record.singleUse !== true) {
    return { valid: false, reason: 'authorization-schema-invalid' };
  }
  if (record.commonDir !== canonicalPath(commonDir)) return { valid: false, reason: 'authorization-common-dir-mismatch' };
  if (record.targetWorktree !== canonicalPath(root)) return { valid: false, reason: 'authorization-worktree-mismatch' };
  if (record.targetStorePath !== canonicalPath(storePath)) return { valid: false, reason: 'authorization-store-mismatch' };
  const expectedArguments = maintenanceCommandArguments({ root, storePath });
  if (record.command?.cwd !== canonicalPath(root) || stableJson(record.command?.args) !== stableJson(expectedArguments)) {
    return { valid: false, reason: 'authorization-command-mismatch' };
  }
  if (record.commandHash !== maintenanceCommandHash({ commonDir, root, storePath })) {
    return { valid: false, reason: 'authorization-command-hash-mismatch' };
  }
  if (record.lockfileSha256 !== sha256(fs.readFileSync(path.join(root, 'pnpm-lock.yaml')))) {
    return { valid: false, reason: 'authorization-lockfile-mismatch' };
  }
  if (record.nodeVersion !== nodeVersion) return { valid: false, reason: 'authorization-node-version-mismatch' };
  if (record.pnpmVersion !== pnpmVersion) return { valid: false, reason: 'authorization-pnpm-version-mismatch' };
  if (typeof record.nonce !== 'string' || !/^[0-9a-f-]{36}$/iu.test(record.nonce)) {
    return { valid: false, reason: 'authorization-nonce-invalid' };
  }
  if (typeof record.reason !== 'string' || record.reason.trim() === '') {
    return { valid: false, reason: 'authorization-reason-missing' };
  }
  const expiresAt = Date.parse(record.expiresAt ?? '');
  const createdAt = Date.parse(record.createdAt ?? '');
  if (!Number.isFinite(expiresAt) || !Number.isFinite(createdAt) || expiresAt <= now.getTime()) {
    return { valid: false, reason: 'authorization-expired' };
  }
  if (expiresAt - createdAt > MAX_MAINTENANCE_AUTHORIZATION_MINUTES * 60_000) {
    return { valid: false, reason: 'authorization-ttl-too-long' };
  }
  if (record.usedAt) return { valid: false, reason: 'authorization-already-used' };
  return { valid: true, record };
}

function consumeMaintenanceAuthorization(filePath, record) {
  writeJsonAtomic(filePath, { ...record, usedAt: new Date().toISOString() });
}

function installDependencies({
  root,
  authorizationFile,
  commonDir,
  currentMessageAuthorization = false,
  targetStorePath,
  pnpmVersion,
  json,
}) {
  const authorization = validateMaintenanceAuthorization({
    filePath: authorizationFile,
    commonDir,
    root,
    storePath: targetStorePath,
    pnpmVersion,
  });
  if (!authorization.valid) {
    return { installed: false, authorized: false, reason: authorization.reason };
  }
  const environment = {
    ...process.env,
    CI: 'true',
    // The project invokes pnpm's JS entry directly through Node, so pnpm does not
    // populate npm_config_user_agent for the pnpmfile tripwire. Bind the exact
    // measured version into the child environment instead of weakening the guard.
    npm_config_user_agent: `pnpm/${pnpmVersion} npm/? node/${process.version}`,
  };
  const stdout = runPnpm(root, maintenanceCommandArguments({ root, storePath: targetStorePath }), {
    environment,
    stdio: json ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  consumeMaintenanceAuthorization(authorizationFile, authorization.record);
  return { installed: true, authorized: true, stdout };
}

function trackedTreeStatus(root) {
  return run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root }).trim();
}

function inferDownloadCount(stdout) {
  if (typeof stdout !== 'string' || stdout.trim() === '') return null;
  if (/already up to date/iu.test(stdout) || /packages:\s*\+0/iu.test(stdout)) return 0;
  const match = stdout.match(/(?:downloaded|added)\s+(\d+)/iu);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function ensureWorktreeDependencies(options = {}) {
  const root = assertScheduleRoot(fs.realpathSync.native(path.resolve(options.worktree ?? process.cwd())));
  const mode = options.mode ?? DEFAULT_DEPENDENCY_MODE;
  if (!['ReuseOnly', 'DependencyMaintenance'].includes(mode)) fail(`unsupported dependency mode: ${mode}`);
  const workspacePackages = discoverWorkspacePackages(root);
  const projectState = resolveProjectLocalState(root);
  const runtime = inspectRuntimeEnvironment(root, { projectHome: projectState.projectHome });
  const snapshot = createDependencySnapshot({
    root,
    inputPaths: collectDependencyInputPaths(root, workspacePackages),
    environment: runtime.environment,
  });
  const stateDirectory = projectState.fingerprintRoot;
  const markerPath = projectState.dependencyMarkerPath;
  const lockPath = projectState.dependencyLockPath;
  const busyReason = hasActiveLocalLock(stateDirectory, projectState.leaseRoot, root, options.leaseToken);
  const getHealth = () => inspectDependencyHealth({
    root,
    storePath: runtime.storePath,
    workspacePackages,
    expectedPnpmVersion: runtime.environment.pnpmVersion,
    allowGlobalVirtualStore: false,
  });
  const previous = readMarker(markerPath);
  const fingerprintReasons = diffDependencySnapshots(previous, snapshot);
  const health = getHealth();
  const base = {
    dependencyFingerprint: snapshot.fingerprint,
    fingerprint: snapshot.fingerprint,
    dependenciesReused: false,
    installed: false,
    installInvoked: false,
    worktreeCreated: false,
    reasons: [...fingerprintReasons, ...health.reasons.map((reason) => `health:${reason}`)],
    markerPath,
    mode,
    canonicalProjectHome: projectState.projectHome,
    projectLocalStoreTarget: 'runtime/pnpm-store',
    l2ReconciliationAuditPath: projectState.l2ReconciliationAuditPath,
  };
  if (busyReason) {
    return { ...base, taskStatus: 'POOL_BUSY', reasons: [busyReason] };
  }
  if (fingerprintReasons.length === 0 && health.healthy) {
    return { ...base, taskStatus: 'READY_REUSE', dependenciesReused: true, reasons: [] };
  }
  if (mode === 'ReuseOnly') {
    if (
      options.adoptHealthyExisting === true &&
      previous === undefined &&
      fingerprintReasons.length === 1 &&
      fingerprintReasons[0] === 'marker:missing' &&
      health.healthy
    ) {
      writeJsonAtomic(markerPath, { ...snapshot, updatedAt: new Date().toISOString() });
      return { ...base, taskStatus: 'READY_REUSE', dependenciesReused: true, adopted: true, reasons: ['marker:missing'] };
    }
    if (!health.healthy && health.reasons.includes('node-modules-missing')) {
      return { ...base, taskStatus: 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV' };
    }
    return { ...base, taskStatus: 'BLOCKED_DEPENDENCY_INSTALL_REQUIRED' };
  }
  const commonDir = gitCommonDirectory(root);
  const currentMessageAuthorization = options.currentMessageAuthorization === true;
  if (currentMessageAuthorization) {
    const slotLease = findSlotLease(projectState.leaseRoot, root);
    if (!options.leaseToken || !slotLease || slotLease.lease.token !== options.leaseToken) {
      return {
        ...base,
        taskStatus: 'BLOCKED_DEPENDENCY_MAINTENANCE_AUTHORIZATION_REQUIRED',
        reasons: [...base.reasons, 'authorization:current-message-requires-owned-lease'],
      };
    }
  }
  const authorizationFile = path.resolve(options.authorizationFile ?? path.join(
    projectState.stateRoot,
    'authorizations',
    'pending.json',
  ));
  if (!isPathInside(projectState.stateRoot, authorizationFile)) {
    return {
      ...base,
      taskStatus: 'BLOCKED_DEPENDENCY_MAINTENANCE_AUTHORIZATION_REQUIRED',
      reasons: [...base.reasons, 'authorization:project-local-path-required'],
    };
  }
  const authorization = validateMaintenanceAuthorization({
    filePath: authorizationFile,
    commonDir,
    root,
    storePath: runtime.targetStorePath,
    pnpmVersion: runtime.environment.pnpmVersion,
  });
  if (!authorization.valid) {
    return {
      ...base,
      taskStatus: 'BLOCKED_DEPENDENCY_MAINTENANCE_AUTHORIZATION_REQUIRED',
      reasons: [...base.reasons, `authorization:${authorization.reason}`],
    };
  }
  const reconciliationAudit = readL2ReconciliationAudit(projectState.l2ReconciliationAuditPath);
  const previousReconciliation = findL2ReconciliationAttempt(
    reconciliationAudit,
    snapshot.fingerprint,
  );
  const tripwireRecoveryAllowed =
    previousReconciliation?.status === 'tripwire-pre-resolution' &&
    previousReconciliation.recoveryAttempted !== true;
  if (previousReconciliation && !tripwireRecoveryAllowed) {
    return {
      ...base,
      taskStatus: 'BLOCKED_L2_RECONCILIATION_ALREADY_ATTEMPTED',
      reasons: [
        ...base.reasons,
        `l2-reconciliation:${snapshot.fingerprint}:already-attempted`,
        `l2-reconciliation-status:${previousReconciliation.status ?? 'unknown'}`,
      ],
    };
  }
  fs.mkdirSync(stateDirectory, { recursive: true });
  if (!createExclusiveDirectory(lockPath)) return { ...base, taskStatus: 'POOL_BUSY', reasons: ['dependency-install-lock-present'] };
  const installArguments = maintenanceCommandArguments({ root, storePath: runtime.targetStorePath });
  const trackedTreeBefore = trackedTreeStatus(root);
  const reconciliationAttempt = {
    authorizationSource: currentMessageAuthorization ? 'current-message' : 'authorization-file',
    command: { cwd: canonicalPath(root), args: installArguments },
    commandHash: maintenanceCommandHash({ commonDir, root, storePath: runtime.targetStorePath }),
    fingerprint: snapshot.fingerprint,
    installInvoked: true,
    lockfileSha256: sha256(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'))),
    startedAt: new Date().toISOString(),
    status: 'started',
    attemptCount: (previousReconciliation?.attemptCount ?? 0) + 1,
    recoveryAttempted: tripwireRecoveryAllowed,
    trackedTreeBeforeHash: sha256(trackedTreeBefore),
  };
  recordL2ReconciliationAttempt(projectState.l2ReconciliationAuditPath, reconciliationAttempt);
  try {
    writeJsonAtomic(path.join(lockPath, 'owner.json'), {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      fingerprint: snapshot.fingerprint,
    });
    const install = installDependencies({
      root,
      authorizationFile,
      commonDir,
      currentMessageAuthorization,
      targetStorePath: runtime.targetStorePath,
      pnpmVersion: runtime.environment.pnpmVersion,
      json: options.json === true,
    });
    if (!install.installed) {
      recordL2ReconciliationAttempt(projectState.l2ReconciliationAuditPath, {
        ...reconciliationAttempt,
        completedAt: new Date().toISOString(),
        status: `authorization-failed:${install.reason}`,
      });
      return { ...base, taskStatus: 'BLOCKED_DEPENDENCY_MAINTENANCE_AUTHORIZATION_REQUIRED', reasons: [`authorization:${install.reason}`] };
    }
    const installedHealth = getHealth();
    const trackedTreeAfter = trackedTreeStatus(root);
    const trackedTreeChanged = trackedTreeAfter !== trackedTreeBefore;
    const downloadCount = inferDownloadCount(install.stdout);
    if (!installedHealth.healthy || trackedTreeChanged) {
      recordL2ReconciliationAttempt(projectState.l2ReconciliationAuditPath, {
        ...reconciliationAttempt,
        completedAt: new Date().toISOString(),
        downloadCount,
        status: installedHealth.healthy ? 'tracked-tree-changed' : 'health-failed',
        trackedTreeAfterHash: sha256(trackedTreeAfter),
        trackedTreeChanged,
      });
      return {
        ...base,
        taskStatus: 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV',
        installed: true,
        installInvoked: true,
        reasons: [
          ...installedHealth.reasons.map((reason) => `health:${reason}`),
          ...(trackedTreeChanged ? ['tracked-tree-changed-by-install'] : []),
        ],
      };
    }
    writeJsonAtomic(markerPath, { ...snapshot, updatedAt: new Date().toISOString() });
    recordL2ReconciliationAttempt(projectState.l2ReconciliationAuditPath, {
      ...reconciliationAttempt,
      completedAt: new Date().toISOString(),
      downloadCount,
      status: 'ready-reuse',
      trackedTreeAfterHash: sha256(trackedTreeAfter),
      trackedTreeChanged: false,
    });
    return { ...base, taskStatus: 'READY_INSTALLED', dependenciesReused: false, installed: true, installInvoked: true };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    recordL2ReconciliationAttempt(projectState.l2ReconciliationAuditPath, {
      ...reconciliationAttempt,
      completedAt: new Date().toISOString(),
      failurePhase: errorText.includes('[schedule:install-tripwire]')
        ? 'tripwire-before-resolution'
        : 'pnpm-child',
      status: errorText.includes('[schedule:install-tripwire]')
        ? 'tripwire-pre-resolution'
        : 'install-failed',
    });
    throw error;
  } finally {
    fs.rmSync(lockPath, { force: true, recursive: true });
  }
}

function parseArguments(arguments_) {
  const options = {
    authorizationFile: undefined,
    json: false,
    leaseToken: undefined,
    mode: DEFAULT_DEPENDENCY_MODE,
    currentMessageAuthorization: false,
    worktree: process.cwd(),
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--mode' || argument === '--worktree' || argument === '--authorization-file' || argument === '--lease-token') {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) fail(`${argument} requires a value`);
      if (argument === '--mode') options.mode = value;
      else if (argument === '--worktree') options.worktree = value;
      else if (argument === '--authorization-file') options.authorizationFile = value;
      else options.leaseToken = value;
      index += 1;
    } else if (argument === '--adopt-healthy-existing') options.adoptHealthyExisting = true;
    else if (argument === '--current-message-authorization') options.currentMessageAuthorization = true;
    else if (argument === '--check-only') options.mode = 'ReuseOnly';
    else fail(`unknown argument: ${argument}`);
  }
  return options;
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result));
    return;
  }
  console.log(`TASK_STATUS=${result.taskStatus}`);
  console.log(`DEPENDENCIES_REUSED=${result.dependenciesReused ? 'true' : 'false'}`);
  console.log(`INSTALL_INVOKED=${result.installInvoked ? 'true' : 'false'}`);
  console.log(`WORKTREE_CREATED=${result.worktreeCreated ? 'true' : 'false'}`);
  console.log(`DEPENDENCY_FINGERPRINT=${result.dependencyFingerprint}`);
  for (const reason of result.reasons ?? []) console.log(`INVALIDATION_REASON=${reason}`);
}

export function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const result = ensureWorktreeDependencies(options);
  printResult(result, options.json);
  return result;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try { main(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
