export const validHolidayReadModel = {
  confirmed: true,
  dates: [
    { date: '2026-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false },
    { date: '2026-10-10', holidayName: '国庆节调休', isOffDay: false, isWorkday: true },
  ],
  year: 2026,
};

const holidayWithInheritedExtra = Object.assign(
  Object.create({ inheritedExtra: true }),
  validHolidayReadModel,
);
const dateWithInheritedExtra = Object.assign(
  Object.create({ inheritedExtra: true }),
  validHolidayReadModel.dates[0],
);
const inheritedDatePrototype = Object.create(
  Array.prototype,
) as (typeof validHolidayReadModel.dates)[number][];
inheritedDatePrototype[0] = validHolidayReadModel.dates[0]!;
const datesWithInheritedIndex = new Array<(typeof validHolidayReadModel.dates)[number]>(1);
Object.setPrototypeOf(datesWithInheritedIndex, inheritedDatePrototype);

export const holidayReadModelCorpus: readonly {
  readonly expected: boolean;
  readonly name: string;
  readonly value: unknown;
}[] = [
  { expected: true, name: 'accepts a confirmed calendar', value: validHolidayReadModel },
  {
    expected: true,
    name: 'decodes an inherited holiday date array index',
    value: { ...validHolidayReadModel, dates: datesWithInheritedIndex },
  },
  {
    expected: true,
    name: 'accepts the contract empty strings, empty dates, and unrestricted integer year',
    value: {
      confirmed: false,
      dates: [{ date: '', holidayName: '', isOffDay: false, isWorkday: false }],
      year: -1,
    },
  },
  { expected: false, name: 'rejects null', value: null },
  {
    expected: false,
    name: 'rejects an extra root field',
    value: { ...validHolidayReadModel, extra: true },
  },
  {
    expected: false,
    name: 'rejects an inherited enumerable root field',
    value: holidayWithInheritedExtra,
  },
  {
    expected: false,
    name: 'rejects a non-boolean confirmation flag',
    value: { ...validHolidayReadModel, confirmed: 1 },
  },
  {
    expected: false,
    name: 'rejects a non-array date collection',
    value: { ...validHolidayReadModel, dates: {} },
  },
  {
    expected: false,
    name: 'rejects an extra date field',
    value: {
      ...validHolidayReadModel,
      dates: [{ ...validHolidayReadModel.dates[0], extra: true }],
    },
  },
  {
    expected: false,
    name: 'rejects an inherited enumerable date field',
    value: { ...validHolidayReadModel, dates: [dateWithInheritedExtra] },
  },
  {
    expected: false,
    name: 'rejects non-string date values',
    value: {
      ...validHolidayReadModel,
      dates: [{ ...validHolidayReadModel.dates[0], date: 20260101 }],
    },
  },
  {
    expected: false,
    name: 'rejects non-boolean day flags',
    value: {
      ...validHolidayReadModel,
      dates: [{ ...validHolidayReadModel.dates[0], isOffDay: 'true' }],
    },
  },
  {
    expected: false,
    name: 'rejects non-integer years',
    value: { ...validHolidayReadModel, year: 2026.5 },
  },
  {
    expected: false,
    name: 'rejects non-finite years',
    value: { ...validHolidayReadModel, year: Number.POSITIVE_INFINITY },
  },
  {
    expected: false,
    name: 'rejects unsafe integer years',
    value: { ...validHolidayReadModel, year: Number.MAX_SAFE_INTEGER + 1 },
  },
];
