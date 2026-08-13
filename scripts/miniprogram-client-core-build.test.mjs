import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CLIENT_CORE_MAX_BYTES,
  findClientCoreBundleIssues,
  findClientCoreMetafileIssues,
  inspectPackedClientCoreMiniProgramBundle,
  preparePackedClientCoreBuild,
} from './miniprogram-client-core-bundle-gate.mjs';
import { findDevToolsBuildIssues } from './miniprogram-client-core-devtools-build.mjs';

const rootPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const miniprogramPackage = JSON.parse(
  readFileSync(new URL('../apps/miniprogram/package.json', import.meta.url), 'utf8'),
);
const miniprogramTsconfig = JSON.parse(
  readFileSync(new URL('../apps/miniprogram/tsconfig.json', import.meta.url), 'utf8'),
);
const vitestConfig = readFileSync(new URL('../vitest.config.ts', import.meta.url), 'utf8');
const eslintConfig = readFileSync(new URL('../eslint.config.js', import.meta.url), 'utf8');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('miniprogram client-core build boundary', () => {
  it('builds and audits client-core before both root and package-local build-npm commands', () => {
    expect(rootPackage.scripts['miniprogram:client-core:prepare']).toBe(
      'pnpm --filter @schedule/miniprogram client-core:prepare',
    );
    expect(rootPackage.scripts['miniprogram:devtools:build-npm']).toBe(
      'pnpm --filter @schedule/miniprogram build-npm',
    );
    expect(miniprogramPackage.scripts['client-core:prepare']).toBe(
      'pnpm --filter @schedule/client-core build && node ../../scripts/miniprogram-client-core-bundle-gate.mjs',
    );
    expect(miniprogramPackage.scripts['build-npm']).toBe(
      'pnpm run client-core:prepare && node ../../scripts/miniprogram-client-core-devtools-build.mjs',
    );
    expect(miniprogramPackage.scripts.typecheck).toBe(
      'pnpm run client-core:prepare && tsc --noEmit -p tsconfig.json',
    );
  });

  it('resolves the workspace dependency through its built Mini Program declaration', () => {
    expect(miniprogramPackage.dependencies['@schedule/client-core']).toBe('workspace:*');
    expect(miniprogramTsconfig.compilerOptions.paths['@schedule/client-core']).toEqual([
      '../../packages/client-core/dist/index.d.ts',
    ]);
    expect(miniprogramTsconfig.exclude).toContain('minitest/**/*');
  });

  it('runs tests from source without depending on ignored build output', () => {
    expect(vitestConfig).toContain("'@schedule/client-core': fileURLToPath(");
    expect(vitestConfig).toContain(
      "new URL('./packages/client-core/src/index.ts', import.meta.url)",
    );
    expect(eslintConfig).toContain("'apps/miniprogram/minitest/**'");
  });

  it('accepts a small minified dependency-free CommonJS bundle', () => {
    const source = '"use strict";module.exports={decode:function(value){return value}};';

    expect(findClientCoreBundleIssues(Buffer.from(source))).toEqual([]);
  });

  it('removes stale packed output and rejects output older than this build marker', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'schedule-client-core-build-'));
    temporaryDirectories.push(directory);
    const packedDirectory = path.join(directory, 'packed');
    const packedBundlePath = path.join(packedDirectory, 'index.js');
    const sourceBundlePath = path.join(directory, 'source.js');
    const markerPath = path.join(directory, 'build-marker.json');
    const safeBundle = Buffer.from('"use strict";module.exports={value:1};');
    mkdirSync(packedDirectory, { recursive: true });
    writeFileSync(packedBundlePath, safeBundle);
    writeFileSync(sourceBundlePath, safeBundle);

    preparePackedClientCoreBuild({
      markerPath,
      packedDirectory,
      sourceBundlePath,
      startedAtMs: 2_000,
      testOnlySafeRoot: directory,
    });

    expect(existsSync(packedDirectory)).toBe(false);
    mkdirSync(packedDirectory, { recursive: true });
    writeFileSync(packedBundlePath, safeBundle, { flag: 'wx' });
    utimesSync(packedBundlePath, 1, 1);
    expect(
      inspectPackedClientCoreMiniProgramBundle({
        markerPath,
        packedBundlePath,
        sourceBundlePath,
      }).issues,
    ).toContain('packed miniprogram bundle predates this build');

    utimesSync(packedBundlePath, 3, 3);
    expect(
      inspectPackedClientCoreMiniProgramBundle({
        markerPath,
        packedBundlePath,
        sourceBundlePath,
      }).issues,
    ).toEqual([]);
    writeFileSync(sourceBundlePath, '"use strict";module.exports={value:2};');
    expect(
      inspectPackedClientCoreMiniProgramBundle({
        markerPath,
        packedBundlePath,
        sourceBundlePath,
      }).issues,
    ).toContain('source miniprogram bundle changed after build-npm started');
  });

  it('refuses to recursively remove any directory outside the exact production target', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'schedule-client-core-safety-'));
    temporaryDirectories.push(directory);
    const sourceBundlePath = path.join(directory, 'source.js');
    const markerPath = path.join(directory, 'build-marker.json');
    writeFileSync(sourceBundlePath, '"use strict";module.exports={value:1};');

    expect(() =>
      preparePackedClientCoreBuild({
        markerPath,
        packedDirectory: path.join(directory, 'unexpected-target'),
        sourceBundlePath,
      }),
    ).toThrow('refusing to remove anything except the exact packed client-core directory');
    expect(() =>
      preparePackedClientCoreBuild({
        markerPath,
        packedDirectory: path.join(directory, 'outside-safe-root'),
        sourceBundlePath,
        testOnlySafeRoot: path.join(directory, 'different-safe-root'),
      }),
    ).toThrow('test packed output must stay inside its explicit safe root');
  });

  it('treats missing or non-empty DevTools warnings as build failures', () => {
    expect(
      findDevToolsBuildIssues({
        output: '{"cost":123,"warnings":[]}',
        status: 0,
      }),
    ).toEqual([]);
    expect(
      findDevToolsBuildIssues({
        output: '{"cost":123,"warnings":["missing entry"]}',
        status: 0,
      }),
    ).toEqual(['DevTools build-npm warning: missing entry']);
    expect(findDevToolsBuildIssues({ output: 'build complete', status: 0 })).toEqual([
      'DevTools build-npm did not report a warnings array',
    ]);
  });

  it('uses the esbuild metafile to reject external and non-core runtime imports', () => {
    expect(
      findClientCoreMetafileIssues({
        inputs: {
          'src/index.ts': { imports: [{ external: false, path: 'src/types.ts' }] },
          'src/types.ts': { imports: [] },
        },
        outputs: {
          'dist/miniprogram/index.js': { imports: [] },
        },
      }),
    ).toEqual([]);
    expect(
      findClientCoreMetafileIssues({
        inputs: {
          'src/index.ts': {
            imports: [
              { external: true, path: 'node:crypto' },
              { external: false, path: '../contracts/src/index.ts' },
            ],
          },
        },
        outputs: {
          'dist/miniprogram/index.js': {
            imports: [{ external: true, path: 'zod' }],
          },
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'metafile input import is external: node:crypto',
        'metafile input escapes client-core src: ../contracts/src/index.ts',
        'metafile output import is external: zod',
      ]),
    );
  });

  it('does not mistake property names, larger identifiers, comments, or strings for globals', () => {
    const source = [
      '"use strict";',
      '/* window document fetch wx zod @schedule/contracts node:crypto */',
      'const documented="prefetch";',
      'const value={window:"wx",windowSize:1};',
      'module.exports={documented,copy:"document fetch zod",value:value.window};',
    ].join('');

    expect(findClientCoreBundleIssues(Buffer.from(source))).toEqual([]);
    expect(findClientCoreBundleIssues(Buffer.from('"module.exports";'))).toContain(
      'bundle is not CommonJS',
    );
  });

  it('rejects oversized, non-CommonJS, non-minified, and platform-coupled bundles', () => {
    expect(findClientCoreBundleIssues(Buffer.alloc(CLIENT_CORE_MAX_BYTES + 1, 0x61))).toContain(
      `bundle exceeds ${CLIENT_CORE_MAX_BYTES} bytes`,
    );
    expect(findClientCoreBundleIssues(Buffer.from('export const value=1;'))).toContain(
      'bundle is not CommonJS',
    );
    expect(
      findClientCoreBundleIssues(Buffer.from('module.exports = {\n  value: 1,\n};\n')),
    ).toContain('bundle is not minified');

    for (const forbiddenIdentifier of [
      'Buffer',
      'XMLHttpRequest',
      '__dirname',
      '__filename',
      'window',
      'document',
      'fetch',
      'global',
      'globalThis',
      'localStorage',
      'navigator',
      'process',
      'self',
      'wx',
    ]) {
      expect(
        findClientCoreBundleIssues(Buffer.from(`module.exports=${forbiddenIdentifier};`)),
      ).toContain(`bundle references forbidden runtime identifier: ${forbiddenIdentifier}`);
    }
    for (const [moduleName, issue] of [
      ['zod', 'bundle imports forbidden runtime module: zod'],
      [
        '@schedule/contracts/runtime',
        'bundle imports forbidden runtime module: @schedule/contracts/runtime',
      ],
      ['node:crypto', 'bundle imports Node builtin: node:crypto'],
      ['fs', 'bundle imports Node builtin: fs'],
    ]) {
      expect(
        findClientCoreBundleIssues(
          Buffer.from(`module.exports=require(${JSON.stringify(moduleName)});`),
        ),
      ).toContain(issue);
    }
  });
});
