import { describe, expect, it } from 'vitest';

import {
  createCalendarViewModeState,
  recenterMonthSlots,
  rotateMonthSlots,
  stepCalendarMonth,
  stepCalendarWeek,
  switchCalendarViewMode,
} from './calendar-view-mode.js';

describe('calendar view mode state', () => {
  it('pins month, week, list transitions and navigation guards', () => {
    const initial = createCalendarViewModeState('2026-08-15');
    expect(initial).toEqual({ businessMonth: '2026-08', mode: 'month', weekStart: '2026-08-10' });
    expect(switchCalendarViewMode(initial, 'week', '2026-08-15')).toMatchObject({ mode: 'week' });
    expect(switchCalendarViewMode(initial, 'list', '2026-08-15')).toMatchObject({ mode: 'list' });
    expect(stepCalendarMonth(initial, 1, '2026-08-15')).toEqual({
      businessMonth: '2026-09',
      mode: 'month',
      weekStart: '2026-08-31',
    });
    expect(() => stepCalendarWeek(initial, 1)).toThrow('Week stepping requires week mode.');
    const week = switchCalendarViewMode(initial, 'week', '2026-08-15');
    expect(stepCalendarWeek(week, 1)).toEqual({
      businessMonth: '2026-08',
      mode: 'week',
      weekStart: '2026-08-17',
    });
    expect(() => stepCalendarMonth(week, 1, '2026-08-15')).toThrow(
      'Month stepping is not available in week mode.',
    );
  });

  it('re-centers and rotates exactly three month slots', () => {
    expect(recenterMonthSlots('2026-08')).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(rotateMonthSlots(['2026-07', '2026-08', '2026-09'], 0)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
    expect(rotateMonthSlots(['2026-07', '2026-08', '2026-09'], 2)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(() => rotateMonthSlots(['2026-07', '2026-08', '2026-09'], 1 as 0 | 2)).toThrow();
  });

  it('re-centers a stale week when month swiping moved the visible calendar elsewhere', () => {
    expect(
      switchCalendarViewMode(
        { businessMonth: '2026-10', mode: 'month', weekStart: '2026-08-10' },
        'week',
        '2026-08-15',
      ),
    ).toEqual({ businessMonth: '2026-10', mode: 'week', weekStart: '2026-09-28' });
    expect(
      switchCalendarViewMode(
        { businessMonth: '2027-01', mode: 'month', weekStart: '2026-12-28' },
        'week',
        '2026-08-15',
      ),
    ).toEqual({ businessMonth: '2027-01', mode: 'week', weekStart: '2026-12-28' });
  });
});
