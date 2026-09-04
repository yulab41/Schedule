import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PNPM_INSTALL_ARGUMENTS,
  collectDependencyInputPaths,
  createDependencySnapshot,
  diffDependencySnapshots,
  findL2ReconciliationAttempt,
  inspectDependencyHealth,
  inspectRuntimeEnvironment,
  maintenanceCommandArguments,
  maintenanceCommandHash,
  recordL2ReconciliationAttempt,
  resolveCanonicalProjectHome,
  resolveProjectLocalState,
  resolveProjectLocalStorePath,
} from './worktree-deps-core.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporaryDirectories = [];

function temporaryDirectory() {
  const runtimeRoot = path.join(REPOSITORY_ROOT, 'runtime');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtimeRoot, 'codex-test-deps-'));
  temporaryDirectories.push(directory);
  return directory;
}

function write(root, relativePath, content = `${relativePath}\n`) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

test.after(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

test('derives project-local state from the Git common directory, not linked-worktree admin state', () => {
  const projectHome = resolveCanonicalProjectHome(REPOSITORY_ROOT);
  const state = resolveProjectLocalState(REPOSITORY_ROOT);
  assert.equal(state.projectHome, projectHome);
  assert.equal(state.fingerprintRoot.startsWith(path.join(projectHome, 'runtime', 'codex', 'fingerprints')), true);
  assert.equal(state.dependencyMarkerPath.includes(`${path.sep}.git${path.sep}`), false);
  assert.equal(resolveProjectLocalStorePath(projectHome), path.join(projectHome, 'runtime', 'pnpm-store'));
});

test('inspects the versioned project-local store selected by maintenance', () => {
  const projectHome = resolveCanonicalProjectHome(REPOSITORY_ROOT);
  const targetStorePath = resolveProjectLocalStorePath(projectHome);
  const runtime = inspectRuntimeEnvironment(REPOSITORY_ROOT, { projectHome });
  assert.equal(runtime.targetStorePath, targetStorePath);
  assert.equal(runtime.storePath.startsWith(`${targetStorePath}${path.sep}`), true);
});

test('binds maintenance commands to the project-local store and exact worktree', () => {
  const storePath = resolveProjectLocalStorePath(REPOSITORY_ROOT);
  const arguments_ = maintenanceCommandArguments({ root: REPOSITORY_ROOT, storePath });
  assert.deepEqual(arguments_, [
    'install',
    '--frozen-lockfile',
    '--offline',
    '--config.strictDepBuilds=false',
    `--store-dir=${storePath.toLocaleLowerCase('en-US')}`,
  ]);
  assert.match(maintenanceCommandHash({ commonDir: path.join(REPOSITORY_ROOT, '.git'), root: REPOSITORY_ROOT, storePath }), /^[0-9a-f]{64}$/u);
});

test('records one L2 frozen reconciliation attempt per complete fingerprint', () => {
  const auditPath = path.join(temporaryDirectory(), 'runtime', 'codex', 'l2-reconciliation-v1.json');
  const fingerprint = 'a'.repeat(64);
  const initial = {
    fingerprint,
    installInvoked: true,
    startedAt: '2026-09-05T00:00:00.000Z',
    status: 'started',
  };
  recordL2ReconciliationAttempt(auditPath, initial);
  recordL2ReconciliationAttempt(auditPath, {
    ...initial,
    completedAt: '2026-09-05T00:00:01.000Z',
    status: 'ready-reuse',
  });
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  assert.equal(audit.schemaVersion, 1);
  assert.equal(audit.attempts.length, 1);
  assert.equal(findL2ReconciliationAttempt(audit, fingerprint).status, 'ready-reuse');
});

test('uses an offline install argument list only in separately authorized maintenance mode', () => {
  assert.deepEqual(PNPM_INSTALL_ARGUMENTS, [
    'install',
    '--frozen-lockfile',
    '--offline',
    '--config.strictDepBuilds=false',
  ]);
  assert.equal(PNPM_INSTALL_ARGUMENTS.includes('--force'), false);
  assert.equal(PNPM_INSTALL_ARGUMENTS.some((value) => value === 'store'), false);
});

test('fingerprint inputs ignore ordinary source while detecting dependency inputs', () => {
  const root = temporaryDirectory();
  for (const relativePath of [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.npmrc',
    '.pnpmfile.cjs',
    'patches/example.patch',
    'packages/a/package.json',
  ]) write(root, relativePath);
  write(root, 'apps/web/src/business.ts', 'v1\n');
  const inputPaths = collectDependencyInputPaths(root, [{ manifestPath: path.join(root, 'packages/a/package.json') }]);
  const environment = {
    architecture: 'x64',
    nodeVersion: 'v24.14.0',
    os: 'win32-test',
    pnpmVersion: '11.9.0',
    storePathHash: 'store-a',
    storeVolume: 'e:',
    layout: { enableGlobalVirtualStore: 'undefined', nodeLinker: 'undefined' },
  };
  const first = createDependencySnapshot({ root, inputPaths, environment });
  write(root, 'apps/web/src/business.ts', 'v2\n');
  const sourceOnly = createDependencySnapshot({ root, inputPaths, environment });
  assert.equal(sourceOnly.fingerprint, first.fingerprint);
  fs.appendFileSync(path.join(root, 'pnpm-lock.yaml'), 'changed\n');
  const lockChanged = createDependencySnapshot({ root, inputPaths, environment });
  assert.ok(diffDependencySnapshots(first, lockChanged).includes('input:pnpm-lock.yaml:changed'));
});

test('health checks require the worktree metadata, store, and root executables', () => {
  const root = temporaryDirectory();
  const storePath = path.join(root, '.pnpm-store');
  const virtualStorePath = path.join(root, 'node_modules', '.pnpm');
  fs.mkdirSync(storePath, { recursive: true });
  fs.mkdirSync(virtualStorePath, { recursive: true });
  for (const executable of ['eslint.CMD', 'prettier.CMD', 'tsc.CMD', 'vitest.CMD']) {
    write(root, `node_modules/.bin/${executable}`, '@echo off\n');
  }
  const packageA = path.join(root, 'packages', 'a');
  const packageB = path.join(root, 'packages', 'b');
  write(root, 'packages/a/package.json', JSON.stringify({ name: '@schedule/a', version: '1.0.0' }));
  write(root, 'packages/b/package.json', JSON.stringify({
    name: '@schedule/b',
    version: '1.0.0',
    dependencies: { '@schedule/a': 'workspace:*' },
  }));
  const workspaceLink = path.join(packageB, 'node_modules', '@schedule', 'a');
  fs.mkdirSync(path.dirname(workspaceLink), { recursive: true });
  fs.symlinkSync(packageA, workspaceLink, 'junction');
  write(root, 'node_modules/.modules.yaml', JSON.stringify({
    nodeLinker: 'isolated',
    packageManager: 'pnpm@11.9.0',
    storeDir: storePath,
    virtualStoreDir: virtualStorePath,
  }));
  const healthy = inspectDependencyHealth({
    root,
    storePath,
    workspacePackages: [
      { directory: packageA, manifest: { name: '@schedule/a', version: '1.0.0' } },
      { directory: packageB, manifest: { name: '@schedule/b', version: '1.0.0', dependencies: { '@schedule/a': 'workspace:*' } } },
    ],
    expectedPnpmVersion: '11.9.0',
    platform: 'win32',
  });
  assert.deepEqual(healthy, { healthy: true, reasons: [] });
  write(root, 'node_modules/.modules.yaml', JSON.stringify({
    nodeLinker: 'isolated',
    packageManager: 'pnpm@11.9.0',
    storeDir: path.join(storePath, 'v11'),
    virtualStoreDir: virtualStorePath,
  }));
  const versionedStoreHealthy = inspectDependencyHealth({
    root,
    storePath,
    workspacePackages: [
      { directory: packageA, manifest: { name: '@schedule/a', version: '1.0.0' } },
      { directory: packageB, manifest: { name: '@schedule/b', version: '1.0.0', dependencies: { '@schedule/a': 'workspace:*' } } },
    ],
    expectedPnpmVersion: '11.9.0',
    platform: 'win32',
  });
  assert.deepEqual(versionedStoreHealthy, { healthy: true, reasons: [] });
  fs.rmSync(path.join(root, 'node_modules/.bin/vitest.CMD'));
  const unhealthy = inspectDependencyHealth({
    root,
    storePath,
    workspacePackages: [
      { directory: packageA, manifest: { name: '@schedule/a', version: '1.0.0' } },
      { directory: packageB, manifest: { name: '@schedule/b', version: '1.0.0', dependencies: { '@schedule/a': 'workspace:*' } } },
    ],
    expectedPnpmVersion: '11.9.0',
    platform: 'win32',
  });
  assert.ok(unhealthy.reasons.includes('root-executable-missing:vitest'));
});

test('PowerShell maintenance callers use named forwarding instead of array binding', () => {
  const maintenance = fs.readFileSync(
    path.join(REPOSITORY_ROOT, 'scripts/codex/dependency-maintenance.ps1'),
    'utf8',
  );
  const pool = fs.readFileSync(
    path.join(REPOSITORY_ROOT, 'scripts/codex/manage-worktree-pool.ps1'),
    'utf8',
  );
  assert.match(maintenance, /\$coreParameters\s*=\s*@\{/u);
  assert.match(maintenance, /Mode\s*=\s*'DependencyMaintenance'/u);
  assert.match(maintenance, /coreParameters\.LeaseToken\s*=\s*\$LeaseToken/u);
  assert.match(maintenance, /CurrentMessageAuthorization/u);
  assert.doesNotMatch(maintenance, /\$coreArguments\s*=\s*@\(/u);
  const ensure = fs.readFileSync(
    path.join(REPOSITORY_ROOT, 'scripts/codex/ensure-worktree-deps.ps1'),
    'utf8',
  );
  assert.match(ensure, /CurrentMessageAuthorization/u);
  assert.match(ensure, /current-message-authorization/u);
  assert.match(pool, /\$parameters\s*=\s*@\{/u);
  assert.match(pool, /Mode\s*=\s*'ReuseOnly'/u);
  assert.doesNotMatch(pool, /\$arguments\s*=\s*@\(/u);
});

test('first maintenance and versioned-store health paths are initialized before reuse', () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, 'scripts/codex/worktree-deps-core.mjs'),
    'utf8',
  );
  const stateDirectoryIndex = source.indexOf('fs.mkdirSync(stateDirectory, { recursive: true });');
  const lockIndex = source.indexOf('createExclusiveDirectory(lockPath)');
  assert.ok(stateDirectoryIndex >= 0);
  assert.ok(lockIndex > stateDirectoryIndex);
  assert.match(source, /\['store', 'path', `--store-dir=\$\{targetStorePath\}`\]/u);
  assert.match(source, /npm_config_user_agent:\s*`pnpm\/\$\{pnpmVersion\}/u);
});
