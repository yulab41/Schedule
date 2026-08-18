import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  buildP1MiniumArchive,
  listStoredZipEntries,
  loadP1MiniumSource,
  validateP1MiniumSource,
} from './minium-case-helpers.mjs';

const EXPECTED_CAPTURES = [
  'p1-foundation-controls-v1--initial.png',
  'p1-foundation-controls-v1--notification-on.png',
  'p1-foundation-controls-v1--contact-unchecked.png',
  'p1-foundation-controls-v1--week-selected.png',
  'p1-calendar-month-v1--initial.png',
  'p1-calendar-month-v1--selected-date.png',
  'p1-calendar-month-v1--previous-month.png',
  'p1-calendar-month-v1--next-month.png',
  'p1-calendar-month-v1--rebound.png',
  'p1-manual-matrix-daily-v1--initial.png',
  'p1-manual-matrix-daily-v1--horizontal-scroll.png',
  'p1-manual-matrix-daily-v1--cell-selected.png',
  'p1-manual-matrix-daily-v1--undo.png',
  'p1-manual-matrix-maximum-v1--initial.png',
  'p1-manual-matrix-maximum-v1--scroll-end.png',
  'p1-manual-matrix-maximum-v1--stale-cell.png',
  'p1-manual-matrix-maximum-v1--cell-selected.png',
  'p1-manual-matrix-maximum-v1--undo.png',
];

describe('P1 Minium custom case package', () => {
  it('locks the official MiniTest-discoverable class, routes, interactions, and captures', async () => {
    const source = await loadP1MiniumSource();
    const result = validateP1MiniumSource(source);

    expect(result.testMethods).toEqual([
      'test_calendar_month',
      'test_foundation_controls',
      'test_manual_matrix_daily',
      'test_manual_matrix_maximum',
    ]);
    expect(result.captureNames).toEqual(EXPECTED_CAPTURES);
    expect(source).toContain('class P1NativeParityTest(minium.MiniTest):');
    expect(source).toContain('self.app.relaunch("/pages/calendar-poc/index")');
    expect(source).toContain(
      'self.app.relaunch("/pages/manual-matrix-poc/index", {"mode": "maximum"})',
    );
    expect(source).toContain('.scroll_to(left=');
    expect(source).toContain('.move(24, 0, 150, smooth=True)');
    expect(source).not.toMatch(/dev_tool_path|project_path|token|appid|secret/i);
  });

  it('requires stable native selectors without changing visual layout', async () => {
    const files = new Map(
      await Promise.all(
        [
          '../src/pages/index/index.wxml',
          '../src/pages/calendar-poc/index.wxml',
          '../src/components/calendar/calendar-month/index.wxml',
          '../src/pages/manual-matrix-poc/index.wxml',
          '../src/components/manual-schedule/manual-schedule-cell/index.wxml',
        ].map(async (path) => [path, await readFile(new URL(path, import.meta.url), 'utf8')]),
      ),
    );

    expect(files.get('../src/pages/index/index.wxml')).toContain('id="p1-foundation"');
    expect(files.get('../src/pages/index/index.wxml')).toContain('id="p1-radio-week"');
    expect(files.get('../src/pages/calendar-poc/index.wxml')).toContain('id="p1-calendar-month"');
    expect(files.get('../src/components/calendar/calendar-month/index.wxml')).toContain(
      'id="calendar-cell-{{panelIndex}}-{{cell.businessDate}}"',
    );
    expect(files.get('../src/pages/manual-matrix-poc/index.wxml')).toContain('id="matrix-scroll"');
    expect(files.get('../src/pages/manual-matrix-poc/index.wxml')).toContain(
      'test-id="matrix-cell-r{{row.rowIndex}}-c{{cell.columnIndex}}"',
    );
    expect(
      files.get('../src/components/manual-schedule/manual-schedule-cell/index.wxml'),
    ).toContain('id="{{testId}}"');
  });

  it('builds one deterministic upload zip with the Python case at archive root', async () => {
    const first = await buildP1MiniumArchive();
    const second = await buildP1MiniumArchive();

    expect(first.equals(second)).toBe(true);
    expect(listStoredZipEntries(first)).toEqual(['test_p1_native.py']);
    expect(first.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('fails closed if a capture drifts from the checked-in P1 state manifest', async () => {
    const source = await loadP1MiniumSource();
    expect(() =>
      validateP1MiniumSource(source.replace('p1-calendar-month-v1--rebound.png', 'renamed.png')),
    ).toThrow(/capture names/i);
  });
});
