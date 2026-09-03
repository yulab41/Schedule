import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PNPM_INSTALL_ARGUMENTS,
  collectDependencyInputPaths,
  createDependencySnapshot,
  diffDependencySnapshots,
  ensureDependencyState,
  inspectDependencyHealth,
  sanitizePnpmConfigValue,
} from './worktree-deps-core.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

function createTemporaryDirectory() {
  const runtimeRoot = path.join(REPOSITORY_ROOT, 'runtime');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtimeRoot, 'test-worktree-deps-'));
  temporaryDirectories.push(directory);
  return directory;
}

function write(root, relativePath, content = `${relativePath}\n`) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function createSnapshotFixture() {
  const root = createTemporaryDirectory();
  for (const relativePath of [
    '.npmrc',
    '.pnpmfile.cjs',
    'package.json',
    'packages/a/package.json',
    'packages/b/package.json',
    'patches/example.patch',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ]) {
    write(root, relativePath);
  }
  write(root, 'apps/web/src/unrelated.ts', 'business source\n');

  const environment = {
    architecture: 'x64',
    nodeVersion: 'v24.14.0',
    os: 'win32-10.0.26100',
    pnpmVersion: '11.9.0',
    storePathHash: 'store-a',
    storeVolume: 'e:',
    layout: {
      enableGlobalVirtualStore: 'undefined',
      nodeLinker: 'undefined',
      packageImportMethod: 'undefined',
      sideEffectsCache: 'undefined',
      virtualStoreType: 'undefined',
    },
  };
  const inputPaths = [
    '.npmrc',
    '.pnpmfile.cjs',
    'package.json',
    'packages/a/package.json',
    'packages/b/package.json',
    'patches/example.patch',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ];
  return { environment, inputPaths, root };
}

function createHealthyNodeModules(root) {
  const storePath = path.join(root, '.store');
  const virtualStorePath = path.join(root, 'node_modules', '.pnpm');
  const binPath = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(storePath, { recursive: true });
  fs.mkdirSync(virtualStorePath, { recursive: true });
  fs.mkdirSync(binPath, { recursive: true });
  for (const executable of ['eslint.CMD', 'prettier.CMD', 'tsc.CMD', 'vitest.CMD']) {
    write(root, path.join('node_modules', '.bin', executable), '@exit /b 0\n');
  }

  write(root, 'packages/a/package.json', JSON.stringify({ name: '@schedule/a', version: '1.0.0' }));
  write(
    root,
    'packages/b/package.json',
    JSON.stringify({
      dependencies: { '@schedule/a': 'workspace:*' },
      name: '@schedule/b',
      version: '1.0.0',
    }),
  );
  const workspaceLink = path.join(root, 'packages/b/node_modules/@schedule/a');
  fs.mkdirSync(path.dirname(workspaceLink), { recursive: true });
  fs.symlinkSync(path.join(root, 'packages/a'), workspaceLink, 'junction');

  write(
    root,
    'node_modules/.modules.yaml',
    `${JSON.stringify({
      nodeLinker: 'isolated',
      packageManager: 'pnpm@11.9.0',
      storeDir: storePath,
      virtualStoreDir: virtualStorePath,
    })}\n`,
  );

  return {
    storePath,
    workspacePackages: [
      {
        directory: path.join(root, 'packages/a'),
        manifest: { name: '@schedule/a', version: '1.0.0' },
      },
      {
        directory: path.join(root, 'packages/b'),
        manifest: {
          dependencies: { '@schedule/a': 'workspace:*' },
          name: '@schedule/b',
          version: '1.0.0',
        },
      },
    ],
  };
}

