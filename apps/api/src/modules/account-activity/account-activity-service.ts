import type {
  AccountActivitySummary,
  AccountLoginMethod,
  AccountOpenRequest,
} from '@schedule/contracts';
import {
  accountActivitySummaries,
  accountOpenReceipts,
  users,
  withTransaction,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { requirePlatformAdmin } from '../platform-admin/platform-admin.js';

export function chinaActivityDay(now: Date): string {
  return new Date(now.valueOf() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const emptySummary: AccountActivitySummary = {
  todayLoginCount: 0,
  todayOpenCount: 0,
  totalOpenCount: 0,
};

export class AccountActivityService {
  public constructor(
    private readonly client: DatabaseClient,
    private readonly admins: ReadonlySet<string> = new Set(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Kept outside the authentication transaction: a statistics failure cannot roll back a session.
  public async recordLogin(userId: string, method: AccountLoginMethod): Promise<void> {
    await withTransaction(this.client, async (tx) => {
      await this.lockUser(tx, eq(users.id, userId));
      const now = this.now();
      const row = await this.summaryForUpdate(tx, userId, now);
      const day = chinaActivityDay(now);
      await tx
        .update(accountActivitySummaries)
        .set({
          day,
          todayLoginCount: (row.day === day ? row.todayLoginCount : 0) + 1,
          todayOpenCount: row.day === day ? row.todayOpenCount : 0,
          lastLoginAt: now,
          lastLoginMethod: method,
        })
        .where(eq(accountActivitySummaries.userId, userId));
    });
  }

  public async recordOpen(
    identity: AuthenticatedIdentity,
    input: AccountOpenRequest,
  ): Promise<{ recorded: boolean }> {
    const now = this.now();
    const openedAt = new Date(input.openedAt);
    // Bound clock skew and reject expired replays even after receipts are pruned.
    if (
      !Number.isFinite(openedAt.valueOf()) ||
      openedAt.valueOf() <= now.valueOf() - 30 * 86400000 ||
      openedAt.valueOf() > now.valueOf() + 300000
    ) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '访问时间已过期或无效。',
      });
    }
    return withTransaction(this.client, async (tx) => {
      const userId = await this.lockUser(tx, eq(users.cloudbaseUid, identity.cloudbaseUid));
      const [receipt] = await tx
        .select({ eventId: accountOpenReceipts.eventId })
        .from(accountOpenReceipts)
        .where(
          and(
            eq(accountOpenReceipts.userId, userId),
            eq(accountOpenReceipts.eventId, input.eventId),
          ),
        )
        .limit(1);
      if (receipt !== undefined) return { recorded: false };
      const row = await this.summaryForUpdate(tx, userId, now);
      await tx.insert(accountOpenReceipts).values({ userId, eventId: input.eventId, openedAt });
      const day = chinaActivityDay(now);
      await tx
        .update(accountActivitySummaries)
        .set({
          day,
          todayLoginCount: row.day === day ? row.todayLoginCount : 0,
          todayOpenCount:
            (row.day === day ? row.todayOpenCount : 0) +
            (chinaActivityDay(openedAt) === day ? 1 : 0),
          totalOpenCount: row.totalOpenCount + 1,
          lastOpenedAt:
            row.lastOpenedAt === null || row.lastOpenedAt < openedAt ? openedAt : row.lastOpenedAt,
        })
        .where(eq(accountActivitySummaries.userId, userId));
      return { recorded: true };
    });
  }

  public async summary(
    identity: AuthenticatedIdentity,
    userId: string,
  ): Promise<AccountActivitySummary> {
    return withTransaction(this.client, async (tx) => {
      await requirePlatformAdmin(tx, identity, this.admins);
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);
      if (user === undefined)
        throw new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage: '账号不存在。' });
      const [row] = await tx
        .select()
        .from(accountActivitySummaries)
        .where(eq(accountActivitySummaries.userId, userId))
        .limit(1);
      if (row === undefined) return emptySummary;
      const today = row.day === chinaActivityDay(this.now());
      return {
        startedAt: row.startedAt.toISOString(),
        ...(row.lastLoginAt === null ? {} : { lastLoginAt: row.lastLoginAt.toISOString() }),
        ...(row.lastLoginMethod === null ? {} : { lastLoginMethod: row.lastLoginMethod }),
        todayLoginCount: today ? row.todayLoginCount : 0,
        ...(row.lastOpenedAt === null ? {} : { lastOpenedAt: row.lastOpenedAt.toISOString() }),
        todayOpenCount: today ? row.todayOpenCount : 0,
        totalOpenCount: row.totalOpenCount,
      };
    });
  }

  private async lockUser(
    tx: DatabaseTransaction,
    condition: ReturnType<typeof eq>,
  ): Promise<string> {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(condition, eq(users.status, 'active'), isNull(users.deletedAt)))
      .limit(1)
      .for('update');
    if (user === undefined)
      throw new ApiError({
        code: 'AUTHENTICATION_REQUIRED',
        statusCode: 401,
        userMessage: '请重新登录。',
      });
    return user.id;
  }
  private async summaryForUpdate(tx: DatabaseTransaction, userId: string, now: Date) {
    await tx
      .insert(accountActivitySummaries)
      .values({ userId, startedAt: now, day: chinaActivityDay(now) })
      .onDuplicateKeyUpdate({ set: { userId } });
    const [row] = await tx
      .select()
      .from(accountActivitySummaries)
      .where(eq(accountActivitySummaries.userId, userId))
      .limit(1)
      .for('update');
    if (row === undefined) throw new Error('ACCOUNT_ACTIVITY_SUMMARY_MISSING');
    return row;
  }
}
