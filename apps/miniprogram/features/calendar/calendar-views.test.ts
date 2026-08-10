import { describe, expect, it } from 'vitest';

import { goldenCalendar, goldenToday } from './calendar-golden-data.js';
import {
  addWeeks,
  buildDayList,
  formatChinaDateTime,
  getBusinessMonthsForWeek,
  getVisibleWeekForMonth,
  getWeekDays,
  getWeekLabel,
  getWeekStartDate,
  getWeekdayLabel,
  isWeekend,
} from './calendar-views.js';

describe('calendar week and list views', () => {
  it('uses Monday-first business weeks and CST labels', () => {
    expect(getWeekStartDate('2026-08-05')).toBe('2026-08-03');
    expect(getWeekDays('2026-08-05')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
    expect(addWeeks('2026-08-05', 1)).toBe('2026-08-12');
    expect(addWeeks('2026-08-03', -1)).toBe('2026-07-27');
    expect(getWeekLabel('2026-08-05')).toBe('2026年8月3日 – 8月9日');
    expect(getVisibleWeekForMonth('2026-08', '2026-08-12')).toBe('2026-08-10');
    expect(getVisibleWeekForMonth('2026-09', '2026-08-12')).toBe('2026-08-31');
    expect(getWeekdayLabel('2026-08-03')).toBe('周一');
    expect(isWeekend('2026-08-08')).toBe(true);
    expect(formatChinaDateTime('2026-08-15T09:00:00+08:00')).toBe('2026-08-15 09:00');
    expect(getBusinessMonthsForWeek('2026-08-31')).toEqual(['2026-08', '2026-09']);
    expect(getBusinessMonthsForWeek('2026-12-28')).toEqual(['2026-12', '2027-01']);
    expect(() => addWeeks('2026-08-05', 1.5)).toThrow();
  });

  it('groups the immutable golden assignments by ordered business date', () => {
    const source = JSON.stringify(goldenCalendar.assignments);
    const days = buildDayList(goldenCalendar.assignments, goldenToday);

    expect(days.map(({ businessDate }) => businessDate)).toEqual(
      [...new Set(goldenCalendar.assignments.map(({ businessDate }) => businessDate))].sort(),
    );
    expect(days[0]?.assignments).toHaveLength(1);
    expect(JSON.stringify(goldenCalendar.assignments)).toBe(source);
  });
});
