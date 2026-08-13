import {
  decodeReadonlyArray,
  decodeResult,
  hasOnlyEnumerableKeys,
  isObjectRecord,
  type Mutable,
} from './decode-helpers.js';
import type { DecodeResult, JsonEndpointDescriptor } from './types.js';

export type CalendarChangeMarker = 'leave-cover' | 'overtime' | 'swap';

export interface CalendarDutyAssignment {
  readonly actualMemberName?: string | undefined;
  readonly actualMembershipId?: string | undefined;
  readonly businessDate: string;
  readonly changeMarkers: readonly CalendarChangeMarker[];
  readonly endsAt: string;
  readonly id: string;
  readonly plannedMemberName?: string | undefined;
  readonly plannedMembershipId?: string | undefined;
  readonly schedulePeriodId: string;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly shiftTypeTextColor: string;
  readonly slotPosition: number;
  readonly startsAt: string;
}

export interface CalendarDutyMember {
  readonly isConfirmed: boolean;
  readonly membershipId: string;
  readonly mobilePhone?: string | undefined;
  readonly realName: string;
  readonly shortPhone?: string | undefined;
}

export interface CalendarRoleSummary {
  readonly id: string;
  readonly name: string;
}

export interface CalendarShiftTypeSummary {
  readonly abbreviation: string;
  readonly color: string;
  readonly crossesMidnight: boolean;
  readonly endTime?: string | undefined;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly name: string;
  readonly startTime?: string | undefined;
  readonly textColor: string;
}

export interface CalendarReadModel {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessMonth: string;
  readonly groupId: string;
  readonly members: readonly CalendarDutyMember[];
  readonly roles: readonly CalendarRoleSummary[];
  readonly shiftTypes: readonly CalendarShiftTypeSummary[];
}

export interface GuestCalendarReadModel {
  readonly calendar: CalendarReadModel;
  readonly groupName: string;
}

export interface VisitorResolveResponse {
  readonly groupId: string;
  readonly groupName: string;
}

const assignmentKeys = new Set([
  'actualMemberName',
  'actualMembershipId',
  'businessDate',
  'changeMarkers',
  'endsAt',
  'id',
  'plannedMemberName',
  'plannedMembershipId',
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
]);
const memberKeys = new Set([
  'isConfirmed',
  'membershipId',
  'mobilePhone',
  'realName',
  'shortPhone',
]);
const roleKeys = new Set(['id', 'name']);
const shiftTypeKeys = new Set([
  'abbreviation',
  'color',
  'crossesMidnight',
  'endTime',
  'id',
  'isAllDay',
  'name',
  'startTime',
  'textColor',
]);
const calendarKeys = new Set([
  'assignments',
  'businessMonth',
  'groupId',
  'members',
  'roles',
  'shiftTypes',
]);
const guestCalendarKeys = new Set(['calendar', 'groupName']);
const visitorResolveKeys = new Set(['groupId', 'groupName']);
const businessDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const businessMonthPattern = /^\d{4}-\d{2}$/u;
const colorPattern = /^#[\dA-F]{6}$/iu;
const timePattern = /^\d{2}:\d{2}$/u;

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function decodeChangeMarker(value: unknown): CalendarChangeMarker | undefined {
  return value === 'leave-cover' || value === 'overtime' || value === 'swap' ? value : undefined;
}

function decodeAssignment(value: unknown): CalendarDutyAssignment | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, assignmentKeys)) return undefined;

  const actualMemberName = value.actualMemberName;
  const actualMembershipId = value.actualMembershipId;
  const businessDate = value.businessDate;
  const changeMarkersValue = value.changeMarkers;
  const endsAt = value.endsAt;
  const id = value.id;
  const plannedMemberName = value.plannedMemberName;
  const plannedMembershipId = value.plannedMembershipId;
  const schedulePeriodId = value.schedulePeriodId;
  const scheduleRoleId = value.scheduleRoleId;
  const scheduleRoleName = value.scheduleRoleName;
  const shiftTypeAbbreviation = value.shiftTypeAbbreviation;
  const shiftTypeColor = value.shiftTypeColor;
  const shiftTypeId = value.shiftTypeId;
  const shiftTypeName = value.shiftTypeName;
  const shiftTypeTextColor = value.shiftTypeTextColor;
  const slotPosition = value.slotPosition;
  const startsAt = value.startsAt;
  const changeMarkers = decodeReadonlyArray(changeMarkersValue, decodeChangeMarker);

  if (
    !isOptionalString(actualMemberName) ||
    !isOptionalString(actualMembershipId) ||
    typeof businessDate !== 'string' ||
    !businessDatePattern.test(businessDate) ||
    changeMarkers === undefined ||
    !isString(endsAt) ||
    !isNonemptyString(id) ||
    !isOptionalString(plannedMemberName) ||
    !isOptionalString(plannedMembershipId) ||
    !isNonemptyString(schedulePeriodId) ||
    !isNonemptyString(scheduleRoleId) ||
    !isNonemptyString(scheduleRoleName) ||
    !isNonemptyString(shiftTypeAbbreviation) ||
    typeof shiftTypeColor !== 'string' ||
    !colorPattern.test(shiftTypeColor) ||
    !isNonemptyString(shiftTypeId) ||
    !isNonemptyString(shiftTypeName) ||
    typeof shiftTypeTextColor !== 'string' ||
    !colorPattern.test(shiftTypeTextColor) ||
    typeof slotPosition !== 'number' ||
    !Number.isSafeInteger(slotPosition) ||
    slotPosition < 1 ||
    !isString(startsAt)
  ) {
    return undefined;
  }

  const decoded: Mutable<CalendarDutyAssignment> = {
    businessDate,
    changeMarkers,
    endsAt,
    id,
    schedulePeriodId,
    scheduleRoleId,
    scheduleRoleName,
    shiftTypeAbbreviation,
    shiftTypeColor,
    shiftTypeId,
    shiftTypeName,
    shiftTypeTextColor,
    slotPosition,
    startsAt,
  };
  if (actualMemberName !== undefined || 'actualMemberName' in value) {
    decoded.actualMemberName = actualMemberName;
  }
  if (actualMembershipId !== undefined || 'actualMembershipId' in value) {
    decoded.actualMembershipId = actualMembershipId;
  }
  if (plannedMemberName !== undefined || 'plannedMemberName' in value) {
    decoded.plannedMemberName = plannedMemberName;
  }
  if (plannedMembershipId !== undefined || 'plannedMembershipId' in value) {
    decoded.plannedMembershipId = plannedMembershipId;
  }
  return decoded;
}

