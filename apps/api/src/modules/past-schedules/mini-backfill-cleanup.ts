import { createHash, randomUUID } from 'node:crypto';
import {
  auditLogs,
  groups,
  schedulePeriods,
  shiftAssignments,
  withTransaction,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

export const miniBackfillHiddenAction = 'miniprogram_backfill_record_hidden';

// Match the recorded update, not the assignment forever. A subsequent backfill is visible.
export function visibleMiniBackfillRecords() {
  return sql`NOT EXISTS (SELECT 1 FROM ${auditLogs}
    WHERE ${auditLogs.action} = ${miniBackfillHiddenAction}
      AND ${auditLogs.targetType} = 'shift_assignment'
      AND ${auditLogs.targetId} = ${shiftAssignments.id}
      AND ${auditLogs.groupId} = ${schedulePeriods.groupId}
      AND JSON_EXTRACT(${auditLogs.metadata}, '$.backfillAtMillis') = UNIX_TIMESTAMP(${shiftAssignments.backfillAt}) * 1000)`;
}

// Explicit one-time operator job. Only audit markers are inserted; schedules and events stay intact.
export class MiniBackfillCleanup {
  public constructor(private readonly client: DatabaseClient) {}

  public async preview(groupId?: string) {
    return withTransaction(this.client, async (transaction) =>
      summarize(groupId, await this.select(transaction, groupId)),
    );
  }

  public async apply(input: {
    readonly groupId?: string;
    readonly expectedFingerprint: string;
    readonly operationId: string;
  }) {
    return withTransaction(this.client, async (transaction) => {
      await transaction
        .select({ id: groups.id })
        .from(groups)
        .where(input.groupId === undefined ? undefined : eq(groups.id, input.groupId))
        .orderBy(asc(groups.id))
        .for('update');
      const rows = await this.select(transaction, input.groupId);
      const summary = summarize(input.groupId, rows);
      if (summary.fingerprint !== input.expectedFingerprint)
        throw new Error('Cleanup preview changed; preview again before applying.');
      for (let offset = 0; offset < rows.length; offset += 500) {
        await transaction.insert(auditLogs).values(
          rows.slice(offset, offset + 500).map((row) => ({
            id: randomUUID(),
            groupId: row.groupId,
            action: miniBackfillHiddenAction,
            operationId: input.operationId,
            outcome: 'success',
            targetType: 'shift_assignment',
            targetId: row.id,
            metadata: {
              backfillAtMillis: row.backfillAt!.valueOf(),
              previewFingerprint: summary.fingerprint,
            },
          })),
        );
      }
      return { ...summary, operationId: input.operationId };
    });
  }

  private async select(transaction: DatabaseTransaction, groupId?: string) {
    return transaction
      .select({
        id: shiftAssignments.id,
        groupId: schedulePeriods.groupId,
        backfillAt: shiftAssignments.backfillAt,
      })
      .from(shiftAssignments)
      .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
      .where(
        and(
          groupId === undefined ? undefined : eq(schedulePeriods.groupId, groupId),
          isNull(schedulePeriods.deletedAt),
          isNull(shiftAssignments.deletedAt),
          isNotNull(shiftAssignments.backfillAt),
          visibleMiniBackfillRecords(),
        ),
      )
      .orderBy(asc(shiftAssignments.id));
  }
}

function summarize(
  groupId: string | undefined,
  rows: readonly { id: string; groupId: string; backfillAt: Date | null }[],
) {
  return {
    count: rows.length,
    groupCount: new Set(rows.map((row) => row.groupId)).size,
    fingerprint: createHash('sha256')
      .update(JSON.stringify({ scope: groupId ?? 'all-groups', rows }))
      .digest('hex'),
  };
}
