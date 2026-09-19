import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const PLAN_URL = new URL('../testing/p6-core-rc-plan.json', import.meta.url);
const RUNBOOK_URL = new URL('../docs/runbooks/p6-core-rc.md', import.meta.url);

describe('P6 core RC manual evidence plan', () => {
  it('locks physical Android, exact performance thresholds, and normal/weak/offline lifecycle coverage', async () => {
    const source = await readFile(PLAN_URL, 'utf8');
    const runbook = await readFile(RUNBOOK_URL, 'utf8');
    const plan = JSON.parse(source);

    expect(plan).toMatchObject({
      channel: 'user-manual',
      requiredDevice: 'user-android-physical',
      schemaVersion: 1,
      stage: 'P6-core-v1',
    });
    expect(plan.performance).toEqual({
      coreReady: {
        endBoundary: 'first-ready-or-offline-setData-callback',
        metric: 'core-ready',
        requiredSamples: 5,
        route: 'pages/workbench/index?performance=1',
        startBoundary: 'workbench-onLoad-before-shell-and-capability-read',
        thresholdMs: 2500,
      },
      foregroundReady: {
        endBoundary: 'refreshed-ready-or-offline-setData-callback',
        metric: 'foreground-ready',
        requiredSamples: 5,
        route: 'pages/workbench/index?performance=1',
        startBoundary: 'non-initial-workbench-onShow-before-capability-read',
        thresholdMs: 2500,
      },
    });
    expect(plan.automatedEvidence).toEqual({
      maximumMatrixViewModelBytes: 171340,
      nodeTargetDisposition: 'warning-with-exact-no-growth-ceilings',
      productionManualHostElementLowerBound: 1507,
      wxsHotPathSetDataCalls: 0,
    });
    expect(plan.cases.map((entry) => entry.id)).toEqual([
      'normal-cold-start',
      'foreground-refresh',
      'weak-network-read',
      'offline-cache-read-only',
      'maximum-matrix-performance',
    ]);
    expect(plan.cases.flatMap((entry) => entry.networkStates)).toEqual(
      expect.arrayContaining(['normal', 'weak', 'offline']),
    );
    expect(plan.requiredEvidence).toEqual([
      'buildLabel',
      'deviceModel',
      'androidVersion',
      'wechatVersion',
      'baseLibraryVersion',
      'systemFontScale',
      'metric',
      'startBoundary',
      'endBoundary',
      'samplesMs',
      'maxMs',
      'thresholdMs',
      'result',
      'symptomOnFailure',
    ]);
    expect(source).not.toMatch(/MINITEST_|minium|privateKey|token|AppSecret/iu);
    expect(runbook).toContain('pages/workbench/index`，`performance=1');
    expect(runbook).toContain('samplesMs');
    expect(runbook).toContain('1,507');
    expect(runbook).toContain('已实现待实体性能复核');
  });
});
