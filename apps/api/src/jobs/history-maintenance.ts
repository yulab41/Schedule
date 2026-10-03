import {
  type DatabaseClient,
  dutyAdjustments,
  groups,
  leaveRequests,
  notifications,
  platformJobRuns,
  swapRequests,
  withTransaction,
} from '@schedule/database';
import { getChinaStandardTimeCalendarDate } from '@schedule/scheduling-domain';
import { and, asc, eq, gt, gte, inArray, isNull, lt, sql } from 'drizzle-orm';

import { expiredWorkflowListCondition } from '../modules/workflows/workflow-list-visibility.js';
import { recordJobRun } from './job-runs.js';

const jobName = 'history-maintenance';

// The existing host retention scheduler owns flock. Its 15-minute checks only run this
// database maintenance once per China calendar day, from 03:00, and retry failed days.
export class HistoryMaintenanceJob {
  public constructor(private readonly client: DatabaseClient) {}

  public async runIfDue(now = new Date()) {
    const today = getChinaStandardTimeCalendarDate(now);
    const windowStart = new Date(`${today}T03:00:00+08:00`);
    if (now < windowStart) return { skipped: 'before-window' };
    const [completed] = await this.client.database
      .select({ id: platformJobRuns.id })
      .from(platformJobRuns)
      .where(
        and(
          eq(platformJobRuns.jobName, jobName),
          eq(platformJobRuns.status, 'completed'),
          gte(platformJobRuns.startedAt, windowStart),
        ),
      )
      .limit(1);
    if (completed) return { skipped: 'already-completed' };
    return (await recordJobRun(this.client, jobName, () => this.run(now), now)).result;
  }

  public async run(now = new Date()) {
    const monthStart = `${getChinaStandardTimeCalendarDate(now).slice(0, 7)}-01`;
    const notificationCutoff = new Date(
      `${getChinaStandardTimeCalendarDate(new Date(now.valueOf() - 30 * 86_400_000))}T00:00:00+08:00`,
    );
    const result = {
      monthStart,
      archivedPeriods: 0,
      workflowVisibilityChanges: 0,
      notificationVisibilityChanges: 0,
    };
    let after: string | undefined;
    for (;;) {
      const scope = await this.client.database
        .select({ id: groups.id })
        .from(groups)
        .where(
          and(isNull(groups.deletedAt), after === undefined ? undefined : gt(groups.id, after)),
        )
        .orderBy(asc(groups.id))
        .limit(100);
      if (!scope.length) break;
      for (const group of scope) {
        const changedGroup = await withTransaction(this.client, async (transaction) => {
          const [active] = await transaction
            .select({ id: groups.id })
            .from(groups)
            .where(and(eq(groups.id, group.id), isNull(groups.deletedAt)))
            .limit(1)
            .for('update');
          const changes = { archivedPeriods: 0, workflowVisibilityChanges: 0 };
          if (!active) return changes;
          for (const [kind, table] of [
            ['swap', swapRequests],
            ['duty', dutyAdjustments],
            ['leave', leaveRequests],
          ] as const) {
            const expired = expiredWorkflowListCondition(kind, now);
            const [changed] = await transaction.execute(sql`UPDATE ${table}
            SET ${table.listHiddenAt} = CASE WHEN ${expired} THEN ${now} ELSE NULL END,
                ${table.updatedAt} = ${table.updatedAt}
            WHERE ${table.groupId} = ${group.id} AND ${table.deletedAt} IS NULL
              AND ((${table.listHiddenAt} IS NULL AND ${expired})
                OR (${table.listHiddenAt} IS NOT NULL AND NOT (${expired})))`);
            changes.workflowVisibilityChanges += (
              changed as unknown as { affectedRows: number }
            ).affectedRows;
          }
          const [archived] = await transaction.execute(sql`UPDATE schedule_periods
          SET status = 'past', version = version + 1
          WHERE group_id = ${group.id} AND deleted_at IS NULL
            AND status = 'published' AND business_month < ${monthStart}`);
          changes.archivedPeriods += (archived as unknown as { affectedRows: number }).affectedRows;
          return changes;
        });
        result.archivedPeriods += changedGroup.archivedPeriods;
        result.workflowVisibilityChanges += changedGroup.workflowVisibilityChanges;
      }
      after = scope.at(-1)!.id;
    }
    // Notification creation time is immutable; expiry changes display state, never read/delivery history.
    for (;;) {
      const changed = await withTransaction(this.client, async (transaction) => {
        const rows = await transaction
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              isNull(notifications.listHiddenAt),
              lt(notifications.createdAt, notificationCutoff),
            ),
          )
          .orderBy(asc(notifications.createdAt), asc(notifications.id))
          .limit(500)
          .for('update');
        if (!rows.length) return 0;
        const [hidden] = await transaction
          .update(notifications)
          .set({ listHiddenAt: now, updatedAt: sql`${notifications.updatedAt}` })
          .where(
            inArray(
              notifications.id,
              rows.map((row) => row.id),
            ),
          );
        return hidden.affectedRows;
      });
      result.notificationVisibilityChanges += changed;
      if (changed < 500) break;
    }
    return result;
  }
}