function decodeMember(value: unknown): CalendarDutyMember | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, memberKeys)) return undefined;

  const isConfirmed = value.isConfirmed;
  const membershipId = value.membershipId;
  const mobilePhone = value.mobilePhone;
  const realName = value.realName;
  const shortPhone = value.shortPhone;
  if (
    typeof isConfirmed !== 'boolean' ||
    !isNonemptyString(membershipId) ||
    !isOptionalString(mobilePhone) ||
    !isNonemptyString(realName) ||
    !isOptionalString(shortPhone)
  ) {
    return undefined;
  }

  const decoded: Mutable<CalendarDutyMember> = { isConfirmed, membershipId, realName };
  if (mobilePhone !== undefined || 'mobilePhone' in value) decoded.mobilePhone = mobilePhone;
  if (shortPhone !== undefined || 'shortPhone' in value) decoded.shortPhone = shortPhone;
  return decoded;
}

function decodeRole(value: unknown): CalendarRoleSummary | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, roleKeys)) return undefined;
  const id = value.id;
  const name = value.name;
  return isNonemptyString(id) && isNonemptyString(name) ? { id, name } : undefined;
}

function decodeShiftType(value: unknown): CalendarShiftTypeSummary | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, shiftTypeKeys)) return undefined;

  const abbreviation = value.abbreviation;
  const color = value.color;
  const crossesMidnight = value.crossesMidnight;
  const endTime = value.endTime;
  const id = value.id;
  const isAllDay = value.isAllDay;
  const name = value.name;
  const startTime = value.startTime;
  const textColor = value.textColor;
  if (
    !isNonemptyString(abbreviation) ||
    typeof color !== 'string' ||
    !colorPattern.test(color) ||
    typeof crossesMidnight !== 'boolean' ||
    (endTime !== undefined && (typeof endTime !== 'string' || !timePattern.test(endTime))) ||
    !isNonemptyString(id) ||
    typeof isAllDay !== 'boolean' ||
    !isNonemptyString(name) ||
    (startTime !== undefined && (typeof startTime !== 'string' || !timePattern.test(startTime))) ||
    typeof textColor !== 'string' ||
    !colorPattern.test(textColor)
  ) {
    return undefined;
  }

  const decoded: Mutable<CalendarShiftTypeSummary> = {
    abbreviation,
    color,
    crossesMidnight,
    id,
    isAllDay,
    name,
    textColor,
  };
  if (endTime !== undefined || 'endTime' in value) decoded.endTime = endTime;
  if (startTime !== undefined || 'startTime' in value) decoded.startTime = startTime;
  return decoded;
}

function decodeCalendarValue(value: unknown): CalendarReadModel | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, calendarKeys)) return undefined;

  const assignmentsValue = value.assignments;
  const businessMonth = value.businessMonth;
  const groupId = value.groupId;
  const membersValue = value.members;
  const rolesValue = value.roles;
  const shiftTypesValue = value.shiftTypes;
  const assignments = decodeReadonlyArray(assignmentsValue, decodeAssignment);
  const members = decodeReadonlyArray(membersValue, decodeMember);
  const roles = decodeReadonlyArray(rolesValue, decodeRole);
  const shiftTypes = decodeReadonlyArray(shiftTypesValue, decodeShiftType);

  if (
    assignments === undefined ||
    typeof businessMonth !== 'string' ||
    !businessMonthPattern.test(businessMonth) ||
    !isString(groupId) ||
    members === undefined ||
    roles === undefined ||
    shiftTypes === undefined
  ) {
    return undefined;
  }
  return { assignments, businessMonth, groupId, members, roles, shiftTypes };
}

