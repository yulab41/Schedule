import type { CalendarReadModel, CalendarDutyAssignment, HolidayReadModel } from '../src/index.js';

export function makeAssignment(
  overrides: Partial<CalendarDutyAssignment> = {},
): CalendarDutyAssignment {
  return {
    businessDate: '2026-08-15',
    changeMarkers: [],
    endsAt: '2026-08-15T16:00:00+08:00',
    id: 'assignment-1',
    plannedMemberName: '计划医生',
    plannedMembershipId: 'member-1',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '门诊',
    shiftTypeAbbreviation: '全天',
    shiftTypeColor: '#123456',
    shiftTypeId: 'shift-1',
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-15T08:00:00+08:00',
    ...overrides,
  };
}

export const calendarFixture: CalendarReadModel = {
  assignments: [
    makeAssignment({
      changeMarkers: ['leave-cover'],
      id: 'later',
      plannedMemberName: '一位名字很长的值班医生',
      slotPosition: 2,
      startsAt: '2026-08-15T09:00:00+08:00',
    }),
    makeAssignment({
      actualMemberName: '实际替班医生',
      actualMembershipId: 'member-2',
      changeMarkers: ['swap', 'overtime'],
      endsAt: '2026-08-15T07:00:00+08:00',
      id: 'earlier',
      startsAt: '2026-08-15T06:00:00+08:00',
    }),
    makeAssignment({
      actualMemberName: '',
      actualMembershipId: 'member-3',
      businessDate: '2026-08-16',
      id: 'empty-name',
      schedulePeriodId: 'period-2',
      scheduleRoleId: 'role-2',
      scheduleRoleName: '急诊',
      shiftTypeAbbreviation: '夜',
      shiftTypeColor: '#654321',
      shiftTypeId: 'shift-2',
      shiftTypeName: '夜班',
      shiftTypeTextColor: '#000000',
    }),
  ],
  businessMonth: '2026-08',
  groupId: 'group-1',
  members: [
    {
      isConfirmed: true,
      membershipId: 'member-1',
      mobilePhone: 'SYNTHETIC-LONG-NUMBER',
      realName: '计划医生',
      shortPhone: 'SYNTHETIC-SHORT-NUMBER',
    },
    {
      isConfirmed: false,
      membershipId: 'member-2',
      mobilePhone: 'UNCONFIRMED-SYNTHETIC-NUMBER',
      realName: '实际替班医生',
    },
    { isConfirmed: true, membershipId: 'member-3', realName: '无号码医生' },
  ],
  roles: [
    { id: 'role-1', name: '门诊' },
    { id: 'role-2', name: '急诊' },
  ],
  shiftTypes: [
    {
      abbreviation: '全天',
      color: '#123456',
      crossesMidnight: false,
      id: 'shift-1',
      isAllDay: false,
      name: '全天班',
      textColor: '#FFFFFF',
    },
    {
      abbreviation: '夜',
      color: '#654321',
      crossesMidnight: true,
      id: 'shift-2',
      isAllDay: false,
      name: '夜班',
      textColor: '#000000',
    },
  ],
};

export const holidayFixture: HolidayReadModel = {
  confirmed: true,
  dates: [
    { date: '2026-08-16', holidayName: '劳动节', isOffDay: true, isWorkday: false },
    { date: '2026-08-17', holidayName: '补班日', isOffDay: false, isWorkday: true },
  ],
  year: 2026,
};
