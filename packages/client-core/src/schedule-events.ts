import {
  INVALID_RESPONSE,
  type DecodeResult,
  type EndpointQueryValue,
  type JsonEndpointDescriptor,
  type JsonObject,
} from './types.js';

export interface ScheduleEvent {
  readonly affectedMembershipIds: readonly string[];
  readonly affectedShiftIds: readonly string[];
  readonly afterData?: JsonObject | undefined;
  readonly approverUserId?: string | undefined;
  readonly beforeData?: JsonObject | undefined;
  readonly eventStatus: string;
  readonly eventType: string;
  readonly groupId: string;
  readonly id: string;
  readonly initiatedByUserId?: string | undefined;
  readonly objectId?: string | undefined;
  readonly objectType: string;
  readonly occurredAt: string;
  readonly operationId: string;
  readonly operatorUserId?: string | undefined;
  readonly parentEventId?: string | undefined;
  readonly reason?: string | undefined;
  readonly schedulePeriodId?: string | undefined;
  readonly statisticsDelta?: JsonObject | undefined;
}

export interface ScheduleEventPage {
  readonly events: readonly ScheduleEvent[];
  readonly nextCursor?: string | undefined;
}

/** Mirrors Omit<ScheduleEventQuery, 'groupId'> without importing runtime contracts. */
export interface ScheduleEventQueryInput {
  readonly cursor?: string;
  readonly eventTypes?: readonly string[];
  readonly from?: string;
  readonly membershipId?: string;
  readonly operatorUserId?: string;
  readonly pageSize?: number;
  readonly scheduleRoleId?: string;
  readonly shiftId?: string;
  readonly to?: string;
}

type UnknownRecord = Record<string, unknown>;
type Mutable<Value> = { -readonly [Key in keyof Value]: Value[Key] };

const pageKeys = new Set(['events', 'nextCursor']);
const eventKeys = new Set([
  'affectedMembershipIds',
  'affectedShiftIds',
  'afterData',
  'approverUserId',
  'beforeData',
  'eventStatus',
  'eventType',
  'groupId',
  'id',
  'initiatedByUserId',
  'objectId',
  'objectType',
  'occurredAt',
  'operationId',
  'operatorUserId',
  'parentEventId',
  'reason',
  'schedulePeriodId',
  'statisticsDelta',
]);

function isObjectRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyEnumerableKeys(value: UnknownRecord, allowedKeys: ReadonlySet<string>): boolean {
  for (const key in value) {
    if (!allowedKeys.has(key)) return false;
  }
  return true;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalJsonObject(value: unknown): value is JsonObject | undefined {
  return value === undefined || isObjectRecord(value);
}

function decodeStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const length = value.length;
  const decoded = new Array<string>(length);
  for (let index = 0; index < length; index += 1) {
    const item: unknown = value[index];
    if (typeof item !== 'string') return undefined;
    decoded[index] = item;
  }
  return Object.freeze(decoded);
}

