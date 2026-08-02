import { randomUUID } from 'node:crypto';

import type {
  MonthStatisticsSnapshot,
  StatisticsRecalculateCheckResult,
  StatisticsSummary,
  YearStatistics,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { statisticsRecalcChecks, statisticsSnapshots, withTransaction } from '@schedule/database';
import { mergeMonthStatistics } from '@schedule/scheduling-domain';
import { and, eq, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { StatisticsComputation } from './statistics-computation.js';

const comparisonFields = [
  'plannedCount',
  'actualCount',
  'countedPlannedCount',
  'countedActualCount',
  'weekendCount',
  'holidayCount',
  'swapCount',
  'overtimeCount',
  'deductionCount',
  'netDutyAdjustment',
  'leaveCoverCount',
  'manualAdjustmentCount',
] as const satisfies readonly (keyof StatisticsSummary)[];

export class StatisticsService {
  private readonly computation = new StatisticsComputation();
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async refreshInTransaction(
    transaction: DatabaseTransaction,
    groupId: string,
    businessMonth: string,
    triggeredByEventId?: string,
  ): Promise<void> {
    const result = await this.computation.computeMonth(transaction, groupId, businessMonth);
    await transaction
      .insert(statisticsSnapshots)
      .values({
        businessMonth,
        computedAt: result.computedAt,
        groupId,
        id: randomUUID(),
        payload: toJsonObject(result.summary),
        triggeredByEventId: triggeredByEventId ?? null,
        version: 1,
      })
      .onDuplicateKeyUpdate({
        set: {
          computedAt: result.computedAt,
          payload: toJsonObject(result.summary),
          triggeredByEventId: triggeredByEventId ?? null,
          version: sql`${statisticsSnapshots.version} + 1`,
        },
      });
  }

  public async getMonth(
    identity: AuthenticatedIdentity,
    groupId: string,
    businessMonth: string,
  ): Promise<MonthStatisticsSnapshot> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return this.readOrComputeMonth(transaction, groupId, businessMonth);
    });
  }

  public async getYear(
    identity: AuthenticatedIdentity,
    groupId: string,
    year: number,
  ): Promise<YearStatistics> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const months = await Promise.all(
        getYearMonths(year).map((businessMonth) =>
          this.readOrComputeMonth(transaction, groupId, businessMonth),
        ),
      );
      const summaries = months.map((month) => month.summary);
      const summary = mergeMonthStatistics(summaries);

      return {
        months: months.map((month) => ({
          businessMonth: month.businessMonth,
          summary: month.summary,
        })),
        summary,
        year,
      };
    });
  }

  public async refresh(
    identity: AuthenticatedIdentity,
    groupId: string,
    businessMonth: string,
  ): Promise<MonthStatisticsSnapshot> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      await this.refreshInTransaction(transaction, authorization.group.id, businessMonth);
      const [row] = await transaction
        .select()
        .from(statisticsSnapshots)
        .where(
          and(
            eq(statisticsSnapshots.groupId, authorization.group.id),
            eq(statisticsSnapshots.businessMonth, businessMonth),
          ),
        )
        .limit(1);
      if (row === undefined) {
        throw new ApiError({
          code: 'INTERNAL_ERROR',
          statusCode: 500,
          userMessage: '统计快照刷新失败。',
        });
      }
      return toSnapshot(row);
    });
  }

  public async recalculateCheck(
    identity: AuthenticatedIdentity,
    groupId: string,
    businessMonth: string,
  ): Promise<StatisticsRecalculateCheckResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const recomputed = await this.computation.computeMonth(
        transaction,
        authorization.group.id,
        businessMonth,
      );
      const [snapshotRow] = await transaction
        .select()
        .from(statisticsSnapshots)
        .where(
          and(
            eq(statisticsSnapshots.groupId, authorization.group.id),
            eq(statisticsSnapshots.businessMonth, businessMonth),
          ),
        )
        .limit(1);
      const snapshotSummary =
        snapshotRow === undefined
          ? undefined
          : (snapshotRow.payload as unknown as StatisticsSummary);
      const mismatches =
        snapshotSummary === undefined
          ? ['missing_snapshot']
          : compareSummaries(recomputed.summary, snapshotSummary);
      const matched = mismatches.length === 0;

      await transaction.insert(statisticsRecalcChecks).values({
        businessMonth,
        checkedByUserId: authorization.user.id,
        groupId: authorization.group.id,
        id: randomUUID(),
        matched: matched ? 1 : 0,
        mismatchSummary: mismatches,
        recomputedPayload: toJsonObject(recomputed.summary),
        snapshotVersion: snapshotRow?.version ?? 0,
      });
      if (snapshotRow === undefined) {
        await this.refreshInTransaction(transaction, authorization.group.id, businessMonth);
      }

      return {
        businessMonth: businessMonth.slice(0, 7),
        matched,
        mismatches,
        recomputed: recomputed.summary,
        snapshot: snapshotSummary ?? recomputed.summary,
        snapshotVersion: snapshotRow?.version ?? 1,
      };
    });
  }

  private async readOrComputeMonth(
    transaction: DatabaseTransaction,
    groupId: string,
    businessMonth: string,
  ): Promise<MonthStatisticsSnapshot> {
    const [row] = await transaction
      .select()
      .from(statisticsSnapshots)
      .where(
        and(
          eq(statisticsSnapshots.groupId, groupId),
          eq(statisticsSnapshots.businessMonth, businessMonth),
        ),
      )
      .limit(1);
    if (row !== undefined) {
      return toSnapshot(row);
    }

    const computed = await this.computation.computeMonth(transaction, groupId, businessMonth);
    return {
      businessMonth: businessMonth.slice(0, 7),
      computedAt: computed.computedAt.toISOString(),
      groupId,
      summary: computed.summary,
      version: 0,
    };
  }
}

function toSnapshot(row: typeof statisticsSnapshots.$inferSelect): MonthStatisticsSnapshot {
  return {
    businessMonth: row.businessMonth.slice(0, 7),
    computedAt: row.computedAt.toISOString(),
    groupId: row.groupId,
    summary: row.payload as unknown as StatisticsSummary,
    version: row.version,
  };
}

function toJsonObject(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function getYearMonths(year: number): readonly string[] {
  return Array.from(
    { length: 12 },
    (_, index) => `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}-01`,
  );
}

function compareSummaries(
  recomputed: StatisticsSummary,
  snapshot: StatisticsSummary,
): readonly string[] {
  const mismatches: string[] = [];
  for (const field of comparisonFields) {
    if (recomputed[field] !== snapshot[field]) {
      mismatches.push(`${field}: snapshot ${snapshot[field]} != recomputed ${recomputed[field]}`);
    }
  }
  const snapshotMembers = new Map(snapshot.members.map((member) => [member.membershipId, member]));
  for (const member of recomputed.members) {
    const other = snapshotMembers.get(member.membershipId);
    if (other === undefined) {
      mismatches.push(`member ${member.membershipId} (${member.realName}) missing in snapshot`);
      continue;
    }
    for (const field of comparisonFields) {
      if (member[field] !== other[field]) {
        mismatches.push(
          `member ${member.membershipId} ${field}: snapshot ${other[field]} != recomputed ${member[field]}`,
        );
      }
    }
  }
  for (const member of snapshot.members) {
    if (!recomputed.members.some((entry) => entry.membershipId === member.membershipId)) {
      mismatches.push(`member ${member.membershipId} (${member.realName}) only in snapshot`);
    }
  }

  return mismatches.slice(0, 20);
}
