import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type {
  PastScheduleAssignment,
  PastSchedulePeriod,
  SchedulingConfig,
} from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { getChinaStandardTimeBusinessDate } from '@schedule/scheduling-domain';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('past schedule backfill', () => {
  let app: ReturnType<typeof createApp>;
  let allDayShiftTypeId: string;
  let candidateMembershipId: string;
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
        'candidate-token': 'cloudbase-candidate',
        'outsider-token': 'cloudbase-outsider',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    await registerUser('outsider-token', 'Outside Doctor');
    groupId = await createGroup('Backfill group', '1234');
    await addRosterEntry(groupId, 'Candidate Doctor');
    const claim = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { groupCode: '1234' },
      url: '/groups/claim',
    });
    expect(claim.statusCode).toBe(201);

    const config = (await getConfig('owner-token', groupId)).json() as SchedulingConfig;
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    expect(allDayShift).toBeDefined();
    allDayShiftTypeId = allDayShift?.id as string;
    primaryRoleId = await createRole(groupId, '一线');

    const members = (await listGroupMembers(groupId)).json() as readonly {
      readonly id: string;
      readonly realName: string;
    }[];
    ownerMembershipId = members.find((member) => member.realName === 'Owner Doctor')?.id as string;
    candidateMembershipId = members.find((member) => member.realName === 'Candidate Doctor')
      ?.id as string;
    await replaceRoleMembers(groupId, primaryRoleId, [ownerMembershipId, candidateMembershipId]);
    const roleConfig = (
      (await getConfig('owner-token', groupId)).json() as SchedulingConfig
    ).roles.find((candidate) => candidate.id === primaryRoleId)!;
    await updateRotationRule(groupId, primaryRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: roleConfig.members[0]?.id as string,
    });
    rulesVersion = ((await getConfig('owner-token', groupId)).json() as SchedulingConfig)
      .rulesVersion;
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('lists past periods and only past-date assignments for administrators', async () => {
    await publishMonth('2026-08');
    const pastPeriodId = await findPastPeriodId();
    expect(pastPeriodId).toBeDefined();

    const periods = (await listPastPeriods('owner-token')).json() as PastSchedulePeriod[];
    expect(periods.some((period) => period.id === pastPeriodId)).toBe(true);
    expect(periods.filter((period) => period.businessMonth === '2026-08')).toHaveLength(1);

    const assignments = (
      await listPastAssignments('owner-token', pastPeriodId as string)
    ).json() as PastScheduleAssignment[];
    const today = getChinaStandardTimeBusinessDate(new Date());
    expect(assignments.length).toBe(Number(today.slice(8)) - 1);
    expect(assignments.every((assignment) => assignment.businessDate < today)).toBe(true);
    expect(assignments[0]).toMatchObject({
      shiftTypeName: '全天班',
      slotPosition: 1,
    });
    expect(assignments[0]?.actualMemberName ?? assignments[0]?.plannedMemberName).toEqual(
      expect.any(String),
    );

    expect((await listPastPeriods('candidate-token')).statusCode).toBe(403);
  });

  it('updates a past assignment with a schedule backfill event and rejects future dates and non-admins', async () => {
    await publishMonth('2026-08');
    await publishMonth('2026-09');
    const pastPeriodId = (await findPastPeriodId()) as string;
    const pastAssignments = (
      await listPastAssignments('owner-token', pastPeriodId)
    ).json() as PastScheduleAssignment[];
    const target = pastAssignments[0] as PastScheduleAssignment;
    const nextMemberId =
      target.actualMemberId === ownerMembershipId ? candidateMembershipId : ownerMembershipId;

    const updated = await updatePastAssignment('owner-token', pastPeriodId, target.assignmentId, {
      actualMembershipId: nextMemberId,
      reason: '实际值班人员更正',
    });
    expect(updated.statusCode).toBe(200);
    const body = updated.json() as {
      readonly assignment: PastScheduleAssignment;
      readonly eventId: string;
    };
    expect(body.assignment.actualMemberId).toBe(nextMemberId);
    expect(body.eventId.length).toBeGreaterThan(0);

    const [eventRows] = await client.database.execute(
      sql`SELECT event_type AS eventType, after_data AS afterData
          FROM schedule_events
          WHERE id = ${body.eventId}`,
    );
    const event = (
      eventRows as unknown as readonly {
        readonly afterData: { readonly source?: string; readonly businessDate?: string };
        readonly eventType: string;
      }[]
    )[0];
    expect(event?.eventType).toBe('schedule_backfill_completed');
    expect(event?.afterData).toMatchObject({
      businessDate: target.businessDate,
      source: 'schedule_backfill',
    });

    const forbidden = await updatePastAssignment(
      'candidate-token',
      pastPeriodId,
      target.assignmentId,
      { actualMembershipId: ownerMembershipId },
    );
    expect(forbidden.statusCode).toBe(403);

    const futurePeriodId = await findPublishedPeriodId('2026-09-01');
    const futureAssignments = (
      await listPastAssignments('owner-token', futurePeriodId as string)
    ).json() as PastScheduleAssignment[];
    expect(futureAssignments).toEqual([]);
    const futureRows = (
      await client.database.execute(
        sql`SELECT id FROM shift_assignments WHERE schedule_period_id = ${futurePeriodId} AND deleted_at IS NULL LIMIT 1`,
      )
    )[0] as unknown as readonly { id: string }[];
    const futureAssignmentId = futureRows[0]?.id as string;
    expect(futureAssignmentId).toBeDefined();
    const futureBlocked = await updatePastAssignment(
      'owner-token',
      futurePeriodId as string,
      futureAssignmentId,
      { actualMembershipId: ownerMembershipId },
    );
    expect(futureBlocked.statusCode).toBe(409);
    expect(futureBlocked.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        message: expect.stringContaining('尚未过去'),
      },
    });
  });

  async function publishMonth(businessMonth: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        businessMonth,
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion,
        scheduleRoleIds: [primaryRoleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
    });
    expect(response.statusCode, response.body).toBe(200);
  }

  async function findPastPeriodId(): Promise<string | undefined> {
    const rows = (
      await client.database.execute(
        sql`SELECT id FROM schedule_periods WHERE group_id = ${groupId} AND status = 'past' AND deleted_at IS NULL LIMIT 1`,
      )
    )[0] as unknown as readonly { id: string }[];
    return rows[0]?.id;
  }

  async function findPublishedPeriodId(businessMonth: string): Promise<string | undefined> {
    const rows = (
      await client.database.execute(
        sql`SELECT id FROM schedule_periods WHERE group_id = ${groupId} AND business_month = ${businessMonth} AND status = 'published' AND deleted_at IS NULL LIMIT 1`,
      )
    )[0] as unknown as readonly { id: string }[];
    return rows[0]?.id;
  }

  function listPastPeriods(token: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/past-schedules`,
    });
  }

  function listPastAssignments(token: string, periodId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/past-schedules/${periodId}/assignments`,
    });
  }

  function updatePastAssignment(
    token: string,
    periodId: string,
    assignmentId: string,
    input: { readonly actualMembershipId?: string; readonly reason?: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: input,
      url: `/groups/${groupId}/past-schedules/${periodId}/assignments/${assignmentId}`,
    });
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

  function listGroupMembers(targetGroupId: string) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${targetGroupId}/members`,
    });
  }

  function getConfig(token: string, targetGroupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${targetGroupId}/scheduling-config`,
    });
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
      readonly startingMemberScheduleRoleId: string;
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
