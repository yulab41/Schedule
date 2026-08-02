import type { DatabaseClient } from '@schedule/database';
import { exportJobs, withTransaction } from '@schedule/database';
import { asc, eq } from 'drizzle-orm';

import { buildExportContent } from '../modules/exports/export-content.js';

const downloadTtlMinutes = 15;

export interface ExportJobRunResult {
  readonly completed: number;
  readonly failed: number;
  readonly processed: number;
  readonly skipped: number;
}

export class ExportJobProcessor {
  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly options: { readonly batchSize?: number } = {},
  ) {}

  public async run(now = new Date()): Promise<ExportJobRunResult> {
    const batchSize = this.options.batchSize ?? 10;
    const pendingJobs = await withTransaction(this.databaseClient, (transaction) =>
      transaction
        .select({ id: exportJobs.id })
        .from(exportJobs)
        .where(eq(exportJobs.status, 'pending'))
        .orderBy(asc(exportJobs.createdAt))
        .limit(batchSize),
    );

    let completed = 0;
    let failed = 0;
    let skipped = 0;
    for (const job of pendingJobs) {
      const outcome = await this.processOne(job.id, now);
      if (outcome === 'completed') {
        completed += 1;
      } else if (outcome === 'failed') {
        failed += 1;
      } else {
        skipped += 1;
      }
    }

    return { completed, failed, processed: pendingJobs.length, skipped };
  }

  private async processOne(
    exportJobId: string,
    now: Date,
  ): Promise<'completed' | 'failed' | 'skipped'> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [job] = await transaction
        .select()
        .from(exportJobs)
        .where(eq(exportJobs.id, exportJobId))
        .limit(1)
        .for('update');
      if (job === undefined || job.status !== 'pending') {
        return 'skipped';
      }
      await transaction
        .update(exportJobs)
        .set({ startedAt: now, status: 'running' })
        .where(eq(exportJobs.id, exportJobId));

      try {
        const result = await buildExportContent(transaction, job);
        await transaction
          .update(exportJobs)
          .set({
            completedAt: now,
            expiresAt: new Date(now.valueOf() + downloadTtlMinutes * 60_000),
            fileContent: result.content,
            rowCount: result.rowCount,
            status: 'completed',
          })
          .where(eq(exportJobs.id, exportJobId));
        return 'completed';
      } catch (error) {
        await transaction
          .update(exportJobs)
          .set({
            completedAt: now,
            error: getErrorMessage(error).slice(0, 500),
            status: 'failed',
          })
          .where(eq(exportJobs.id, exportJobId));
        return 'failed';
      }
    });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}
