export const validCalendarDutyAssignment = {
  actualMemberName: '冯欣',
  actualMembershipId: 'membership-actual',
  businessDate: '2026-08-13',
  changeMarkers: ['swap', 'leave-cover', 'overtime'],
  endsAt: '2026-08-14T08:00:00+08:00',
  id: 'assignment-1',
  plannedMemberName: '林恩宇',
  plannedMembershipId: 'membership-planned',
  schedulePeriodId: 'period-1',
  scheduleRoleId: 'role-1',
  scheduleRoleName: '一线',
  shiftTypeAbbreviation: '全',
  shiftTypeColor: '#1A73E8',
  shiftTypeId: 'shift-type-1',
  shiftTypeName: '全天班',
  shiftTypeTextColor: '#FFFFFF',
  slotPosition: 1,
  startsAt: '2026-08-13T08:00:00+08:00',
};

export const validCalendarDutyMember = {
  isConfirmed: true,
  membershipId: 'membership-actual',
  mobilePhone: 'phone-placeholder',
  realName: '冯欣',
  shortPhone: 'short-placeholder',
};

export const validCalendarRole = { id: 'role-1', name: '一线' };

export const validCalendarShiftType = {
  abbreviation: '全',
  color: '#1A73E8',
  crossesMidnight: false,
  endTime: '08:00',
  id: 'shift-type-1',
  isAllDay: true,
  name: '全天班',
  startTime: '08:00',
  textColor: '#FFFFFF',
};

export const validCalendarReadModel = {
  assignments: [validCalendarDutyAssignment],
  businessMonth: '2026-08',
  groupId: 'group-1',
  members: [validCalendarDutyMember],
  roles: [validCalendarRole],
  shiftTypes: [validCalendarShiftType],
};

export const validGuestCalendarReadModel = {
  calendar: validCalendarReadModel,
  groupName: '测试群组',
};

const calendarWithInheritedExtra = Object.assign(
  Object.create({ inheritedExtra: true }),
  validCalendarReadModel,
);
const assignmentWithInheritedExtra = Object.assign(
  Object.create({ inheritedExtra: true }),
  validCalendarDutyAssignment,
);
const proxiedOptionalAssignment = new Proxy(
  { ...validCalendarDutyAssignment },
  {
    get(target, property, receiver) {
      return property === 'actualMemberName' ? '代理姓名' : Reflect.get(target, property, receiver);
    },
    has(target, property) {
      return property === 'actualMemberName' ? false : Reflect.has(target, property);
    },
  },
);
const inheritedAssignmentPrototype = Object.create(
  Array.prototype,
) as (typeof validCalendarDutyAssignment)[];
inheritedAssignmentPrototype[0] = validCalendarDutyAssignment;
const assignmentsWithInheritedIndex = new Array<typeof validCalendarDutyAssignment>(1);
Object.setPrototypeOf(assignmentsWithInheritedIndex, inheritedAssignmentPrototype);
const inheritedMarkerPrototype = Object.create(Array.prototype) as string[];
inheritedMarkerPrototype[0] = 'swap';
const markersWithInheritedIndex = new Array<string>(1);
Object.setPrototypeOf(markersWithInheritedIndex, inheritedMarkerPrototype);

