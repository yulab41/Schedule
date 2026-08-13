import { describe, expect, it } from 'vitest';

import {
  addWeeks,
  buildDayList,
  createCalendarViewModeState,
  formatChinaDateTime,
  goCalendarToBusinessMonth,
  goCalendarToThisWeek,
  goCalendarToToday,
  getBusinessMonthsForWeek,
  getVisibleWeekForMonth,
  getWeekDays,
  getWeekLabel,
  getWeekStartDate,
  getWeekdayLabel,
  isWeekend,
  recenterMonthSlots,
  rotateMonthSlots,
  stepCalendarMonth,
  stepCalendarWeek,
  switchCalendarViewMode,
} from '../src/index.js';
import { makeAssignment } from './fixtures.js';

describe('calendar week, list, and view-mode helpers', () => {
  it('uses Monday-first weeks across months and years', () => {
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
    expect(addWeeks('2026-01-01', -1)).toBe('2025-12-25');
    expect(getWeekLabel('2026-08-05')).toBe('2026年8月3日 – 8月9日');
    expect(getVisibleWeekForMonth('2026-09', '2026-08-12')).toBe('2026-08-31');
    expect(getBusinessMonthsForWeek('2026-12-28')).toEqual(['2026-12', '2027-01']);
    expect(getWeekdayLabel('2026-08-03')).toBe('周一');
    expect(isWeekend('2026-08-08')).toBe(true);
    expect(formatChinaDateTime('2026-08-15T09:00:00+08:00')).toBe('2026-08-15 09:00');
    expect(() => addWeeks('2026-08-05', 1.5)).toThrow();
  });

  it('groups immutable assignments into ordered days and stable assignment order', () => {
    const assignments = Object.freeze([
      makeAssignment({ businessDate: '2026-08-16', id: 'later-day' }),
      makeAssignment({ id: 'second', startsAt: '2026-08-15T06:00:00+08:00' }),
      makeAssignment({ id: 'first', startsAt: '2026-08-15T06:00:00+08:00' }),
    ]);
    const snapshot = JSON.stringify(assignments);
    const days = buildDayList(assignments, '2026-08-15');
    expect(days.map(({ businessDate }) => businessDate)).toEqual(['2026-08-15', '2026-08-16']);
    expect(days[0]).toMatchObject({ isToday: true, weekdayLabel: '周六' });
    expect(days[0]?.assignments.map(({ id }) => id)).toEqual(['second', 'first']);
    expect(JSON.stringify(assignments)).toBe(snapshot);
  });

  it('keeps month/week/list transitions and exact three-slot rotation deterministic', () => {
    const initial = createCalendarViewModeState('2026-08-15');
    expect(initial).toEqual({ businessMonth: '2026-08', mode: 'month', weekStart: '2026-08-10' });
    const week = switchCalendarViewMode(initial, 'week', '2026-08-15');
    expect(stepCalendarWeek(week, 1)).toEqual({
      businessMonth: '2026-08',
      mode: 'week',
      weekStart: '2026-08-17',
    });
    expect(stepCalendarMonth(initial, 1, '2026-08-15')).toEqual({
      businessMonth: '2026-09',
      mode: 'month',
      weekStart: '2026-08-31',
    });
    expect(() => stepCalendarMonth(week, 1, '2026-08-15')).toThrow();
    expect(() => stepCalendarWeek(initial, 1)).toThrow();
    expect(recenterMonthSlots('2026-08')).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(rotateMonthSlots(['2026-07', '2026-08', '2026-09'], 2)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('centers today, this week, and a direct month while preserving documented modes', () => {
    const list = {
      businessMonth: '2026-06',
      mode: 'list',
      weekStart: '2026-06-01',
    } as const;
    expect(goCalendarToToday(list, '2026-08-15')).toEqual({
      businessMonth: '2026-08',
      mode: 'list',
      weekStart: '2026-08-10',
    });
    expect(goCalendarToThisWeek(list, '2026-08-15')).toEqual({
      businessMonth: '2026-08',
      mode: 'week',
      weekStart: '2026-08-10',
    });
    expect(goCalendarToBusinessMonth(list, '2027-01', '2026-08-15')).toEqual({
      businessMonth: '2027-01',
      mode: 'list',
      weekStart: '2026-12-28',
    });
    expect(() => goCalendarToBusinessMonth(list, '2027-13', '2026-08-15')).toThrow();
    expect(() => goCalendarToToday(list, '2026-02-29')).toThrow();
  });
});
