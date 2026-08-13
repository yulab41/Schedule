export const validScheduleEvent = {
  affectedMembershipIds: ['membership-1', ''],
  affectedShiftIds: ['shift-1'],
  afterData: {
    membershipId: 'membership-2',
    nested: { enabled: true },
    values: [1, null, 'value'],
  },
  approverUserId: '',
  beforeData: { membershipId: 'membership-1' },
  eventStatus: '',
  eventType: 'swap_completed',
  groupId: 'group-1',
  id: 'event-1',
  initiatedByUserId: 'user-1',
  objectId: '',
  objectType: '',
  occurredAt: '',
  operationId: '',
  operatorUserId: 'user-2',
  parentEventId: '',
  reason: '',
  schedulePeriodId: '',
  statisticsDelta: { total: -1 },
} as const;

export interface ScheduleEventPageCorpusEntry {
  readonly expected: boolean;
  readonly name: string;
  readonly value: unknown;
}

const withoutKey = (key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(validScheduleEvent).filter(([candidate]) => candidate !== key));

const requiredEventKeys = [
  'affectedMembershipIds',
  'affectedShiftIds',
  'eventStatus',
  'eventType',
  'groupId',
  'id',
  'objectType',
  'occurredAt',
  'operationId',
] as const;

const invalidRequiredValues: Readonly<Record<(typeof requiredEventKeys)[number], unknown>> = {
  affectedMembershipIds: 'membership-1',
  affectedShiftIds: 'shift-1',
  eventStatus: 1,
  eventType: 1,
  groupId: 1,
  id: 1,
  objectType: 1,
  occurredAt: 1,
  operationId: 1,
};

const optionalStringKeys = [
  'approverUserId',
  'initiatedByUserId',
  'objectId',
  'operatorUserId',
  'parentEventId',
  'reason',
  'schedulePeriodId',
] as const;

const optionalObjectKeys = ['afterData', 'beforeData', 'statisticsDelta'] as const;

const sparseEvents = new Array(1);
const sparseMembershipIds = new Array(1);
const eventsWithOverriddenEvery = Object.assign([{ ...validScheduleEvent, id: 1 }], {
  every: () => true,
});
const pageWithInheritedExtra = Object.assign(Object.create({ inheritedExtra: true }), {
  events: [],
});
const eventWithInheritedExtra = Object.assign(
  Object.create({ inheritedExtra: true }),
  validScheduleEvent,
);
const eventWithOptionalValueAndFalseHas = new Proxy(
  { ...validScheduleEvent },
  {
    get(target, property, receiver) {
      return property === 'reason' ? 'proxied reason' : Reflect.get(target, property, receiver);
    },
    has(target, property) {
      return property === 'reason' ? false : Reflect.has(target, property);
    },
  },
);
const pageWithOptionalValueAndFalseHas = new Proxy(
  { events: [], nextCursor: 'cursor' },
  {
    get(target, property, receiver) {
      return property === 'nextCursor' ? 'proxied cursor' : Reflect.get(target, property, receiver);
    },
    has(target, property) {
      return property === 'nextCursor' ? false : Reflect.has(target, property);
    },
  },
);
const inheritedMembershipIndexPrototype = Object.create(Array.prototype) as string[];
inheritedMembershipIndexPrototype[0] = 'inherited-membership';
const membershipIdsWithInheritedIndex = new Array<string>(1);
Object.setPrototypeOf(membershipIdsWithInheritedIndex, inheritedMembershipIndexPrototype);
const inheritedEventIndexPrototype = Object.create(
  Array.prototype,
) as (typeof validScheduleEvent)[];
inheritedEventIndexPrototype[0] = validScheduleEvent;
const eventsWithInheritedIndex = new Array<typeof validScheduleEvent>(1);
Object.setPrototypeOf(eventsWithInheritedIndex, inheritedEventIndexPrototype);

const requiredFieldCorpus: readonly ScheduleEventPageCorpusEntry[] = requiredEventKeys.flatMap(
  (key) => [
    {
      expected: false,
      name: `missing required event property: ${key}`,
      value: { events: [withoutKey(key)] },
    },
    {
      expected: false,
      name: `wrong required event property type: ${key}`,
      value: { events: [{ ...validScheduleEvent, [key]: invalidRequiredValues[key] }] },
    },
  ],
);

