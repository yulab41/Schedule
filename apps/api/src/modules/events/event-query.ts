import type {
  JsonObject,
  ScheduleEvent,
  ScheduleEventPage,
  ScheduleEventQuery,
} from '@schedule/contracts';
import {
  scheduleEvents,
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
} from '@schedule/database';
import { and, desc, eq, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';

const defaultPageSize = 50;
const maximumPageSize = 100;
const maximumEventTypes = 20;

interface EventCursor {
  readonly id: string;
  readonly occurredAt: Date;
}

export class EventQuery {
  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async list(query: ScheduleEventQuery): Promise<ScheduleEventPage> {
    return withTransaction(this.databaseClient, (transaction) =>
      this.listInTransaction(transaction, query),
    );
  }

  public async listInTransaction(
    transaction: DatabaseTransaction,
    query: ScheduleEventQuery,
  ): Promise<ScheduleEventPage> {
    const pageSize = getPageSize(query.pageSize);
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const from = query.from === undefined ? undefined : parseTimestamp(query.from, 'from');
    const to = query.to === undefined ? undefined : parseTimestamp(query.to, 'to');

    if (from !== undefined && to !== undefined && from > to) {
      throw validationError('The query start time must not be after its end time.');
    }

    if (query.eventTypes !== undefined && query.eventTypes.length > maximumEventTypes) {
      throw validationError(`A query can include at most ${maximumEventTypes} event types.`);
    }

    const conditions = [eq(scheduleEvents.groupId, query.groupId)];

    if (from !== undefined) {
      conditions.push(gte(scheduleEvents.occurredAt, from));
    }

    if (to !== undefined) {
      conditions.push(lte(scheduleEvents.occurredAt, to));
    }

    if (query.eventTypes !== undefined && query.eventTypes.length > 0) {
      conditions.push(inArray(scheduleEvents.eventType, [...query.eventTypes]));
    }

    if (query.membershipId !== undefined) {
      conditions.push(
        sql`json_contains(${scheduleEvents.affectedMembershipIds}, json_quote(${query.membershipId}))`,
      );
    }

    if (cursor !== undefined) {
      const cursorCondition = or(
        lt(scheduleEvents.occurredAt, cursor.occurredAt),
        and(eq(scheduleEvents.occurredAt, cursor.occurredAt), lt(scheduleEvents.id, cursor.id)),
      );

      if (cursorCondition !== undefined) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await transaction
      .select()
      .from(scheduleEvents)
      .where(and(...conditions))
      .orderBy(desc(scheduleEvents.occurredAt), desc(scheduleEvents.id))
      .limit(pageSize + 1);
    const pageRows = rows.slice(0, pageSize);
    const lastEvent = pageRows.at(-1);

    return {
      events: pageRows.map(toScheduleEvent),
      ...(rows.length > pageSize && lastEvent !== undefined
        ? { nextCursor: encodeCursor(lastEvent.occurredAt, lastEvent.id) }
        : {}),
    };
  }
}

function getPageSize(pageSize: number | undefined): number {
  const resolvedPageSize = pageSize ?? defaultPageSize;

  if (
    !Number.isInteger(resolvedPageSize) ||
    resolvedPageSize < 1 ||
    resolvedPageSize > maximumPageSize
  ) {
    throw validationError(`The page size must be an integer from 1 to ${maximumPageSize}.`);
  }

  return resolvedPageSize;
}

function parseTimestamp(value: string, field: string): Date {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.valueOf())) {
    throw validationError(`The ${field} timestamp must be valid.`);
  }

  return timestamp;
}

function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id })).toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): EventCursor {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    if (
      typeof value !== 'object' ||
      value === null ||
      !('id' in value) ||
      !('occurredAt' in value) ||
      typeof value.id !== 'string' ||
      typeof value.occurredAt !== 'string'
    ) {
      throw new Error('Invalid cursor.');
    }

    return { id: value.id, occurredAt: parseTimestamp(value.occurredAt, 'cursor') };
  } catch {
    throw validationError('The event cursor is invalid.');
  }
}

function toScheduleEvent(row: typeof scheduleEvents.$inferSelect): ScheduleEvent {
  return {
    affectedMembershipIds: row.affectedMembershipIds,
    affectedShiftIds: row.affectedShiftIds,
    eventStatus: row.eventStatus,
    eventType: row.eventType,
    groupId: row.groupId,
    id: row.id,
    objectType: row.objectType,
    occurredAt: row.occurredAt.toISOString(),
    operationId: row.operationId,
    ...(row.afterData === null ? {} : { afterData: row.afterData as JsonObject }),
    ...(row.approverUserId === null ? {} : { approverUserId: row.approverUserId }),
    ...(row.beforeData === null ? {} : { beforeData: row.beforeData as JsonObject }),
    ...(row.initiatedByUserId === null ? {} : { initiatedByUserId: row.initiatedByUserId }),
    ...(row.objectId === null ? {} : { objectId: row.objectId }),
    ...(row.operatorUserId === null ? {} : { operatorUserId: row.operatorUserId }),
    ...(row.parentEventId === null ? {} : { parentEventId: row.parentEventId }),
    ...(row.reason === null ? {} : { reason: row.reason }),
    ...(row.schedulePeriodId === null ? {} : { schedulePeriodId: row.schedulePeriodId }),
    ...(row.statisticsDelta === null ? {} : { statisticsDelta: row.statisticsDelta as JsonObject }),
  };
}

function validationError(userMessage: string): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage,
  });
}
