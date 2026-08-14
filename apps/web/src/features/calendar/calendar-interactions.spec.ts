import type { CalendarDutyAssignment, ConfirmedHolidayDate } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { isCalendarGridCellSelected } from './calendar-logic.js';
import {
  getDefaultSelectedDate,
  getMultiDayHolidayDates,
  getSwipeMonthIntent,
} from './calendar-views.js';

describe('calendar mobile interactions', () => {
  it('never selects leading or trailing empty cells when no selected date is supplied', () => {
    expect(isCalendarGridCellSelected(null, undefined)).toBe(false);
    expect(isCalendarGridCellSelected({ businessDate: '2026-08-01' }, undefined)).toBe(false);
    expect(isCalendarGridCellSelected({ businessDate: '2026-08-01' }, '2026-08-01')).toBe(true);
  });

  it('selects today for the current month', () => {
    expect(
      getDefaultSelectedDate({
        assignments: [assignment({ businessDate: '2026-08-01' })],
        businessMonth: '2026-08',
        today: '2026-08-14',
      }),
    ).toBe('2026-08-14');
  });

  it('selects the first scheduled date for another month, then falls back to day one', () => {
    expect(
      getDefaultSelectedDate({
        assignments: [
          assignment({ businessDate: '2026-09-20', id: 'late' }),
          assignment({ businessDate: '2026-09-03', id: 'early' }),
          assignment({ businessDate: '2026-10-01', id: 'outside' }),
        ],
        businessMonth: '2026-09',
        today: '2026-08-14',
      }),
    ).toBe('2026-09-03');
    expect(
      getDefaultSelectedDate({
        assignments: [],
        businessMonth: '2026-09',
        today: '2026-08-14',
      }),
    ).toBe('2026-09-01');
  });

  it('changes month only for a clear horizontal swipe of at least 56px', () => {
    expect(getSwipeMonthIntent({ deltaX: -72, deltaY: 12 })).toBe(1);
    expect(getSwipeMonthIntent({ deltaX: 72, deltaY: 12 })).toBe(-1);
    expect(getSwipeMonthIntent({ deltaX: -55, deltaY: 0 })).toBe(0);
    expect(getSwipeMonthIntent({ deltaX: -72, deltaY: 64 })).toBe(0);
  });

  it('tints every day in a consecutive multi-day off-day holiday, but not single days', () => {
    const holidays = new Map<string, ConfirmedHolidayDate>([
      ['2026-10-01', holiday('2026-10-01', '国庆节')],
      ['2026-10-02', holiday('2026-10-02', '国庆节')],
      ['2026-10-03', holiday('2026-10-03', '国庆节')],
      ['2026-10-10', holiday('2026-10-10', '国庆节', false, true)],
      ['2026-10-15', holiday('2026-10-15', '院庆日')],
    ]);

    expect([...getMultiDayHolidayDates(holidays)]).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });
});

function assignment(overrides: Partial<CalendarDutyAssignment> = {}): CalendarDutyAssignment {
  return {
    businessDate: '2026-08-01',
    changeMarkers: [],
    endsAt: '2026-08-01T08:00:00.000Z',
    id: 'assignment-1',
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
    slotPosition: 1,
    startsAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function holiday(
  date: string,
  holidayName: string,
  isOffDay = true,
  isWorkday = false,
): ConfirmedHolidayDate {
  return { date, holidayName, isOffDay, isWorkday };
}
