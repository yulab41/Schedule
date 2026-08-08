import { createHash, randomUUID } from 'node:crypto';

import type { VisitorAccessLog, VisitorAccessLogPage } from '@schedule/contracts';
import {
  type DatabaseClient,
  guestScheduleAccessAttempts,
  groups,
  visitorAccessLogs,
  withTransaction,
} from '@schedule/database';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';

const MAX_ACCESS_LOG_PAGE_SIZE = 100;
const FAILED_RESOLVE_THRESHOLD = 5;

export class VisitorAccessLogService {
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async resolveGroup(
    visitorKey: string,
    expectedGroupId?: string,
  ): Promise<{ readonly groupId: string; readonly groupName: string }> {
    const accessKey = createHash('sha256').update(visitorKey).digest('hex');
    const [group] = await this.databaseClient.database
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(eq(groups.visitorKey, visitorKey), isNull(groups.deletedAt)))
      .limit(1);

    if (group === undefined || (expectedGroupId !== undefined && group.id !== expectedGroupId)) {
      await this.consumeFailedResolve(accessKey);
      throw new ApiError({
        code: 'VISITOR_KEY_INVALID',
        statusCode: 404,
        userMessage: '访客链接无效或群组不可用。',
      });
    }

    return { groupId: group.id, groupName: group.name };
  }

  public async recordAccess(
    groupId: string,
    businessMonth: string,
    clientIp: string | undefined,
    requestId: string | undefined,
  ): Promise<void> {
    await this.databaseClient.database.insert(visitorAccessLogs).values({
      businessMonth,
      clientIp: clientIp ?? null,
      groupId,
      id: randomUUID(),
      requestId: requestId ?? null,
    });
  }

  public async listLogs(
    identity: AuthenticatedIdentity,
    groupId: string,
    cursor: string | undefined,
    pageSize = MAX_ACCESS_LOG_PAGE_SIZE,
  ): Promise<VisitorAccessLogPage> {
    const limit = Math.min(Math.max(Math.floor(pageSize), 1), MAX_ACCESS_LOG_PAGE_SIZE);

    return withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewVisitorAccessLogs',
      );

      const rows = await transaction
        .select({
          businessMonth: visitorAccessLogs.businessMonth,
          clientIp: visitorAccessLogs.clientIp,
          createdAt: visitorAccessLogs.createdAt,
          groupId: visitorAccessLogs.groupId,
          id: visitorAccessLogs.id,
          requestId: visitorAccessLogs.requestId,
        })
        .from(visitorAccessLogs)
        .where(
          and(
            eq(visitorAccessLogs.groupId, groupId),
            cursor === undefined
              ? undefined
              : sql`(
                  ${visitorAccessLogs.createdAt} < ${readCursorDate(cursor)}
                  OR (
                    ${visitorAccessLogs.createdAt} = ${readCursorDate(cursor)}
                    AND ${visitorAccessLogs.id} < ${readCursorId(cursor)}
                  )
                )`,
          ),
        )
        .orderBy(desc(visitorAccessLogs.createdAt), desc(visitorAccessLogs.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      return {
        logs: pageRows.map((row) => toVisitorAccessLog(row)),
        ...(hasMore && pageRows.length > 0
          ? {
              nextCursor: `${toMySqlTimestamp(
                pageRows[pageRows.length - 1]?.createdAt as Date,
              )}|${pageRows[pageRows.length - 1]?.id}`,
            }
          : {}),
      };
    });
  }

  private async consumeFailedResolve(accessKey: string): Promise<void> {
    const windowExpired = sql`${guestScheduleAccessAttempts.windowStartedAt} < timestampadd(second, -60, current_timestamp(3))`;
    await this.databaseClient.database
      .insert(guestScheduleAccessAttempts)
      .values({ accessKey })
      .onDuplicateKeyUpdate({
        set: {
          attemptCount: sql`if(${windowExpired}, 1, ${guestScheduleAccessAttempts.attemptCount} + 1)`,
          windowStartedAt: sql`if(${windowExpired}, current_timestamp(3), ${guestScheduleAccessAttempts.windowStartedAt})`,
        },
      });
    const [attempt] = await this.databaseClient.database
      .select({ count: guestScheduleAccessAttempts.attemptCount })
      .from(guestScheduleAccessAttempts)
      .where(eq(guestScheduleAccessAttempts.accessKey, accessKey))
      .limit(1);
    if (attempt !== undefined && attempt.count > FAILED_RESOLVE_THRESHOLD) {
      throw new ApiError({
        code: 'RATE_LIMITED',
        statusCode: 429,
        userMessage: '访客链接尝试过于频繁，请稍后重试。',
      });
    }
  }
}

function readCursorDate(cursor: string): string {
  return cursor.split('|')[0] ?? '';
}

function readCursorId(cursor: string): string {
  return cursor.split('|')[1] ?? '';
}

function toMySqlTimestamp(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.` +
    `${pad(date.getUTCMilliseconds(), 3)}`
  );
}

function toVisitorAccessLog(row: {
  readonly businessMonth: string;
  readonly clientIp: string | null;
  readonly createdAt: Date;
  readonly groupId: string;
  readonly id: string;
  readonly requestId: string | null;
}): VisitorAccessLog {
  return {
    businessMonth: row.businessMonth,
    ...(row.clientIp === null ? {} : { clientIp: row.clientIp }),
    createdAt: row.createdAt.toISOString(),
    groupId: row.groupId,
    id: row.id,
    ...(row.requestId === null ? {} : { requestId: row.requestId }),
  };
}
