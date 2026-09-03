import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BOOTSTRAP_PROFILES, ensureWorkspaceBootstrap } from './workspace-bootstrap-core.mjs';

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
  const directory = fs.mkdtempSync(path.join(runtimeRoot, 'test-workspace-bootstrap-'));
  temporaryDirectories.push(directory);
  return directory;
}

function write(root, relativePath, content = `${relativePath}\n`) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function createPackage(root, shortName, dependencies = {}) {
  const directory = path.join(root, 'packages', shortName);
  const manifest = {
    name: `@schedule/${shortName}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': { import: './dist/index.js', types: './dist/index.d.ts' },
    },
    scripts: { build: 'tsc -p tsconfig.build.json' },
    dependencies: Object.fromEntries(
      Object.entries(dependencies).map(([name, value]) => [`@schedule/${name}`, value]),
    ),
  };
  write(root, `packages/${shortName}/package.json`, `${JSON.stringify(manifest, undefined, 2)}\n`);
  write(
    root,
    `packages/${shortName}/src/index.ts`,
    `export const ${shortName.replace('-', '_')} = 1;\n`,
  );
  write(root, `packages/${shortName}/tsconfig.json`, '{"extends":"../../tsconfig.base.json"}\n');
  write(
    root,
    `packages/${shortName}/tsconfig.build.json`,
    '{"extends":"./tsconfig.json","compilerOptions":{"outDir":"dist"}}\n',
  );
  return { directory, manifest };
}

function createFixture() {
  const root = createTemporaryDirectory();
  write(root, 'tsconfig.base.json', '{"compilerOptions":{"strict":true}}\n');
  const workspacePackages = [
    createPackage(root, 'contracts'),
    createPackage(root, 'client-core', { contracts: 'workspace:*' }),
    createPackage(root, 'presentation-core'),
    createPackage(root, 'database'),
    createPackage(root, 'scheduling-domain', { contracts: 'workspace:*' }),
    createPackage(root, 'test-fixtures', { database: 'workspace:*' }),
    createPackage(root, 'ui-tokens'),
  ];
  const stateRoot = path.join(root, '.state');
  return {
    lockPath: path.join(stateRoot, 'bootstrap.lock'),
    markerPath: path.join(stateRoot, 'bootstrap.json'),
    nodeVersion: 'v24.14.0',
    root,
    typescriptVersion: '5.9.3',
    workspacePackages,
  };
}

function writeBuildOutputs(workspacePackage) {
  write(workspacePackage.directory, 'dist/index.js', 'export const built = true;\n');
  write(workspacePackage.directory, 'dist/index.d.ts', 'export declare const built: true;\n');
}

describe('workspace bootstrap profiles', () => {
  it('keeps the Mini profile to its three required shared packages', () => {
    expect(BOOTSTRAP_PROFILES.mini).toEqual([
      '@schedule/contracts',
      '@schedule/client-core',
      '@schedule/presentation-core',
    ]);
    expect(BOOTSTRAP_PROFILES.mini).not.toContain('@schedule/database');
    expect(BOOTSTRAP_PROFILES.mini).not.toContain('@schedule/scheduling-domain');
  });

  it('builds the Mini closure in topological order and then reuses valid outputs', () => {
    const fixture = createFixture();
    const built = [];
    const buildPackage = vi.fn((workspacePackage) => {
      built.push(workspacePackage.manifest.name);
      writeBuildOutputs(workspacePackage);
    });

    const first = ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
    expect(first.built).toEqual([
      '@schedule/contracts',
      '@schedule/client-core',
      '@schedule/presentation-core',
    ]);
    expect(built.indexOf('@schedule/contracts')).toBeLessThan(
      built.indexOf('@schedule/client-core'),
    );
    expect(buildPackage).toHaveBeenCalledTimes(3);

    buildPackage.mockClear();
    const second = ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
    expect(second).toMatchObject({ built: [], reused: BOOTSTRAP_PROFILES.mini });
    expect(buildPackage).not.toHaveBeenCalled();
  });

  it('rebuilds a changed upstream package and only its selected dependants', () => {
    const fixture = createFixture();
    const buildPackage = vi.fn(writeBuildOutputs);
    ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
    buildPackage.mockClear();

    fs.appendFileSync(
      path.join(fixture.root, 'packages/contracts/src/index.ts'),
      'export const v2 = 2;\n',
    );
    const result = ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });

    expect(result.built).toEqual(['@schedule/contracts', '@schedule/client-core']);
    expect(result.reused).toEqual(['@schedule/presentation-core']);
    expect(buildPackage).toHaveBeenCalledTimes(2);
  });

  it.each(['package.json', 'tsconfig.json', 'tsconfig.build.json'])(
    'invalidates a package when %s changes',
    (relativePath) => {
      const fixture = createFixture();
      const buildPackage = vi.fn(writeBuildOutputs);
      ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
      buildPackage.mockClear();

      fs.appendFileSync(path.join(fixture.root, 'packages/presentation-core', relativePath), '\n');
      const result = ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });

      expect(result.built).toEqual(['@schedule/presentation-core']);
      expect(buildPackage).toHaveBeenCalledTimes(1);
    },
  );

  it('rebuilds only the package whose dist output is missing or changed', () => {
    const fixture = createFixture();
    const buildPackage = vi.fn(writeBuildOutputs);
    ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
    buildPackage.mockClear();
    fs.rmSync(path.join(fixture.root, 'packages/presentation-core/dist/index.d.ts'));

    const result = ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
    expect(result.built).toEqual(['@schedule/presentation-core']);
    expect(result.reasons['@schedule/presentation-core']).toContain(
      'output-missing:dist/index.d.ts',
    );
  });

  it('does not rebuild shared packages for application-only source changes', () => {
    const fixture = createFixture();
    const buildPackage = vi.fn(writeBuildOutputs);
    ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
    buildPackage.mockClear();
    write(fixture.root, 'apps/miniprogram/src/app.ts', 'changed app source\n');

    const result = ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' });
    expect(result.built).toEqual([]);
    expect(buildPackage).not.toHaveBeenCalled();
  });

  it('keeps a failed package out of the success marker', () => {
    const fixture = createFixture();
    const buildPackage = vi.fn((workspacePackage) => {
      if (workspacePackage.manifest.name === '@schedule/client-core') {
        throw new Error('controlled build failure');
      }
      writeBuildOutputs(workspacePackage);
    });

    expect(() => ensureWorkspaceBootstrap({ ...fixture, buildPackage, profile: 'mini' })).toThrow(
      /controlled build failure/u,
    );
    const marker = JSON.parse(fs.readFileSync(fixture.markerPath, 'utf8'));
    expect(marker.packages['@schedule/contracts']).toBeDefined();
    expect(marker.packages['@schedule/client-core']).toBeUndefined();
  });

  it('fails closed when another bootstrap owns the worktree lock', () => {
    const fixture = createFixture();
    fs.mkdirSync(fixture.lockPath, { recursive: true });
    expect(() =>
      ensureWorkspaceBootstrap({
        ...fixture,
        buildPackage: vi.fn(),
        profile: 'mini',
      }),
    ).toThrow(/bootstrap lock/u);
  });
});