export const calendarReadModelCorpus: readonly {
  readonly expected: boolean;
  readonly name: string;
  readonly value: unknown;
}[] = [
  { expected: true, name: 'accepts a complete calendar snapshot', value: validCalendarReadModel },
  {
    expected: true,
    name: 'accepts empty collections and the contract empty group id',
    value: {
      assignments: [],
      businessMonth: '2026-02',
      groupId: '',
      members: [],
      roles: [],
      shiftTypes: [],
    },
  },
  {
    expected: true,
    name: 'retains an optional proxy value when its has trap returns false',
    value: { ...validCalendarReadModel, assignments: [proxiedOptionalAssignment] },
  },
  {
    expected: true,
    name: 'decodes an inherited assignment array index',
    value: { ...validCalendarReadModel, assignments: assignmentsWithInheritedIndex },
  },
  {
    expected: true,
    name: 'decodes an inherited change marker array index',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, changeMarkers: markersWithInheritedIndex }],
    },
  },
  {
    expected: true,
    name: 'accepts omitted optional assignment, member, and shift fields',
    value: {
      ...validCalendarReadModel,
      assignments: [
        {
          ...validCalendarDutyAssignment,
          actualMemberName: undefined,
          actualMembershipId: undefined,
          plannedMemberName: undefined,
          plannedMembershipId: undefined,
        },
      ],
      members: [
        {
          ...validCalendarDutyMember,
          mobilePhone: undefined,
          shortPhone: undefined,
        },
      ],
      shiftTypes: [
        {
          ...validCalendarShiftType,
          endTime: undefined,
          startTime: undefined,
        },
      ],
    },
  },
  { expected: false, name: 'rejects null', value: null },
  { expected: false, name: 'rejects an array root', value: [] },
  {
    expected: false,
    name: 'rejects missing root fields',
    value: { ...validCalendarReadModel, assignments: undefined },
  },
  {
    expected: false,
    name: 'rejects extra root fields',
    value: { ...validCalendarReadModel, extra: true },
  },
  {
    expected: false,
    name: 'rejects inherited enumerable root fields',
    value: calendarWithInheritedExtra,
  },
  {
    expected: false,
    name: 'rejects malformed business months',
    value: { ...validCalendarReadModel, businessMonth: '2026-8' },
  },
  {
    expected: false,
    name: 'rejects non-string group ids',
    value: { ...validCalendarReadModel, groupId: 1 },
  },
  {
    expected: false,
    name: 'rejects a non-array assignment collection',
    value: { ...validCalendarReadModel, assignments: {} },
  },
  {
    expected: false,
    name: 'rejects extra assignment fields',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, extra: true }],
    },
  },
  {
    expected: false,
    name: 'rejects inherited enumerable assignment fields',
    value: { ...validCalendarReadModel, assignments: [assignmentWithInheritedExtra] },
  },
  {
    expected: false,
    name: 'rejects malformed assignment business dates',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, businessDate: '2026-8-13' }],
    },
  },
  {
    expected: false,
    name: 'rejects unknown change markers',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, changeMarkers: ['deduction'] }],
    },
  },
  {
    expected: false,
    name: 'rejects empty required assignment ids',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, id: '' }],
    },
  },
  {
    expected: false,
    name: 'rejects wrong optional assignment types',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, actualMemberName: null }],
    },
  },
  {
    expected: false,
    name: 'rejects invalid assignment colors',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, shiftTypeColor: '#12345G' }],
    },
  },
  {
    expected: false,
    name: 'rejects non-positive assignment positions',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, slotPosition: 0 }],
    },
  },
  {
    expected: false,
    name: 'rejects non-integer assignment positions',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, slotPosition: 1.5 }],
    },
  },
  {
    expected: false,
    name: 'rejects unsafe integer assignment positions',
    value: {
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, slotPosition: Number.MAX_SAFE_INTEGER + 1 }],
    },
  },
  {
    expected: false,
    name: 'rejects extra member fields',
    value: {
      ...validCalendarReadModel,
      members: [{ ...validCalendarDutyMember, extra: true }],
    },
  },
  {
    expected: false,
    name: 'rejects empty member names',
    value: {
      ...validCalendarReadModel,
      members: [{ ...validCalendarDutyMember, realName: '' }],
    },
  },
  {
    expected: false,
    name: 'rejects non-boolean confirmation flags',
    value: {
      ...validCalendarReadModel,
      members: [{ ...validCalendarDutyMember, isConfirmed: 1 }],
    },
  },
  {
    expected: false,
    name: 'rejects extra role fields',
    value: { ...validCalendarReadModel, roles: [{ ...validCalendarRole, extra: true }] },
  },
  {
    expected: false,
    name: 'rejects empty role names',
    value: { ...validCalendarReadModel, roles: [{ ...validCalendarRole, name: '' }] },
  },
  {
    expected: false,
    name: 'rejects extra shift type fields',
    value: {
      ...validCalendarReadModel,
      shiftTypes: [{ ...validCalendarShiftType, extra: true }],
    },
  },
  {
    expected: false,
    name: 'rejects malformed optional shift times',
    value: {
      ...validCalendarReadModel,
      shiftTypes: [{ ...validCalendarShiftType, startTime: '8:00' }],
    },
  },
  {
    expected: false,
    name: 'rejects non-boolean all-day flags',
    value: {
      ...validCalendarReadModel,
      shiftTypes: [{ ...validCalendarShiftType, isAllDay: 'true' }],
    },
  },
];

export const guestCalendarReadModelCorpus: readonly {
  readonly expected: boolean;
  readonly name: string;
  readonly value: unknown;
}[] = [
  { expected: true, name: 'accepts a complete guest calendar', value: validGuestCalendarReadModel },
  {
    expected: true,
    name: 'accepts the contract empty guest group name',
    value: { ...validGuestCalendarReadModel, groupName: '' },
  },
  { expected: false, name: 'rejects null', value: null },
  {
    expected: false,
    name: 'rejects extra guest fields',
    value: { ...validGuestCalendarReadModel, extra: true },
  },
  {
    expected: false,
    name: 'rejects malformed nested calendars',
    value: {
      ...validGuestCalendarReadModel,
      calendar: { ...validCalendarReadModel, extra: true },
    },
  },
  {
    expected: false,
    name: 'rejects non-string group names',
    value: { ...validGuestCalendarReadModel, groupName: 1 },
  },
];
