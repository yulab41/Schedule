import { createHash, randomUUID } from 'node:crypto';
import {
  auditLogs,
  groups,
  scheduleEvents,
  withTransaction,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, asc, eq, isNotNull, lt, notInArray, or } from 'drizzle-orm';

export const miniTimelineHiddenAction = 'miniprogram_event_hidden';

export function visibleMiniTimelineEvents(transaction: DatabaseTransaction, groupId?: string) {
  return notInArray(
    scheduleEvents.id,
    transaction
      .select({ id: auditLogs.targetId })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, miniTimelineHiddenAction),
          eq(auditLogs.targetType, 'schedule_event'),
          isNotNull(auditLogs.targetId),
          groupId === undefined ? undefined : eq(auditLogs.groupId, groupId),
        ),
      ),
  );
}

interface CleanupInput {
  readonly before: Date;
  readonly groupId?: string;
  readonly includeExistingBackfills?: boolean;
}

// This is an explicit operator job, never a scheduled retention rule. Each existing event
// receives an audit marker; event contents, statistics and subsequent inserts are untouched.
export class MiniTimelineCleanup {
  public constructor(private readonly client: DatabaseClient) {}

  public async preview(input: CleanupInput) {
    return withTransaction(this.client, async (transaction) =>
      summarize(input, await this.select(transaction, input)),
    );
  }

  public async apply(
    input: CleanupInput & { readonly expectedFingerprint: string; readonly operationId: string },
  ) {
    return withTransaction(this.client, async (transaction) => {
      // Serialize cleanup jobs for the selected groups without altering a business record.
      await transaction
        .select({ id: groups.id })
        .from(groups)
        .where(input.groupId === undefined ? undefined : eq(groups.id, input.groupId))
        .orderBy(asc(groups.id))
        .for('update');
      const rows = await this.select(transaction, input);
      const summary = summarize(input, rows);
      if (summary.fingerprint !== input.expectedFingerprint)
        throw new Error('Cleanup preview changed; preview again before applying.');
      for (let offset = 0; offset < rows.length; offset += 500) {
        await transaction.insert(auditLogs).values(
          rows.slice(offset, offset + 500).map((row) => ({
            id: randomUUID(),
            action: miniTimelineHiddenAction,
            groupId: row.groupId,
            metadata: {
              before: input.before.toISOString(),
              includeExistingBackfills: input.includeExistingBackfills === true,
              previewFingerprint: summary.fingerprint,
            },
            operationId: input.operationId,
            outcome: 'success',
            targetId: row.id,
            targetType: 'schedule_event',
          })),
        );
      }
      return { ...summary, operationId: input.operationId };
    });
  }

  private async select(transaction: DatabaseTransaction, input: CleanupInput) {
    if (!Number.isFinite(input.before.valueOf()))
      throw new Error('Cleanup cutoff must be a valid timestamp.');
    return transaction
      .select({ id: scheduleEvents.id, groupId: scheduleEvents.groupId })
      .from(scheduleEvents)
      .where(
        and(
          input.groupId === undefined ? undefined : eq(scheduleEvents.groupId, input.groupId),
          or(
            lt(scheduleEvents.occurredAt, input.before),
            input.includeExistingBackfills === true
              ? eq(scheduleEvents.eventType, 'schedule_backfill_completed')
              : undefined,
          ),
          visibleMiniTimelineEvents(transaction, input.groupId),
        ),
      )
      .orderBy(asc(scheduleEvents.id));
  }
}

function summarize(
  input: CleanupInput,
  rows: readonly { readonly id: string; readonly groupId: string }[],
) {
  return {
    before: input.before.toISOString(),
    includeExistingBackfills: input.includeExistingBackfills === true,
    count: rows.length,
    groupCount: new Set(rows.map((row) => row.groupId)).size,
    fingerprint: createHash('sha256')
      .update(
        JSON.stringify({
          before: input.before.toISOString(),
          includeExistingBackfills: input.includeExistingBackfills === true,
          scope: input.groupId ?? 'all-groups',
          rows,
        }),
      )
      .digest('hex'),
  };
}
