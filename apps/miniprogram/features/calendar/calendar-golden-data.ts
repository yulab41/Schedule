import type {
  CalendarChangeMarker,
  CalendarDutyMember,
  CalendarReadModel,
  HolidayReadModel,
  ScheduleEvent,
} from '@schedule/contracts';

export const calendarFixtureGroupId = 'fixture-group';
export const calendarFixtureGroupName = '测试排班组';
export const goldenBusinessMonth = '2026-08';
export const goldenToday = '2026-08-10';

const primaryRole = {
  id: 'fixture-role-primary',
  name: '测试一线',
} as const;
const secondaryRole = {
  id: 'fixture-role-secondary',
  name: '测试二线',
} as const;
const allDayShiftType = {
  abbreviation: '全天',
  color: '#1F5AA6',
  crossesMidnight: true,
  endTime: '08:00',
  id: 'fixture-shift-all-day',
  isAllDay: true,
  name: '测试全天班',
  startTime: '08:00',
  textColor: '#FFFFFF',
} as const;
const eveningShiftType = {
  abbreviation: '晚班',
  color: '#C2410C',
  crossesMidnight: true,
  endTime: '08:00',
  id: 'fixture-shift-evening',
  isAllDay: false,
  name: '测试晚班',
  startTime: '20:00',
  textColor: '#FFFFFF',
} as const;
const members: readonly CalendarDutyMember[] = [
  {
    isConfirmed: true,
    membershipId: 'fixture-member-a',
    mobilePhone: 'FIXTURE-CONFIRMED-PHONE',
    realName: '测试成员甲',
    shortPhone: 'FIXTURE-SHORT-PHONE',
  },
  { isConfirmed: false, membershipId: 'fixture-member-b', realName: '测试成员乙' },
  { isConfirmed: false, membershipId: 'fixture-member-c', realName: '测试成员丙' },
  {
    isConfirmed: false,
    membershipId: 'fixture-member-d',
    mobilePhone: 'SYNTHETIC-LONG-NUMBER',
    realName: '测试成员丁',
  },
  { isConfirmed: false, membershipId: 'fixture-member-e', realName: '测试成员戊' },
  { isConfirmed: false, membershipId: 'fixture-member-f', realName: '测试成员己' },
];

interface AssignmentOverride {
  readonly actualMembershipId?: string;
  readonly changeMarkers?: readonly CalendarChangeMarker[];
  readonly plannedMembershipId?: string;
}

const assignmentOverrides: Readonly<Record<string, AssignmentOverride>> = {
  '2026-08-08': {
    actualMembershipId: 'fixture-member-f',
    changeMarkers: ['swap'],
    plannedMembershipId: 'fixture-member-d',
  },
  '2026-08-12': {
    actualMembershipId: 'fixture-member-c',
    changeMarkers: ['overtime'],
    plannedMembershipId: 'fixture-member-b',
  },
  '2026-08-15': {
    actualMembershipId: 'fixture-member-d',
    plannedMembershipId: 'fixture-member-d',
  },
  '2026-09-16': {
    actualMembershipId: 'fixture-member-b',
    changeMarkers: ['swap'],
    plannedMembershipId: 'fixture-member-c',
  },
  '2026-09-18': {
    actualMembershipId: 'fixture-member-d',
    changeMarkers: ['overtime'],
    plannedMembershipId: 'fixture-member-e',
  },
};

function memberFor(membershipId: string): CalendarDutyMember {
  return members.find((member) => member.membershipId === membershipId) ?? members[0]!;
}