const optionalStringCorpus: readonly ScheduleEventPageCorpusEntry[] = optionalStringKeys.map(
  (key) => ({
    expected: false,
    name: `wrong optional string type: ${key}`,
    value: { events: [{ ...validScheduleEvent, [key]: 1 }] },
  }),
);

const optionalObjectCorpus: readonly ScheduleEventPageCorpusEntry[] = optionalObjectKeys.flatMap(
  (key) => [
    {
      expected: false,
      name: `null optional JSON object: ${key}`,
      value: { events: [{ ...validScheduleEvent, [key]: null }] },
    },
    {
      expected: false,
      name: `array optional JSON object: ${key}`,
      value: { events: [{ ...validScheduleEvent, [key]: [] }] },
    },
    {
      expected: false,
      name: `primitive optional JSON object: ${key}`,
      value: { events: [{ ...validScheduleEvent, [key]: 'not-an-object' }] },
    },
  ],
);

export const scheduleEventPageCorpus: readonly ScheduleEventPageCorpusEntry[] = [
  { expected: true, name: 'empty page', value: { events: [] } },
  { expected: true, name: 'empty cursor', value: { events: [], nextCursor: '' } },
  {
    expected: true,
    name: 'complete event and cursor',
    value: { events: [validScheduleEvent], nextCursor: 'cursor/+=' },
  },
  {
    expected: true,
    name: 'explicitly undefined optional properties',
    value: {
      events: [
        {
          ...validScheduleEvent,
          afterData: undefined,
          approverUserId: undefined,
          beforeData: undefined,
          initiatedByUserId: undefined,
          objectId: undefined,
          operatorUserId: undefined,
          parentEventId: undefined,
          reason: undefined,
          schedulePeriodId: undefined,
          statisticsDelta: undefined,
        },
      ],
      nextCursor: undefined,
    },
  },
  {
    expected: true,
    name: 'event optional value is retained when proxy has trap returns false',
    value: { events: [eventWithOptionalValueAndFalseHas] },
  },
  {
    expected: true,
    name: 'page optional value is retained when proxy has trap returns false',
    value: pageWithOptionalValueAndFalseHas,
  },
  {
    expected: true,
    name: 'inherited event array index is decoded',
    value: { events: eventsWithInheritedIndex },
  },
  {
    expected: true,
    name: 'inherited string array index is decoded',
    value: {
      events: [{ ...validScheduleEvent, affectedMembershipIds: membershipIdsWithInheritedIndex }],
    },
  },
  { expected: false, name: 'null page', value: null },
  { expected: false, name: 'array page', value: [] },
  { expected: false, name: 'missing events', value: {} },
  { expected: false, name: 'non-array events', value: { events: {} } },
  { expected: false, name: 'sparse events array', value: { events: sparseEvents } },
  {
    expected: false,
    name: 'overridden events every cannot bypass invalid entries',
    value: { events: eventsWithOverriddenEvery },
  },
  { expected: false, name: 'non-string cursor', value: { events: [], nextCursor: 1 } },
  { expected: false, name: 'unknown page property', value: { events: [], total: 0 } },
  { expected: false, name: 'inherited page property', value: pageWithInheritedExtra },
  { expected: false, name: 'null event', value: { events: [null] } },
  {
    expected: false,
    name: 'unknown event property',
    value: { events: [{ ...validScheduleEvent, unexpected: true }] },
  },
  {
    expected: false,
    name: 'inherited event property',
    value: { events: [eventWithInheritedExtra] },
  },
  ...requiredFieldCorpus,
  {
    expected: false,
    name: 'empty event id',
    value: { events: [{ ...validScheduleEvent, id: '' }] },
  },
  {
    expected: false,
    name: 'empty group id',
    value: { events: [{ ...validScheduleEvent, groupId: '' }] },
  },
  {
    expected: false,
    name: 'empty event type',
    value: { events: [{ ...validScheduleEvent, eventType: '' }] },
  },
  {
    expected: false,
    name: 'non-string affected membership',
    value: { events: [{ ...validScheduleEvent, affectedMembershipIds: [1] }] },
  },
  {
    expected: false,
    name: 'sparse affected membership array',
    value: { events: [{ ...validScheduleEvent, affectedMembershipIds: sparseMembershipIds }] },
  },
  {
    expected: false,
    name: 'non-string affected shift',
    value: { events: [{ ...validScheduleEvent, affectedShiftIds: [1] }] },
  },
  ...optionalStringCorpus,
  ...optionalObjectCorpus,
];
