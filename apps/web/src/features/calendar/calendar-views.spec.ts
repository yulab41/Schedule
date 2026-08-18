import type { CalendarDutyAssignment } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  addWeeks,
  buildDayList,
  getBusinessDate,
  getBusinessMonthOf,
  getPreferredViewMode,
  retargetSelectedDateToMonth,
  getVisibleWeekForMonth,
  getWeekBusinessMonths,
  getWeekDays,
  getWeekIndexForToday,
  getWeekLabel,
  getWeekOfMonthLabel,
  getWeekStartDate,
  groupAssignmentsByDate,
  isWeekend,
  truncateCalendarBadgeLabel,
} from './calendar-views.js';

function assignment(businessDate: string, slotPosition = 1): CalendarDutyAssignment {
  return {
    businessDate,
    changeMarkers: [],
    endsAt: `${businessDate}T16:00:00.000Z`,
    id: `${businessDate}-${slotPosition}`,
    plannedMembershipId: 'membership-1',
    plannedMemberName: '张医生',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-1',
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition,
    startsAt: `${businessDate}T00:00:00.000Z`,
  };
}

describe('Calendar view helpers', () => {
  it('computes the China Standard Time business date', () => {
    expect(getBusinessDate(new Date('2026-08-01T17:00:00.000Z'))).toBe('2026-08-01');
    expect(getBusinessMonthOf('2026-08-05')).toBe('2026-08');
  });

  it('retargets the selected day to the displayed month as one complete date key', () => {
    expect(retargetSelectedDateToMonth('2026-08-14', '2026-09')).toBe('2026-09-14');
    expect(retargetSelectedDateToMonth('2026-01-31', '2026-02')).toBe('2026-02-28');
    expect(retargetSelectedDateToMonth('2028-01-31', '2028-02')).toBe('2028-02-29');
  });

  it('builds Monday-first weeks and moves between weeks', () => {
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
  });

  it('labels weeks by their calendar-month ordinal', () => {
    expect(getWeekOfMonthLabel('2026-08-10')).toBe('8月第3周');
    expect(getWeekOfMonthLabel('2026-07-30')).toBe('7月第5周-8月第1周');
    expect(getWeekOfMonthLabel('2026-08-31')).toBe('8月第6周-9月第1周');
    expect(getWeekOfMonthLabel('2026-09-07')).toBe('9月第2周');
  });

  it('loads every month touched by a continuous Monday-to-Sunday week', () => {
    expect(getWeekBusinessMonths('2026-07-30')).toEqual(['2026-07', '2026-08']);
    expect(getWeekBusinessMonths('2026-08-10')).toEqual(['2026-08']);
  });

  it('keeps compact calendar badges on one line with at most two characters', () => {
    expect(truncateCalendarBadgeLabel('全天')).toBe('全天');
    expect(truncateCalendarBadgeLabel('全天班')).toBe('全天');
    expect(truncateCalendarBadgeLabel('AM')).toBe('AM');
    expect(truncateCalendarBadgeLabel('DAY')).toBe('DA');
  });

  it('chooses the week containing today when today is inside the displayed month', () => {
    expect(getVisibleWeekForMonth('2026-08', '2026-08-12')).toBe('2026-08-10');
    expect(getVisibleWeekForMonth('2026-09', '2026-08-12')).toBe('2026-08-31');
  });

  it('finds the today row in a month grid', () => {
    const weeks = [
      [
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
        '2026-08-06',
        '2026-08-07',
        '2026-08-08',
        '2026-08-09',
      ],
      [
        '2026-08-10',
        '2026-08-11',
        '2026-08-12',
        '2026-08-13',
        '2026-08-14',
        '2026-08-15',
        '2026-08-16',
      ],
    ].map((dates) =>
      dates.map((businessDate) => (businessDate === null ? null : { businessDate })),
    );
    expect(getWeekIndexForToday(weeks, '2026-08-12')).toBe(1);
    expect(getWeekIndexForToday(weeks, '2026-09-01')).toBeUndefined();
  });

  it('defaults every device to the month calendar view', () => {
    expect(getPreferredViewMode()).toBe('month');
  });

  it('groups and orders assignments per day for month, week, and list views', () => {
    const assignments = [assignment('2026-08-05'), assignment('2026-08-03', 2)];
    const grouped = groupAssignmentsByDate(assignments);
    expect([...grouped.keys()]).toEqual(['2026-08-05', '2026-08-03']);

    const days = buildDayList(assignments, '2026-08-03');
    expect(days[0]?.businessDate).toBe('2026-08-03');
    expect(days[0]?.isToday).toBe(true);
    expect(days[0]?.weekdayLabel).toBe('周一');
    expect(days[1]?.businessDate).toBe('2026-08-05');
    expect(days[1]?.isToday).toBe(false);
  });

  it('detects weekends and weekdays', () => {
    expect(isWeekend('2026-08-08')).toBe(true);
    expect(isWeekend('2026-08-09')).toBe(true);
    expect(isWeekend('2026-08-10')).toBe(false);
    expect(isWeekend('2026-08-03')).toBe(false);
  });

  it('orders multiple shift types on the same day by shift start time', () => {
    const assignments = [
      assignment('2026-08-05', 1),
      { ...assignment('2026-08-05', 2), startsAt: '2026-08-05T08:00:00.000Z' },
      { ...assignment('2026-08-05', 3), startsAt: '2026-08-04T16:00:00.000Z' },
    ];
    const grouped = groupAssignmentsByDate(assignments);
    const day = grouped.get('2026-08-05') ?? [];
    expect(day.map((item) => item.startsAt)).toEqual([
      '2026-08-05T00:00:00.000Z',
      '2026-08-05T08:00:00.000Z',
      '2026-08-04T16:00:00.000Z',
    ]);
  });
});
