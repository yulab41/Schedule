import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  addBusinessMonths,
  buildMonthGrid,
  filterCalendarAssignments,
  formatShiftTimeRange,
  getBusinessMonthLabel,
  getCalendarMarkerDescription,
  getCalendarMarkerLabel,
  getAvailablePhoneActions,
  getCurrentBusinessDate,
  getCurrentBusinessMonth,
  getDutyMemberName,
  getHolidayShortLabel,
  isPastBusinessDate,
  parseBusinessDate,
  parseBusinessMonth,
  sortCalendarAssignments,
} from './calendar-logic.js';

function makeAssignment(overrides: Partial<CalendarDutyAssignment> = {}): CalendarDutyAssignment {
  return {
    businessDate: '2026-08-01',
    changeMarkers: [],
    endsAt: '2026-08-01T16:00:00+08:00',
    id: 'assignment',
    plannedMemberName: '计划姓名',
    plannedMembershipId: 'planned-member',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '医生',
    shiftTypeAbbreviation: '日',
    shiftTypeColor: '#123456',
    shiftTypeId: 'shift-1',
    shiftTypeName: '日班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-01T08:00:00+08:00',
    ...overrides,
  } satisfies CalendarDutyAssignment;
}
function makeMember(overrides: Partial<CalendarDutyMember> = {}): CalendarDutyMember {
  return {
    isConfirmed: true,
    membershipId: 'member-1',
    mobilePhone: '13800000000',
    realName: '张医生',
    shortPhone: '6601',
    ...overrides,
  } satisfies CalendarDutyMember;
}

describe('calendar logic', () => {
  it('uses CST and validates business dates and months', () => {
    expect(getCurrentBusinessDate(new Date('2026-07-31T16:00:00.000Z'))).toBe('2026-08-01');
    expect(getCurrentBusinessMonth(new Date('2026-07-31T16:00:00.000Z'))).toBe('2026-08');
    expect(addBusinessMonths('2026-01', -1)).toBe('2025-12');
    expect(getBusinessMonthLabel('2026-08')).toBe('2026年8月');
    expect(isPastBusinessDate('2026-08-03', '2026-08-04')).toBe(true);
    expect(() => parseBusinessMonth('2026-13')).toThrow();
    expect(() => parseBusinessDate('2026-02-29')).toThrow();
  });
  it('builds a Monday-first seven-column August 2026 grid', () => {
    const weeks = buildMonthGrid(2026, 8);
    expect(weeks[0]?.map((cell) => cell?.businessDate)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-08-01',
      '2026-08-02',
    ]);
    expect(weeks.at(-1)?.[0]?.businessDate).toBe('2026-08-31');
  });
  it('filters immutably and keeps empty actual names', () => {
    const source = Object.freeze([
      makeAssignment({ id: 'show', actualMemberName: '', changeMarkers: ['swap'] }),
      makeAssignment({ id: 'hide', scheduleRoleId: 'other' }),
    ]);
    expect(
      filterCalendarAssignments(source, { onlyChanges: true, roleIds: ['role-1'] }).map(
        ({ id }) => id,
      ),
    ).toEqual(['show']);
    expect(getDutyMemberName(source[0]!)).toBe('');
    expect(source.map(({ id }) => id)).toEqual(['show', 'hide']);
  });
  it('sorts stable same-day assignments with midnight last', () => {
    const source = [
      makeAssignment({ id: 'first', startsAt: '2026-08-01T06:00:00+08:00' }),
      makeAssignment({ id: 'midnight', startsAt: '2026-08-01T00:00:00+08:00' }),
      makeAssignment({ id: 'later', startsAt: '2026-08-01T07:00:00+08:00' }),
      makeAssignment({ id: 'second', startsAt: '2026-08-01T06:00:00+08:00' }),
    ];
    expect(sortCalendarAssignments(source).map(({ id }) => id)).toEqual([
      'first',
      'second',
      'later',
      'midnight',
    ]);
    expect(formatShiftTimeRange(makeAssignment())).toBe('08:00–16:00');
  });
  it('maps holiday and phone display actions without inventing contact state', () => {
    expect(getHolidayShortLabel('劳动节')).toBe('五一');
    expect(getHolidayShortLabel('国庆节')).toBe('国庆');
    const markers = ['swap', 'leave-cover', 'overtime'] as const;
    expect(markers.map(getCalendarMarkerLabel)).toEqual(['换', '替', '加']);
    expect(markers.map(getCalendarMarkerDescription)).toEqual(['换班', '请假替班', '加班']);
    expect(getAvailablePhoneActions(undefined)).toEqual([]);
    expect(
      getAvailablePhoneActions(makeMember({ isConfirmed: false })).map(({ kind }) => kind),
    ).toEqual(['copy', 'copy']);
  });
});
