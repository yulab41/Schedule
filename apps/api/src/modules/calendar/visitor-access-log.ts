import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

import type {
  VisitorAccessAggregate,
  VisitorAccessAggregatePage,
  VisitorAccessLog,
  VisitorAccessLogPage,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  guestScheduleAccessAttempts,
  groups,
  visitorAccessLogs,
  visitorAccessMonthlyAggregates,
  withTransaction,
} from '@schedule/database';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { requirePlatformAdmin } from '../platform-admin/platform-admin.js';

const MAX_ACCESS_LOG_PAGE_SIZE = 100;
const FAILED_RESOLVE_THRESHOLD = 5;
const visitorAccessRetentionMilliseconds = 90 * 24 * 60 * 60 * 1000;

export interface VisitorAccessLogServiceOptions {
  readonly now?: () => Date;
  readonly platformAdminUids?: ReadonlySet<string>;
}

export class VisitorAccessLogService {
  private readonly permissionService = new GroupPermissionService();
  private readonly now: () => Date;
  private readonly platformAdminUids: ReadonlySet<string>;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    options: VisitorAccessLogServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.platformAdminUids = options.platformAdminUids ?? new Set();
  }

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
      clientIp: normalizeClientIp(clientIp) ?? null,
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
    const cutoff = new Date(this.now().valueOf() - visitorAccessRetentionMilliseconds);

    return withTransaction(this.databaseClient, async (transaction) => {
      await this.requireAccess(transaction, identity, groupId);

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
            gte(visitorAccessLogs.createdAt, cutoff),
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

  public async listAggregates(
    identity: AuthenticatedIdentity,
    groupId: string,
    cursor: string | undefined,
    pageSize = MAX_ACCESS_LOG_PAGE_SIZE,
  ): Promise<VisitorAccessAggregatePage> {
    const limit = Math.min(Math.max(Math.floor(pageSize), 1), MAX_ACCESS_LOG_PAGE_SIZE);
    return withTransaction(this.databaseClient, async (transaction) => {
      await this.requireAccess(transaction, identity, groupId);
      const [schemaRows] = (await transaction.execute(sql`
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'visitor_access_monthly_aggregates'
      `)) as unknown as [readonly { count: number }[], unknown];
      if ((schemaRows[0]?.count ?? 0) !== 1) {
        throw new ApiError({
          code: 'SERVICE_UNAVAILABLE',
          statusCode: 503,
          userMessage: '访客匿名汇总暂不可用。',
        });
      }
      const rows = await transaction
        .select({
          accessCount: visitorAccessMonthlyAggregates.accessCount,
          accessMonth: visitorAccessMonthlyAggregates.accessMonth,
          businessMonth: visitorAccessMonthlyAggregates.businessMonth,
        })
        .from(visitorAccessMonthlyAggregates)
        .where(
          and(
            eq(visitorAccessMonthlyAggregates.groupId, groupId),
            cursor === undefined
              ? undefined
              : sql`(
                  ${visitorAccessMonthlyAggregates.accessMonth} < ${readAggregateCursorAccessMonth(cursor)}
                  OR (
                    ${visitorAccessMonthlyAggregates.accessMonth} = ${readAggregateCursorAccessMonth(cursor)}
                    AND ${visitorAccessMonthlyAggregates.businessMonth} < ${readAggregateCursorBusinessMonth(cursor)}
                  )
                )`,
          ),
        )
        .orderBy(
          desc(visitorAccessMonthlyAggregates.accessMonth),
          desc(visitorAccessMonthlyAggregates.businessMonth),
        )
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      return {
        aggregates: pageRows.map(toVisitorAccessAggregate),
        ...(hasMore && pageRows.length > 0
          ? {
              nextCursor: `${pageRows[pageRows.length - 1]?.accessMonth}|${pageRows[pageRows.length - 1]?.businessMonth}`,
            }
          : {}),
      };
    });
  }

  private async requireAccess(
    transaction: Parameters<GroupPermissionService['requirePermission']>[0],
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<void> {
    try {
      await requirePlatformAdmin(transaction, identity, this.platformAdminUids);
      return;
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        (error.code !== 'FORBIDDEN' && error.code !== 'NOT_FOUND')
      ) {
        throw error;
      }
    }
    await this.permissionService.requirePermission(
      transaction,
      identity,
      groupId,
      'viewVisitorAccessLogs',
    );
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

export function normalizeClientIp(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const candidate = value.trim();
  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(candidate)?.[1];
  if (mappedIpv4 !== undefined && isIP(mappedIpv4) === 4) return mappedIpv4;
  return isIP(candidate) === 0 ? undefined : candidate.toLowerCase();
}

function readCursorDate(cursor: string): string {
  return cursor.split('|')[0] ?? '';
}

function readCursorId(cursor: string): string {
  return cursor.split('|')[1] ?? '';
}

function readAggregateCursorAccessMonth(cursor: string): string {
  return cursor.split('|')[0] ?? '';
}

function readAggregateCursorBusinessMonth(cursor: string): string {
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

function toVisitorAccessAggregate(row: {
  readonly accessCount: bigint;
  readonly accessMonth: string;
  readonly businessMonth: string;
}): VisitorAccessAggregate {
  return {
    accessCount: String(row.accessCount),
    accessMonth: row.accessMonth,
    businessMonth: row.businessMonth,
  };
}
