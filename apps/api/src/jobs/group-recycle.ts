import type { DatabaseClient } from '@schedule/database';
import { withTransaction } from '@schedule/database';
import { sql, type SQL } from 'drizzle-orm';

const recycleWindowDays = 30;

export interface GroupRecycleRunResult {
  readonly purged: number;
  readonly scanned: number;
}

const deleteQueries: readonly ((groupId: string) => SQL)[] = [
  (groupId) => sql`DELETE FROM export_jobs WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM statistics_recalc_checks WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM statistics_snapshots WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM notification_deliveries
                   WHERE notification_id IN (SELECT id FROM notifications WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM notifications WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM notification_settings WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM shift_assignments
                   WHERE schedule_period_id IN (SELECT id FROM schedule_periods WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM schedule_periods WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM manual_schedule_cells
                   WHERE template_id IN (SELECT id FROM manual_schedule_templates WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM manual_schedule_template_members
                   WHERE template_id IN (SELECT id FROM manual_schedule_templates WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM manual_schedule_templates WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM duty_adjustments WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM swap_requests WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM leave_requests WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM schedule_events WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM audit_logs WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM rotation_members
                   WHERE rotation_rule_id IN (
                     SELECT id FROM rotation_rules
                     WHERE schedule_role_id IN (SELECT id FROM schedule_roles WHERE group_id = ${groupId})
                   )`,
  (groupId) => sql`DELETE FROM rotation_rules
                   WHERE schedule_role_id IN (SELECT id FROM schedule_roles WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM member_schedule_roles
                   WHERE schedule_role_id IN (SELECT id FROM schedule_roles WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM shift_types WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM schedule_roles WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM group_member_contacts
                   WHERE membership_id IN (SELECT id FROM group_memberships WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM notification_preferences
                   WHERE membership_id IN (SELECT id FROM group_memberships WHERE group_id = ${groupId})`,
  (groupId) => sql`DELETE FROM group_memberships WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM group_join_requests WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM roster_entries WHERE group_id = ${groupId}`,
  (groupId) => sql`DELETE FROM \`groups\` WHERE id = ${groupId}`,
];

export class GroupRecycleJob {
  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async run(now = new Date()): Promise<GroupRecycleRunResult> {
    const cutoff = new Date(now.valueOf() - recycleWindowDays * 24 * 60 * 60 * 1000);

    return withTransaction(this.databaseClient, async (transaction) => {
      const [rows] = (await transaction.execute(
        sql`SELECT id FROM \`groups\`
            WHERE deleted_at IS NOT NULL AND deleted_at <= ${cutoff}
            ORDER BY deleted_at`,
      )) as unknown as [{ id: string }[], unknown];

      for (const row of rows) {
        for (const buildQuery of deleteQueries) {
          await transaction.execute(buildQuery(row.id));
        }
      }

      return { purged: rows.length, scanned: rows.length };
    });
  }
}