function decodeScheduleEvent(value: unknown): ScheduleEvent | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, eventKeys)) return undefined;

  const affectedMembershipIdsValue = value.affectedMembershipIds;
  const affectedShiftIdsValue = value.affectedShiftIds;
  const afterData = value.afterData;
  const approverUserId = value.approverUserId;
  const beforeData = value.beforeData;
  const eventStatus = value.eventStatus;
  const eventType = value.eventType;
  const groupId = value.groupId;
  const id = value.id;
  const initiatedByUserId = value.initiatedByUserId;
  const objectId = value.objectId;
  const objectType = value.objectType;
  const occurredAt = value.occurredAt;
  const operationId = value.operationId;
  const operatorUserId = value.operatorUserId;
  const parentEventId = value.parentEventId;
  const reason = value.reason;
  const schedulePeriodId = value.schedulePeriodId;
  const statisticsDelta = value.statisticsDelta;

  const affectedMembershipIds = decodeStringArray(affectedMembershipIdsValue);
  const affectedShiftIds = decodeStringArray(affectedShiftIdsValue);

  if (
    affectedMembershipIds === undefined ||
    affectedShiftIds === undefined ||
    !isOptionalJsonObject(afterData) ||
    !isOptionalString(approverUserId) ||
    !isOptionalJsonObject(beforeData) ||
    typeof eventStatus !== 'string' ||
    typeof eventType !== 'string' ||
    eventType.length === 0 ||
    typeof groupId !== 'string' ||
    groupId.length === 0 ||
    typeof id !== 'string' ||
    id.length === 0 ||
    !isOptionalString(initiatedByUserId) ||
    !isOptionalString(objectId) ||
    typeof objectType !== 'string' ||
    typeof occurredAt !== 'string' ||
    typeof operationId !== 'string' ||
    !isOptionalString(operatorUserId) ||
    !isOptionalString(parentEventId) ||
    !isOptionalString(reason) ||
    !isOptionalString(schedulePeriodId) ||
    !isOptionalJsonObject(statisticsDelta)
  ) {
    return undefined;
  }

  const decoded: Mutable<ScheduleEvent> = {
    affectedMembershipIds,
    affectedShiftIds,
    eventStatus,
    eventType,
    groupId,
    id,
    objectType,
    occurredAt,
    operationId,
  };
  if (afterData !== undefined || 'afterData' in value) decoded.afterData = afterData;
  if (approverUserId !== undefined || 'approverUserId' in value) {
    decoded.approverUserId = approverUserId;
  }
  if (beforeData !== undefined || 'beforeData' in value) decoded.beforeData = beforeData;
  if (initiatedByUserId !== undefined || 'initiatedByUserId' in value) {
    decoded.initiatedByUserId = initiatedByUserId;
  }
  if (objectId !== undefined || 'objectId' in value) decoded.objectId = objectId;
  if (operatorUserId !== undefined || 'operatorUserId' in value) {
    decoded.operatorUserId = operatorUserId;
  }
  if (parentEventId !== undefined || 'parentEventId' in value) {
    decoded.parentEventId = parentEventId;
  }
  if (reason !== undefined || 'reason' in value) decoded.reason = reason;
  if (schedulePeriodId !== undefined || 'schedulePeriodId' in value) {
    decoded.schedulePeriodId = schedulePeriodId;
  }
  if (statisticsDelta !== undefined || 'statisticsDelta' in value) {
    decoded.statisticsDelta = statisticsDelta;
  }
  return decoded;
}

function decodeScheduleEvents(value: unknown): readonly ScheduleEvent[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const length = value.length;
  const decoded = new Array<ScheduleEvent>(length);
  for (let index = 0; index < length; index += 1) {
    const item: unknown = value[index];
    const event = decodeScheduleEvent(item);
    if (event === undefined) return undefined;
    decoded[index] = event;
  }
  return Object.freeze(decoded);
}

function decodeScheduleEventPageValue(value: unknown): ScheduleEventPage | undefined {
  if (!isObjectRecord(value) || !hasOnlyEnumerableKeys(value, pageKeys)) return undefined;

  const eventsValue = value.events;
  const nextCursor = value.nextCursor;
  const events = decodeScheduleEvents(eventsValue);
  if (events === undefined || !isOptionalString(nextCursor)) return undefined;

  const decoded: Mutable<ScheduleEventPage> = { events };
  if (nextCursor !== undefined || 'nextCursor' in value) decoded.nextCursor = nextCursor;
  return decoded;
}

export function decodeScheduleEventPage(value: unknown): DecodeResult<ScheduleEventPage> {
  try {
    const decoded = decodeScheduleEventPageValue(value);
    return decoded !== undefined
      ? { ok: true, value: decoded }
      : { error: { code: INVALID_RESPONSE }, ok: false };
  } catch {
    return { error: { code: INVALID_RESPONSE }, ok: false };
  }
}

export function buildScheduleEventListEndpoint(
  groupId: string,
  query: ScheduleEventQueryInput,
): JsonEndpointDescriptor<ScheduleEventPage> {
  const endpointQuery: Record<string, EndpointQueryValue> = {};

  if (query.cursor !== undefined) {
    endpointQuery.cursor = query.cursor;
  }
  if (query.eventTypes !== undefined && query.eventTypes.length > 0) {
    endpointQuery.eventTypes = query.eventTypes.join(',');
  }
  if (query.from !== undefined) {
    endpointQuery.from = query.from;
  }
  if (query.membershipId !== undefined) {
    endpointQuery.membershipId = query.membershipId;
  }
  if (query.operatorUserId !== undefined) {
    endpointQuery.operatorUserId = query.operatorUserId;
  }
  if (query.pageSize !== undefined) {
    endpointQuery.pageSize = query.pageSize;
  }
  if (query.scheduleRoleId !== undefined) {
    endpointQuery.scheduleRoleId = query.scheduleRoleId;
  }
  if (query.shiftId !== undefined) {
    endpointQuery.shiftId = query.shiftId;
  }
  if (query.to !== undefined) {
    endpointQuery.to = query.to;
  }

  return {
    auth: true,
    decodeResponse: decodeScheduleEventPage,
    method: 'GET',
    path: `/groups/${encodeURIComponent(groupId)}/events`,
    query: endpointQuery,
  };
}
