import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* global process */

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEPENDENCY_ENVIRONMENT_SCHEMA_VERSION,
  classifyDependencyEnvironment,
  collectDependencyHealthIssues,
  collectDependencyInputs,
  computeDependencyEnvironmentFingerprint,
  computeDependencyFingerprint,
  normalizePnpmLayoutSettings,
  runDependencyInstallIfNeeded,
} from './dependency-environment.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_RUNTIME_ROOT = path.join(ROOT, 'runtime', 'tmp');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

function createTemporaryDirectory() {
  fs.mkdirSync(TEST_RUNTIME_ROOT, { recursive: true });
  const directory = fs.mkdtempSync(path.join(TEST_RUNTIME_ROOT, 'dependency-environment-'));
  temporaryDirectories.push(directory);
  return directory;
}

function write(root, relativePath, contents = '') {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, 'utf8');
  return absolutePath;
}

function createHealthyFixture() {
  const root = createTemporaryDirectory();
  const workspacePackage = path.join(root, 'packages', 'fixture');
  const storePath = path.join(root, '.pnpm-store', 'v11');
  const virtualStorePath = path.join(root, 'node_modules', '.pnpm');

  write(
    root,
    'package.json',
    JSON.stringify({
      dependencies: {
        '@fixture/workspace': 'workspace:*',
        external: '1.0.0',
      },
      name: 'fixture-root',
      private: true,
    }),
  );
  write(
    root,
    'packages/fixture/package.json',
    JSON.stringify({ name: '@fixture/workspace', version: '1.0.0' }),
  );
  fs.mkdirSync(storePath, { recursive: true });
  fs.mkdirSync(virtualStorePath, { recursive: true });
  write(
    root,
    'node_modules/.modules.yaml',
    JSON.stringify({
      layoutVersion: 5,
      nodeLinker: 'isolated',
      packageManager: 'pnpm@11.9.0',
      storeDir: storePath,
      virtualStoreDir: virtualStorePath,
    }),
  );
  fs.mkdirSync(path.join(root, 'node_modules', 'external'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', '@fixture'), { recursive: true });
  fs.symlinkSync(
    workspacePackage,
    path.join(root, 'node_modules', '@fixture', 'workspace'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  return {
    packageJsonPaths: ['package.json', 'packages/fixture/package.json'],
    root,
    storePath,
  };
}

describe('complete dependency environment fingerprint', () => {
  it('includes every dependency source input and changes with file contents', () => {
    const root = createTemporaryDirectory();
    const files = [
      '.npmrc',
      '.pnpmfile.cjs',
      'package.json',
      'packages/example/package.json',
      'patches/example.patch',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'vendor/custom-dependency.patch',
    ];

    for (const relativePath of files) write(root, relativePath, `${relativePath}\n`);

    expect(collectDependencyInputs(files)).toEqual(files);
    const first = computeDependencyFingerprint(root, files);
    fs.appendFileSync(path.join(root, 'packages/example/package.json'), 'changed\n');
    expect(computeDependencyFingerprint(root, files)).not.toBe(first);
  });

  it('changes for Node, pnpm, OS, architecture, layout, or store-path drift', () => {
    const base = {
      architecture: 'x64',
      nodeVersion: 'v24.14.0',
      operatingSystem: 'win32',
      pnpmLayout: normalizePnpmLayoutSettings({ 'node-linker': 'isolated' }),
      pnpmVersion: '11.9.0',
      sourceFingerprint: 'source-a',
      storePath: 'E:/pnpm-store/v11',
    };
    const fingerprint = computeDependencyEnvironmentFingerprint(base);
    const variants = [
      { ...base, nodeVersion: 'v24.15.0' },
      { ...base, pnpmVersion: '11.10.0' },
      { ...base, operatingSystem: 'linux' },
      { ...base, architecture: 'arm64' },
      {
        ...base,
        pnpmLayout: normalizePnpmLayoutSettings({ 'node-linker': 'hoisted' }),
      },
      { ...base, storePath: 'E:/another-store/v11' },
    ];

    for (const variant of variants) {
      expect(computeDependencyEnvironmentFingerprint(variant)).not.toBe(fingerprint);
    }
  });

  it('keeps only dependency-layout settings and never fingerprints registry credentials', () => {
    const settings = normalizePnpmLayoutSettings({
      '//registry.example.test/:_authToken': 'must-not-survive',
      'node-linker': 'hoisted',
      'public-hoist-pattern': ['eslint'],
      registry: 'https://registry.example.test',
      'virtual-store-dir-max-length': 72,
    });

    expect(settings).toMatchObject({
      nodeLinker: 'hoisted',
      publicHoistPattern: ['eslint'],
      virtualStoreDirMaxLength: 72,
    });
    expect(JSON.stringify(settings)).not.toContain('must-not-survive');
    expect(JSON.stringify(settings)).not.toContain('registry.example.test');
  });
});

describe('dependency environment health', () => {
  it('accepts complete direct links and rejects missing or misdirected links', () => {
    const fixture = createHealthyFixture();
    const input = {
      packageJsonPaths: fixture.packageJsonPaths,
      pnpmVersion: '11.9.0',
      root: fixture.root,
      storePath: fixture.storePath,
    };

    expect(collectDependencyHealthIssues(input)).toEqual([]);

    fs.rmSync(path.join(fixture.root, 'node_modules', 'external'), { recursive: true });
    expect(collectDependencyHealthIssues(input)).toContain('missing-dependency:external');

    fs.mkdirSync(path.join(fixture.root, 'node_modules', 'external'), { recursive: true });
    const workspaceLink = path.join(fixture.root, 'node_modules', '@fixture', 'workspace');
    fs.rmSync(workspaceLink, { recursive: true });
    fs.mkdirSync(workspaceLink, { recursive: true });
    expect(collectDependencyHealthIssues(input)).toContain(
      'workspace-link-target:@fixture/workspace',
    );
  });

  it('rejects pnpm metadata whose package manager or store does not match', () => {
    const fixture = createHealthyFixture();
    const input = {
      packageJsonPaths: fixture.packageJsonPaths,
      pnpmVersion: '11.8.0',
      root: fixture.root,
      storePath: path.join(fixture.root, 'other-store'),
    };

    expect(collectDependencyHealthIssues(input)).toEqual(
      expect.arrayContaining(['pnpm-version', 'pnpm-store']),
    );
  });
});

describe('dependency environment decision and install boundary', () => {
  const fingerprint = 'complete-fingerprint';
  const matchingMarker = {
    fingerprint,
    schemaVersion: DEPENDENCY_ENVIRONMENT_SCHEMA_VERSION,
  };

  it('matches only when marker, complete fingerprint, and health all agree', () => {
    expect(
      classifyDependencyEnvironment({
        fingerprint,
        healthIssues: [],
        marker: matchingMarker,
      }),
    ).toEqual({ reasons: [], status: 'MATCH' });

    expect(
      classifyDependencyEnvironment({ fingerprint, healthIssues: [], marker: undefined }),
    ).toEqual({ reasons: ['marker-missing'], status: 'MISS' });
    expect(
      classifyDependencyEnvironment({
        fingerprint,
        healthIssues: ['missing-dependency:external'],
        marker: matchingMarker,
      }),
    ).toEqual({ reasons: ['missing-dependency:external'], status: 'MISS' });
    expect(
      classifyDependencyEnvironment({
        fingerprint,
        healthIssues: [],
        marker: { ...matchingMarker, fingerprint: 'stale' },
      }),
    ).toEqual({ reasons: ['fingerprint-mismatch'], status: 'MISS' });
  });

  it('performs zero writes on MATCH and one frozen install on MISS', () => {
    const reusedCalls = [];
    expect(
      runDependencyInstallIfNeeded({
        check: () => ({ reasons: [], status: 'MATCH' }),
        install: () => reusedCalls.push('install'),
        record: () => reusedCalls.push('record'),
        verifyHealth: () => reusedCalls.push('verify'),
      }),
    ).toEqual({ action: 'reused', initialReasons: [] });
    expect(reusedCalls).toEqual([]);

    const installedCalls = [];
    const checks = [
      { reasons: ['fingerprint-mismatch'], status: 'MISS' },
      { reasons: [], status: 'MATCH' },
    ];
    expect(
      runDependencyInstallIfNeeded({
        check: () => checks.shift(),
        install: () => installedCalls.push('install'),
        record: () => installedCalls.push('record'),
        verifyHealth: () => {
          installedCalls.push('verify');
          return [];
        },
      }),
    ).toEqual({ action: 'installed', initialReasons: ['fingerprint-mismatch'] });
    expect(installedCalls).toEqual(['install', 'verify', 'record']);
  });

  it('does not record a marker when post-install health fails', () => {
    const calls = [];
    expect(() =>
      runDependencyInstallIfNeeded({
        check: () => ({ reasons: ['marker-missing'], status: 'MISS' }),
        install: () => calls.push('install'),
        record: () => calls.push('record'),
        verifyHealth: () => ['missing-dependency:external'],
      }),
    ).toThrow(/missing-dependency:external/u);
    expect(calls).toEqual(['install']);
  });
});
