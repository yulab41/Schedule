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
  it('pins Mini test and build scripts to LF in every clean Windows worktree', () => {
    const attributes = readFileSync(new URL('../../../.gitattributes', import.meta.url), 'utf8');
    expect(attributes).toContain('apps/miniprogram/scripts/*.mjs text eol=lf');
  });
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

  it('keeps direct P9 panel controllers and wrappers bundle-only', () => {
    const buildTools = readFileSync(new URL('./build-tools.mjs', import.meta.url), 'utf8');

    for (const panel of [
      'exports-panel',
      'insights-dashboard-panel',
      'notifications-panel',
      'visitor-access-panel',
    ]) {
      expect(buildTools).toContain(`'${panel}'`);
    }
    expect(buildTools).toContain('BUNDLED_ONLY_TYPESCRIPT_MODULES');
    expect(buildTools).toContain('`subpackages/insights/components/${panel}/controller.ts`');
    expect(buildTools).toContain('`subpackages/insights/components/${panel}/index.ts`');
    for (const modulePath of [
      'subpackages/organization/components/directory-panel/controller.ts',
      'subpackages/organization/components/directory-panel/index.ts',
      'subpackages/organization/components/group-settings-panel/controller.ts',
      'subpackages/organization/components/scheduling-config-panel/controller.ts',
      'subpackages/organization/components/scheduling-config-panel/index.ts',
      'subpackages/organization/components/invite-visitor-panel/controller.ts',
      'subpackages/organization/components/invite-visitor-panel/index.ts',
      'subpackages/organization/components/platform-accounts-panel/controller.ts',
      'subpackages/organization/components/platform-accounts-panel/index.ts',
      'subpackages/workflows/components/workflow-duty-panel/controller.ts',
      'subpackages/workflows/components/workflow-leave-panel/controller.ts',
      'subpackages/workflows/components/workflow-swap-panel/controller.ts',
      'subpackages/workflows/components/controller-host.ts',
    ]) {
      expect(buildTools).toContain(`'${modulePath}'`);
    }
    expect(buildTools).not.toContain(
      "'subpackages/organization/components/group-settings-panel/index.ts'",
    );
    for (const workflow of ['duty', 'leave', 'swap']) {
      expect(buildTools).not.toContain(
        `'subpackages/workflows/components/workflow-${workflow}-panel/index.ts'`,
      );
    }
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
    expect(findRuntimeBoundaryIssues("import '@schedule/contracts';")).toContain(
      'imports forbidden runtime module: @schedule/contracts',
    );
    expect(
      findRuntimeBoundaryIssues("import type { CalendarReadModel } from '@schedule/contracts';"),
    ).not.toContain('imports forbidden runtime module: @schedule/contracts');
    expect(
      findRuntimeBoundaryIssues("import '@schedule/contracts/manual-schedule-limits';"),
    ).not.toContain('imports forbidden runtime module: @schedule/contracts/manual-schedule-limits');
    expect(
      findRuntimeBoundaryIssues("import '@schedule/contracts/past-schedule-limits';"),
    ).not.toContain('imports forbidden runtime module: @schedule/contracts/past-schedule-limits');
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
      expect(compiled).toContain('0.1.0-probe');
      expect(compiled).toContain('abc1234');
      expect(compiled).not.toContain('__MINIPROGRAM_BUILD_VERSION__');
      expect(compiled).not.toContain('__MINIPROGRAM_BUILD_COMMIT__');
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });
});
