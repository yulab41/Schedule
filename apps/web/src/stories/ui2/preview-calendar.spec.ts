import { describe, expect, it } from 'vitest';

import { isWeekendColumn, shouldTintHolidayCell } from './preview-calendar.js';

describe('UI 2.0 preview calendar visual states', () => {
  it('marks only Saturday and Sunday columns as weekends', () => {
    expect(Array.from({ length: 7 }, (_, index) => isWeekendColumn(index))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('tints every off-day cell in a multi-day holiday period', () => {
    expect(shouldTintHolidayCell({ kind: 'off-day', label: '国庆', spanDays: 7 })).toBe(true);
  });

  it('does not tint a single-day holiday cell', () => {
    expect(shouldTintHolidayCell({ kind: 'off-day', label: '元旦', spanDays: 1 })).toBe(false);
  });

  it('does not tint a makeup workday cell', () => {
    expect(shouldTintHolidayCell({ kind: 'workday', label: '班', spanDays: 1 })).toBe(false);
  });
});