describe('dependency fingerprint', () => {
  it('uses a frozen offline install without force or store mutation', () => {
    expect(PNPM_INSTALL_ARGUMENTS).toEqual([
      'install',
      '--frozen-lockfile',
      '--offline',
      '--config.strictDepBuilds=false',
    ]);
    expect(PNPM_INSTALL_ARGUMENTS).not.toContain('--force');
    expect(PNPM_INSTALL_ARGUMENTS.join(' ')).not.toMatch(/store\s+(prune|delete)/iu);
  });

  it('hashes an absolute storeDir config before it can enter a local marker', () => {
    const sanitized = sanitizePnpmConfigValue('storeDir', 'Z:\\example-store');
    expect(sanitized).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(sanitized).not.toContain('Z:');
    expect(sanitizePnpmConfigValue('nodeLinker', 'isolated')).toBe('isolated');
  });

  it('includes every root .pnpmfile.* hook without assuming an extension', () => {
    const root = createTemporaryDirectory();
    write(root, 'package.json', '{"name":"root"}\n');
    write(root, '.pnpmfile.custom-hook', 'module.exports = {};\n');
    const workspacePackages = [
      {
        directory: root,
        manifestPath: path.join(root, 'package.json'),
        manifest: { name: 'root' },
      },
    ];

    expect(collectDependencyInputPaths(root, workspacePackages)).toContain('.pnpmfile.custom-hook');
  });

  it('ignores conversation, Git SHA, branch, origin movement, and ordinary source changes', () => {
    const fixture = createSnapshotFixture();
    const first = createDependencySnapshot(fixture);

    write(fixture.root, 'apps/web/src/unrelated.ts', 'changed business source\n');
    write(fixture.root, 'docs/conversation-id.txt', 'new conversation\n');
    const second = createDependencySnapshot(fixture);

    expect(second.fingerprint).toBe(first.fingerprint);
    expect(diffDependencySnapshots(first, second)).toEqual([]);
  });

  it.each([
    ['pnpm-lock.yaml', 'lockfile'],
    ['packages/a/package.json', 'workspace manifest'],
    ['pnpm-workspace.yaml', 'pnpm workspace config'],
    ['patches/example.patch', 'patch'],
    ['.pnpmfile.cjs', 'pnpm hook'],
  ])('invalidates when %s changes (%s)', (relativePath) => {
    const fixture = createSnapshotFixture();
    const first = createDependencySnapshot(fixture);
    fs.appendFileSync(path.join(fixture.root, relativePath), 'changed\n');
    const second = createDependencySnapshot(fixture);

    expect(second.fingerprint).not.toBe(first.fingerprint);
    expect(diffDependencySnapshots(first, second)).toContain(`input:${relativePath}:changed`);
  });

  it.each([
    ['nodeVersion', 'v25.0.0'],
    ['pnpmVersion', '11.10.0'],
    ['architecture', 'arm64'],
    ['storePathHash', 'store-b'],
  ])('invalidates when environment.%s changes', (key, value) => {
    const fixture = createSnapshotFixture();
    const first = createDependencySnapshot(fixture);
    const second = createDependencySnapshot({
      ...fixture,
      environment: { ...fixture.environment, [key]: value },
    });

    expect(diffDependencySnapshots(first, second)).toContain(`environment:${key}:changed`);
  });

  it('invalidates when a pnpm layout setting changes', () => {
    const fixture = createSnapshotFixture();
    const first = createDependencySnapshot(fixture);
    const second = createDependencySnapshot({
      ...fixture,
      environment: {
        ...fixture.environment,
        layout: { ...fixture.environment.layout, nodeLinker: 'hoisted' },
      },
    });

    expect(diffDependencySnapshots(first, second)).toContain(
      'environment:layout.nodeLinker:changed',
    );
  });
});

