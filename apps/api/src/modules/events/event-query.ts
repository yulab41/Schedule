import type {
  JsonObject,
  ScheduleEvent,
  ScheduleEventDetail,
  ScheduleEventPage,
  ScheduleEventQuery,
} from '@schedule/contracts';
import {
  schedulePeriods,
  scheduleEvents,
  shiftAssignments,
  userProfiles,
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
} from '@schedule/database';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';
import { visibleTimelineEvents } from './mini-timeline-cleanup.js';

const defaultPageSize = 50;
const maximumPageSize = 100;
const maximumEventTypes = 20;

const nonShiftScopedEventTypes = new Set([
  'manual_schedule_inline_applied',
  'manual_schedule_template_applied',
  'manual_schedule_template_created',
  'manual_schedule_template_deleted',
  'manual_schedule_template_updated',
  'rotation_order_changed',
  'schedule_generation_completed',
  'schedule_period_created',
  'schedule_period_deleted',
  'schedule_period_published',
  'schedule_period_replaced',
  'schedule_period_withdrawn',
  'schedule_role_changed',
  'schedule_role_corrected',
  'shift_type_changed',
]);

interface EventCursor {
  readonly id: string;
  readonly occurredAt: Date;
}

export class EventQuery {
  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async getDetail(groupId: string, eventId: string): Promise<ScheduleEventDetail> {
    return withTransaction(this.databaseClient, (transaction) =>
      this.getDetailInTransaction(transaction, groupId, eventId),
    );
  }

  public async list(query: ScheduleEventQuery): Promise<ScheduleEventPage> {
    return withTransaction(this.databaseClient, (transaction) =>
      this.listInTransaction(transaction, query),
    );
  }

  public async getDetailInTransaction(
    transaction: DatabaseTransaction,
    groupId: string,
    eventId: string,
  ): Promise<ScheduleEventDetail> {
    const [eventRow] = await transaction
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.id, eventId), eq(scheduleEvents.groupId, groupId)))
      .limit(1);
    if (eventRow === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '事件不存在或不属于该群组。',
      });
    }

    const relatedRows = await this.loadRelatedEvents(transaction, groupId, eventRow);
    const rows = [...relatedRows, eventRow];
    rows.sort(
      (first, second) =>
        first.occurredAt.valueOf() - second.occurredAt.valueOf() ||
        first.id.localeCompare(second.id),
    );

    return {
      event: toScheduleEvent(eventRow),
      relatedEvents: rows
        .filter((row) => row.id !== eventRow.id)
        .map((row) => toScheduleEvent(row)),
    };
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

    // Group timelines always honor stored visibility, independent of client headers.
    // Per-shift audit queries and event details retain their original records.
    if (query.shiftId === undefined) {
      conditions.push(visibleTimelineEvents());
    }

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

    if (query.operatorUserId !== undefined) {
      conditions.push(eq(scheduleEvents.operatorUserId, query.operatorUserId));
    }

    if (query.shiftId !== undefined) {
      conditions.push(
        sql`json_contains(${scheduleEvents.affectedShiftIds}, json_quote(${query.shiftId}))`,
      );
      conditions.push(notInArray(scheduleEvents.eventType, [...nonShiftScopedEventTypes]));
    }

    if (query.scheduleRoleId !== undefined) {
      conditions.push(this.buildRoleCondition(query.groupId, query.scheduleRoleId));
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
    const operatorIds = [
      ...new Set(
        pageRows.flatMap((row) => (row.operatorUserId === null ? [] : [row.operatorUserId])),
      ),
    ];
    const profiles =
      query.includeOperatorName === true && operatorIds.length > 0
        ? await transaction
            .select({ userId: userProfiles.userId, realName: userProfiles.realName })
            .from(userProfiles)
            .where(and(inArray(userProfiles.userId, operatorIds), isNull(userProfiles.deletedAt)))
        : [];
    const names = new Map(profiles.map((profile) => [profile.userId, profile.realName]));

    return {
      events: pageRows.map((row) => {
        const operatorName =
          row.operatorUserId === null ? undefined : names.get(row.operatorUserId);
        return { ...toScheduleEvent(row), ...(operatorName === undefined ? {} : { operatorName }) };
      }),
      ...(rows.length > pageSize && lastEvent !== undefined
        ? { nextCursor: encodeCursor(lastEvent.occurredAt, lastEvent.id) }
        : {}),
    };
  }

  private buildRoleCondition(groupId: string, scheduleRoleId: string): SQL {
    // Expand only the shifts affected by this event; do not enumerate role history
    // in Node or generate one JSON_CONTAINS branch for every historical shift.
    return sql`(
      EXISTS (SELECT 1 FROM ${schedulePeriods}
        WHERE ${schedulePeriods.id} = ${scheduleEvents.schedulePeriodId}
          AND ${schedulePeriods.groupId} = ${groupId}
          AND ${schedulePeriods.scheduleRoleId} = ${scheduleRoleId}
          AND ${schedulePeriods.deletedAt} IS NULL)
      OR EXISTS (SELECT 1 FROM JSON_TABLE(${scheduleEvents.affectedShiftIds},
        '$[*]' COLUMNS (shift_id VARCHAR(36) PATH '$')) AS affected
        INNER JOIN ${shiftAssignments} ON ${shiftAssignments.id} = affected.shift_id COLLATE utf8mb4_0900_ai_ci
          AND JSON_CONTAINS(${scheduleEvents.affectedShiftIds}, JSON_QUOTE(${shiftAssignments.id}))
        INNER JOIN ${schedulePeriods} ON ${schedulePeriods.id} = ${shiftAssignments.schedulePeriodId}
        WHERE ${schedulePeriods.groupId} = ${groupId}
          AND ${schedulePeriods.scheduleRoleId} = ${scheduleRoleId}
          AND ${schedulePeriods.deletedAt} IS NULL
          AND ${shiftAssignments.deletedAt} IS NULL)
    )`;
  }

  private async loadRelatedEvents(
    transaction: DatabaseTransaction,
    groupId: string,
    eventRow: typeof scheduleEvents.$inferSelect,
  ): Promise<readonly (typeof scheduleEvents.$inferSelect)[]> {
    const related = new Map<string, typeof scheduleEvents.$inferSelect>();
    const maximumRelatedEvents = 100;

    let parentId = eventRow.parentEventId;
    while (parentId !== null && related.size < maximumRelatedEvents) {
      const [parent] = await transaction
        .select()
        .from(scheduleEvents)
        .where(and(eq(scheduleEvents.id, parentId), eq(scheduleEvents.groupId, groupId)))
        .limit(1);
      if (parent === undefined) {
        break;
      }
      related.set(parent.id, parent);
      parentId = parent.parentEventId;
    }

    let frontier = [eventRow.id];
    while (frontier.length > 0 && related.size < maximumRelatedEvents) {
      const children = await transaction
        .select()
        .from(scheduleEvents)
        .where(
          and(eq(scheduleEvents.groupId, groupId), inArray(scheduleEvents.parentEventId, frontier)),
        )
        .limit(maximumRelatedEvents - related.size);
      frontier = [];
      for (const child of children) {
        if (related.has(child.id)) {
          continue;
        }
        related.set(child.id, child);
        frontier.push(child.id);
      }
    }

    return [...related.values()];
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
