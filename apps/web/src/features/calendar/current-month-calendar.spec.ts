import type { CalendarChangeMarker, CalendarDutyAssignment } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  addBusinessMonths,
  buildDialLink,
  buildMonthGrid,
  createLatestRequestTracker,
  filterCalendarAssignments,
  getAvailablePhoneOptions,
  getBusinessMonthLabel,
  getCalendarMarkerDescription,
  getCalendarMarkerLabel,
  getCurrentBusinessMonth,
  getDutyMemberName,
  getHolidayShortLabel,
  formatShiftTimeRange,
  isPastBusinessDate,
} from './calendar-logic.js';

describe('current month calendar logic', () => {
  it('computes the China Standard Time business month from any timestamp', () => {
    expect(getCurrentBusinessMonth(new Date('2026-08-01T02:00:00.000Z'))).toBe('2026-08');
    expect(getCurrentBusinessMonth(new Date('2026-07-31T16:30:00.000Z'))).toBe('2026-07');
    expect(getCurrentBusinessMonth(new Date('2026-07-31T15:59:59.000Z'))).toBe('2026-07');
  });

  it('formats shift time ranges as China Standard Time wall-clock times', () => {
    expect(formatShiftTimeRange(assignment())).toBe('00:00–08:00');
  });

  it('marks dates strictly before today as past', () => {
    expect(isPastBusinessDate('2026-08-03', '2026-08-04')).toBe(true);
    expect(isPastBusinessDate('2026-08-04', '2026-08-04')).toBe(false);
    expect(isPastBusinessDate('2026-08-05', '2026-08-04')).toBe(false);
  });

  it('shifts months across year boundaries and labels them in Chinese', () => {
    expect(addBusinessMonths('2026-01', -1)).toBe('2025-12');
    expect(addBusinessMonths('2026-12', 1)).toBe('2027-01');
    expect(addBusinessMonths('2026-08', 3)).toBe('2026-11');
    expect(() => addBusinessMonths('2026-8', 1)).toThrow();
    expect(getBusinessMonthLabel('2026-08')).toBe('2026年8月');
  });

  it('builds a Monday-first grid that covers the whole month', () => {
    const leapFebruary = buildMonthGrid(2028, 2);
    const days = leapFebruary.flat().filter((cell) => cell !== null);

    expect(leapFebruary[0]?.[0]).toBeNull();
    expect(leapFebruary[0]?.[1]?.businessDate).toBe('2028-02-01');
    expect(days.at(-1)?.businessDate).toBe('2028-02-29');
    expect(days).toHaveLength(29);
    expect(leapFebruary.every((week) => week.length === 7)).toBe(true);

    const august = buildMonthGrid(2026, 8);
    expect(august[0]?.[0]).toBeNull();
    expect(august[0]?.[5]?.businessDate).toBe('2026-08-01');
    expect(august).toHaveLength(6);
  });

  it('filters assignments by role, shift type, member, and change markers', () => {
    const assignments = [
      assignment({ changeMarkers: ['swap'], scheduleRoleId: 'role-1', shiftTypeId: 'shift-1' }),
      assignment({
        actualMembershipId: 'membership-2',
        actualMemberName: '李医生',
        changeMarkers: [],
        plannedMembershipId: 'membership-1',
        plannedMemberName: '张医生',
        scheduleRoleId: 'role-2',
        scheduleRoleName: '二线',
        shiftTypeId: 'shift-2',
      }),
    ];

    expect(filterCalendarAssignments(assignments, { roleIds: ['role-1'] })).toEqual([
      assignments[0],
    ]);
    expect(filterCalendarAssignments(assignments, { shiftTypeIds: ['shift-2'] })).toEqual([
      assignments[1],
    ]);
    expect(filterCalendarAssignments(assignments, { membershipIds: ['membership-2'] })).toEqual([
      assignments[1],
    ]);
    expect(filterCalendarAssignments(assignments, { onlyChanges: true })).toEqual([assignments[0]]);
    expect(filterCalendarAssignments(assignments, {})).toEqual(assignments);
    expect(
      filterCalendarAssignments(assignments, {
        membershipIds: ['membership-1'],
        onlyChanges: true,
      }),
    ).toEqual([assignments[0]]);
  });

  it('shows the actual member as the displayed duty person', () => {
    const swapped = assignment({
      actualMembershipId: 'membership-2',
      actualMemberName: '李医生',
      plannedMembershipId: 'membership-1',
      plannedMemberName: '张医生',
    });

    expect(getDutyMemberName(swapped)).toBe('李医生');
    expect(getDutyMemberName(assignment())).toBe('张医生');
  });

  it('offers phone numbers with confirmation state and builds valid dial links', () => {
    expect(getAvailablePhoneOptions(undefined)).toEqual([]);
    expect(
      getAvailablePhoneOptions({ isConfirmed: false, membershipId: 'm', realName: '张医生' }),
    ).toEqual([]);
    expect(
      getAvailablePhoneOptions({
        isConfirmed: false,
        membershipId: 'm',
        mobilePhone: '13800138000',
        realName: '张医生',
      }),
    ).toEqual([{ isConfirmed: false, label: '长号', number: '13800138000' }]);
    expect(
      getAvailablePhoneOptions({
        isConfirmed: true,
        membershipId: 'm',
        mobilePhone: '13800138000',
        realName: '张医生',
        shortPhone: '12345',
      }),
    ).toEqual([
      { isConfirmed: true, label: '长号', number: '13800138000' },
      { isConfirmed: true, label: '短号', number: '12345' },
    ]);
    expect(
      getAvailablePhoneOptions({
        isConfirmed: true,
        membershipId: 'm',
        realName: '张医生',
      }),
    ).toEqual([]);
    expect(buildDialLink('13800138000')).toBe('tel:13800138000');
    expect(() => buildDialLink('')).toThrow();
  });

  it('labels and describes the change markers', () => {
    const markers: readonly CalendarChangeMarker[] = ['swap', 'leave-cover', 'overtime'];
    expect(markers.map(getCalendarMarkerLabel)).toEqual(['换', '替', '加']);
    expect(markers.map(getCalendarMarkerDescription)).toEqual(['换班', '请假替班', '加班']);
  });

  it('shortens long holiday names for compact calendar cells', () => {
    expect(getHolidayShortLabel('国庆节')).toBe('国庆');
    expect(getHolidayShortLabel('清明节')).toBe('清明');
    expect(getHolidayShortLabel('劳动节')).toBe('五一');
    expect(getHolidayShortLabel('春节')).toBe('春节');
    expect(getHolidayShortLabel('中国人民解放军建军纪念日')).toBe('中国人民');
  });

  it('ignores stale calendar responses after a newer request starts', () => {
    const tracker = createLatestRequestTracker();
    const first = tracker.begin();
    const second = tracker.begin();

    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(second)).toBe(true);
  });
});

function assignment(overrides: Partial<CalendarDutyAssignment> = {}): CalendarDutyAssignment {
  return {
    businessDate: '2026-08-01',
    changeMarkers: [],
    endsAt: '2026-08-01T00:00:00.000Z',
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
    startsAt: '2026-07-31T16:00:00.000Z',
    ...overrides,
  };
}
