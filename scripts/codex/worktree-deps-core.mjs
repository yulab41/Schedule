/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEPENDENCY_MARKER_SCHEMA_VERSION = 1;
export const REQUIRED_ROOT_EXECUTABLES = ['eslint', 'prettier', 'tsc', 'vitest'];
export const PNPM_LAYOUT_CONFIG_KEYS = [
  'enableGlobalVirtualStore',
  'nodeLinker',
  'packageImportMethod',
  'recursiveInstall',
  'sideEffectsCache',
  'storeDir',
  'virtualStoreType',
];
export const PNPM_INSTALL_ARGUMENTS = [
  'install',
  '--frozen-lockfile',
  '--offline',
  '--config.strictDepBuilds=false',
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function fail(message) {
  throw new Error(`[worktree:deps] ${message}`);
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

function normalizeEnvironment(environment) {
  return stableValue(environment);
}

export function createDependencySnapshot({ root, inputPaths, environment }) {
  const normalizedRoot = path.resolve(root);
  const inputs = [...new Set(inputPaths.map(normalizeRelativePath))]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((relativePath) => {
      const absolutePath = path.resolve(normalizedRoot, relativePath);
      const relativeToRoot = path.relative(normalizedRoot, absolutePath);
      if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
        fail(`dependency input escapes the worktree: ${relativePath}`);
      }
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        fail(`dependency input is missing: ${relativePath}`);
      }
      return { path: relativePath, sha256: sha256(fs.readFileSync(absolutePath)) };
    });
  const normalizedEnvironment = normalizeEnvironment(environment);
  const fingerprint = sha256(stableJson({ environment: normalizedEnvironment, inputs }));
  return {
    schemaVersion: DEPENDENCY_MARKER_SCHEMA_VERSION,
    fingerprint,
    inputs,
    environment: normalizedEnvironment,
  };
}

function compareEnvironment(previous, current, prefix = '') {
  const changes = [];
  const keys = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(current ?? {})])].sort(
    (left, right) => left.localeCompare(right, 'en'),
  );
  for (const key of keys) {
    const before = previous?.[key];
    const after = current?.[key];
    const field = prefix === '' ? key : `${prefix}.${key}`;
    if (
      before !== null &&
      after !== null &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      changes.push(...compareEnvironment(before, after, field));
    } else if (stableJson(before) !== stableJson(after)) {
      changes.push(`environment:${field}:changed`);
    }
  }
  return changes;
}

export function diffDependencySnapshots(previous, current) {
  if (previous === undefined || previous === null) return ['marker:missing'];
  if (previous.schemaVersion !== current.schemaVersion) return ['marker:schema-changed'];
  if (previous.fingerprint === current.fingerprint) return [];

  const changes = [];
  const previousInputs = new Map(
    (previous.inputs ?? []).map((entry) => [entry.path, entry.sha256]),
  );
  const currentInputs = new Map((current.inputs ?? []).map((entry) => [entry.path, entry.sha256]));
  const inputPaths = [...new Set([...previousInputs.keys(), ...currentInputs.keys()])].sort(
    (a, b) => a.localeCompare(b, 'en'),
  );
  for (const inputPath of inputPaths) {
    if (!previousInputs.has(inputPath)) changes.push(`input:${inputPath}:added`);
    else if (!currentInputs.has(inputPath)) changes.push(`input:${inputPath}:removed`);
    else if (previousInputs.get(inputPath) !== currentInputs.get(inputPath)) {
      changes.push(`input:${inputPath}:changed`);
    }
  }
  changes.push(...compareEnvironment(previous.environment, current.environment));
  return changes.length === 0 ? ['fingerprint:changed'] : changes;
}

