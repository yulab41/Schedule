import { afterEach, expect, it, vi } from 'vitest';
import * as presentation from '@schedule/presentation-core';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { createWorkbenchViewModel } from '../src/features/workbench/workbench-model.ts';

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
