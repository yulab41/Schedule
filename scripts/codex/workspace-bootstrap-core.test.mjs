import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BOOTSTRAP_PROFILES, ensureWorkspaceBootstrap } from './workspace-bootstrap-core.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporaryDirectories = [];

function temporaryDirectory() {
  const runtimeRoot = path.join(REPOSITORY_ROOT, 'runtime');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtimeRoot, 'codex-test-bootstrap-'));
  temporaryDirectories.push(directory);
  return directory;
}

function write(root, relativePath, content = `${relativePath}\n`) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function packageFixture(root, name, dependencyNames = []) {
  const directory = path.join(root, 'packages', name);
  const manifest = {
    name: `@schedule/${name}`,
    version: '1.0.0',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    scripts: { build: 'tsc -p tsconfig.build.json' },
    dependencies: Object.fromEntries(dependencyNames.map((dependency) => [`@schedule/${dependency}`, 'workspace:*'])),
  };
  write(root, `packages/${name}/package.json`, `${JSON.stringify(manifest)}\n`);
  write(root, `packages/${name}/src/index.ts`, `export const ${name.replaceAll('-', '_')} = 1;\n`);
  write(root, `packages/${name}/tsconfig.json`, '{}\n');
  write(root, `packages/${name}/tsconfig.build.json`, '{}\n');
  return { directory, manifest };
}

test.after(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

test('Mini profile contains only the three required producers', () => {
  assert.deepEqual(BOOTSTRAP_PROFILES.mini, [
    '@schedule/contracts',
    '@schedule/client-core',
    '@schedule/presentation-core',
  ]);
  assert.deepEqual(BOOTSTRAP_PROFILES.root.length, 7);
});

test('bootstraps topologically once, then reuses unchanged outputs', () => {
  const root = temporaryDirectory();
  write(root, 'tsconfig.base.json', '{}\n');
  const workspacePackages = [
    packageFixture(root, 'contracts'),
    packageFixture(root, 'client-core', ['contracts']),
    packageFixture(root, 'presentation-core'),
  ];
  const markerPath = path.join(root, '.state', 'workspace-bootstrap.json');
  const lockPath = path.join(root, '.state', 'workspace-bootstrap.lock');
  const built = [];
  const buildPackage = (workspacePackage) => {
    built.push(workspacePackage.manifest.name);
    write(workspacePackage.directory, 'dist/index.js', 'export const built = true;\n');
    write(workspacePackage.directory, 'dist/index.d.ts', 'export declare const built: true;\n');
  };
  const first = ensureWorkspaceBootstrap({
    root,
    profile: 'mini',
    workspacePackages,
    markerPath,
    lockPath,
    nodeVersion: 'v24.14.0',
    typescriptVersion: '5.9.3',
    buildPackage,
  });
  assert.deepEqual(first.built, [
    '@schedule/contracts',
    '@schedule/client-core',
    '@schedule/presentation-core',
  ]);
  assert.deepEqual(built, first.built);
  built.length = 0;
  const second = ensureWorkspaceBootstrap({
    root,
    profile: 'mini',
    workspacePackages,
    markerPath,
    lockPath,
    nodeVersion: 'v24.14.0',
    typescriptVersion: '5.9.3',
    buildPackage,
  });
  assert.deepEqual(second.built, []);
  assert.deepEqual(second.reused, first.built);
  assert.deepEqual(built, []);
  fs.appendFileSync(path.join(root, 'packages/contracts/src/index.ts'), 'export const v2 = 2;\n');
  const changed = ensureWorkspaceBootstrap({
    root,
    profile: 'mini',
    workspacePackages,
    markerPath,
    lockPath,
    nodeVersion: 'v24.14.0',
    typescriptVersion: '5.9.3',
    buildPackage,
  });
  assert.deepEqual(changed.built, ['@schedule/contracts', '@schedule/client-core']);
  assert.deepEqual(changed.reused, ['@schedule/presentation-core']);
});
