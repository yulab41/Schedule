import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';

export const calendarApiGoldenResponse = {
  assignments: [
    {
      actualMemberName: '李医生',
      actualMembershipId: 'membership-2',
      businessDate: '2026-08-22',
      changeMarkers: ['swap', 'leave-cover', 'overtime'],
      endsAt: '2026-08-23T00:00:00.000+08:00',
      id: 'assignment-1',
      plannedMemberName: '张医生',
      plannedMembershipId: 'membership-1',
      schedulePeriodId: 'period-1',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1f5aa6',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      shiftTypeTextColor: '#ffffff',
      slotPosition: 1,
      startsAt: '2026-08-22T00:00:00.000+08:00',
    },
  ],
  businessMonth: '2026-08',
  groupId: 'group-1',
  members: [
    {
      isConfirmed: true,
      membershipId: 'membership-1',
      mobilePhone: '13800138000',
      realName: '张医生',
      shortPhone: '61234',
    },
    {
      isConfirmed: false,
      membershipId: 'membership-2',
      realName: '李医生',
    },
  ],
  roles: [{ id: 'role-1', name: '一线' }],
  shiftTypes: [
    {
      abbreviation: '全',
      color: '#1f5aa6',
      crossesMidnight: true,
      endTime: '08:00',
      id: 'shift-1',
      isAllDay: true,
      name: '全天班',
      startTime: '08:00',
      textColor: '#ffffff',
    },
  ],
} as const satisfies CalendarReadModel;

export const holidayApiGoldenResponse = {
  confirmed: true,
  dates: [
    { date: '2026-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false },
    { date: '2026-02-28', holidayName: '春节调休', isOffDay: false, isWorkday: true },
  ],
  year: 2026,
} as const satisfies HolidayReadModel;