function canonicalPath(value) {
  let resolved = fs.realpathSync.native(value);
  if (process.platform === 'win32') resolved = resolved.toLocaleLowerCase('en-US');
  return resolved.replace(/[\\/]+$/u, '');
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function parseModulesMetadata(source) {
  try {
    return JSON.parse(source);
  } catch {
    const selected = {};
    for (const key of ['nodeLinker', 'packageManager', 'storeDir', 'virtualStoreDir']) {
      const match = source.match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\r\\n]+)`, 'mu'));
      if (match?.[1] !== undefined) selected[key] = match[1].trim();
    }
    return selected;
  }
}

function workspaceDependencies(manifest) {
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
  allowGlobalVirtualStore = false,
  expectedPnpmVersion,
  platform = process.platform,
}) {
  const reasons = [];
  const normalizedRoot = path.resolve(root);
  const nodeModulesPath = path.join(normalizedRoot, 'node_modules');
  const modulesPath = path.join(nodeModulesPath, '.modules.yaml');

  if (!fs.existsSync(nodeModulesPath)) {
    return { healthy: false, reasons: ['node-modules-missing'] };
  }
  if (fs.lstatSync(nodeModulesPath).isSymbolicLink()) {
    reasons.push('node-modules-must-not-be-shared-or-linked');
  }
  if (!fs.existsSync(modulesPath)) {
    reasons.push('modules-metadata-missing');
  }

  let metadata = {};
  if (fs.existsSync(modulesPath)) {
    try {
      metadata = parseModulesMetadata(fs.readFileSync(modulesPath, 'utf8'));
    } catch {
      reasons.push('modules-metadata-unreadable');
    }
  }

  if (!fs.existsSync(storePath)) {
    reasons.push('pnpm-store-unavailable');
  } else {
    try {
      fs.accessSync(storePath, fs.constants.R_OK);
    } catch {
      reasons.push('pnpm-store-unreadable');
    }
  }

  if (metadata.storeDir !== undefined && fs.existsSync(storePath)) {
    try {
      if (canonicalPath(metadata.storeDir) !== canonicalPath(storePath)) {
        reasons.push('modules-store-mismatch');
      }
    } catch {
      reasons.push('modules-store-unreadable');
    }
  }
  if (
    expectedPnpmVersion !== undefined &&
    metadata.packageManager !== undefined &&
    metadata.packageManager !== `pnpm@${expectedPnpmVersion}`
  ) {
    reasons.push('modules-pnpm-version-mismatch');
  }

  if (metadata.virtualStoreDir === undefined || !fs.existsSync(metadata.virtualStoreDir)) {
    reasons.push('virtual-store-missing');
  } else if (!allowGlobalVirtualStore) {
    try {
      if (!isWithin(canonicalPath(nodeModulesPath), canonicalPath(metadata.virtualStoreDir))) {
        reasons.push('virtual-store-not-worktree-local');
      }
    } catch {
      reasons.push('virtual-store-unreadable');
    }
  }

  const executableSuffix = platform === 'win32' ? '.CMD' : '';
  for (const executable of REQUIRED_ROOT_EXECUTABLES) {
    const fileName = `${executable}${executableSuffix}`;
    if (!fs.existsSync(path.join(nodeModulesPath, '.bin', fileName))) {
      reasons.push(`root-executable-missing:${fileName}`);
    }
  }

  const packagesByName = new Map(
    workspacePackages.map((workspacePackage) => [workspacePackage.manifest.name, workspacePackage]),
  );
  for (const workspacePackage of workspacePackages) {
    for (const dependencyName of workspaceDependencies(workspacePackage.manifest)) {
      const dependency = packagesByName.get(dependencyName);
      if (dependency === undefined) {
        reasons.push(
          `workspace-dependency-not-found:${workspacePackage.manifest.name}->${dependencyName}`,
        );
        continue;
      }
      const linkPath = path.join(
        workspacePackage.directory,
        'node_modules',
        ...dependencyName.split('/'),
      );
      if (!fs.existsSync(linkPath)) {
        reasons.push(`workspace-link-missing:${workspacePackage.manifest.name}->${dependencyName}`);
        continue;
      }
      try {
        if (canonicalPath(linkPath) !== canonicalPath(dependency.directory)) {
          reasons.push(
            `workspace-link-wrong-target:${workspacePackage.manifest.name}->${dependencyName}`,
          );
        }
      } catch {
        reasons.push(
          `workspace-link-unreadable:${workspacePackage.manifest.name}->${dependencyName}`,
        );
      }
    }
  }

  return { healthy: reasons.length === 0, reasons: [...new Set(reasons)].sort() };
}

function readMarker(markerPath) {
  try {
    return JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch {
    return undefined;
  }
}

function writeMarker(markerPath, snapshot) {
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  const temporaryPath = `${markerPath}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporaryPath,
    `${JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }, undefined, 2)}\n`,
    'utf8',
  );
  fs.renameSync(temporaryPath, markerPath);
}

