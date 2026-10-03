import { randomUUID } from 'node:crypto';
import { platformJobRuns, withTransaction, type DatabaseClient } from '@schedule/database';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { AuditWriter } from '../modules/audit/audit-writer.js';

// User-approved operational-log policy; security/business audit records are untouched.
export async function purgeExpiredJobRuns(
  client: DatabaseClient,
  now = new Date(),
  batchSize = 1000,
  maxBatches = 100,
) {
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 1000 ||
    !Number.isInteger(maxBatches) ||
    maxBatches < 1 ||
    maxBatches > 100
  )
    throw new Error('Invalid job retention budget');
  const result = { completedDeleted: 0, failedDeleted: 0, batches: 0 };
  for (const [status, days] of [
    ['completed', 30],
    ['failed', 90],
  ] as const) {
    const cutoff = new Date(now.valueOf() - days * 86400000);
    for (let batch = 0; batch < maxBatches; batch++) {
      const deleted = await withTransaction(client, async (transaction) => {
        const rows = await transaction
          .select({ id: platformJobRuns.id })
          .from(platformJobRuns)
          .where(and(eq(platformJobRuns.status, status), lt(platformJobRuns.finishedAt, cutoff)))
          .orderBy(asc(platformJobRuns.finishedAt), asc(platformJobRuns.id))
          .limit(batchSize)
          .for('update', { skipLocked: true });
        if (!rows.length) return 0;
        const [changed] = await transaction.delete(platformJobRuns).where(
          inArray(
            platformJobRuns.id,
            rows.map((row) => row.id),
          ),
        );
        await new AuditWriter().append(transaction, {
          action: 'job_run_retention',
          operationId: randomUUID(),
          outcome: 'completed',
          targetType: 'platform_job_runs',
          metadata: {
            status,
            retentionDays: days,
            cutoff: cutoff.toISOString(),
            deletedRows: changed.affectedRows,
          },
        });
        return changed.affectedRows;
      });
      if (!deleted) break;
      result[status === 'completed' ? 'completedDeleted' : 'failedDeleted'] += deleted;
      result.batches++;
      if (deleted < batchSize) break;
    }
  }
  return result;
}
