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

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('scheduling configuration', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
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
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('creates six group templates and requires configured times before enabling other shifts', async () => {
    const groupId = await createGroup();
    const config = await getConfig('owner-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.name === '全天班');
    const aShift = config.shiftTypes.find((shiftType) => shiftType.name === 'A 班');

    expect(config.shiftTypes).toHaveLength(6);
    expect(config.shiftTypes.map((shiftType) => shiftType.name)).toEqual([
      '全天班',
      'A 班',
      'N 班',
      'P 班',
      'NP 班',
      '办公班',
    ]);
    expect(allDayShift).toMatchObject({
      crossesMidnight: true,
      endTime: '08:00',
      isAllDay: true,
      isEnabled: true,
      startTime: '08:00',
    });
    expect(aShift).toMatchObject({ isEnabled: false });
    expect(aShift).not.toHaveProperty('startTime');
    expect(aShift).not.toHaveProperty('endTime');

    const invalidEnable = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: aShift?.abbreviation,
        color: aShift?.color,
        countsTowardStatistics: aShift?.countsTowardStatistics,
        crossesMidnight: false,
        endTime: null,
        isEnabled: true,
        name: aShift?.name,
        startTime: null,
      },
      url: `/groups/${groupId}/shift-types/${aShift?.id}`,
    });

    expect(invalidEnable.statusCode).toBe(400);
  });

  it('allows a member in multiple roles and persists only contiguous rotation positions', async () => {
    const groupId = await createClaimedGroup();
    const members = await listGroupMembers(groupId);
    const owner = members.find((member) => member.realName === 'Owner Doctor');
    const candidate = members.find((member) => member.realName === 'Candidate Doctor');
    const firstRole = await createRole(groupId, '一线');

    const membersSaved = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { membershipIds: [owner?.id, candidate?.id] },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/members`,
    });
    const firstRoleWithMembers = membersSaved.json() as ScheduleRoleResponse;
    const invalidOrder = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        members: firstRoleWithMembers.members.map((member, index) => ({
          position: index + 2,
          scheduleRoleMemberId: member.id,
        })),
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/rotation-members`,
    });
    const validOrder = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        members: [...firstRoleWithMembers.members].reverse().map((member, index) => ({
          position: index + 1,
          scheduleRoleMemberId: member.id,
        })),
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/rotation-members`,
    });
    const reorderedFirstRole = validOrder.json() as ScheduleRoleResponse;
    const defaultShiftTypeId = (await getConfig('owner-token', groupId)).shiftTypes.find(
      (shiftType) => shiftType.isEnabled,
    )?.id;
    const rotationRule = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        currentPosition: 1,
        defaultShiftTypeId,
        requiredMembersPerDay: 2,
        startDate: '2026-08-31',
        startingMemberScheduleRoleId: reorderedFirstRole.members[0]?.id,
      },
      url: `/groups/${groupId}/schedule-roles/${firstRole.id}/rotation-rule`,
    });
    const secondRole = await createRole(groupId, '二线');
    const secondRoleMembers = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { membershipIds: [candidate?.id] },
      url: `/groups/${groupId}/schedule-roles/${secondRole.id}/members`,
    });

    expect(membersSaved.statusCode).toBe(200);
    expect(invalidOrder.statusCode).toBe(400);
    expect(validOrder.statusCode).toBe(200);
    expect(validOrder.json()).toMatchObject({
      members: [
        { position: 1, realName: 'Candidate Doctor' },
        { position: 2, realName: 'Owner Doctor' },
      ],
    });
    expect(rotationRule.statusCode).toBe(200);
    expect(rotationRule.json()).toMatchObject({
      rotationRule: {
        currentPosition: 1,
        requiredMembersPerDay: 2,
        startDate: '2026-08-31',
        startingMemberScheduleRoleId: reorderedFirstRole.members[0]?.id,
      },
    });
    expect(secondRoleMembers.statusCode).toBe(200);

    const config = await getConfig('owner-token', groupId);
    expect(config.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '一线',
          members: expect.arrayContaining([
            expect.objectContaining({ realName: 'Candidate Doctor' }),
          ]),
        }),
        expect.objectContaining({
          name: '二线',
          members: expect.arrayContaining([
            expect.objectContaining({ realName: 'Candidate Doctor' }),
          ]),
        }),
      ]),
    );
  });

  it('keeps disabled shift configuration available while blocking direct member changes', async () => {
    const groupId = await createClaimedGroup();
    const createShift = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        abbreviation: '夜',
        color: '#312E81',
        countsTowardStatistics: true,
        crossesMidnight: true,
        endTime: '08:00',
        isEnabled: true,
        name: '自定义夜班',
        startTime: '20:00',
      },
      url: `/groups/${groupId}/shift-types`,
    });
    const shiftType = createShift.json() as ShiftTypeResponse;
    const disableShift = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: shiftType.abbreviation,
        color: shiftType.color,
        countsTowardStatistics: shiftType.countsTowardStatistics,
        crossesMidnight: shiftType.crossesMidnight,
        endTime: shiftType.endTime,
        isEnabled: false,
        name: shiftType.name,
        startTime: shiftType.startTime,
      },
      url: `/groups/${groupId}/shift-types/${shiftType.id}`,
    });
    const memberCreatesRole = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { name: '越权角色' },
      url: `/groups/${groupId}/schedule-roles`,
    });

    expect(createShift.statusCode).toBe(201);
    expect(shiftType).toMatchObject({
      crossesMidnight: true,
      endTime: '08:00',
      startTime: '20:00',
      textColor: '#FFFFFF',
    });
    expect(disableShift.statusCode).toBe(200);
    expect(disableShift.json()).toMatchObject({ configurationVersion: 2, isEnabled: false });
    expect(memberCreatesRole.statusCode).toBe(403);
    expect((await getConfig('owner-token', groupId)).shiftTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: shiftType.id, isEnabled: false, name: '自定义夜班' }),
      ]),
    );
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

  async function createGroup(): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { groupCode: '1234', name: 'Scheduling group' },
      url: '/groups',
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function createClaimedGroup(): Promise<string> {
    const groupId = await createGroup();
    const roster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Candidate Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    const claim = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { groupCode: '1234' },
      url: '/groups/claim',
    });

    expect(roster.statusCode).toBe(200);
    expect(claim.statusCode).toBe(201);
    return groupId;
  }

  async function createRole(groupId: string, name: string): Promise<{ id: string }> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { name },
      url: `/groups/${groupId}/schedule-roles`,
    });

    expect(response.statusCode).toBe(201);
    return response.json() as { id: string };
  }

  async function getConfig(token: string, groupId: string): Promise<SchedulingConfigResponse> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    });

    expect(response.statusCode).toBe(200);
    return response.json() as SchedulingConfigResponse;
  }

  async function listGroupMembers(groupId: string): Promise<MemberResponse[]> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });

    expect(response.statusCode).toBe(200);
    return response.json() as MemberResponse[];
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
  readonly roles: readonly {
    readonly members: readonly { readonly realName: string }[];
    readonly name: string;
  }[];
  readonly shiftTypes: readonly ShiftTypeResponse[];
}

interface ShiftTypeResponse {
  readonly abbreviation: string;
  readonly color: string;
  readonly configurationVersion: number;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime?: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime?: string;
  readonly textColor: string;
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
