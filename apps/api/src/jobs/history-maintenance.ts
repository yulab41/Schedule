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
import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';

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
    return withTransaction(this.client, async (transaction) => {
      // Serialize with existing workflow and publication writes; no lock survives this short job.
      const scope = await transaction
        .select({ id: groups.id })
        .from(groups)
        .where(isNull(groups.deletedAt))
        .orderBy(asc(groups.id))
        .for('update');
      const result = {
        monthStart,
        archivedPeriods: 0,
        workflowVisibilityChanges: 0,
        notificationVisibilityChanges: 0,
      };
      for (const group of scope) {
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
          result.workflowVisibilityChanges += (
            changed as unknown as { affectedRows: number }
          ).affectedRows;
        }
        const [archived] = await transaction.execute(sql`UPDATE schedule_periods
          SET status = 'past', version = version + 1
          WHERE group_id = ${group.id} AND deleted_at IS NULL
            AND status = 'published' AND business_month < ${monthStart}`);
        result.archivedPeriods += (archived as unknown as { affectedRows: number }).affectedRows;
      }
      // Notification creation time is immutable; expiry changes display state, never read/delivery history.
      const [hidden] = await transaction.execute(sql`UPDATE ${notifications}
        SET ${notifications.listHiddenAt} = ${now}, ${notifications.updatedAt} = ${notifications.updatedAt}
        WHERE ${notifications.listHiddenAt} IS NULL AND ${notifications.createdAt} < ${notificationCutoff}`);
      result.notificationVisibilityChanges = (
        hidden as unknown as { affectedRows: number }
      ).affectedRows;
      return result;
    });
  }
}