function nextUtcMidnight(businessDate: string): string {
  const date = new Date(`${businessDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function createAssignments(businessMonth: string): CalendarReadModel['assignments'] {
  if (businessMonth !== '2026-08' && businessMonth !== '2026-09') return [];
  const [yearText, monthText] = businessMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const primaryAssignments: CalendarReadModel['assignments'] = Array.from(
    { length: dayCount },
    (_, index) => {
      const businessDate = `${businessMonth}-${String(index + 1).padStart(2, '0')}`;
      const defaultMember = members[index % members.length] ?? members[0]!;
      const override = assignmentOverrides[businessDate];
      const plannedMember = memberFor(override?.plannedMembershipId ?? defaultMember.membershipId);
      const actualMember = memberFor(override?.actualMembershipId ?? plannedMember.membershipId);
      return {
        actualMemberName: actualMember.realName,
        actualMembershipId: actualMember.membershipId,
        businessDate,
        changeMarkers: override?.changeMarkers ?? [],
        endsAt: nextUtcMidnight(businessDate),
        id: `fixture-assignment-${businessDate}`,
        plannedMemberName: plannedMember.realName,
        plannedMembershipId: plannedMember.membershipId,
        schedulePeriodId: `fixture-period-${businessMonth}`,
        scheduleRoleId: primaryRole.id,
        scheduleRoleName: primaryRole.name,
        shiftTypeAbbreviation: allDayShiftType.abbreviation,
        shiftTypeColor: allDayShiftType.color,
        shiftTypeId: allDayShiftType.id,
        shiftTypeName: allDayShiftType.name,
        shiftTypeTextColor: allDayShiftType.textColor,
        slotPosition: 1,
        startsAt: `${businessDate}T00:00:00.000Z`,
      };
    },
  );
  const secondaryAssignments: CalendarReadModel['assignments'] =
    businessMonth === '2026-08'
      ? [
          {
            actualMemberName: members[0]!.realName,
            actualMembershipId: members[0]!.membershipId,
            businessDate: '2026-08-15',
            changeMarkers: ['leave-cover'],
            endsAt: nextUtcMidnight('2026-08-15'),
            id: 'fixture-assignment-2026-08-15-secondary',
            plannedMemberName: members[3]!.realName,
            plannedMembershipId: members[3]!.membershipId,
            schedulePeriodId: 'fixture-period-2026-08',
            scheduleRoleId: secondaryRole.id,
            scheduleRoleName: secondaryRole.name,
            shiftTypeAbbreviation: eveningShiftType.abbreviation,
            shiftTypeColor: eveningShiftType.color,
            shiftTypeId: eveningShiftType.id,
            shiftTypeName: eveningShiftType.name,
            shiftTypeTextColor: eveningShiftType.textColor,
            slotPosition: 2,
            startsAt: '2026-08-15T12:00:00.000Z',
          },
        ]
      : [];
  return [...primaryAssignments, ...secondaryAssignments];
}

function createCalendar(businessMonth: string): CalendarReadModel {
  const assignments = createAssignments(businessMonth);
  return {
    assignments,
    businessMonth,
    groupId: calendarFixtureGroupId,
    members: assignments.length === 0 ? [] : members,
    roles: assignments.length === 0 ? [] : [primaryRole, secondaryRole],
    shiftTypes: assignments.length === 0 ? [] : [allDayShiftType, eveningShiftType],
  };
}

const fixtureMonths = Array.from(
  { length: 12 },
  (_, index) => `2026-${String(index + 1).padStart(2, '0')}`,
);

export const goldenCalendars: Readonly<Record<string, CalendarReadModel>> = Object.freeze(
  Object.fromEntries(
    fixtureMonths.map((businessMonth) => [businessMonth, createCalendar(businessMonth)]),
  ) as Record<string, CalendarReadModel>,
);

export function getGoldenCalendar(businessMonth: string): CalendarReadModel {
  return goldenCalendars[businessMonth] ?? createCalendar(businessMonth);
}

export const goldenCalendar = getGoldenCalendar(goldenBusinessMonth);

const holidaySeeds = [
  ['2026-01-01', '元旦'],
  ['2026-01-02', '元旦'],
  ['2026-01-03', '元旦'],
  ['2026-01-04', '元旦调休', true],
  ['2026-02-14', '春节调休', true],
  ['2026-02-15', '春节'],
  ['2026-02-16', '春节'],
  ['2026-02-17', '春节'],
  ['2026-02-18', '春节'],
  ['2026-02-19', '春节'],
  ['2026-02-20', '春节'],
  ['2026-02-21', '春节'],
  ['2026-02-22', '春节'],
  ['2026-02-23', '春节'],
  ['2026-02-28', '春节调休', true],
  ['2026-04-04', '清明节'],
  ['2026-04-05', '清明节'],
  ['2026-04-06', '清明节'],
  ['2026-05-01', '劳动节'],
  ['2026-05-02', '劳动节'],
  ['2026-05-03', '劳动节'],
  ['2026-05-04', '劳动节'],
  ['2026-05-05', '劳动节'],
  ['2026-05-09', '劳动节调休', true],
  ['2026-06-19', '端午节'],
  ['2026-06-20', '端午节'],
  ['2026-06-21', '端午节'],
  ['2026-09-20', '国庆节调休', true],
  ['2026-09-25', '中秋节'],
  ['2026-09-26', '中秋节'],
  ['2026-09-27', '中秋节'],
  ['2026-10-01', '国庆节'],
  ['2026-10-02', '国庆节'],
  ['2026-10-03', '国庆节'],
  ['2026-10-04', '国庆节'],
  ['2026-10-05', '国庆节'],
  ['2026-10-06', '国庆节'],
  ['2026-10-07', '国庆节'],
  ['2026-10-10', '国庆节调休', true],
] as const;

export const goldenHolidays: HolidayReadModel = {
  confirmed: true,
  dates: holidaySeeds.map(([date, holidayName, isWorkday = false]) => ({
    date,
    holidayName,
    isOffDay: !isWorkday,
    isWorkday,
  })),
  year: 2026,
};

const eventTypes = [
  'swap_completed',
  'swap_completed',
  'swap_completed',
  'duty_adjustment_completed',
  'duty_adjustment_completed',
  'duty_adjustment_completed',
  'swap_request_created',
  'swap_request_accepted',
  'swap_request_approved',
  'leave_request_submitted',
  'leave_request_approved',
  'leave_cover_completed',
  'duty_adjustment_request_created',
  'duty_adjustment_request_approved',
] as const;

export const goldenEvents: readonly ScheduleEvent[] = eventTypes.map((eventType, index) => ({
  affectedMembershipIds: ['fixture-member-a', 'fixture-member-b'],
  affectedShiftIds: [`fixture-assignment-2026-09-${String(index + 1).padStart(2, '0')}`],
  eventStatus: eventType.endsWith('_completed') ? 'completed' : 'pending',
  eventType,
  groupId: calendarFixtureGroupId,
  id: `fixture-event-${index + 1}`,
  objectId: `fixture-object-${index + 1}`,
  objectType: eventType.startsWith('swap') ? 'swap_request' : 'fixture_request',
  occurredAt: `2026-09-${String(index + 1).padStart(2, '0')}T09:00:00+08:00`,
  operationId: `fixture-operation-${index + 1}`,
  schedulePeriodId: 'fixture-period-2026-09',
}));
