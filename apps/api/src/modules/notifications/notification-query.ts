import type {
  JsonObject,
  NotificationPage,
  NotificationQuery,
  NotificationRecord,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { notifications, withTransaction } from '@schedule/database';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { requireActiveUser } from './active-user.js';

const defaultPageSize = 30;
const maximumPageSize = 100;

interface NotificationCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export class NotificationQueryService {
  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async listMine(
    identity: AuthenticatedIdentity,
    query: NotificationQuery,
  ): Promise<NotificationPage> {
    return withTransaction(this.databaseClient, (transaction) =>
      this.listMineInTransaction(transaction, identity, query),
    );
  }

  public async listMineInTransaction(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    query: NotificationQuery,
  ): Promise<NotificationPage> {
    const userId = await requireActiveUser(transaction, identity);
    const pageSize = getPageSize(query.pageSize);
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const conditions = [eq(notifications.recipientUserId, userId)];

    if (query.groupId !== undefined) {
      conditions.push(eq(notifications.groupId, query.groupId));
    }
    if (query.unreadOnly === true) {
      conditions.push(eq(notifications.isRead, 0));
    }
    if (cursor !== undefined) {
      const cursorCondition = or(
        lt(notifications.createdAt, cursor.createdAt),
        and(eq(notifications.createdAt, cursor.createdAt), lt(notifications.id, cursor.id)),
      );
      if (cursorCondition !== undefined) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await transaction
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(pageSize + 1);
    const pageRows = rows.slice(0, pageSize);
    const lastNotification = pageRows.at(-1);

    return {
      notifications: pageRows.map(toNotificationRecord),
      unreadCount: await getUnreadCount(transaction, userId, query.groupId),
      ...(rows.length > pageSize && lastNotification !== undefined
        ? { nextCursor: encodeCursor(lastNotification.createdAt, lastNotification.id) }
        : {}),
    };
  }

  public async unreadCount(identity: AuthenticatedIdentity, groupId?: string): Promise<number> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const userId = await requireActiveUser(transaction, identity);
      return getUnreadCount(transaction, userId, groupId);
    });
  }

  public async markRead(
    identity: AuthenticatedIdentity,
    notificationId: string,
  ): Promise<NotificationRecord> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const userId = await requireActiveUser(transaction, identity);
      const [row] = await transaction
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, userId)))
        .limit(1)
        .for('update');
      if (row === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '通知不存在。',
        });
      }

      if (row.isRead !== 1) {
        await transaction
          .update(notifications)
          .set({ isRead: 1, readAt: new Date() })
          .where(eq(notifications.id, notificationId));
      }

      const [updated] = await transaction
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1);

      return toNotificationRecord(updated as typeof notifications.$inferSelect);
    });
  }

  public async markAllRead(
    identity: AuthenticatedIdentity,
    groupId: string | undefined,
  ): Promise<{ readonly count: number }> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const userId = await requireActiveUser(transaction, identity);
      const conditions = [eq(notifications.recipientUserId, userId), eq(notifications.isRead, 0)];
      if (groupId !== undefined) {
        conditions.push(eq(notifications.groupId, groupId));
      }

      const [result] = await transaction
        .update(notifications)
        .set({ isRead: 1, readAt: new Date() })
        .where(and(...conditions));

      return { count: result.affectedRows };
    });
  }
}

function getUnreadCount(
  transaction: DatabaseTransaction,
  userId: string,
  groupId?: string,
): Promise<number> {
  return transaction
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(buildUnreadCountCondition(userId, groupId))
    .then((rows) => rows[0]?.count ?? 0);
}

export function buildUnreadCountCondition(userId: string, groupId?: string) {
  const conditions = [eq(notifications.recipientUserId, userId), eq(notifications.isRead, 0)];
  if (groupId !== undefined) conditions.push(eq(notifications.groupId, groupId));
  return and(...conditions) as Exclude<ReturnType<typeof and>, undefined>;
}

function getPageSize(pageSize: number | undefined): number {
  const resolvedPageSize = pageSize ?? defaultPageSize;
  if (
    !Number.isInteger(resolvedPageSize) ||
    resolvedPageSize < 1 ||
    resolvedPageSize > maximumPageSize
  ) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: `每页数量必须是 1 到 ${maximumPageSize} 的整数。`,
    });
  }

  return resolvedPageSize;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): NotificationCursor {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof value !== 'object' ||
      value === null ||
      !('id' in value) ||
      !('createdAt' in value) ||
      typeof value.id !== 'string' ||
      typeof value.createdAt !== 'string'
    ) {
      throw new Error('Invalid cursor.');
    }
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.valueOf())) {
      throw new Error('Invalid cursor timestamp.');
    }
    return { createdAt, id: value.id };
  } catch {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '通知游标无效。',
    });
  }
}

function toNotificationRecord(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    ...(row.groupId === null ? {} : { groupId: row.groupId }),
    id: row.id,
    isRead: row.isRead === 1,
    notificationType: row.notificationType,
    ...(row.objectId === null ? {} : { objectId: row.objectId }),
    ...(row.objectType === null ? {} : { objectType: row.objectType }),
    ...(row.payload === null ? {} : { payload: row.payload as JsonObject }),
    recipientUserId: row.recipientUserId,
    ...(row.scheduleEventId === null ? {} : { scheduleEventId: row.scheduleEventId }),
    ...(row.shiftAssignmentId === null ? {} : { shiftAssignmentId: row.shiftAssignmentId }),
    title: row.title,
  };
}
