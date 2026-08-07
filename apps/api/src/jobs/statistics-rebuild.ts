import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { schedulePeriods, withTransaction } from '@schedule/database';
import { eq } from 'drizzle-orm';

import { StatisticsService } from '../modules/statistics/statistics-service.js';

export interface StatisticsRebuildRunResult {
  readonly completed: number;
  readonly failed: number;
  readonly failures: readonly StatisticsRebuildFailure[];
  readonly months: number;
}

export interface StatisticsRebuildFailure {
  readonly businessMonth: string;
  readonly error: string;
  readonly groupId: string;
}

export interface StatisticsRefresher {
  refreshInTransaction(
    transaction: DatabaseTransaction,
    groupId: string,
    businessMonth: string,
    triggeredByEventId?: string,
  ): Promise<void>;
}

export interface StatisticsRebuildJobOptions {
  readonly fromMonth?: string;
  readonly statisticsRefresher?: StatisticsRefresher;
}

export class StatisticsRebuildJob {
  private readonly statisticsService: StatisticsRefresher;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly options: StatisticsRebuildJobOptions = {},
  ) {
    this.statisticsService = options.statisticsRefresher ?? new StatisticsService(databaseClient);
  }

  public async run(): Promise<StatisticsRebuildRunResult> {
    const months = await withTransaction(this.databaseClient, (transaction) =>
      transaction
        .selectDistinct({
          businessMonth: schedulePeriods.businessMonth,
          groupId: schedulePeriods.groupId,
        })
        .from(schedulePeriods)
        .where(eq(schedulePeriods.status, 'published')),
    );
    const filtered =
      this.options.fromMonth === undefined
        ? months
        : months.filter((month) => month.businessMonth >= (this.options.fromMonth ?? ''));

    let completed = 0;
    let failed = 0;
    const failures: StatisticsRebuildFailure[] = [];
    for (const { businessMonth, groupId } of filtered) {
      try {
        await withTransaction(this.databaseClient, (transaction) =>
          this.statisticsService.refreshInTransaction(transaction, groupId, businessMonth),
        );
        completed += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          businessMonth,
          // 与 platform_job_runs.summary 的 500 字符上限一致，避免单条错误撑爆摘要。
          error: getErrorMessage(error).slice(0, 500),
          groupId,
        });
      }
    }

    return { completed, failed, failures, months: filtered.length };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}
