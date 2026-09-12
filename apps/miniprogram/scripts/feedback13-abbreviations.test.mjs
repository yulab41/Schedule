import { describe, expect, it } from 'vitest';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { createWorkbenchViewModel } from '../src/features/workbench/workbench-model.ts';

function view(isAllDay, nursePreset = false) {
  const calendar = structuredClone(calendarApiGoldenResponse);
  calendar.shiftTypes[0].abbreviation = '全天';
  calendar.shiftTypes[0].isAllDay = isAllDay;
  calendar.assignments[0].shiftTypeAbbreviation = '全天';
  return createWorkbenchViewModel(
    calendar,
    holidayApiGoldenResponse,
    '2026-08-22',
    '2026-08',
    '2026-08-17',
    undefined,
    '2026-08-22',
    { nursePreset },
  );
}

describe('feedback13 calendar abbreviation display', () => {
  it.each([false, true])(
    'uses the configured all-day abbreviation in week/details/list (nurse=%s)',
    (nurse) => {
      const result = view(true, nurse);
      const day = result.weekPanels[1].days[5];
      expect(day.shiftGroups[0].abbreviation).toBe('全天');
      expect(day.duties[0].shiftAbbreviation).toBe('全天');
      expect(result.selectedDetails[0].shiftAbbreviation).toBe('全天');
      expect(result.listPanels[1].days[0].duties[0].shiftAbbreviation).toBe('全天');
    },
  );
  it.each([false, true])(
    'hides only the all-day month badge and retains personnel and markers (nurse=%s)',
    (nurse) => {
      const cell = view(true, nurse).monthPanels[1].cells.find(
        (cell) => cell.businessDate === '2026-08-22',
      );
      expect(cell.shiftAbbreviation).toBe('');
      expect(cell.person).toBe('李医生');
      expect(cell.marker).toBe('换');
    },
  );
  it('does not hide a partial-day shift merely named 全天班', () => {
    const cell = view(false, true).monthPanels[1].cells.find(
      (cell) => cell.businessDate === '2026-08-22',
    );
    expect(cell.shiftAbbreviation).toBe('全天');
  });
});