export function ensureDependencyState({
  markerPath,
  lockPath,
  snapshot,
  getHealth,
  install,
  checkOnly = false,
  adoptHealthyExisting = false,
  onInstallRequired = () => {},
}) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    fs.mkdirSync(lockPath);
  } catch (error) {
    if (error?.code === 'EEXIST') fail(`install lock already exists: ${path.basename(lockPath)}`);
    throw error;
  }

  try {
    fs.writeFileSync(
      path.join(lockPath, 'owner.json'),
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
      'utf8',
    );
    const markerExists = fs.existsSync(markerPath);
    const previous = readMarker(markerPath);
    const health = getHealth();
    const fingerprintReasons = diffDependencySnapshots(previous, snapshot);
    const reasons = [...fingerprintReasons, ...health.reasons.map((reason) => `health:${reason}`)];

    if (reasons.length === 0) {
      return {
        adopted: false,
        compatible: true,
        dependenciesReused: true,
        installed: false,
        reasons: [],
      };
    }
    if (checkOnly) {
      return {
        adopted: false,
        compatible: false,
        dependenciesReused: false,
        installed: false,
        reasons,
      };
    }
    if (
      adoptHealthyExisting &&
      !markerExists &&
      previous === undefined &&
      health.healthy &&
      fingerprintReasons.length === 1 &&
      fingerprintReasons[0] === 'marker:missing'
    ) {
      writeMarker(markerPath, snapshot);
      return {
        adopted: true,
        compatible: true,
        dependenciesReused: true,
        installed: false,
        reasons: ['marker:missing'],
      };
    }

    onInstallRequired(reasons);
    install({ reasons });
    const installedHealth = getHealth();
    if (!installedHealth.healthy) {
      fail(`health check failed after install: ${installedHealth.reasons.join(', ')}`);
    }
    writeMarker(markerPath, snapshot);
    return {
      adopted: false,
      compatible: true,
      dependenciesReused: false,
      installed: true,
      reasons,
    };
  } finally {
    fs.rmSync(lockPath, { force: true, recursive: true });
  }
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    fail(`${command} ${arguments_.join(' ')} failed${detail === '' ? '' : `: ${detail}`}`);
  }
  return result.stdout ?? '';
}

export function resolvePnpmInvocation(
  environment = process.env,
  platform = process.platform,
  nodeExecutable = process.execPath,
) {
  const explicitCli = environment.npm_execpath;
  if (explicitCli !== undefined && fs.existsSync(explicitCli)) {
    return { argumentsPrefix: [explicitCli], command: nodeExecutable };
  }
  if (platform === 'win32') {
    const candidates = [
      environment.APPDATA === undefined
        ? undefined
        : path.join(environment.APPDATA, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      path.join(path.dirname(nodeExecutable), 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      path.join(path.dirname(nodeExecutable), 'node_modules', 'corepack', 'dist', 'pnpm.js'),
    ];
    const cliPath = candidates.find(
      (candidate) => candidate !== undefined && fs.existsSync(candidate),
    );
    if (cliPath === undefined) fail('unable to locate the pnpm JavaScript entry point');
    return { argumentsPrefix: [cliPath], command: nodeExecutable };
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

export function discoverWorkspacePackages(root) {
  const output = runPnpm(root, ['list', '--recursive', '--depth=-1', '--json']);
  let entries;
  try {
    entries = JSON.parse(output);
  } catch {
    fail('pnpm workspace inventory was not valid JSON');
  }
  return entries.map((entry) => {
    const directory = path.resolve(entry.path);
    const manifestPath = path.join(directory, 'package.json');
    return {
      directory,
      manifestPath,
      manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
    };
  });
}

function collectFilesRecursively(directory, root) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFilesRecursively(absolutePath, root));
    else if (entry.isFile()) files.push(normalizeRelativePath(path.relative(root, absolutePath)));
  }
  return files;
}

export function collectDependencyInputPaths(root, workspacePackages) {
  const inputs = new Set(
    workspacePackages.map((workspacePackage) =>
      normalizeRelativePath(path.relative(root, workspacePackage.manifestPath)),
    ),
  );
  for (const fileName of [
    '.npmrc',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'pnpm-workspace.yml',
    'pnpmfile.cjs',
  ]) {
    if (fs.existsSync(path.join(root, fileName))) inputs.add(fileName);
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith('.pnpmfile.')) inputs.add(entry.name);
  }
  for (const relativePath of collectFilesRecursively(path.join(root, 'patches'), root)) {
    inputs.add(relativePath);
  }
  return [...inputs].sort((left, right) => left.localeCompare(right, 'en'));
}

function readPnpmConfig(root, key) {
  return runPnpm(root, ['config', 'get', key]).trim() || 'undefined';
}

export function sanitizePnpmConfigValue(key, value) {
  if (key === 'storeDir' && value !== 'undefined' && path.isAbsolute(value)) {
    const normalized = process.platform === 'win32' ? value.toLocaleLowerCase('en-US') : value;
    return `sha256:${sha256(normalized)}`;
  }
  return value;
}

