import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_ROOT,
  buildMiniProgram,
  findRuntimeBoundaryIssues,
  findWorkletIssues,
  listRegisteredPages,
  resolveBuildProfile,
} from './build-tools.mjs';

describe('Mini Program deterministic toolchain guards', () => {
  it('requires an explicit supported build profile', () => {
    expect(resolveBuildProfile('staging')).toBe('staging');
    expect(resolveBuildProfile('production')).toBe('production');
    expect(() => resolveBuildProfile('development')).toThrow(/profile must be one of/u);
  });

  it('lists main and subpackage routes without duplicates', () => {
    expect(
      listRegisteredPages({
        pages: ['pages/index/index'],
        subpackages: [{ pages: ['pages/editor/index'], root: 'subpackage-scheduling' }],
      }),
    ).toEqual(['pages/index/index', 'subpackage-scheduling/pages/editor/index']);
    expect(() =>
      listRegisteredPages({ pages: ['pages/index/index', '/pages/index/index/'] }),
    ).toThrow(/duplicate routes/u);
  });

  it('rejects DOM, Node, database, and Zod dependencies', () => {
    expect(findRuntimeBoundaryIssues("import fs from 'node:fs';\nwindow.fetch('/api');")).toEqual(
      expect.arrayContaining([
        'imports forbidden runtime module: node:fs',
        'references forbidden runtime identifier: window',
      ]),
    );
    expect(findRuntimeBoundaryIssues("import { z } from 'zod';")).toContain(
      'imports forbidden runtime module: zod',
    );
    expect(findRuntimeBoundaryIssues("import '@schedule/database';")).toContain(
      'imports forbidden runtime module: @schedule/database',
    );
  });

  it('requires worklet to be the first and only directive', () => {
    expect(findWorkletIssues("function ok() { 'worklet'; return 1; }").issues).toEqual([]);
    expect(
      findWorkletIssues("function late() { const value = 1; 'worklet'; return value; }").issues,
    ).toEqual([expect.stringMatching(/first and only directive/u)]);
    expect(findWorkletIssues("function duplicate() { 'worklet'; 'worklet'; }").issues).toEqual([
      expect.stringMatching(/first and only directive/u),
    ]);
  });

  it('preserves the Worklet directive through the real esbuild path', async () => {
    mkdirSync(ARTIFACT_ROOT, { recursive: true });
    const fixtureRoot = mkdtempSync(path.join(ARTIFACT_ROOT, 'worklet-build-'));
    const sourceRoot = path.join(fixtureRoot, 'src');
    const outdir = path.join(fixtureRoot, 'out');
    try {
      mkdirSync(sourceRoot, { recursive: true });
      writeFileSync(
        path.join(sourceRoot, 'app.ts'),
        "export const buildLabel = `${__MINIPROGRAM_BUILD_VERSION__}@${__MINIPROGRAM_BUILD_COMMIT__}`;\nfunction moveHeader() { 'worklet'; return 1; }\nApp({ moveHeader });\n",
        'utf8',
      );
      await buildMiniProgram({
        buildCommit: 'abc1234',
        buildVersion: '0.1.0-probe',
        outdir,
        profile: 'staging',
        sourceRoot,
      });
      const compiled = readFileSync(path.join(outdir, 'app.js'), 'utf8');
      const worklets = findWorkletIssues(compiled, 'app.js');
      expect(worklets.issues).toEqual([]);
      expect(worklets.count).toBeGreaterThanOrEqual(1);
      expect(compiled).toContain('"0.1.0-probe"');
      expect(compiled).toContain('"abc1234"');
      expect(compiled).not.toContain('__MINIPROGRAM_BUILD_VERSION__');
      expect(compiled).not.toContain('__MINIPROGRAM_BUILD_COMMIT__');
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });
});
