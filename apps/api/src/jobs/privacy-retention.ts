import { randomUUID } from 'node:crypto';

import {
  type DatabaseClient,
  type DatabaseTransaction,
  visitorAccessLogs,
  visitorAccessMonthlyAggregates,
  withTransaction,
} from '@schedule/database';
import { asc, count, inArray, lt, sql } from 'drizzle-orm';

import { AuditWriter } from '../modules/audit/audit-writer.js';

const dayMilliseconds = 24 * 60 * 60 * 1000;
const chinaOffsetMilliseconds = 8 * 60 * 60 * 1000;
const defaultBatchSize = 1000;
const defaultMaxBatches = 100;

export const visitorAccessRetentionDays = 90;

interface AuditAppender {
  append(
    transaction: DatabaseTransaction,
    input: Parameters<AuditWriter['append']>[1],
  ): Promise<string>;
}

interface PrivacyRetentionOptions {
  readonly auditWriter?: AuditAppender;
  readonly batchSize?: number;
  readonly maxBatches?: number;
}

interface ExpiredVisitorAccessRow {
  readonly businessMonth: string;
  readonly createdAt: Date;
  readonly groupId: string;
  readonly id: string;
}

interface AggregateBucket {
  readonly accessMonth: string;
  readonly businessMonth: string;
  readonly count: number;
  readonly groupId: string;
}

export interface PrivacyRetentionRunResult {
  readonly aggregateBuckets: number;
  readonly batches: number;
  readonly cutoff: string;
  readonly deletedRows: number;
  readonly remainingRows: number;
}

export class PrivacyRetentionJob {
  private readonly auditWriter: AuditAppender;
  private readonly batchSize: number;
  private readonly maxBatches: number;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    options: PrivacyRetentionOptions = {},
  ) {
    this.auditWriter = options.auditWriter ?? new AuditWriter();
    this.batchSize = readPositiveInteger(options.batchSize, defaultBatchSize, 'batchSize');
    this.maxBatches = readPositiveInteger(options.maxBatches, defaultMaxBatches, 'maxBatches');
  }

  public async run(now = new Date()): Promise<PrivacyRetentionRunResult> {
    const cutoff = createVisitorAccessCutoff(now);
    let aggregateBuckets = 0;
    let batches = 0;
    let deletedRows = 0;

    while (batches < this.maxBatches) {
      const batch = await withTransaction(this.databaseClient, (transaction) =>
        this.processBatch(transaction, cutoff),
      );
      if (batch.deletedRows === 0) break;
      aggregateBuckets += batch.aggregateBuckets;
      batches += 1;
      deletedRows += batch.deletedRows;
    }

    const remainingRows = await this.countRemaining(cutoff);
    const result = {
      aggregateBuckets,
      batches,
      cutoff: cutoff.toISOString(),
      deletedRows,
      remainingRows,
    };
    if (remainingRows > 0) {
      throw new Error(`visitor access retention backlog remains: ${remainingRows}`);
    }
    return result;
  }

  private async processBatch(
    transaction: DatabaseTransaction,
    cutoff: Date,
  ): Promise<{ readonly aggregateBuckets: number; readonly deletedRows: number }> {
    const rows = await transaction
      .select({
        businessMonth: visitorAccessLogs.businessMonth,
        createdAt: visitorAccessLogs.createdAt,
        groupId: visitorAccessLogs.groupId,
        id: visitorAccessLogs.id,
      })
      .from(visitorAccessLogs)
      .where(lt(visitorAccessLogs.createdAt, cutoff))
      .orderBy(asc(visitorAccessLogs.createdAt), asc(visitorAccessLogs.id))
      .limit(this.batchSize)
      .for('update', { skipLocked: true });
    if (rows.length === 0) return { aggregateBuckets: 0, deletedRows: 0 };

    const buckets = createAggregateBuckets(rows);
    for (const bucket of buckets) {
      const increment = BigInt(bucket.count);
      await transaction
        .insert(visitorAccessMonthlyAggregates)
        .values({
          accessCount: increment,
          accessMonth: bucket.accessMonth,
          businessMonth: bucket.businessMonth,
          groupId: bucket.groupId,
        })
        .onDuplicateKeyUpdate({
          set: {
            accessCount: sql`${visitorAccessMonthlyAggregates.accessCount} + ${increment}`,
          },
        });
    }

    await transaction.delete(visitorAccessLogs).where(
      inArray(
        visitorAccessLogs.id,
        rows.map((row) => row.id),
      ),
    );

    const operationId = randomUUID();
    for (const group of summarizeGroups(rows, buckets)) {
      await this.auditWriter.append(transaction, {
        action: 'visitor_access_retention',
        groupId: group.groupId,
        metadata: {
          aggregateBucketCount: group.aggregateBucketCount,
          cutoff: cutoff.toISOString(),
          deletedCount: group.deletedCount,
          retentionDays: visitorAccessRetentionDays,
        },
        operationId,
        outcome: 'completed',
        targetType: 'visitor_access_logs',
      });
    }

    return { aggregateBuckets: buckets.length, deletedRows: rows.length };
  }

  private async countRemaining(cutoff: Date): Promise<number> {
    const [row] = await this.databaseClient.database
      .select({ value: count() })
      .from(visitorAccessLogs)
      .where(lt(visitorAccessLogs.createdAt, cutoff));
    return row?.value ?? 0;
  }
}

export function createVisitorAccessCutoff(now: Date): Date {
  return new Date(now.valueOf() - visitorAccessRetentionDays * dayMilliseconds);
}

export function toChinaAccessMonth(createdAt: Date): string {
  return new Date(createdAt.valueOf() + chinaOffsetMilliseconds).toISOString().slice(0, 7);
}

function createAggregateBuckets(
  rows: readonly ExpiredVisitorAccessRow[],
): readonly AggregateBucket[] {
  const buckets = new Map<string, AggregateBucket>();
  for (const row of rows) {
    const accessMonth = toChinaAccessMonth(row.createdAt);
    const key = `${row.groupId}\u0000${accessMonth}\u0000${row.businessMonth}`;
    const current = buckets.get(key);
    buckets.set(key, {
      accessMonth,
      businessMonth: row.businessMonth,
      count: (current?.count ?? 0) + 1,
      groupId: row.groupId,
    });
  }
  return [...buckets.values()];
}

function summarizeGroups(
  rows: readonly ExpiredVisitorAccessRow[],
  buckets: readonly AggregateBucket[],
): readonly {
  readonly aggregateBucketCount: number;
  readonly deletedCount: number;
  readonly groupId: string;
}[] {
  const summaries = new Map<
    string,
    { aggregateBucketCount: number; deletedCount: number; groupId: string }
  >();
  for (const row of rows) {
    const current = summaries.get(row.groupId);
    summaries.set(row.groupId, {
      aggregateBucketCount: current?.aggregateBucketCount ?? 0,
      deletedCount: (current?.deletedCount ?? 0) + 1,
      groupId: row.groupId,
    });
  }
  for (const bucket of buckets) {
    const current = summaries.get(bucket.groupId);
    if (current !== undefined) current.aggregateBucketCount += 1;
  }
  return [...summaries.values()];
}

function readPositiveInteger(value: number | undefined, fallback: number, field: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return resolved;
}
