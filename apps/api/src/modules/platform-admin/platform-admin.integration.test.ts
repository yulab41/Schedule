import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import {
  decryptBackupArchive,
  deriveBackupKey,
  restoreBackupArchive,
} from '../../jobs/backup-archive.js';
import { LocalBackupStorage } from '../../jobs/backup-storage.js';
import { DatabaseBackupJob } from '../../jobs/database-backup.js';
import { GroupRecycleJob } from '../../jobs/group-recycle.js';
import { recordJobRun } from '../../jobs/job-runs.js';
import { StatisticsRebuildJob } from '../../jobs/statistics-rebuild.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

const encryptionKey = deriveBackupKey('c'.repeat(64));

describeWithDatabase('platform administration and recovery', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;
  let temporaryDirectory: string | undefined;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'admin-token': 'cloudbase-admin',
        'developer-token': 'password_00000000-0000-4000-8000-000000000001',
        'member-token': 'cloudbase-member',
        'outsider-token': 'cloudbase-outsider',
      }),
      databaseClient: client,
      logger: false,
      platformAdminUids: new Set(['cloudbase-admin']),
    });
    await registerUser('admin-token', 'Platform Admin');
    await registerUser('member-token', 'Member Doctor');
    await registerUser('outsider-token', 'Outside Doctor');
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
    if (temporaryDirectory !== undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
      temporaryDirectory = undefined;
    }
  });

  it('reports platform administrator status without leaking other data', async () => {
    const admin = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'GET',
      url: '/platform/me',
    });
    expect(admin.statusCode).toBe(200);
    expect(admin.json()).toEqual({ isPlatformAdmin: true });

    const member = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: '/platform/me',
    });
    expect(member.statusCode).toBe(200);
    expect(member.json()).toEqual({ isPlatformAdmin: false });
  });

  it('grants the seeded developer administrator access to every group without listing it as a member', async () => {
    const groupId = await createGroup('member-token', 'Developer managed group', '8642');

    const platformMe = await app.inject({
      headers: { authorization: 'Bearer developer-token' },
      method: 'GET',
      url: '/platform/me',
    });
    const groups = await app.inject({
      headers: { authorization: 'Bearer developer-token' },
      method: 'GET',
      url: '/groups',
    });
    const members = await app.inject({
      headers: { authorization: 'Bearer developer-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    const deleted = await app.inject({
      headers: { authorization: 'Bearer developer-token' },
      method: 'DELETE',
      url: `/groups/${groupId}`,
    });

    expect(platformMe.json()).toEqual({ isPlatformAdmin: true });
    expect(groups.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: groupId, isDeveloperAdmin: true, role: 'administrator' }),
      ]),
    );
    expect(members.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ realName: '后台管理员' })]),
    );
    expect(deleted.statusCode).toBe(204);
  });

  it('restores a soft-deleted group inside the 30-day recycle window and audits it', async () => {
    const groupId = await createGroup('member-token', 'Recycle Group', '1234');
    const deleted = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'DELETE',
      url: `/groups/${groupId}`,
    });
    expect(deleted.statusCode).toBe(204);

    const memberRestore = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      url: `/platform/groups/${groupId}/restore`,
    });
    expect(memberRestore.statusCode).toBe(403);

    const restored = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      url: `/platform/groups/${groupId}/restore`,
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toEqual({ restored: true });

    const groups = (
      await app.inject({
        headers: { authorization: 'Bearer member-token' },
        method: 'GET',
        url: '/groups',
      })
    ).json() as readonly { id: string }[];
    expect(groups.some((group) => group.id === groupId)).toBe(true);

    const [auditRows] = (await client.database.execute(
      sql`SELECT action, target_id, outcome FROM audit_logs WHERE action = 'group_restore'`,
    )) as unknown as [{ action: string; outcome: string; target_id: string }[], unknown];
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: 'group_restore',
      outcome: 'completed',
      target_id: groupId,
    });
  });

  it('rejects restore for active groups and purges groups after the recycle window', async () => {
    const groupId = await createGroup('member-token', 'Expired Group', '4321');
    const activeRestore = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      url: `/platform/groups/${groupId}/restore`,
    });
    expect(activeRestore.statusCode).toBe(404);

    await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'DELETE',
      url: `/groups/${groupId}`,
    });
    await client.database.execute(
      sql`UPDATE \`groups\` SET deleted_at = ${new Date('2026-07-01T00:00:00.000Z')} WHERE id = ${groupId}`,
    );

    const recycle = new GroupRecycleJob(client);
    const result = await recycle.run(new Date('2026-08-02T00:00:00.000Z'));
    expect(result.purged).toBe(1);
    expect(result.scanned).toBeGreaterThan(result.purged);

    const [remainingGroups] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM \`groups\` WHERE id = ${groupId}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(remainingGroups[0]?.count).toBe(0);

    const recreated = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      payload: { groupCode: '4321', name: 'New Group' },
      url: '/groups',
    });
    expect(recreated.statusCode).toBe(201);
  });

  it('deregisters an account by detaching identity and contacts while keeping history', async () => {
    const groupId = await createGroup('member-token', 'Doctor Group', '5678');
    const members = (
      await app.inject({
        headers: { authorization: 'Bearer member-token' },
        method: 'GET',
        url: `/groups/${groupId}/members`,
      })
    ).json() as readonly { id: string; isCurrentUser: boolean }[];
    const membershipId = members.find((member) => member.isCurrentUser)?.id;
    expect(membershipId).toBeDefined();

    await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'PUT',
      payload: { confirm: true, mobilePhone: '13800138000' },
      url: `/groups/${groupId}/members/${membershipId}/contact`,
    });

    const deregistered = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      url: '/users/me/deregister',
    });
    expect(deregistered.statusCode).toBe(200);
    expect(deregistered.json()).toMatchObject({ status: 'deleted' });

    const [userRows] = (await client.database.execute(
      sql`SELECT u.cloudbase_uid, u.status, u.deleted_at
          FROM users u
          JOIN user_profiles p ON p.user_id = u.id
          WHERE p.real_name = 'Member Doctor'`,
    )) as unknown as [
      { cloudbase_uid: string | null; deleted_at: Date | null; status: string }[],
      unknown,
    ];
    expect(userRows[0]?.cloudbase_uid).toBeNull();
    expect(userRows[0]?.status).toBe('deleted');
    expect(userRows[0]?.deleted_at).not.toBeNull();

    const [contactRows] = (await client.database.execute(
      sql`SELECT c.mobile_phone, c.is_confirmed
          FROM group_member_contacts c
          JOIN group_memberships m ON m.id = c.membership_id
          WHERE m.group_id = ${groupId}`,
    )) as unknown as [{ is_confirmed: number; mobile_phone: string | null }[], unknown];
    expect(contactRows[0]?.mobile_phone).toBeNull();
    expect(contactRows[0]?.is_confirmed).toBe(0);

    const [profileRows] = (await client.database.execute(
      sql`SELECT real_name FROM user_profiles WHERE real_name = 'Member Doctor'`,
    )) as unknown as [{ real_name: string }[], unknown];
    expect(profileRows).toHaveLength(1);

    const [auditRows] = (await client.database.execute(
      sql`SELECT action FROM audit_logs WHERE action = 'user_deregister'`,
    )) as unknown as [{ action: string }[], unknown];
    expect(auditRows).toHaveLength(1);

    const reRegistered = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      payload: { realName: 'Member Doctor Again' },
      url: '/users',
    });
    expect(reRegistered.statusCode).toBe(201);
  });

  it('lets platform administrators suspend and reactivate accounts', async () => {
    const profile = (
      await app.inject({
        headers: { authorization: 'Bearer member-token' },
        method: 'GET',
        url: '/users/me',
      })
    ).json() as { id: string };

    const suspended = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'PUT',
      payload: { status: 'suspended' },
      url: `/platform/users/${profile.id}/status`,
    });
    expect(suspended.statusCode).toBe(200);
    expect(suspended.json()).toMatchObject({ id: profile.id, status: 'suspended' });

    const blockedRead = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: '/users/me',
    });
    expect(blockedRead.statusCode).toBe(403);

    const outsiderBan = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'PUT',
      payload: { status: 'suspended' },
      url: `/platform/users/${profile.id}/status`,
    });
    expect(outsiderBan.statusCode).toBe(403);

    const reactivated = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'PUT',
      payload: { status: 'active' },
      url: `/platform/users/${profile.id}/status`,
    });
    expect(reactivated.statusCode).toBe(200);

    const readAgain = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: '/users/me',
    });
    expect(readAgain.statusCode).toBe(200);

    const [auditRows] = (await client.database.execute(
      sql`SELECT action, metadata FROM audit_logs WHERE action = 'user_status_change' ORDER BY occurred_at`,
    )) as unknown as [{ action: string; metadata: string }[], unknown];
    expect(auditRows).toHaveLength(2);
  });

  it('records job runs and exposes them to platform administrators only', async () => {
    await recordJobRun(client, 'database-backup', async () => ({ archiveId: 'archive-1' }));
    await expect(
      recordJobRun(client, 'group-recycle', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const adminJobs = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'GET',
      url: '/platform/jobs',
    });
    expect(adminJobs.statusCode).toBe(200);
    const runs = (adminJobs.json() as { runs: readonly { jobName: string; status: string }[] })
      .runs;
    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.status).sort()).toEqual(['completed', 'failed']);

    const memberJobs = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'GET',
      url: '/platform/jobs',
    });
    expect(memberJobs.statusCode).toBe(403);

    const adminBackups = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'GET',
      url: '/platform/backups',
    });
    expect(adminBackups.statusCode).toBe(200);
    expect((adminBackups.json() as { archives: unknown[] }).archives).toEqual([]);
  });

  it('backs up, restores, and verifies an archive against the source data', async () => {
    const groupId = await createGroup('member-token', 'Backup Group', '2468');
    await client.database.execute(sql`
      INSERT INTO group_member_contacts (id, membership_id, mobile_phone, is_confirmed)
      SELECT ${randomUUID()}, m.id, '13900139000', 1
      FROM group_memberships m WHERE m.group_id = ${groupId}
    `);

    temporaryDirectory = await mkdtemp(join(tmpdir(), 'schedule-backup-'));
    const job = new DatabaseBackupJob(client, {
      encryptionKey,
      storage: new LocalBackupStorage(temporaryDirectory),
    });
    const result = await job.run(new Date('2026-08-02T04:00:00.000Z'));
    expect(result.backupKind).toBe('monthly');
    expect(result.tableCount).toBeGreaterThanOrEqual(36);
    expect(result.rowCount).toBeGreaterThanOrEqual(4);

    const [archiveRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM backup_archives WHERE id = ${result.archiveId}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(archiveRows[0]?.count).toBe(1);

    const content = await new LocalBackupStorage(temporaryDirectory).read(result.storageKey);
    expect(decryptBackupArchive(JSON.parse(content.toString('utf8')), encryptionKey)).toBeDefined();
    expect(() =>
      decryptBackupArchive(JSON.parse(content.toString('utf8')), deriveBackupKey('d'.repeat(64))),
    ).toThrow();

    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    const restore = await restoreBackupArchive(client, content, encryptionKey);
    expect(restore.mismatches).toEqual([]);
    expect(restore.tableCount).toBe(result.tableCount);
    expect(restore.rowCount).toBe(result.rowCount);

    const [restoredUsers] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM users`,
    )) as unknown as [{ count: number }[], unknown];
    expect(restoredUsers[0]?.count).toBe(3);
    const [restoredGroups] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM \`groups\` WHERE id = ${groupId}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(restoredGroups[0]?.count).toBe(1);
    const [restoredContacts] = (await client.database.execute(
      sql`SELECT mobile_phone FROM group_member_contacts WHERE mobile_phone = '13900139000'`,
    )) as unknown as [{ mobile_phone: string }[], unknown];
    expect(restoredContacts).toHaveLength(1);
  });

  it('rebuilds statistics snapshots from published periods', async () => {
    const groupId = await createGroup('member-token', 'Stats Group', '1357');
    const [memberRows] = (await client.database.execute(
      sql`SELECT id FROM group_memberships WHERE group_id = ${groupId} LIMIT 1`,
    )) as unknown as [{ id: string }[], unknown];
    const membershipId = memberRows[0]?.id;
    expect(membershipId).toBeDefined();

    const roleId = randomUUID();
    const periodId = randomUUID();
    const shiftTypeId = randomUUID();
    const assignmentId = randomUUID();
    await client.database.execute(sql`
      INSERT INTO schedule_roles (id, group_id, name)
      VALUES (${roleId}, ${groupId}, '一线')
    `);
    await client.database.execute(sql`
      INSERT INTO shift_types (
        id, group_id, name, abbreviation, color, text_color,
        display_order, start_time, end_time, crosses_midnight, is_all_day,
        counts_toward_statistics, is_enabled, version
      )
      VALUES (
        ${shiftTypeId}, ${groupId}, '全天班', '全', '#1F5AA6', '#FFFFFF', 1,
        '08:00:00', '08:00:00', 1, 1, 1, 1, 1
      )
    `);
    await client.database.execute(sql`
      INSERT INTO schedule_periods (
        id, group_id, schedule_role_id, business_month, revision, status,
        rules_version, published_at, version
      )
      VALUES (
        ${periodId}, ${groupId}, ${roleId}, '2026-08-01', 1, 'published',
        1, ${new Date('2026-08-01T00:00:00.000Z')}, 1
      )
    `);
    await client.database.execute(sql`
      INSERT INTO shift_assignments (
        id, schedule_period_id, business_date, slot_position, shift_type_id,
        shift_type_name, shift_type_abbreviation, shift_type_color,
        shift_type_text_color, shift_type_configuration_version,
        shift_start_time, shift_end_time, crosses_midnight, is_all_day,
        counts_toward_statistics, starts_at, ends_at,
        planned_membership_id, planned_member_name, version
      )
      VALUES (
        ${assignmentId}, ${periodId}, '2026-08-01', 1, ${shiftTypeId},
        '全天班', '全', '#1F5AA6', '#FFFFFF', 1,
        '08:00:00', '08:00:00', 1, 1, 1,
        ${new Date('2026-08-01T00:00:00.000Z')},
        ${new Date('2026-08-02T00:00:00.000Z')},
        ${membershipId}, 'Member Doctor', 1
      )
    `);

    const firstRun = await new StatisticsRebuildJob(client).run();
    expect(firstRun.months).toBe(1);
    expect(firstRun.completed).toBe(1);

    const [snapshots] = (await client.database.execute(
      sql`SELECT payload FROM statistics_snapshots
          WHERE group_id = ${groupId} AND business_month = '2026-08-01'`,
    )) as unknown as [{ payload: { plannedCount: number } }[], unknown];
    const payload = snapshots[0]?.payload ?? { plannedCount: 0 };
    expect(payload.plannedCount).toBe(1);

    await client.database.execute(
      sql`UPDATE statistics_snapshots
          SET payload = JSON_SET(payload, '$.plannedCount', 99)
          WHERE group_id = ${groupId} AND business_month = '2026-08-01'`,
    );
    const secondRun = await new StatisticsRebuildJob(client).run();
    expect(secondRun.completed).toBe(1);
    const [fixedSnapshots] = (await client.database.execute(
      sql`SELECT payload FROM statistics_snapshots
          WHERE group_id = ${groupId} AND business_month = '2026-08-01'`,
    )) as unknown as [{ payload: { plannedCount: number } }[], unknown];
    expect(fixedSnapshots[0]?.payload.plannedCount).toBe(1);
  });

  it('records failure context when a statistics rebuild month fails', async () => {
    const groupId = await createGroup('member-token', 'Stats Failure Group', '9753');
    const roleId = randomUUID();
    const periodId = randomUUID();
    await client.database.execute(sql`
      INSERT INTO schedule_roles (id, group_id, name)
      VALUES (${roleId}, ${groupId}, '一线')
    `);
    await client.database.execute(sql`
      INSERT INTO schedule_periods (
        id, group_id, schedule_role_id, business_month, revision, status,
        rules_version, published_at, version
      )
      VALUES (
        ${periodId}, ${groupId}, ${roleId}, '2026-08-01', 1, 'published',
        1, ${new Date('2026-08-01T00:00:00.000Z')}, 1
      )
    `);

    const failingRefresher = {
      refreshInTransaction: async (): Promise<void> => {
        throw new Error('stats rebuild boom');
      },
    };
    const job = new StatisticsRebuildJob(client, { statisticsRefresher: failingRefresher });
    const { result, runId } = await recordJobRun(client, 'statistics-rebuild', () => job.run());
    expect(result).toEqual({
      completed: 0,
      failed: 1,
      failures: [{ businessMonth: '2026-08-01', error: 'stats rebuild boom', groupId }],
      months: 1,
    });

    const [runRows] = (await client.database.execute(
      sql`SELECT summary FROM platform_job_runs WHERE id = ${runId}`,
    )) as unknown as [{ summary: string | null }[], unknown];
    expect(runRows[0]?.summary).toContain('2026-08-01');
    expect(runRows[0]?.summary).toContain('stats rebuild boom');
  });

  async function registerUser(token: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });
    expect(response.statusCode).toBe(201);
  }

  async function createGroup(token: string, name: string, groupCode: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }
});

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    authenticate: async ({ authorization }) => {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      const cloudbaseUid = token === undefined ? undefined : tokens[token];
      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
    },
  };
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') {
    return undefined;
  }

  const {
    TEST_MYSQL_DATABASE,
    TEST_MYSQL_HOST,
    TEST_MYSQL_PASSWORD,
    TEST_MYSQL_PORT,
    TEST_MYSQL_USER,
  } = process.env;
  const port = Number(TEST_MYSQL_PORT ?? '3307');

  if (
    TEST_MYSQL_DATABASE === undefined ||
    TEST_MYSQL_PASSWORD === undefined ||
    TEST_MYSQL_USER === undefined ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    return undefined;
  }

  return {
    database: TEST_MYSQL_DATABASE,
    host: TEST_MYSQL_HOST ?? '127.0.0.1',
    password: TEST_MYSQL_PASSWORD,
    port,
    user: TEST_MYSQL_USER,
  };
}

async function resetDatabase(client: DatabaseClient): Promise<void> {
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_search_aliases`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_contact_methods`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_source_documents`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_import_batches`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_campuses`);
  await client.database.execute(sql`DROP TABLE IF EXISTS invite_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_logs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS backup_archives`);
  await client.database.execute(sql`DROP TABLE IF EXISTS platform_job_runs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_cells`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_template_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_templates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS duty_adjustments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS workflow_sequence_allocations`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_deliveries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notifications`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_preferences`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_settings`);
  await client.database.execute(sql`DROP TABLE IF EXISTS web_push_subscriptions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_batches`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_dates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_calendar_versions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_recalc_checks`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_snapshots`);
  await client.database.execute(sql`DROP TABLE IF EXISTS export_jobs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_assignments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_periods`);
  await client.database.execute(sql`DROP TABLE IF EXISTS audit_logs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_events`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_rules`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_types`);
  await client.database.execute(sql`DROP TABLE IF EXISTS member_schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_join_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS guest_schedule_access_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS membership_claim_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_code_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_member_contacts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS leave_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS swap_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
