import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { ScheduleExportJob } from '@schedule/contracts';
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
import { ExportJobProcessor } from '../../jobs/export-jobs.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('schedule exports', () => {
  let allDayShiftTypeId: string;
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'admin-token': 'cloudbase-admin',
        'a-token': 'cloudbase-a',
        'b-token': 'cloudbase-b',
        'outsider-token': 'cloudbase-outsider',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('admin-token', 'Owner Doctor');
    await registerUser('a-token', 'A Doctor');
    await registerUser('b-token', 'B Doctor');
    await registerUser('outsider-token', 'Outside Doctor');
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (client !== undefined) {
      await client.close();
    }
  });

  it('creates and processes a schedule export without phone numbers and audits it', async () => {
    const context = await seedPublishedSeptember();
    const created = await createExport('admin-token', context.groupId, {
      exportType: 'schedule',
      period: '2026-09',
    });
    expect(created.statusCode).toBe(201);
    const job = created.json() as ScheduleExportJob;
    expect(job.status).toBe('pending');
    expect(job.periodType).toBe('month');

    const processed = await new ExportJobProcessor(client).run();
    expect(processed).toMatchObject({ processed: 1, completed: 1, failed: 0 });

    const fetched = (
      await getExportJob('admin-token', context.groupId, job.id)
    ).json() as ScheduleExportJob;
    expect(fetched.status).toBe('completed');
    expect(fetched.rowCount).toBe(30);
    expect(fetched.expiresAt).toBeDefined();

    const download = await downloadExport('admin-token', context.groupId, job.id);
    expect(download.statusCode).toBe(200);
    const csv = download.body;
    expect(csv).toContain('日期,星期,角色,班种');
    expect(csv).toContain('A Doctor');
    expect(csv).toContain('B Doctor');
    expect(csv).not.toMatch(/电话|手机|短号|audit|审计/u);
    expect(download.headers['content-type']).toContain('text/csv');

    const auditRows = (
      await client.database.execute(sql`SELECT action FROM audit_logs ORDER BY occurred_at`)
    )[0] as unknown as readonly { action: string }[];
    expect(auditRows.map((row) => row.action)).toEqual([
      'schedule_export_created',
      'schedule_export_downloaded',
    ]);

    const secondRun = await new ExportJobProcessor(client).run();
    expect(secondRun.processed).toBe(0);
  });

  it('denies ordinary members and outsiders and validates the export scope server-side', async () => {
    const context = await seedPublishedSeptember();

    const memberCreate = await createExport('a-token', context.groupId, {
      exportType: 'schedule',
      period: '2026-09',
    });
    expect(memberCreate.statusCode).toBe(403);
    const outsiderCreate = await createExport('outsider-token', context.groupId, {
      exportType: 'schedule',
      period: '2026-09',
    });
    expect(outsiderCreate.statusCode).toBe(403);

    const invalidPeriod = await createExport('admin-token', context.groupId, {
      exportType: 'schedule',
      period: '2026-13',
    });
    expect(invalidPeriod.statusCode).toBe(400);

    const foreignRole = await createExport('admin-token', context.groupId, {
      exportType: 'schedule',
      period: '2026-09',
      roleId: randomUUID(),
    });
    expect(foreignRole.statusCode).toBe(400);

    const foreignMembership = await createExport('admin-token', context.groupId, {
      exportType: 'schedule',
      membershipId: randomUUID(),
      period: '2026-09',
    });
    expect(foreignMembership.statusCode).toBe(400);
  });

  it('exports a statistics year with member rows and totals', async () => {
    const context = await seedPublishedSeptember();
    await generatePublishedOctober(context.groupId);

    const created = await createExport('admin-token', context.groupId, {
      exportType: 'statistics',
      period: '2026',
    });
    const job = created.json() as ScheduleExportJob;
    await new ExportJobProcessor(client).run();
    const download = await downloadExport('admin-token', context.groupId, job.id);
    expect(download.statusCode).toBe(200);
    const csv = download.body;
    expect(csv).toContain('成员,计划班次,实际值班');
    expect(csv).toContain('A Doctor');
    expect(csv).toContain('合计,61,61');
    expect(csv).not.toMatch(/电话|手机|短号/u);
  });

  it('scopes exports by member and role filters', async () => {
    const context = await seedPublishedSeptember();
    const created = await createExport('admin-token', context.groupId, {
      exportType: 'schedule',
      membershipId: context.membershipIds.a,
      period: '2026-09',
    });
    const job = created.json() as ScheduleExportJob;
    await new ExportJobProcessor(client).run();
    const download = await downloadExport('admin-token', context.groupId, job.id);
    expect(download.statusCode).toBe(200);
    const csv = download.body;
    expect(csv.split('\r\n').filter((line) => line.length > 0)).toHaveLength(16);
    expect(csv).not.toContain('B Doctor');

    const roleScoped = await createExport('admin-token', context.groupId, {
      exportType: 'schedule',
      period: '2026-09',
      roleId: context.roleId,
    });
    const roleJob = roleScoped.json() as ScheduleExportJob;
    await new ExportJobProcessor(client).run();
    const roleDownload = await downloadExport('admin-token', context.groupId, roleJob.id);
    expect(roleDownload.statusCode).toBe(200);
    expect(roleDownload.body).toContain('Primary');
  });

  it('rejects downloads of expired or unfinished exports', async () => {
    const context = await seedPublishedSeptember();
    const created = await createExport('admin-token', context.groupId, {
      exportType: 'schedule',
      period: '2026-09',
    });
    const job = created.json() as ScheduleExportJob;

    const unfinished = await downloadExport('admin-token', context.groupId, job.id);
    expect(unfinished.statusCode).toBe(409);

    await new ExportJobProcessor(client).run();
    await client.database.execute(
      sql`UPDATE export_jobs SET expires_at = '2020-01-01 00:00:00.000' WHERE id = ${job.id}`,
    );
    const expired = await downloadExport('admin-token', context.groupId, job.id);
    expect(expired.statusCode).toBe(404);

    const missing = await downloadExport('admin-token', context.groupId, randomUUID());
    expect(missing.statusCode).toBe(404);
  });

  async function seedPublishedSeptember(): Promise<Context> {
    const groupId = await createGroup('Export group', '4433');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await claimGroup('a-token', '4433');
    await claimGroup('b-token', '4433');
    const roleId = await setupRole(groupId);
    const rulesVersion = (await getConfig('admin-token', groupId)).rulesVersion;
    await generateSchedule(groupId, roleId, '2026-09', rulesVersion);

    const members = await listGroupMembers(groupId);
    const membershipById = new Map(members.map((member) => [member.realName, member.id]));
    return {
      groupId,
      membershipIds: {
        a: membershipById.get('A Doctor') as string,
        b: membershipById.get('B Doctor') as string,
      },
      roleId,
    };
  }

  async function generatePublishedOctober(groupId: string): Promise<void> {
    const rulesVersion = (await getConfig('admin-token', groupId)).rulesVersion;
    const roleId = (await getConfig('admin-token', groupId)).roles[0]?.id as string;
    await generateSchedule(groupId, roleId, '2026-10', rulesVersion);
  }

  async function setupRole(groupId: string): Promise<string> {
    const config = await getConfig('admin-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    allDayShiftTypeId = allDayShift?.id as string;
    const roleId = await createRole(groupId, 'Primary');
    const members = await listGroupMembers(groupId);
    const membershipIds = members
      .filter((member) => member.realName === 'A Doctor' || member.realName === 'B Doctor')
      .map((member) => member.id);
    await replaceRoleMembers(groupId, roleId, membershipIds);
    const roleConfig = (await getConfig('admin-token', groupId)).roles.find(
      (role) => role.id === roleId,
    );
    const startingMemberScheduleRoleId = roleConfig?.members.find(
      (member) => member.realName === 'A Doctor',
    )?.id;
    await updateRotationRule(groupId, roleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-09-01',
      startingMemberScheduleRoleId: startingMemberScheduleRoleId as string,
    });
    return roleId;
  }

  async function registerUser(token: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });
    expect(response.statusCode).toBe(201);
  }

  async function createGroup(name: string, groupCode: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function addRosterEntry(groupId: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: { realNames: [realName] },
      url: `/groups/${groupId}/roster-entries`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function claimGroup(token: string, groupCode: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode },
      url: '/groups/claim',
    });
    expect(response.statusCode).toBe(201);
  }

  async function listGroupMembers(groupId: string): Promise<MemberResponse[]> {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    expect(response.statusCode).toBe(200);
    return response.json() as MemberResponse[];
  }

  async function getConfig(token: string, groupId: string): Promise<ConfigResponse> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    });
    expect(response.statusCode).toBe(200);
    return response.json() as ConfigResponse;
  }

  async function createRole(groupId: string, name: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: { name },
      url: `/groups/${groupId}/schedule-roles`,
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function replaceRoleMembers(
    groupId: string,
    roleId: string,
    membershipIds: readonly string[],
  ): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'PUT',
      payload: { membershipIds },
      url: `/groups/${groupId}/schedule-roles/${roleId}/members`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function updateRotationRule(
    groupId: string,
    roleId: string,
    payload: {
      readonly currentPosition: number;
      readonly defaultShiftTypeId: string;
      readonly requiredMembersPerDay: number;
      readonly startDate: string;
      readonly startingMemberScheduleRoleId: string;
    },
  ): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'PUT',
      payload,
      url: `/groups/${groupId}/schedule-roles/${roleId}/rotation-rule`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function generateSchedule(
    groupId: string,
    roleId: string,
    businessMonth: string,
    rulesVersion: number,
  ) {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: {
        businessMonth,
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion,
        scheduleRoleIds: [roleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
    });
    expect(response.statusCode).toBe(200);
    return response;
  }

  async function createExport(
    token: string,
    groupId: string,
    body: {
      readonly exportType: 'schedule' | 'statistics';
      readonly membershipId?: string;
      readonly period: string;
      readonly roleId?: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/exports`,
    });
  }

  async function getExportJob(token: string, groupId: string, exportJobId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/exports/${exportJobId}`,
    });
  }

  async function downloadExport(token: string, groupId: string, exportJobId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/exports/${exportJobId}/download`,
    });
  }
});

interface Context {
  readonly groupId: string;
  readonly membershipIds: { readonly a: string; readonly b: string };
  readonly roleId: string;
}

interface MemberResponse {
  readonly id: string;
  readonly realName: string;
}

interface ConfigResponse {
  readonly roles: readonly {
    readonly id: string;
    readonly members: readonly { readonly id: string; readonly realName: string }[];
  }[];
  readonly rulesVersion: number;
  readonly shiftTypes: readonly {
    readonly id: string;
    readonly isEnabled: boolean;
  }[];
}

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
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