export function inspectRuntimeEnvironment(root) {
  const storePath = path.resolve(runPnpm(root, ['store', 'path']).trim());
  const pnpmVersion = runPnpm(root, ['--version']).trim();
  const layout = Object.fromEntries(
    PNPM_LAYOUT_CONFIG_KEYS.map((key) => [
      key,
      sanitizePnpmConfigValue(key, readPnpmConfig(root, key)),
    ]),
  );
  return {
    environment: {
      architecture: process.arch,
      nodeVersion: process.version,
      os: `${os.platform()}-${os.release()}`,
      pnpmVersion,
      storePathHash: sha256(
        process.platform === 'win32' ? storePath.toLocaleLowerCase('en-US') : storePath,
      ),
      storeVolume: path
        .parse(storePath)
        .root.replace(/[\\/]+$/u, '')
        .toLocaleLowerCase('en-US'),
      layout,
    },
    storePath,
  };
}

function gitDirectory(root) {
  return path.resolve(run('git', ['rev-parse', '--absolute-git-dir'], { cwd: root }).trim());
}

function parseArguments(arguments_) {
  const options = {
    adoptHealthyExisting: false,
    checkOnly: false,
    json: false,
    worktree: process.cwd(),
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--adopt-healthy-existing') options.adoptHealthyExisting = true;
    else if (argument === '--check-only') options.checkOnly = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--worktree') {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) fail('--worktree requires a path');
      options.worktree = value;
      index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  return options;
}

export function stripPnpmBuildPlaceholders(source) {
  return source.replace(
    /^[ \t]+(?:'[^'\r\n]+'|"[^"\r\n]+"|[^:\r\n]+): set this to true or false\r?\n/gmu,
    '',
  );
}

function installDependencies(root, stdio = 'inherit') {
  const workspacePath = path.join(root, 'pnpm-workspace.yaml');
  const originalWorkspace = fs.readFileSync(workspacePath);
  const environment = { ...process.env, CI: 'true' };
  try {
    runPnpm(root, PNPM_INSTALL_ARGUMENTS, { environment, stdio });
  } finally {
    const currentWorkspace = fs.readFileSync(workspacePath);
    if (!currentWorkspace.equals(originalWorkspace)) {
      const stripped = stripPnpmBuildPlaceholders(currentWorkspace.toString('utf8'));
      const normalize = (value) => value.replaceAll('\r\n', '\n');
      if (normalize(stripped) !== normalize(originalWorkspace.toString('utf8'))) {
        fail('pnpm install changed pnpm-workspace.yaml beyond build-review placeholders');
      }
      fs.writeFileSync(workspacePath, originalWorkspace);
    }
  }
}

export function ensureWorktreeDependencies(options) {
  const root = fs.realpathSync.native(path.resolve(options.worktree));
  const workspacePackages = discoverWorkspacePackages(root);
  const runtime = inspectRuntimeEnvironment(root);
  const snapshot = createDependencySnapshot({
    root,
    inputPaths: collectDependencyInputPaths(root, workspacePackages),
    environment: runtime.environment,
  });
  const stateDirectory = path.join(gitDirectory(root), 'schedule-worktree-state');
  const markerPath = path.join(stateDirectory, 'dependencies-v1.json');
  const lockPath = path.join(stateDirectory, 'dependency-install.lock');
  const allowGlobalVirtualStore =
    runtime.environment.layout.enableGlobalVirtualStore.toLocaleLowerCase('en-US') === 'true';
  const getHealth = () =>
    inspectDependencyHealth({
      root,
      storePath: runtime.storePath,
      workspacePackages,
      allowGlobalVirtualStore,
      expectedPnpmVersion: runtime.environment.pnpmVersion,
    });
  return {
    ...ensureDependencyState({
      markerPath,
      lockPath,
      snapshot,
      getHealth,
      install: () =>
        installDependencies(root, options.json ? ['ignore', 'pipe', 'pipe'] : 'inherit'),
      checkOnly: options.checkOnly,
      adoptHealthyExisting: options.adoptHealthyExisting,
      onInstallRequired: (reasons) => {
        for (const reason of reasons) {
          const message = `DEPENDENCY_INVALIDATION_REASON=${reason}`;
          if (options.json) console.error(message);
          else console.log(message);
        }
      },
    }),
    fingerprint: snapshot.fingerprint,
  };
}

function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const result = ensureWorktreeDependencies(options);
  if (options.json) console.log(JSON.stringify(result));
  else {
    console.log(`DEPENDENCIES_REUSED=${result.dependenciesReused ? 'true' : 'false'}`);
    console.log(`DEPENDENCIES_INSTALLED=${result.installed ? 'true' : 'false'}`);
    console.log(`DEPENDENCIES_ADOPTED=${result.adopted ? 'true' : 'false'}`);
    console.log(`DEPENDENCY_FINGERPRINT=${result.fingerprint}`);
  }
  return result;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
