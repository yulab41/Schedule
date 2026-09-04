/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  discoverWorkspacePackages,
  ensureWorktreeDependencies,
  resolvePnpmInvocation,
} from './worktree-deps-core.mjs';

export const BOOTSTRAP_MARKER_SCHEMA_VERSION = 2;
export const BOOTSTRAP_PROFILES = Object.freeze({
  mini: ['@schedule/contracts', '@schedule/client-core', '@schedule/presentation-core'],
  api: ['@schedule/contracts', '@schedule/database', '@schedule/scheduling-domain', '@schedule/test-fixtures'],
  web: [
    '@schedule/contracts',
    '@schedule/client-core',
    '@schedule/presentation-core',
    '@schedule/scheduling-domain',
    '@schedule/ui-tokens',
  ],
  root: [
    '@schedule/contracts',
    '@schedule/client-core',
    '@schedule/presentation-core',
    '@schedule/database',
    '@schedule/scheduling-domain',
    '@schedule/test-fixtures',
    '@schedule/ui-tokens',
  ],
  release: [
    '@schedule/contracts',
    '@schedule/client-core',
    '@schedule/presentation-core',
    '@schedule/database',
    '@schedule/scheduling-domain',
    '@schedule/test-fixtures',
    '@schedule/ui-tokens',
  ],
});

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const BOOTSTRAP_STATE_DIRECTORY = 'schedule-worktree-state';
const BOOTSTRAP_MARKER = 'workspace-bootstrap-v2.json';
const BOOTSTRAP_LOCK = 'workspace-bootstrap.lock';

function fail(message, code = 'SCHEDULE_BOOTSTRAP_ERROR') {
  const error = new Error(`[schedule:bootstrap] ${message}`);
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

function collectFiles(directory, root, predicate = () => true, results = []) {
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'runtime', 'dist'].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolutePath, root, predicate, results);
    else if (entry.isFile() && predicate(absolutePath)) {
      results.push(normalizeRelativePath(path.relative(root, absolutePath)));
    }
  }
  return results;
}

function workspaceDependencies(workspacePackage, packagesByName) {
  const names = [];
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, specifier] of Object.entries(workspacePackage.manifest[section] ?? {})) {
      if (typeof specifier === 'string' && specifier.startsWith('workspace:') && packagesByName.has(name)) {
        names.push(name);
      }
    }
  }
  return [...new Set(names)].sort((left, right) => left.localeCompare(right, 'en'));
}

export function resolveProfile(profile, packagesByName) {
  const requested = BOOTSTRAP_PROFILES[profile];
  if (requested === undefined) fail(`unknown bootstrap profile: ${profile}`);
  const ordered = [];
  const visited = new Set();
  const active = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    if (active.has(name)) fail(`workspace dependency cycle includes ${name}`);
    const workspacePackage = packagesByName.get(name);
    if (!workspacePackage) fail(`profile package is missing: ${name}`);
    active.add(name);
    for (const dependency of workspaceDependencies(workspacePackage, packagesByName)) visit(dependency);
    active.delete(name);
    visited.add(name);
    ordered.push(name);
  }
  for (const name of requested) visit(name);
  return ordered;
}

function packageInputPaths(root, workspacePackage) {
  const inputs = new Set();
  const relativeDirectory = normalizeRelativePath(path.relative(root, workspacePackage.directory));
  const addIfFile = (relativePath) => {
    if (fs.existsSync(path.join(root, relativePath))) inputs.add(normalizeRelativePath(relativePath));
  };
  addIfFile('tsconfig.base.json');
  addIfFile(path.join(relativeDirectory, 'package.json'));
  for (const entry of fs.readdirSync(workspacePackage.directory, { withFileTypes: true })) {
    if (entry.isFile() && /^tsconfig(?:\.[^.]+)?\.json$/u.test(entry.name)) {
      addIfFile(path.join(relativeDirectory, entry.name));
    }
  }
  for (const folder of ['src', 'scripts']) {
    for (const relativePath of collectFiles(path.join(workspacePackage.directory, folder), root)) {
      inputs.add(relativePath);
    }
  }
  return [...inputs].sort((left, right) => left.localeCompare(right, 'en'));
}

function hashInputs(root, inputPaths) {
  return inputPaths.map((relativePath) => ({
    path: relativePath,
    sha256: sha256(fs.readFileSync(path.join(root, relativePath))),
  }));
}

