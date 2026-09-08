import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDatabaseClient,
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
    client = createDatabaseClient({
      ...(databaseOptions as DatabaseConnectionOptions),
      connectionLimit: 4,
    });
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
      wechatSessionSecret: 'account-test-operation-secret-32-characters',
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

  it('restricts diagnostics access to the active designated admin account', async () => {
    for (const [token, allowed] of [
      ['developer-token', true],
      ['admin-token', false],
      ['member-token', false],
      ['outsider-token', false],
    ] as const) {
      const response = await app.inject({
        method: 'GET',
        url: '/me/diagnostics-access',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ allowed });
    }
    expect((await app.inject({ method: 'GET', url: '/me/diagnostics-access' })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/me/diagnostics-access',
          headers: { authorization: 'Bearer developer-token' },
        })
      ).statusCode,
    ).toBe(404);
    await client.database.execute(
      sql`UPDATE users SET status = 'suspended' WHERE id = '00000000-0000-4000-8000-000000000001'`,
    );
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/me/diagnostics-access',
          headers: { authorization: 'Bearer developer-token' },
        })
      ).json(),
    ).toEqual({ allowed: false });
    await client.database.execute(
      sql`UPDATE users SET status = 'active', deleted_at = NOW() WHERE id = '00000000-0000-4000-8000-000000000001'`,
    );
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/me/diagnostics-access',
          headers: { authorization: 'Bearer developer-token' },
        })
      ).json(),
    ).toEqual({ allowed: false });
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
      headers: {
        authorization: 'Bearer developer-token',
        'idempotency-key': randomUUID(),
      },
      method: 'DELETE',
      payload: { expectedVersion: 1 },
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
      headers: {
        authorization: 'Bearer member-token',
        'idempotency-key': randomUUID(),
      },
      method: 'DELETE',
      payload: { expectedVersion: 1 },
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
      headers: {
        authorization: 'Bearer member-token',
        'idempotency-key': randomUUID(),
      },
      method: 'DELETE',
      payload: { expectedVersion: 1 },
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
      headers: {
        authorization: 'Bearer member-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { groupCode: '4321', name: 'New Group' },
      url: '/groups',
    });
    expect(recreated.statusCode).toBe(201);
  });

  it('does not expose account deregistration and preserves identity, contacts, and history', async () => {
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

    const contact = await app.inject({
      headers: {
        authorization: 'Bearer member-token',
        'idempotency-key': randomUUID(),
      },
      method: 'PUT',
      payload: { expectedVersion: 0, isConfirmed: true, mobilePhone: '13800138000' },
      url: `/groups/${groupId}/members/${membershipId}/contact`,
    });
    expect(contact.statusCode).toBe(200);

    const deregistered = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      url: '/users/me/deregister',
    });
    expect(deregistered.statusCode).toBe(404);

    const [userRows] = (await client.database.execute(
      sql`SELECT u.cloudbase_uid, u.status, u.deleted_at
          FROM users u
          JOIN user_profiles p ON p.user_id = u.id
          WHERE p.real_name = 'Member Doctor'`,
    )) as unknown as [
      { cloudbase_uid: string | null; deleted_at: Date | null; status: string }[],
      unknown,
    ];
    expect(userRows[0]?.cloudbase_uid).toBe('cloudbase-member');
    expect(userRows[0]?.status).toBe('active');
    expect(userRows[0]?.deleted_at).toBeNull();

    const [contactRows] = (await client.database.execute(
      sql`SELECT c.mobile_phone, c.is_confirmed
          FROM group_member_contacts c
          JOIN group_memberships m ON m.id = c.membership_id
          WHERE m.group_id = ${groupId}`,
    )) as unknown as [{ is_confirmed: number; mobile_phone: string | null }[], unknown];
    expect(contactRows[0]?.mobile_phone).toBe('13800138000');
    expect(contactRows[0]?.is_confirmed).toBe(1);

    const [profileRows] = (await client.database.execute(
      sql`SELECT real_name FROM user_profiles WHERE real_name = 'Member Doctor'`,
    )) as unknown as [{ real_name: string }[], unknown];
    expect(profileRows).toHaveLength(1);

    const [auditRows] = (await client.database.execute(
      sql`SELECT action FROM audit_logs WHERE action = 'user_deregister'`,
    )) as unknown as [{ action: string }[], unknown];
    expect(auditRows).toHaveLength(0);

    const reRegistered = await app.inject({
      headers: { authorization: 'Bearer member-token' },
      method: 'POST',
      payload: { realName: 'Member Doctor Again' },
      url: '/users',
    });
    expect(reRegistered.statusCode).toBe(409);
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
      LIMIT 1
    `);
    await client.database.execute(sql`
      INSERT INTO visitor_access_logs
        (id, group_id, business_month, client_ip, request_id)
      VALUES (${randomUUID()}, ${groupId}, '2026-08', '203.0.113.55', ${randomUUID()})
    `);
    await client.database.execute(sql`
      INSERT INTO miniprogram_telemetry_events
        (id, client_version, page, device_tier, error_code, network_type)
      VALUES (
        ${randomUUID()}, '0.1.0-p6.20260824.80', 'app', 'unknown',
        'UNKNOWN', 'unknown'
      )
    `);

    temporaryDirectory = await mkdtemp(join(tmpdir(), 'schedule-backup-'));
    const job = new DatabaseBackupJob(client, {
      encryptionKey,
      storage: new LocalBackupStorage(temporaryDirectory),
    });
    const result = await job.run(new Date('2026-08-02T04:00:00.000Z'));
    expect(result.backupKind).toBe('monthly');
    expect(result.tableCount).toBe(53);
    expect(result.rowCount).toBeGreaterThanOrEqual(4);

    const [archiveRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM backup_archives WHERE id = ${result.archiveId}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(archiveRows[0]?.count).toBe(1);

    const content = await new LocalBackupStorage(temporaryDirectory).read(result.storageKey);
    const decrypted = decryptBackupArchive(JSON.parse(content.toString('utf8')), encryptionKey);
    expect(decrypted.tables).not.toHaveProperty('visitor_access_logs');
    expect(decrypted.tables).not.toHaveProperty('miniprogram_telemetry_events');
    expect(decrypted.tables).toHaveProperty('user_profile_avatars');
    const [aggregateTables] = (await client.database.execute(sql`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'visitor_access_monthly_aggregates'
    `)) as unknown as [readonly { count: number }[], unknown];
    if ((aggregateTables[0]?.count ?? 0) === 1) {
      expect(decrypted.tables).toHaveProperty(
        'visitor_access_monthly_aggregates',
        expect.any(Object),
      );
    } else {
      expect(decrypted.tables).not.toHaveProperty('visitor_access_monthly_aggregates');
    }
    expect(() =>
      decryptBackupArchive(JSON.parse(content.toString('utf8')), deriveBackupKey('d'.repeat(64))),
    ).toThrow();

    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    await client.database.execute(sql`DELETE FROM user_password_credentials`);
    await client.database.execute(sql`DELETE FROM user_profiles`);
    await client.database.execute(sql`DELETE FROM users`);
    await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    const restore = await restoreBackupArchive(client, content, encryptionKey);
    expect(restore.mismatches).toEqual([]);
    expect(restore.tableCount).toBe(result.tableCount);
    expect(restore.rowCount).toBe(result.rowCount);

    const [restoredUsers] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM users`,
    )) as unknown as [{ count: number }[], unknown];
    expect(restoredUsers[0]?.count).toBe(4);
    const [restoredGroups] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM \`groups\` WHERE id = ${groupId}`,
    )) as unknown as [{ count: number }[], unknown];
    expect(restoredGroups[0]?.count).toBe(1);
    const [restoredContacts] = (await client.database.execute(
      sql`SELECT mobile_phone FROM group_member_contacts WHERE mobile_phone = '13900139000'`,
    )) as unknown as [{ mobile_phone: string }[], unknown];
    expect(restoredContacts).toHaveLength(1);
    const [restoredRawVisitorRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM visitor_access_logs`,
    )) as unknown as [{ count: number }[], unknown];
    expect(restoredRawVisitorRows[0]?.count).toBe(0);
    const [restoredTelemetryRows] = (await client.database.execute(
      sql`SELECT COUNT(*) AS count FROM miniprogram_telemetry_events`,
    )) as unknown as [{ count: number }[], unknown];
    expect(restoredTelemetryRows[0]?.count).toBe(0);
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

  it('maintains account profile and one phone across groups with version checks', async () => {
    await createGroup('member-token', 'Account group one', '7812');
    await createGroup('member-token', 'Account group two', '7813');
    const headers = { authorization: 'Bearer admin-token' };
    const listed = await app.inject({
      method: 'GET',
      url: '/platform-admin/users/details',
      headers,
    });
    expect(listed.statusCode).toBe(200);
    const member = listed
      .json()
      .users.find((user: { realName?: string }) => user.realName === 'Member Doctor');
    const payload = {
      operationId: randomUUID(),
      expectedAccountVersion: member.accountVersion,
      expectedProfileVersion: member.profileVersion,
      realName: 'Renamed Doctor',
      mobilePhone: '13800001111',
    };
    const saved = await app.inject({
      method: 'PUT',
      url: `/platform-admin/users/${member.id}/profile`,
      headers,
      payload,
    });
    expect(saved.statusCode).toBe(200);
    const replay = await app.inject({
      method: 'PUT',
      url: `/platform-admin/users/${member.id}/profile`,
      headers,
      payload,
    });
    expect(replay.json()).toEqual(saved.json());
    const stale = await app.inject({
      method: 'PUT',
      url: `/platform-admin/users/${member.id}/profile`,
      headers,
      payload: { ...payload, operationId: randomUUID(), mobilePhone: null },
    });
    expect(stale.statusCode, stale.body).toBe(409);
    const [rows] = await client.database.execute(
      sql`SELECT c.mobile_phone AS phone FROM group_member_contacts c JOIN group_memberships m ON m.id=c.membership_id WHERE m.user_id=${member.id}`,
    );
    expect(rows).toHaveLength(2);
    expect(
      (rows as unknown as { phone: string }[]).every((row) => row.phone === '13800001111'),
    ).toBe(true);
    const denied = await app.inject({
      method: 'GET',
      url: '/platform-admin/users/details',
      headers: { authorization: 'Bearer member-token' },
    });
    expect(denied.statusCode).toBe(403);
    const old = await app.inject({ method: 'GET', url: '/platform-admin/users', headers });
    expect(old.json().users[0]).not.toHaveProperty('mobilePhone');
  });

  it('sets a password once with keyed request binding and invalidates old sessions', async () => {
    const headers = { authorization: 'Bearer admin-token' };
    const details = await app.inject({
      method: 'GET',
      url: '/platform-admin/users/details',
      headers,
    });
    expect(details.statusCode).toBe(200);
    const member = details
      .json()
      .users.find((user: { realName?: string }) => user.realName === 'Member Doctor');
    const assigned = await app.inject({
      method: 'PUT',
      url: `/platform-admin/users/${member.id}/password-identity`,
      headers,
      payload: {
        operationId: randomUUID(),
        expectedAuthVersion: member.authVersion,
        username: 'account.doctor',
      },
    });
    expect(assigned.statusCode).toBe(200);
    const payload = {
      operationId: randomUUID(),
      expectedAuthVersion: assigned.json().authVersion,
      newPassword: 'new-account-secret',
    };
    const { createPasswordSessionToken, createWechatAuthPort } =
      await import('../../adapters/auth/wechat-auth.js');
    const secret = 'account-test-operation-secret-32-characters';
    const oldToken = createPasswordSessionToken(
      { sub: member.id, username: 'account.doctor', authVersion: assigned.json().authVersion },
      secret,
    );
    const authentication = createWechatAuthPort({
      allowDevTokens: false,
      databaseClient: client,
      sessionSecret: secret,
    });
    expect(
      await authentication.authenticate({ authorization: `Bearer ${oldToken}` }),
    ).toBeDefined();
    const reset = await app.inject({
      method: 'PUT',
      url: `/platform-admin/users/${member.id}/password`,
      headers,
      payload,
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({
      authVersion: payload.expectedAuthVersion + 1,
      passwordConfigured: true,
    });
    expect(
      await authentication.authenticate({ authorization: `Bearer ${oldToken}` }),
    ).toBeUndefined();
    const replay = await app.inject({
      method: 'PUT',
      url: `/platform-admin/users/${member.id}/password`,
      headers,
      payload,
    });
    expect(replay.json()).toEqual(reset.json());
    const mismatch = await app.inject({
      method: 'PUT',
      url: `/platform-admin/users/${member.id}/password`,
      headers,
      payload: { ...payload, newPassword: 'different-secret' },
    });
    expect(mismatch.statusCode).toBe(409);
    const [rows] = await client.database.execute(
      sql`SELECT password_hash AS hash FROM user_password_credentials WHERE user_id=${member.id}`,
    );
    const { verifyPassword } = await import('../auth/password-auth-service.js');
    expect(
      await verifyPassword(payload.newPassword, (rows as unknown as { hash: string }[])[0]!.hash),
    ).toBe(true);
    const [operations] = await client.database.execute(
      sql`SELECT request_fingerprint, result FROM idempotency_keys WHERE operation_key=${payload.operationId}`,
    );
    expect(JSON.stringify(operations)).not.toContain(payload.newPassword);
  });

  it('migrates the latest contact phone with stable ties and preserves originals and visibility', async () => {
    const groupA = await createGroup('member-token', 'Migration one', '7812');
    const groupB = await createGroup('member-token', 'Migration two', '7813');
    const [members] = await client.database.execute(
      sql`SELECT m.id, m.user_id AS userId, m.group_id AS groupId FROM group_memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id IN (${groupA},${groupB}) AND u.cloudbase_uid='cloudbase-member'`,
    );
    const rows = members as unknown as { id: string; userId: string; groupId: string }[];
    const a = rows.find((row) => row.groupId === groupA)!;
    const b = rows.find((row) => row.groupId === groupB)!;
    const firstId = '11111111-0000-4000-8000-000000000001';
    const secondId = '22222222-0000-4000-8000-000000000002';
    await client.database
      .execute(sql`INSERT INTO group_member_contacts (id,membership_id,mobile_phone,short_phone,is_confirmed,version,updated_at,mobile_phone_consent_revoked_at) VALUES
      (${firstId},${a.id},'13800000001','620001',1,7,'2026-09-01 08:00:00',NULL),
      (${secondId},${b.id},'13800000002','620002',1,9,'2026-09-02 08:00:00','2026-09-01 09:00:00')`);
    const statements = readFileSync(
      fileURLToPath(
        new URL('../../../../../migrations/0055_account_mobile_phone.sql', import.meta.url),
      ),
      'utf8',
    )
      .split('--> statement-breakpoint')
      .slice(2);
    for (const statement of statements) await client.database.execute(sql.raw(statement));
    const [after] = await client.database.execute(
      sql`SELECT mobile_phone AS phone,mobile_phone_before_account_sync AS original,short_phone AS shortPhone,is_confirmed AS confirmed,version,updated_at AS updatedAt,mobile_phone_consent_revoked_at AS revoked FROM group_member_contacts ORDER BY id`,
    );
    const contacts = after as unknown as {
      phone: string;
      original: string;
      shortPhone: string;
      confirmed: number;
      version: number;
      updatedAt: Date;
      revoked: Date | null;
    }[];
    expect(contacts.map((row) => row.phone)).toEqual(['13800000002', '13800000002']);
    expect(contacts.map((row) => row.original)).toEqual(['13800000001', '13800000002']);
    expect(contacts.map((row) => row.version)).toEqual([8, 9]);
    expect(contacts.map((row) => row.shortPhone)).toEqual(['620001', '620002']);
    expect(contacts.every((row) => row.confirmed === 1)).toBe(true);
    expect(contacts[1]!.revoked).not.toBeNull();
    const stale = await app.inject({
      method: 'PUT',
      url: `/groups/${groupA}/members/${a.id}/contact`,
      headers: { authorization: 'Bearer member-token' },
      payload: { operationId: randomUUID(), expectedVersion: 7, mobilePhone: '13800000001' },
    });
    expect(stale.statusCode, stale.body).toBe(409);
    await client.database.execute(
      sql`UPDATE group_member_contacts SET mobile_phone=mobile_phone_before_account_sync,updated_at='2026-09-02 08:00:00'`,
    );
    for (const statement of statements) await client.database.execute(sql.raw(statement));
    const [account] = await client.database.execute(
      sql`SELECT mobile_phone AS phone FROM users WHERE id=${a.userId}`,
    );
    expect((account as unknown as { phone: string }[])[0]!.phone).toBe('13800000001');
  });

  it('keeps global phone when editing a new group short number and can revoke from version zero', async () => {
    await client.database.execute(
      sql`UPDATE users SET mobile_phone='13800001111' WHERE cloudbase_uid='cloudbase-member'`,
    );
    const groupId = await createGroup('member-token', 'New phone group', '7812');
    const headers = { authorization: 'Bearer member-token' };
    const consent = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/mobile-phone-consent`,
      headers,
    });
    expect(consent.json()).toMatchObject({ contactVersion: 0, state: 'consented' });
    const revoked = await app.inject({
      method: 'PUT',
      url: `/groups/${groupId}/mobile-phone-consent`,
      headers,
      payload: {
        operationId: randomUUID(),
        expectedContactVersion: 0,
        consented: false,
        noticeVersion: 'v1',
      },
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().state).toBe('not-consented');
    const contacts = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/contacts`,
      headers,
    });
    const contact = contacts.json()[0];
    const edited = await app.inject({
      method: 'PUT',
      url: `/groups/${groupId}/members/${contact.membershipId}/contact`,
      headers,
      payload: {
        operationId: randomUUID(),
        expectedVersion: contact.version,
        shortPhone: '620001',
      },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().mobilePhone).toBe('13800001111');
    const current = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/mobile-phone-consent`,
      headers,
    });
    expect(current.json().state).toBe('not-consented');
  });

  it('retries the complete transaction after an actual database deadlock without double writes', async () => {
    const { withRetriedTransaction } = await import('../concurrency/transaction-retry.js');
    const [found] = await client.database.execute(
      sql`SELECT id,version FROM users WHERE cloudbase_uid IN ('cloudbase-member','cloudbase-outsider') ORDER BY id`,
    );
    const rows = found as unknown as { id: string; version: number }[];
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let arrived = 0;
    async function write(first: string, second: string) {
      let attempt = 0;
      return withRetriedTransaction(client, async (transaction) => {
        attempt += 1;
        await transaction.execute(sql`SELECT id FROM users WHERE id=${first} FOR UPDATE`);
        if (attempt === 1) {
          arrived += 1;
          if (arrived === 2) release();
          await barrier;
        }
        await transaction.execute(sql`UPDATE users SET version=version+1 WHERE id=${second}`);
      });
    }
    await Promise.all([write(rows[0]!.id, rows[1]!.id), write(rows[1]!.id, rows[0]!.id)]);
    const [after] = await client.database.execute(
      sql`SELECT id,version FROM users WHERE cloudbase_uid IN ('cloudbase-member','cloudbase-outsider') ORDER BY id`,
    );
    expect((after as unknown as { version: number }[]).map((row) => row.version)).toEqual(
      rows.map((row) => row.version + 1),
    );
  });

  it('preserves a newer explicit phone clear during identity merge', async () => {
    const { mergeAccountMobilePhone } = await import('../users/account-mobile-phone.js');
    const [found] = await client.database.execute(
      sql`SELECT id,cloudbase_uid AS uid FROM users WHERE cloudbase_uid IN ('cloudbase-member','cloudbase-outsider')`,
    );
    const rows = found as unknown as { id: string; uid: string }[];
    const source = rows.find((row) => row.uid === 'cloudbase-outsider')!.id;
    const target = rows.find((row) => row.uid === 'cloudbase-member')!.id;
    await client.database.execute(
      sql`UPDATE users SET mobile_phone='13800000001',mobile_phone_updated_at='2026-09-01 08:00:00' WHERE id=${source}`,
    );
    await client.database.execute(
      sql`UPDATE users SET mobile_phone=NULL,mobile_phone_updated_at='2026-09-02 08:00:00' WHERE id=${target}`,
    );
    await client.database.transaction((transaction) =>
      mergeAccountMobilePhone(transaction, source, target),
    );
    const [after] = await client.database.execute(
      sql`SELECT mobile_phone AS phone FROM users WHERE id=${target}`,
    );
    expect((after as unknown as { phone: string | null }[])[0]!.phone).toBeNull();
  });

  it('serializes platform phone changes with member contact changes without losing the global value', async () => {
    const group = await createGroup('member-token', 'Concurrent account contacts', '7812');
    const headers = { authorization: 'Bearer admin-token' };
    const details = await app.inject({
      method: 'GET',
      url: '/platform-admin/users/details',
      headers,
    });
    const account = details
      .json()
      .users.find((row: { realName: string }) => row.realName === 'Member Doctor');
    const contacts = await app.inject({
      method: 'GET',
      url: `/groups/${group}/contacts`,
      headers: { authorization: 'Bearer member-token' },
    });
    const contact = contacts.json()[0];
    const [profile, short] = await Promise.all([
      app.inject({
        method: 'PUT',
        url: `/platform-admin/users/${account.id}/profile`,
        headers,
        payload: {
          operationId: randomUUID(),
          expectedAccountVersion: account.accountVersion,
          expectedProfileVersion: account.profileVersion,
          realName: 'Member Doctor',
          mobilePhone: '13800003333',
        },
      }),
      app.inject({
        method: 'PUT',
        url: `/groups/${group}/members/${contact.membershipId}/contact`,
        headers: { authorization: 'Bearer member-token' },
        payload: {
          operationId: randomUUID(),
          expectedVersion: contact.version,
          shortPhone: '620003',
        },
      }),
    ]);
    expect(profile.statusCode, profile.body).toBe(200);
    expect([200, 409]).toContain(short.statusCode);
    const final = await app.inject({
      method: 'GET',
      url: `/groups/${group}/contacts`,
      headers: { authorization: 'Bearer member-token' },
    });
    expect(final.json()[0].mobilePhone).toBe('13800003333');
    if (short.statusCode === 200) expect(final.json()[0].shortPhone).toBe('620003');
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
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': randomUUID(),
      },
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
  await client.database.execute(sql`DROP TABLE IF EXISTS miniprogram_telemetry_events`);
  await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_monthly_aggregates`);
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
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profile_avatars`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
