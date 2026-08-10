import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';

type UnknownRecord = Record<string, unknown>;

const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const businessMonthPattern = /^\d{4}-\d{2}$/u;
const colorPattern = /^#[\dA-F]{6}$/iu;
const timePattern = /^\d{2}:\d{2}$/u;
const calendarChangeMarkers = new Set(['swap', 'leave-cover', 'overtime']);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownKeys(
  value: UnknownRecord,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): boolean {
  const knownKeys = new Set([...requiredKeys, ...optionalKeys]);
  return (
    requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => knownKeys.has(key))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isCalendarDutyAssignment(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !hasOnlyKnownKeys(
      value,
      [
        'businessDate',
        'changeMarkers',
        'endsAt',
        'id',
        'schedulePeriodId',
        'scheduleRoleId',
        'scheduleRoleName',
        'shiftTypeAbbreviation',
        'shiftTypeColor',
        'shiftTypeId',
        'shiftTypeName',
        'shiftTypeTextColor',
        'slotPosition',
        'startsAt',
      ],
      ['actualMemberName', 'actualMembershipId', 'plannedMemberName', 'plannedMembershipId'],
    )
  ) {
    return false;
  }
  return (
    typeof value.businessDate === 'string' &&
    businessDatePattern.test(value.businessDate) &&
    Array.isArray(value.changeMarkers) &&
    value.changeMarkers.every(
      (marker) => typeof marker === 'string' && calendarChangeMarkers.has(marker),
    ) &&
    typeof value.endsAt === 'string' &&
    isNonEmptyString(value.id) &&
    isOptionalString(value.actualMemberName) &&
    isOptionalString(value.actualMembershipId) &&
    isOptionalString(value.plannedMemberName) &&
    isOptionalString(value.plannedMembershipId) &&
    isNonEmptyString(value.schedulePeriodId) &&
    isNonEmptyString(value.scheduleRoleId) &&
    isNonEmptyString(value.scheduleRoleName) &&
    isNonEmptyString(value.shiftTypeAbbreviation) &&
    typeof value.shiftTypeColor === 'string' &&
    colorPattern.test(value.shiftTypeColor) &&
    isNonEmptyString(value.shiftTypeId) &&
    isNonEmptyString(value.shiftTypeName) &&
    typeof value.shiftTypeTextColor === 'string' &&
    colorPattern.test(value.shiftTypeTextColor) &&
    typeof value.slotPosition === 'number' &&
    Number.isInteger(value.slotPosition) &&
    value.slotPosition >= 1 &&
    typeof value.startsAt === 'string'
  );
}

function isCalendarDutyMember(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKnownKeys(
      value,
      ['isConfirmed', 'membershipId', 'realName'],
      ['mobilePhone', 'shortPhone'],
    )
  ) {
    return false;
  }
  return (
    typeof value.isConfirmed === 'boolean' &&
    isNonEmptyString(value.membershipId) &&
    isOptionalString(value.mobilePhone) &&
    isNonEmptyString(value.realName) &&
    isOptionalString(value.shortPhone)
  );
}

function isCalendarRoleSummary(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKnownKeys(value, ['id', 'name']) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name)
  );
}

function isCalendarShiftTypeSummary(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKnownKeys(
      value,
      ['abbreviation', 'color', 'crossesMidnight', 'id', 'isAllDay', 'name', 'textColor'],
      ['endTime', 'startTime'],
    )
  ) {
    return false;
  }
  return (
    isNonEmptyString(value.abbreviation) &&
    typeof value.color === 'string' &&
    colorPattern.test(value.color) &&
    typeof value.crossesMidnight === 'boolean' &&
    (value.endTime === undefined ||
      (typeof value.endTime === 'string' && timePattern.test(value.endTime))) &&
    isNonEmptyString(value.id) &&
    typeof value.isAllDay === 'boolean' &&
    isNonEmptyString(value.name) &&
    (value.startTime === undefined ||
      (typeof value.startTime === 'string' && timePattern.test(value.startTime))) &&
    typeof value.textColor === 'string' &&
    colorPattern.test(value.textColor)
  );
}

export function isCalendarReadModel(value: unknown): value is CalendarReadModel {
  if (
    !isRecord(value) ||
    !hasOnlyKnownKeys(value, [
      'assignments',
      'businessMonth',
      'groupId',
      'members',
      'roles',
      'shiftTypes',
    ])
  ) {
    return false;
  }
  return (
    Array.isArray(value.assignments) &&
    value.assignments.every(isCalendarDutyAssignment) &&
    typeof value.businessMonth === 'string' &&
    businessMonthPattern.test(value.businessMonth) &&
    typeof value.groupId === 'string' &&
    Array.isArray(value.members) &&
    value.members.every(isCalendarDutyMember) &&
    Array.isArray(value.roles) &&
    value.roles.every(isCalendarRoleSummary) &&
    Array.isArray(value.shiftTypes) &&
    value.shiftTypes.every(isCalendarShiftTypeSummary)
  );
}

function isConfirmedHolidayDate(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKnownKeys(value, ['date', 'holidayName', 'isOffDay', 'isWorkday']) &&
    typeof value.date === 'string' &&
    typeof value.holidayName === 'string' &&
    typeof value.isOffDay === 'boolean' &&
    typeof value.isWorkday === 'boolean'
  );
}

export function isHolidayReadModel(value: unknown): value is HolidayReadModel {
  return (
    isRecord(value) &&
    hasOnlyKnownKeys(value, ['confirmed', 'dates', 'year']) &&
    typeof value.confirmed === 'boolean' &&
    Array.isArray(value.dates) &&
    value.dates.every(isConfirmedHolidayDate) &&
    Number.isInteger(value.year)
  );
}
