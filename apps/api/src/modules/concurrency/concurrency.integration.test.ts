import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { SchedulePeriodSummary } from '@schedule/contracts';
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

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('optimistic concurrency protection', () => {
  let app: ReturnType<typeof createApp>;
  let allDayShiftTypeId: string;
  let client: DatabaseClient;
  let groupId: string;
  let ownerMembershipId: string;
  let primaryRoleId: string;
  let rulesVersion: number;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    groupId = await createGroup('Concurrency group', '1234');

    const config = await getConfig('owner-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    expect(allDayShift).toBeDefined();
    allDayShiftTypeId = allDayShift?.id as string;
    primaryRoleId = await createRole(groupId, '一线');

    const members = await listGroupMembers(groupId);
    ownerMembershipId = members.find((member) => member.realName === 'Owner Doctor')?.id as string;
    await replaceRoleMembers(groupId, primaryRoleId, [ownerMembershipId]);
    rulesVersion = (await getConfig('owner-token', groupId)).rulesVersion;
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('lets only one concurrent template update win and returns the latest summary to the loser', async () => {
    const templateId = await createTemplate();
    const requestBody = {
      cells: [{ cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId }],
      cycleDays: 5,
      expectedVersion: 1,
      membershipIds: [ownerMembershipId],
      startDate: '2026-09-01',
    };

    const responses = await Promise.all([
      updateTemplate(templateId, requestBody),
      updateTemplate(templateId, requestBody),
    ]);
    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses).toEqual([200, 409]);

    const losing = responses.find((response) => response.statusCode === 409);
    expect(losing?.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        latestData: {
          id: templateId,
          objectType: 'manual_schedule_template',
          version: 2,
        },
      },
    });

    const [updateEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE object_id = ${templateId} AND event_type = 'manual_schedule_template_updated'`,
    );
    expect(updateEvents).toEqual([{ count: 1 }]);
  });

  it('lets only one concurrent publication win for the same draft version', async () => {
    const templateId = await createTemplate();
    const applied = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
    });
    expect(applied.statusCode).toBe(200);
    const period = (applied.json() as { periods: SchedulePeriodSummary[] }).periods[0];
    expect(period?.status).toBe('draft');

    const publishBody = {
      expectedVersion: period?.version ?? 1,
      operationId: randomUUID(),
    };
    const responses = await Promise.all([
      publishPeriod(period?.id as string, { ...publishBody, operationId: randomUUID() }),
      publishPeriod(period?.id as string, { ...publishBody, operationId: randomUUID() }),
    ]);
    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses).toEqual([200, 409]);

    const losing = responses.find((response) => response.statusCode === 409);
    expect(losing?.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        latestData: {
          id: period?.id,
          objectType: 'schedule_period',
          version: 2,
        },
      },
    });

    const [publishEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE schedule_period_id = ${period?.id} AND event_type = 'schedule_period_published'`,
    );
    expect(publishEvents).toEqual([{ count: 1 }]);
  });

  it('returns the latest profile version to a losing concurrent profile update', async () => {
    const body = { realName: 'Owner Doctor', version: 1 };
    const responses = await Promise.all([
      app.inject({
        headers: { authorization: 'Bearer owner-token' },
        method: 'PATCH',
        payload: { ...body, realName: 'Doctor Alpha' },
        url: '/users/me',
      }),
      app.inject({
        headers: { authorization: 'Bearer owner-token' },
        method: 'PATCH',
        payload: { ...body, realName: 'Doctor Beta' },
        url: '/users/me',
      }),
    ]);
    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses).toEqual([200, 409]);

    const losing = responses.find((response) => response.statusCode === 409);
    expect(losing?.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        latestData: {
          objectType: 'user_profile',
          version: 2,
        },
      },
    });
  });

  it('rejects an operation id reused with a different request without writing anything', async () => {
    const templateId = await createTemplate();
    const operationId = randomUUID();

    const first = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId,
    });
    expect(first.statusCode).toBe(200);

    const mismatched = await applyTemplate(templateId, {
      endDate: '2026-09-30',
      expectedRulesVersion: rulesVersion,
      operationId,
    });
    expect(mismatched.statusCode).toBe(409);
    expect((mismatched.json() as ErrorResponse).error.message).toContain('操作编号');

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    const [applyEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE event_type = 'manual_schedule_template_applied'`,
    );
    expect(periodCount).toEqual([{ count: 1 }]);
    expect(applyEvents).toEqual([{ count: 1 }]);
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

  async function createGroup(name: string, groupCode: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function listGroupMembers(targetGroupId: string): Promise<MemberResponse[]> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${targetGroupId}/members`,
    });

    expect(response.statusCode).toBe(200);
    return response.json() as MemberResponse[];
  }

  async function getConfig(token: string, targetGroupId: string): Promise<ConfigResponse> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${targetGroupId}/scheduling-config`,
    });

    expect(response.statusCode).toBe(200);
    return response.json() as ConfigResponse;
  }

  async function createRole(targetGroupId: string, name: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { name },
      url: `/groups/${targetGroupId}/schedule-roles`,
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function replaceRoleMembers(
    targetGroupId: string,
    roleId: string,
    membershipIds: readonly string[],
  ): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { membershipIds },
      url: `/groups/${targetGroupId}/schedule-roles/${roleId}/members`,
    });

    expect(response.statusCode).toBe(200);
  }

  async function createTemplate(): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        cells: [{ cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId }],
        cycleDays: 7,
        membershipIds: [ownerMembershipId],
        scheduleRoleId: primaryRoleId,
        startDate: '2026-08-01',
      },
      url: `/groups/${groupId}/manual-schedule-templates`,
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function updateTemplate(
    templateId: string,
    body: {
      readonly cells: readonly {
        readonly cycleDay: number;
        readonly membershipId: string;
        readonly shiftTypeId: string;
      }[];
      readonly cycleDays: number;
      readonly expectedVersion: number;
      readonly membershipIds: readonly string[];
      readonly startDate: string;
    },
  ) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { ...body, scheduleRoleId: primaryRoleId },
      url: `/groups/${groupId}/manual-schedule-templates/${templateId}`,
    });
  }

  async function applyTemplate(
    templateId: string,
    body: {
      readonly endDate?: string;
      readonly expectedRulesVersion: number;
      readonly operationId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/manual-schedule-templates/${templateId}/apply`,
    });
  }

  async function publishPeriod(
    schedulePeriodId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/schedules/${schedulePeriodId}/publish`,
    });
  }
});

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

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
  };
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
  await client.database.execute(sql`DROP TABLE IF EXISTS backup_archives`);
  await client.database.execute(sql`DROP TABLE IF EXISTS platform_job_runs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_cells`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_template_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_templates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS duty_adjustments`);
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
