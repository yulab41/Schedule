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
  inspectDependencyHealth,
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
  assert.equal(projectHome, path.resolve(REPOSITORY_ROOT, '..', '..', '..'));
  assert.equal(state.projectHome, projectHome);
  assert.equal(state.fingerprintRoot.startsWith(path.join(projectHome, 'runtime', 'codex', 'fingerprints')), true);
  assert.equal(state.dependencyMarkerPath.includes(`${path.sep}.git${path.sep}`), false);
  assert.equal(resolveProjectLocalStorePath(projectHome), path.join(projectHome, 'runtime', 'pnpm-store'));
});

test('uses a frozen prefer-offline install only in separately authorized maintenance mode', () => {
  assert.deepEqual(PNPM_INSTALL_ARGUMENTS, [
    'install',
    '--frozen-lockfile',
    '--prefer-offline',
    '--config.strictDepBuilds=false',
  ]);
  assert.equal(PNPM_INSTALL_ARGUMENTS.includes('--offline'), false);
  assert.equal(PNPM_INSTALL_ARGUMENTS.includes('--force'), false);
  assert.equal(PNPM_INSTALL_ARGUMENTS.some((value) => value === 'store'), false);
});

test('passes dependency-maintenance options to the PowerShell wrapper as named parameters', () => {
  const wrapper = fs.readFileSync(
    path.join(REPOSITORY_ROOT, 'scripts/codex/dependency-maintenance.ps1'),
    'utf8',
  );
  assert.match(wrapper, /\$arguments\s*=\s*@\{/u);
  assert.match(wrapper, /Mode\s*=\s*'DependencyMaintenance'/u);
  assert.doesNotMatch(wrapper, /\$arguments\s*=\s*@\(/u);
});

test('creates the worktree fingerprint directory before acquiring its maintenance lock', () => {
  const source = fs.readFileSync(
    path.join(REPOSITORY_ROOT, 'scripts/codex/worktree-deps-core.mjs'),
    'utf8',
  );
  const createParent = source.indexOf('fs.mkdirSync(stateDirectory, { recursive: true });');
  const acquireLock = source.indexOf('createExclusiveDirectory(lockPath)');
  assert.notEqual(createParent, -1);
  assert.ok(createParent < acquireLock);
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