function decodeGuestCalendarValue(value: unknown): GuestCalendarReadModel | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, guestCalendarKeys)) return undefined;
  const calendarValue = value.calendar;
  const groupName = value.groupName;
  const calendar = decodeCalendarValue(calendarValue);
  return calendar !== undefined && isString(groupName) ? { calendar, groupName } : undefined;
}

function decodeVisitorResolveValue(value: unknown): VisitorResolveResponse | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, visitorResolveKeys)) return undefined;
  const groupId = value.groupId;
  const groupName = value.groupName;
  return isNonemptyString(groupId) && isNonemptyString(groupName)
    ? { groupId, groupName }
    : undefined;
}

export function decodeCalendarReadModel(value: unknown): DecodeResult<CalendarReadModel> {
  return decodeResult(() => decodeCalendarValue(value));
}

export function decodeGuestCalendarReadModel(value: unknown): DecodeResult<GuestCalendarReadModel> {
  return decodeResult(() => decodeGuestCalendarValue(value));
}

export function decodeVisitorResolveResponse(value: unknown): DecodeResult<VisitorResolveResponse> {
  return decodeResult(() => decodeVisitorResolveValue(value));
}

function decodeBoundCalendar(
  value: unknown,
  expectedGroupId: string,
  expectedBusinessMonth?: string,
  expectedSchedulePeriodId?: string,
): DecodeResult<CalendarReadModel> {
  return decodeResult(() => {
    const decoded = decodeCalendarValue(value);
    if (
      decoded === undefined ||
      decoded.groupId !== expectedGroupId ||
      (expectedBusinessMonth !== undefined && decoded.businessMonth !== expectedBusinessMonth)
    ) {
      return undefined;
    }
    if (expectedSchedulePeriodId !== undefined) {
      const assignmentCount = decoded.assignments.length;
      for (let index = 0; index < assignmentCount; index += 1) {
        if (decoded.assignments[index]?.schedulePeriodId !== expectedSchedulePeriodId) {
          return undefined;
        }
      }
    }
    return decoded;
  });
}

function decodeBoundGuestCalendar(
  value: unknown,
  expectedGroupId: string,
  expectedBusinessMonth: string,
): DecodeResult<GuestCalendarReadModel> {
  return decodeResult(() => {
    const decoded = decodeGuestCalendarValue(value);
    return decoded !== undefined &&
      decoded.calendar.groupId === expectedGroupId &&
      decoded.calendar.businessMonth === expectedBusinessMonth
      ? decoded
      : undefined;
  });
}

export function buildCalendarReadEndpoint(
  groupId: string,
  businessMonth: string,
): JsonEndpointDescriptor<CalendarReadModel> {
  return {
    auth: true,
    decodeResponse: (value) => decodeBoundCalendar(value, groupId, businessMonth),
    method: 'GET',
    path: `/groups/${encodeURIComponent(groupId)}/calendar`,
    query: { businessMonth },
  };
}

export function buildLoggedInGuestCalendarReadEndpoint(
  groupId: string,
  businessMonth: string,
): JsonEndpointDescriptor<GuestCalendarReadModel> {
  return {
    auth: true,
    decodeResponse: (value) => decodeBoundGuestCalendar(value, groupId, businessMonth),
    method: 'GET',
    path: `/groups/${encodeURIComponent(groupId)}/guest-calendar`,
    query: { businessMonth },
  };
}

export function buildSchedulePeriodCalendarReadEndpoint(
  groupId: string,
  schedulePeriodId: string,
): JsonEndpointDescriptor<CalendarReadModel> {
  return {
    auth: true,
    decodeResponse: (value) => decodeBoundCalendar(value, groupId, undefined, schedulePeriodId),
    method: 'GET',
    path: `/groups/${encodeURIComponent(groupId)}/calendar/periods/${encodeURIComponent(
      schedulePeriodId,
    )}`,
  };
}

export function buildGuestCalendarReadEndpoint(
  groupId: string,
  visitorKey: string,
  businessMonth: string,
): JsonEndpointDescriptor<GuestCalendarReadModel> {
  return {
    auth: false,
    decodeResponse: (value) => decodeBoundGuestCalendar(value, groupId, businessMonth),
    method: 'GET',
    path: `/guest/groups/${encodeURIComponent(groupId)}/calendar`,
    query: { businessMonth, visitorKey },
  };
}

export function buildGuestGroupResolveEndpoint(
  visitorKey: string,
): JsonEndpointDescriptor<VisitorResolveResponse> {
  return {
    auth: false,
    body: { visitorKey },
    decodeResponse: decodeVisitorResolveResponse,
    method: 'POST',
    path: '/guest/groups/resolve',
  };
}
