import type { DatabaseClient } from '@schedule/database';
import { schedulePeriods, withTransaction } from '@schedule/database';
import { eq } from 'drizzle-orm';

import { StatisticsService } from '../modules/statistics/statistics-service.js';

export interface StatisticsRebuildRunResult {
  readonly completed: number;
  readonly failed: number;
  readonly months: number;
}

export class StatisticsRebuildJob {
  private readonly statisticsService: StatisticsService;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly options: { readonly fromMonth?: string } = {},
  ) {
    this.statisticsService = new StatisticsService(databaseClient);
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
    for (const { businessMonth, groupId } of filtered) {
      try {
        await withTransaction(this.databaseClient, (transaction) =>
          this.statisticsService.refreshInTransaction(transaction, groupId, businessMonth),
        );
        completed += 1;
      } catch {
        failed += 1;
      }
    }

    return { completed, failed, months: filtered.length };
  }
}