function buildPackageStates({ root, orderedNames, packagesByName, nodeVersion, typescriptVersion }) {
  const states = {};
  for (const name of orderedNames) {
    const workspacePackage = packagesByName.get(name);
    const upstream = Object.fromEntries(
      workspaceDependencies(workspacePackage, packagesByName)
        .filter((dependency) => states[dependency] !== undefined)
        .map((dependency) => [dependency, states[dependency].fingerprint]),
    );
    const state = {
      inputs: hashInputs(root, packageInputPaths(root, workspacePackage)),
      nodeVersion,
      typescriptVersion,
      buildScript: workspacePackage.manifest.scripts?.build ?? null,
      upstream,
    };
    states[name] = { ...state, fingerprint: sha256(stableJson(state)) };
  }
  return states;
}

function exportedDistEntries(value, results = new Set()) {
  if (typeof value === 'string') {
    const normalized = normalizeRelativePath(value);
    if (normalized.startsWith('dist/')) results.add(normalized);
  } else if (Array.isArray(value)) {
    for (const nested of value) exportedDistEntries(nested, results);
  } else if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) exportedDistEntries(nested, results);
  }
  return results;
}

function requiredOutputs(manifest) {
  const outputs = new Set();
  for (const value of [manifest.main, manifest.module, manifest.types, manifest.exports]) {
    exportedDistEntries(value, outputs);
  }
  return [...outputs].sort((left, right) => left.localeCompare(right, 'en'));
}

