import type { FixtureSaveRequest } from '../../test-support/schedule-fixture.js';
import {
  createScheduleFixture,
  configureScheduleFixture,
  type FixtureScheduleResult,
} from '../../test-support/schedule-fixture.js';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { ScheduleGenerationPreview } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('draft preview and publishing', () => {
  let app: ReturnType<typeof createApp>;
  let candidateMembershipId: string;
  let client: DatabaseClient;
  let groupId: string;
  let ownerMembershipId: string;
  let primaryRoleId: string;
  let allDayShiftTypeId: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-31T04:00:00Z'));
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'candidate-token': 'cloudbase-candidate',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    groupId = await createGroup('Scheduling group', '1234');
    await addRosterEntry(groupId, 'Candidate Doctor');
    await insertDirectMembership(client, { groupId, realName: 'Candidate Doctor' });

    const config = await getConfig('owner-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    expect(allDayShift).toBeDefined();
    allDayShiftTypeId = allDayShift?.id as string;
    primaryRoleId = await createRole(groupId, '一线');

    const members = await listGroupMembers(groupId);
    ownerMembershipId = members.find((member) => member.realName === 'Owner Doctor')?.id as string;
    candidateMembershipId = members.find((member) => member.realName === 'Candidate Doctor')
      ?.id as string;
    await replaceRoleMembers(groupId, primaryRoleId, [ownerMembershipId, candidateMembershipId]);
    const role = (await getConfig('owner-token', groupId)).roles.find(
      (candidate) => candidate.id === primaryRoleId,
    );
    const startingMemberScheduleRoleId = role?.members[0]?.id as string;
    await configureFixturePattern(groupId, primaryRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId,
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('blocks publishing a draft whose month is fully past', async () => {
    const config = await getConfig('owner-token', groupId);
    const saved = (
      await saveSchedule(groupId, {
        businessMonth: '2026-08',
        operationId: randomUUID(),
        rulesVersion: config.rulesVersion,
        scheduleRoleIds: [primaryRoleId],
      })
    ).json() as FixtureScheduleResult;
    const periodId = saved.periods[0]?.id as string;
    await client.database.execute(
      sql`UPDATE schedule_periods SET business_month = '2020-01-01' WHERE id = ${periodId}`,
    );

    const blocked = await publishSchedule(groupId, periodId, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });

    expect(blocked.statusCode).toBe(409);
    expect((blocked.json() as ErrorResponse).error.message).toContain('排班补录');
  });

  it('requires acknowledgement before publishing a draft with vacancies', async () => {
    const vacantRoleId = await createRole(groupId, '空缺角色');
    await replaceRoleMembers(groupId, vacantRoleId, []);
    await configureFixturePattern(groupId, vacantRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: null,
    });
    const config = await getConfig('owner-token', groupId);
    const saved = await saveSchedule(groupId, {
      businessMonth: '2026-08',
      operationId: randomUUID(),
      rulesVersion: config.rulesVersion,
      scheduleRoleIds: [vacantRoleId],
    });
    expect(saved.statusCode).toBe(200);
    const savedResult = saved.json() as FixtureScheduleResult;
    expect(savedResult.periods[0]).toMatchObject({ status: 'draft' });
    expect(savedResult.preview.vacancies).toHaveLength(31);
    const periodId = savedResult.periods[0]?.id as string;

    const blocked = await publishSchedule(groupId, periodId, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(blocked.statusCode).toBe(409);
    expect(
      ((blocked.json() as ErrorResponse).error.latestData?.preview as ScheduleGenerationPreview)
        .vacancies,
    ).toHaveLength(31);

    const operationId = randomUUID();
    const accepted = await publishSchedule(groupId, periodId, {
      acknowledgeBlockers: true,
      expectedVersion: 1,
      operationId,
    });
    expect(accepted.statusCode).toBe(200);
    expect((accepted.json() as { period: { status: string } }).period).toMatchObject({
      status: 'published',
    });

    const replay = await publishSchedule(groupId, periodId, {
      acknowledgeBlockers: true,
      expectedVersion: 1,
      operationId,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(accepted.json());
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
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function addRosterEntry(targetGroupId: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { realNames: [realName] },
      url: `/groups/${targetGroupId}/roster-entries`,
    });

    expect(response.statusCode).toBe(200);
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

  async function getConfig(
    token: string,
    targetGroupId: string,
  ): Promise<SchedulingConfigResponse> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${targetGroupId}/scheduling-config`,
    });

    expect(response.statusCode).toBe(200);
    return response.json() as SchedulingConfigResponse;
  }

  async function createRole(targetGroupId: string, name: string): Promise<string> {
    const config = await getConfig('owner-token', targetGroupId);
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { expectedRulesVersion: config.rulesVersion, name, operationId: randomUUID() },
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
    const config = await getConfig('owner-token', targetGroupId);
    const role = config.roles.find((item) => item.id === roleId) as
      { readonly version: number } | undefined;
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: role?.version,
        expectedRulesVersion: config.rulesVersion,
        membershipIds,
        operationId: randomUUID(),
      },
      url: `/groups/${targetGroupId}/schedule-roles/${roleId}/members`,
    });

    expect(response.statusCode).toBe(200);
  }

  async function configureFixturePattern(
    targetGroupId: string,
    roleId: string,
    body: {
      readonly currentPosition: number;
      readonly defaultShiftTypeId: string;
      readonly requiredMembersPerDay: number;
      readonly startDate: string;
      readonly startingMemberScheduleRoleId: string | null;
    },
  ): Promise<void> {
    await configureScheduleFixture(client, targetGroupId, roleId, body);
  }

  async function saveSchedule(
    targetGroupId: string,
    body: FixtureSaveRequest,
    token = 'owner-token',
  ) {
    return createScheduleFixture(app, client, {
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    });
  }

  async function publishSchedule(
    targetGroupId: string,
    periodId: string,
    body: {
      readonly acknowledgeBlockers?: boolean;
      readonly expectedVersion: number;
      readonly operationId: string;
    },
    token = 'owner-token',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${targetGroupId}/schedules/${periodId}/publish`,
    });
  }
});

interface MemberResponse {
  readonly id: string;
  readonly realName: string;
}

interface ScheduleRoleResponse {
  readonly id: string;
  readonly members: readonly { readonly id: string; readonly realName: string }[];
}

interface SchedulingConfigResponse {
  readonly roles: readonly ScheduleRoleResponse[];
  readonly rulesVersion: number;
  readonly shiftTypes: readonly {
    readonly id: string;
    readonly isEnabled: boolean;
  }[];
}

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly latestData?: {
      readonly preview?: ScheduleGenerationPreview;
      readonly rulesVersion?: number;
    };
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_visitor_links`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profile_avatars`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
