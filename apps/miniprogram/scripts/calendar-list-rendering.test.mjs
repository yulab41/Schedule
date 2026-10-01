import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as presentation from '@schedule/presentation-core';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { createWorkbenchViewModel } from '../src/features/workbench/workbench-model.ts';
import { renderWxmlStructure } from './performance-budget.mjs';

it('does not build a hidden list when rendering month or week', () => {
  const group = vi.spyOn(presentation, 'buildDayList');
  try {
    for (const view of ['month', 'week', 'details']) {
      const result = createWorkbenchViewModel(
        calendarApiGoldenResponse,
        holidayApiGoldenResponse,
        '2026-09-21',
        '2026-09',
        '2026-09-21',
        undefined,
        '2026-09-21',
        { view },
      );
      expect(result.listPanels).toEqual([]);
      if (view !== 'month') expect(result.monthPanels).toEqual([]);
      if (view !== 'week') expect(result.weekPanels).toEqual([]);
      expect(result.selectedDetails).toBeDefined();
    }
    expect(group).not.toHaveBeenCalled();
  } finally {
    group.mockRestore();
  }
});

it.each([false, true])(
  'keeps full-model ordering, contacts, markers and boundaries for nurse=%s',
  (nursePreset) => {
    const source = calendarApiGoldenResponse.assignments[0];
    const calendar = {
      ...calendarApiGoldenResponse,
      assignments: Array.from({ length: 20 }, (_, i) => ({
        ...source,
        id: `test-${i}`,
        businessDate: '2026-09-21',
        shiftTypeName: i % 2 ? 'A班' : '电脑班',
        slotPosition: i,
      })),
    };
    const before = structuredClone(calendar);
    const args = [
      calendar,
      holidayApiGoldenResponse,
      '2026-09-21',
      '2026-09',
      '2026-09-21',
      undefined,
      '2026-09-21',
    ];
    const options = { nursePreset, now: new Date('2026-09-21T03:00:00Z') };
    const full = createWorkbenchViewModel(...args, options);
    for (const view of ['month', 'week', 'list', 'details']) {
      const scoped = createWorkbenchViewModel(...args, { ...options, view });
      expect(scoped.selectedDetails).toEqual(full.selectedDetails);
      expect(scoped.nextDutyBoundary).toEqual(full.nextDutyBoundary);
      if (view !== 'details') expect(scoped[`${view}Panels`]).toEqual(full[`${view}Panels`]);
    }
    expect(calendar).toEqual(before);
  },
);

it.each(['workbench/index', 'guest/guest'])(
  '%s defers offscreen contents while keeping every date and its height',
  (route) => {
    const source = readFileSync(new URL(`../src/pages/${route}.wxml`, import.meta.url), 'utf8');
    const list =
      '<view class="list-calendar"' +
      source.split('<view class="list-calendar"')[1].split('</swiper>')[0] +
      '</swiper></view>';
    const duty = {
      name: '测试人员',
      details: '测试班种',
      phone: '000',
      markers: [],
      dutyState: 'before',
      dutyStateLabel: '未上班',
    };
    const listPanels = [-1, 0, 1].map((relative) => ({
      relative,
      key: `${relative}`,
      days: Array.from({ length: 30 }, (_, i) => ({
        businessDate: `test-${i}`,
        duties: Array.from({ length: 20 }, (_, j) => ({ ...duty, key: `${i}-${j}` })),
        renderDuties: i < 2,
      })),
    }));
    const result = renderWxmlStructure(list, { listPanels });
    expect(result.nodeCount).toBeLessThan(5000);
    expect(source).toContain('day.placeholderHeight');
    expect(source).toContain('day.renderDuties');
  },
);
