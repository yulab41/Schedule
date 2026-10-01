import { afterEach, expect, it, vi } from 'vitest';
import * as presentation from '@schedule/presentation-core';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { createWorkbenchViewModel } from '../src/features/workbench/workbench-model.ts';
import * as nurse from '../src/features/workbench/nurse-duty-state.ts';

afterEach(() => vi.restoreAllMocks());

it('groups the loaded window only once for the three list panels', () => {
  const group = vi.spyOn(presentation, 'buildDayList');
  const source = calendarApiGoldenResponse.assignments[0];
  const assignments = ['2026-08-21', '2026-09-21', '2026-10-21'].flatMap((businessDate) =>
    Array.from({ length: 12 }, (_, index) => ({
      ...source,
      id: `${businessDate}-${index}`,
      businessDate,
      slotPosition: index,
      actualMemberName: '测试人员',
      shiftTypeName: 'A班',
      shiftTypeAbbreviation: 'A',
    })),
  );
  const input = { ...calendarApiGoldenResponse, assignments };
  const before = structuredClone(input);
  const view = createWorkbenchViewModel(
    input,
    holidayApiGoldenResponse,
    '2026-09-21',
    '2026-09',
    '2026-09-21',
    undefined,
    '2026-09-21',
    { nursePreset: true, now: new Date('2026-09-21T00:00:00Z') },
  );
  expect(view.listPanels.map((panel) => panel.dutyCount)).toEqual([12, 12, 12]);
  expect(view.listPanels[1].days[0].duties.map((row) => row.key)).toEqual(
    assignments.slice(12, 24).map((row) => row.id),
  );
  expect(input).toEqual(before);
  expect(group).toHaveBeenCalledTimes(1);
});

it('shares same-day shift state within a model and refreshes across a duty boundary', () => {
  const getState = vi.spyOn(nurse, 'getNurseDutyState');
  const source = calendarApiGoldenResponse.assignments[0];
  const assignments = Array.from({ length: 12 }, (_, index) => ({
    ...source,
    id: `state-${index}`,
    businessDate: '2026-09-21',
    shiftTypeName: 'A班',
    shiftTypeAbbreviation: 'A',
    slotPosition: index,
  }));
  const args = [
    { ...calendarApiGoldenResponse, assignments },
    holidayApiGoldenResponse,
    '2026-09-21',
    '2026-09',
    '2026-09-21',
    undefined,
    '2026-09-21',
  ];
  const before = createWorkbenchViewModel(...args, {
    nursePreset: true,
    now: new Date('2026-09-20T23:59:59Z'),
  });
  expect(before.selectedDetails[0].dutyState).toBe('before');
  expect(getState).toHaveBeenCalledTimes(1);
  getState.mockClear();
  const working = createWorkbenchViewModel(...args, {
    nursePreset: true,
    now: new Date('2026-09-21T00:00:00Z'),
  });
  expect(working.selectedDetails[0].dutyState).toBe('working');
  expect(working.listPanels[1].days[0].duties.every((duty) => duty.dutyState === 'working')).toBe(
    true,
  );
  expect(getState).toHaveBeenCalledTimes(1);
});