export function inspectPackageOutputs(root, workspacePackage) {
  const reasons = [];
  for (const relativePath of requiredOutputs(workspacePackage.manifest)) {
    if (!fs.existsSync(path.join(workspacePackage.directory, relativePath))) {
      reasons.push(`output-missing:${relativePath}`);
    }
  }
  const outputPaths = [
    ...collectFiles(path.join(workspacePackage.directory, 'dist'), root),
    ...fs.readdirSync(workspacePackage.directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tsbuildinfo'))
      .map((entry) => normalizeRelativePath(path.relative(root, path.join(workspacePackage.directory, entry.name)))),
  ].sort((left, right) => left.localeCompare(right, 'en'));
  return {
    healthy: reasons.length === 0,
    outputs: outputPaths.map((relativePath) => ({
      path: normalizeRelativePath(path.relative(workspacePackage.directory, path.join(root, relativePath))),
      sha256: sha256(fs.readFileSync(path.join(root, relativePath))),
    })),
    reasons,
  };
}

function compareOutputs(previousOutputs, currentOutputs) {
  const previous = new Map((previousOutputs ?? []).map((entry) => [entry.path, entry.sha256]));
  const current = new Map(currentOutputs.map((entry) => [entry.path, entry.sha256]));
  const reasons = [];
  for (const outputPath of [...new Set([...previous.keys(), ...current.keys()])].sort()) {
    if (!previous.has(outputPath)) reasons.push(`output-added:${outputPath}`);
    else if (!current.has(outputPath)) reasons.push(`output-missing:${outputPath}`);
    else if (previous.get(outputPath) !== current.get(outputPath)) reasons.push(`output-changed:${outputPath}`);
  }
  return reasons;
}

function readMarker(markerPath) {
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    return marker.schemaVersion === BOOTSTRAP_MARKER_SCHEMA_VERSION ? marker : undefined;
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

export function ensureWorkspaceBootstrap({
  root,
  profile,
  workspacePackages,
  markerPath,
  lockPath,
  nodeVersion,
  typescriptVersion,
  buildPackage,
  onPackageDecision = () => {},
}) {
  const packagesByName = new Map(workspacePackages.map((workspacePackage) => [workspacePackage.manifest.name, workspacePackage]));
  const orderedNames = resolveProfile(profile, packagesByName);
  const packageStates = buildPackageStates({ root, orderedNames, packagesByName, nodeVersion, typescriptVersion });
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    fs.mkdirSync(lockPath, { recursive: false });
  } catch (error) {
    if (error?.code === 'EEXIST') return undefined;
    throw error;
  }
  const result = { taskStatus: 'READY_BOOTSTRAP', built: [], reasons: {}, reused: [] };
  try {
    writeJsonAtomic(path.join(lockPath, 'owner.json'), {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      profile,
    });
    const marker = readMarker(markerPath) ?? { schemaVersion: BOOTSTRAP_MARKER_SCHEMA_VERSION, packages: {} };
    for (const name of orderedNames) {
      const workspacePackage = packagesByName.get(name);
      const state = packageStates[name];
      const previous = marker.packages[name];
      const outputHealth = inspectPackageOutputs(root, workspacePackage);
      const reasons = [];
      if (previous === undefined) reasons.push('marker-missing');
      else if (previous.fingerprint !== state.fingerprint) reasons.push('source-fingerprint-changed');
      reasons.push(...outputHealth.reasons);
      if (previous !== undefined && outputHealth.healthy) reasons.push(...compareOutputs(previous.outputs, outputHealth.outputs));
      const uniqueReasons = [...new Set(reasons)].sort();
      result.reasons[name] = uniqueReasons;
      if (uniqueReasons.length === 0) {
        result.reused.push(name);
        onPackageDecision({ action: 'reused', name, reasons: [] });
        continue;
      }
      onPackageDecision({ action: 'build', name, reasons: uniqueReasons });
      buildPackage(workspacePackage);
      const builtOutputs = inspectPackageOutputs(root, workspacePackage);
      if (!builtOutputs.healthy) fail(`${name} output health failed after build: ${builtOutputs.reasons.join(', ')}`);
      marker.packages[name] = {
        ...state,
        builtAt: new Date().toISOString(),
        outputs: builtOutputs.outputs,
      };
      writeJsonAtomic(markerPath, marker);
      result.built.push(name);
    }
    return result;
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
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    fail(`${command} ${arguments_.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout ?? '';
}

function gitDirectory(root) {
  return path.resolve(run('git', ['rev-parse', '--absolute-git-dir'], { cwd: root }).trim());
}

function runPnpm(root, arguments_, options = {}) {
  const invocation = resolvePnpmInvocation(options.environment ?? process.env);
  return run(invocation.command, [...invocation.argumentsPrefix, ...arguments_], {
    cwd: root,
    env: options.environment,
    stdio: options.stdio,
  });
}

export function ensureWorkspaceBootstrapForWorktree(options) {
  const root = path.resolve(options.worktree ?? process.cwd());
  const dependencyState = ensureWorktreeDependencies({ worktree: root, mode: 'ReuseOnly', leaseToken: options.leaseToken, json: true });
  if (!['READY_REUSE', 'READY_INSTALLED'].includes(dependencyState.taskStatus) || !dependencyState.dependenciesReused) {
    return {
      taskStatus: dependencyState.taskStatus,
      dependenciesReused: false,
      installInvoked: false,
      worktreeCreated: false,
      profile: options.profile,
      reasons: dependencyState.reasons,
    };
  }
  const workspacePackages = discoverWorkspacePackages(root);
  let typescriptVersion;
  try {
    typescriptVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'typescript', 'package.json'), 'utf8')).version;
  } catch {
    return {
      taskStatus: 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV',
      dependenciesReused: false,
      installInvoked: false,
      worktreeCreated: false,
      profile: options.profile,
      reasons: ['typescript-package-missing'],
    };
  }
  const stateDirectory = path.join(gitDirectory(root), BOOTSTRAP_STATE_DIRECTORY);
  const result = ensureWorkspaceBootstrap({
    root,
    profile: options.profile,
    workspacePackages,
    markerPath: path.join(stateDirectory, BOOTSTRAP_MARKER),
    lockPath: path.join(stateDirectory, BOOTSTRAP_LOCK),
    nodeVersion: process.version,
    typescriptVersion,
    buildPackage: (workspacePackage) => runPnpm(root, ['--filter', workspacePackage.manifest.name, 'run', 'build'], {
      stdio: options.json ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    }),
    onPackageDecision: ({ action, name, reasons }) => {
      if (options.json) return;
      if (action === 'reused') console.log(`WORKSPACE_PACKAGE_REUSED=${name}`);
      else {
        console.log(`WORKSPACE_PACKAGE_BUILD=${name}`);
        for (const reason of reasons) console.log(`WORKSPACE_BOOTSTRAP_REASON=${name}:${reason}`);
      }
    },
  });
  if (result === undefined) {
    return {
      taskStatus: 'POOL_BUSY',
      dependenciesReused: true,
      installInvoked: false,
      worktreeCreated: false,
      profile: options.profile,
      reasons: ['workspace-bootstrap-lock-present'],
    };
  }
  return {
    ...result,
    dependenciesReused: true,
    installInvoked: false,
    worktreeCreated: false,
    profile: options.profile,
  };
}

function parseArguments(arguments_) {
  const options = { json: false, leaseToken: undefined, profile: undefined, worktree: process.cwd() };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--json') options.json = true;
    else if (['--profile', '--worktree', '--lease-token'].includes(argument)) {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) fail(`${argument} requires a value`);
      if (argument === '--profile') options.profile = value;
      else if (argument === '--worktree') options.worktree = value;
      else options.leaseToken = value;
      index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!options.profile) fail('--profile is required');
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
  console.log(`WORKSPACE_BOOTSTRAP_BUILT=${(result.built ?? []).join(',')}`);
  console.log(`WORKSPACE_BOOTSTRAP_REUSED=${(result.reused ?? []).join(',')}`);
  for (const reason of result.reasons ?? []) console.log(`INVALIDATION_REASON=${reason}`);
}

export function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const result = ensureWorkspaceBootstrapForWorktree(options);
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