describe('dependency health and installation state', () => {
  it('requires modules metadata, root executables, local workspace links, and an accessible store', () => {
    const root = createTemporaryDirectory();
    const { storePath, workspacePackages } = createHealthyNodeModules(root);

    expect(inspectDependencyHealth({ root, storePath, workspacePackages })).toEqual({
      healthy: true,
      reasons: [],
    });

    fs.rmSync(path.join(root, 'node_modules/.bin/vitest.CMD'));
    expect(inspectDependencyHealth({ root, storePath, workspacePackages })).toMatchObject({
      healthy: false,
      reasons: expect.arrayContaining(['root-executable-missing:vitest.CMD']),
    });
  });

  it('rejects a workspace link that resolves outside the current worktree', () => {
    const root = createTemporaryDirectory();
    const { storePath, workspacePackages } = createHealthyNodeModules(root);
    const outside = createTemporaryDirectory();
    const link = path.join(root, 'packages/b/node_modules/@schedule/a');
    fs.rmSync(link, { force: true, recursive: true });
    fs.symlinkSync(outside, link, 'junction');

    expect(inspectDependencyHealth({ root, storePath, workspacePackages })).toMatchObject({
      healthy: false,
      reasons: expect.arrayContaining(['workspace-link-wrong-target:@schedule/b->@schedule/a']),
    });
  });

  it('reuses an equal healthy marker without invoking install', () => {
    const fixture = createSnapshotFixture();
    const snapshot = createDependencySnapshot(fixture);
    const stateRoot = createTemporaryDirectory();
    const markerPath = path.join(stateRoot, 'dependencies.json');
    const lockPath = path.join(stateRoot, 'install.lock');
    fs.writeFileSync(markerPath, `${JSON.stringify(snapshot)}\n`, 'utf8');
    const install = vi.fn();

    const result = ensureDependencyState({
      getHealth: () => ({ healthy: true, reasons: [] }),
      install,
      lockPath,
      markerPath,
      snapshot,
    });

    expect(result).toMatchObject({ dependenciesReused: true, installed: false });
    expect(install).not.toHaveBeenCalled();
  });

  it('runs exactly one install on a fingerprint change and writes the marker only after health passes', () => {
    const fixture = createSnapshotFixture();
    const previous = createDependencySnapshot(fixture);
    fs.appendFileSync(path.join(fixture.root, 'pnpm-lock.yaml'), 'changed\n');
    const current = createDependencySnapshot(fixture);
    const stateRoot = createTemporaryDirectory();
    const markerPath = path.join(stateRoot, 'dependencies.json');
    const lockPath = path.join(stateRoot, 'install.lock');
    fs.writeFileSync(markerPath, `${JSON.stringify(previous)}\n`, 'utf8');
    const install = vi.fn();

    const result = ensureDependencyState({
      getHealth: () => ({ healthy: true, reasons: [] }),
      install,
      lockPath,
      markerPath,
      snapshot: current,
    });

    expect(install).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ dependenciesReused: false, installed: true });
    expect(JSON.parse(fs.readFileSync(markerPath, 'utf8')).fingerprint).toBe(current.fingerprint);
  });

  it('does not forge a successful marker when install fails', () => {
    const fixture = createSnapshotFixture();
    const snapshot = createDependencySnapshot(fixture);
    const stateRoot = createTemporaryDirectory();
    const markerPath = path.join(stateRoot, 'dependencies.json');
    const lockPath = path.join(stateRoot, 'install.lock');

    expect(() =>
      ensureDependencyState({
        getHealth: () => ({ healthy: true, reasons: [] }),
        install: () => {
          throw new Error('controlled install failure');
        },
        lockPath,
        markerPath,
        snapshot,
      }),
    ).toThrow(/controlled install failure/u);
    expect(fs.existsSync(markerPath)).toBe(false);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('does not adopt a corrupted marker as though it were absent', () => {
    const fixture = createSnapshotFixture();
    const snapshot = createDependencySnapshot(fixture);
    const stateRoot = createTemporaryDirectory();
    const markerPath = path.join(stateRoot, 'dependencies.json');
    const lockPath = path.join(stateRoot, 'install.lock');
    fs.writeFileSync(markerPath, '{not-json', 'utf8');
    const install = vi.fn();

    const result = ensureDependencyState({
      adoptHealthyExisting: true,
      getHealth: () => ({ healthy: true, reasons: [] }),
      install,
      lockPath,
      markerPath,
      snapshot,
    });

    expect(result.installed).toBe(true);
    expect(result.adopted).toBe(false);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it('fails closed when another install owns the worktree lock', () => {
    const fixture = createSnapshotFixture();
    const snapshot = createDependencySnapshot(fixture);
    const stateRoot = createTemporaryDirectory();
    const markerPath = path.join(stateRoot, 'dependencies.json');
    const lockPath = path.join(stateRoot, 'install.lock');
    fs.mkdirSync(lockPath, { recursive: true });

    expect(() =>
      ensureDependencyState({
        getHealth: () => ({ healthy: true, reasons: [] }),
        install: vi.fn(),
        lockPath,
        markerPath,
        snapshot,
      }),
    ).toThrow(/install lock/u);
  });
});
