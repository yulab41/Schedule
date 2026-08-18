import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const PLAN_URL = new URL('../testing/p1-manual-test-plan.json', import.meta.url);

describe('P1 user-operated native test plan', () => {
  it('locks the approved physical-device route and state coverage without cloud-test inputs', async () => {
    const source = await readFile(PLAN_URL, 'utf8');
    const plan = JSON.parse(source);

    expect(plan).toMatchObject({
      channel: 'user-manual',
      entryRoute: 'pages/index/index',
      requiredDevice: 'user-android-physical',
      schemaVersion: 1,
    });
    expect(plan.cases.map((entry) => entry.route)).toEqual([
      'pages/index/index',
      'pages/calendar-poc/index',
      'pages/manual-matrix-poc/index?mode=daily',
      'pages/manual-matrix-poc/index?mode=maximum',
    ]);
    expect(plan.cases.map((entry) => entry.states)).toEqual([
      ['initial', 'notification-on', 'contact-unchecked', 'week-selected'],
      ['initial', 'selected-date', 'previous-month', 'next-month', 'rebound'],
      ['initial', 'horizontal-scroll', 'cell-selected', 'undo'],
      ['initial', 'scroll-end', 'stale-cell', 'cell-selected', 'undo'],
    ]);
    expect(plan.completion).toMatchObject({ screenshotsRequiredOnPass: false });
    expect(source).not.toMatch(/MINITEST_|minium|cloud|token|privateKey/i);
  });

  it('keeps the approved visual and performance targets visible to the manual tester', async () => {
    const plan = JSON.parse(await readFile(PLAN_URL, 'utf8'));

    expect(plan.thresholds).toEqual({
      maxKeyGeometryDeltaPx: 2,
      significantPixelRatio: 0.02,
      stableRegionSimilarity: 0.98,
    });
    expect(plan.performance).toEqual({
      androidInteractiveMs: 2500,
      maximumMatrixRenderMs: 1000,
      tapFeedbackMs: 100,
    });
  });
});
