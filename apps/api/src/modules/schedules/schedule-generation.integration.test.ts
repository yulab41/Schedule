import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type {
  SaveGeneratedScheduleRequest,
  SavedScheduleGeneration,
  ScheduleGenerationPreview,
} from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  scheduleEvents,
  schedulePeriods,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('automatic schedule generation, preview, and publishing', () => {
  let app: ReturnType<typeof createApp>;
  let candidateMembershipId: string;
  let client: DatabaseClient;
  let groupId: string;
  let ownerMembershipId: string;
  let primaryRoleId: string;
  let allDayShiftTypeId: string;

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
    groupId = await createGroup('Scheduling group', '1234');
    await addRosterEntry(groupId, 'Candidate Doctor');
    const claim = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { groupCode: '1234' },
      url: '/groups/claim',
    });
    expect(claim.statusCode).toBe(201);

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
    await updateRotationRule(groupId, primaryRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId,
    });
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('generates a deterministic preview without persisting assignments', async () => {
    const config = await getConfig('owner-token', groupId);
    const body = {
      businessMonth: '2026-08',
      rulesVersion: config.rulesVersion,
      scheduleRoleIds: [primaryRoleId],
    };
    const first = await previewSchedule(groupId, body);
    const second = await previewSchedule(groupId, body);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    const preview = first.json() as ScheduleGenerationPreview;
    expect(preview.assignments).toHaveLength(31);
    expect(preview.vacancies).toEqual([]);
    expect(preview.hardConflicts).toEqual([]);
    expect(preview.statistics).toMatchObject({
      assignmentCount: 31,
      countedAssignmentCount: 31,
      vacancyCount: 0,
    });
    expect(preview.assignments[0]).toMatchObject({
      plannedMemberName: expect.any(String),
      scheduleRoleName: '一线',
    });

    const leapMonth = await previewSchedule(groupId, {
      ...body,
      businessMonth: '2028-02',
    });
    expect((leapMonth.json() as ScheduleGenerationPreview).assignments).toHaveLength(29);

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    const [assignmentCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count
          FROM shift_assignments
          INNER JOIN schedule_periods ON schedule_periods.id = shift_assignments.schedule_period_id
          WHERE schedule_periods.group_id = ${groupId}`,
    );

    expect(periodCount).toEqual([{ count: 0 }]);
    expect(assignmentCount).toEqual([{ count: 0 }]);
  });

  it('rejects generation and publication from a non-administrator', async () => {
    const config = await getConfig('owner-token', groupId);
    const body = {
      businessMonth: '2026-08',
      rulesVersion: config.rulesVersion,
      scheduleRoleIds: [primaryRoleId],
    };

    const preview = await previewSchedule(groupId, body, 'candidate-token');
    const save = await saveSchedule(
      groupId,
      { ...body, operationId: randomUUID() },
      'candidate-token',
    );
    const publish = await publishSchedule(
      groupId,
      randomUUID(),
      { expectedVersion: 1, operationId: randomUUID() },
      'candidate-token',
    );

    expect(preview.statusCode).toBe(403);
    expect(save.statusCode).toBe(403);
    expect(publish.statusCode).toBe(403);
  });

  it('saves a draft idempotently using the operation id', async () => {
    const config = await getConfig('owner-token', groupId);
    const body: SaveGeneratedScheduleRequest = {
      businessMonth: '2026-08',
      operationId: randomUUID(),
      rulesVersion: config.rulesVersion,
      scheduleRoleIds: [primaryRoleId],
    };
    const first = await saveSchedule(groupId, body);
    const firstResult = first.json() as SavedScheduleGeneration;

    expect(first.statusCode).toBe(200);
    expect(firstResult.periods).toHaveLength(1);
    expect(firstResult.periods[0]).toMatchObject({
      businessMonth: '2026-08-01',
      revision: 1,
      status: 'draft',
    });
    expect(firstResult.publishMode).toBe('draft');
    expect(firstResult.preview.assignments).toHaveLength(31);

    const replay = await saveSchedule(groupId, body);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(firstResult);

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    const [assignmentCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count
          FROM shift_assignments
          INNER JOIN schedule_periods ON schedule_periods.id = shift_assignments.schedule_period_id
          WHERE schedule_periods.group_id = ${groupId}`,
    );
    expect(periodCount).toEqual([{ count: 1 }]);
    expect(assignmentCount).toEqual([{ count: 31 }]);

    const events = await client.database
      .select({ eventType: scheduleEvents.eventType })
      .from(scheduleEvents)
      .where(eq(scheduleEvents.operationId, body.operationId));
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['schedule_period_created', 'schedule_generation_completed']),
    );

    const conflicting = await saveSchedule(groupId, { ...body, businessMonth: '2026-09' });
    expect(conflicting.statusCode).toBe(409);
  });

  it('rejects stale rules versions before preview or save', async () => {
    const config = await getConfig('owner-token', groupId);
    const role = config.roles.find((candidate) => candidate.id === primaryRoleId) as {
      readonly id: string;
      readonly members: readonly { readonly id: string }[];
    };
    await updateRotationRule(groupId, primaryRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: role.members[0]?.id as string,
    });

    const staleBody = {
      businessMonth: '2026-08',
      rulesVersion: config.rulesVersion,
      scheduleRoleIds: [primaryRoleId],
    };
    const preview = await previewSchedule(groupId, staleBody);
    const save = await saveSchedule(groupId, {
      ...staleBody,
      operationId: randomUUID(),
    });

    expect(preview.statusCode).toBe(409);
    expect((preview.json() as ErrorResponse).error.latestData).toMatchObject({
      rulesVersion: config.rulesVersion + 1,
    });
    expect(save.statusCode).toBe(409);

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    expect(periodCount).toEqual([{ count: 0 }]);
  });

  it('blocks automatic publication on hard conflicts unless acknowledged', async () => {
    await replaceRoleMembers(groupId, primaryRoleId, [ownerMembershipId]);
    const role = (await getConfig('owner-token', groupId)).roles.find(
      (candidate) => candidate.id === primaryRoleId,
    );
    await updateRotationRule(groupId, primaryRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 2,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: role?.members[0]?.id as string,
    });
    const config = await getConfig('owner-token', groupId);
    const body: SaveGeneratedScheduleRequest = {
      businessMonth: '2026-08',
      operationId: randomUUID(),
      publishMode: 'published',
      rulesVersion: config.rulesVersion,
      scheduleRoleIds: [primaryRoleId],
    };

    const blocked = await saveSchedule(groupId, body);
    expect(blocked.statusCode).toBe(409);
    expect(
      ((blocked.json() as ErrorResponse).error.latestData?.preview as ScheduleGenerationPreview)
        .hardConflicts,
    ).toHaveLength(31);

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    expect(periodCount).toEqual([{ count: 0 }]);

    const accepted = await saveSchedule(groupId, { ...body, acknowledgeBlockers: true });
    expect(accepted.statusCode).toBe(200);
    const result = accepted.json() as SavedScheduleGeneration;
    expect(result.periods[0]).toMatchObject({ revision: 1, status: 'published' });
    expect(result.preview.assignments).toHaveLength(62);
    expect(result.preview.hardConflicts).toHaveLength(31);
  });

  it('auto-publishes by group setting and replaces the prior published version', async () => {
    const mode = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { publishMode: 'published' },
      url: `/groups/${groupId}/schedule-publish-mode`,
    });
    expect(mode.statusCode).toBe(200);
    expect(mode.json()).toEqual({ publishMode: 'published' });

    const savedMode = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/schedule-publish-mode`,
    });
    expect(savedMode.statusCode).toBe(200);
    expect(savedMode.json()).toEqual({ publishMode: 'published' });

    const config = await getConfig('owner-token', groupId);
    const saveBody = {
      businessMonth: '2026-08',
      operationId: randomUUID(),
      rulesVersion: config.rulesVersion,
      scheduleRoleIds: [primaryRoleId],
    };
    const first = await saveSchedule(groupId, saveBody);
    const second = await saveSchedule(groupId, {
      ...saveBody,
      operationId: randomUUID(),
    });

    expect((first.json() as SavedScheduleGeneration).periods[0]).toMatchObject({
      revision: 1,
      status: 'published',
    });
    expect((second.json() as SavedScheduleGeneration).periods[0]).toMatchObject({
      revision: 2,
      status: 'published',
    });

    const periods = await client.database
      .select({
        replacedByPeriodId: schedulePeriods.replacedByPeriodId,
        revision: schedulePeriods.revision,
        status: schedulePeriods.status,
      })
      .from(schedulePeriods)
      .where(eq(schedulePeriods.groupId, groupId))
      .orderBy(schedulePeriods.revision);
    expect(periods).toEqual([
      {
        replacedByPeriodId: (second.json() as SavedScheduleGeneration).periods[0]?.id ?? null,
        revision: 1,
        status: 'replaced',
      },
      { replacedByPeriodId: null, revision: 2, status: 'published' },
    ]);
  });

  it('requires acknowledgement before publishing a draft with vacancies', async () => {
    const vacantRoleId = await createRole(groupId, '空缺角色');
    await replaceRoleMembers(groupId, vacantRoleId, []);
    await updateRotationRule(groupId, vacantRoleId, {
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
    const savedResult = saved.json() as SavedScheduleGeneration;
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
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function addRosterEntry(targetGroupId: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
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

  async function updateRotationRule(
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
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: body,
      url: `/groups/${targetGroupId}/schedule-roles/${roleId}/rotation-rule`,
    });

    expect(response.statusCode).toBe(200);
  }

  async function previewSchedule(
    targetGroupId: string,
    body: {
      readonly businessMonth: string;
      readonly rulesVersion: number;
      readonly scheduleRoleIds: readonly string[];
    },
    token = 'owner-token',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${targetGroupId}/schedules/generate-preview`,
    });
  }

  async function saveSchedule(
    targetGroupId: string,
    body: SaveGeneratedScheduleRequest,
    token = 'owner-token',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${targetGroupId}/schedules/generate`,
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
