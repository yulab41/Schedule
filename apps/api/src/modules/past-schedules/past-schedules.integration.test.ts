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
import { insertDirectMembership } from '@schedule/test-fixtures';
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
    await insertDirectMembership(client, { groupCode: '1234', realName: 'Candidate Doctor' });

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
    const currentDutyMemberId = target.actualMemberId ?? target.plannedMemberId;
    const nextMemberId =
      currentDutyMemberId === ownerMembershipId ? candidateMembershipId : ownerMembershipId;

    const updated = await updatePastAssignment('owner-token', pastPeriodId, target.assignmentId, {
      actualMembershipId: nextMemberId,
      reason: '实际值班人员更正',
    });
    expect(updated.statusCode).toBe(200);
    const body = updated.json() as { readonly assignment: PastScheduleAssignment };
    expect(body.assignment.actualMemberId).toBe(nextMemberId);
    expect(body.assignment.backfillAt).toBeDefined();
    expect(body.assignment.backfillReason).toBe('实际值班人员更正');

    const [traceRows] = await client.database.execute(
      sql`SELECT backfill_at AS backfillAt FROM shift_assignments WHERE id = ${target.assignmentId}`,
    );
    expect(
      (traceRows as unknown as readonly { backfillAt: string | null }[])[0]?.backfillAt,
    ).not.toBeNull();
    const [backfillEventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE group_id = ${groupId} AND event_type = 'schedule_backfill_completed'`,
    );
    expect(backfillEventCount).toEqual([{ count: 0 }]);

    const records = (await listBackfillRecords('owner-token')).json() as readonly {
      readonly assignmentId: string;
      readonly backfilledAt: string;
      readonly operatorName: string;
    }[];
    expect(records.some((record) => record.assignmentId === target.assignmentId)).toBe(true);
    expect(records[0]?.operatorName).toBe('Owner Doctor');

    const reverted = await updatePastAssignment('owner-token', pastPeriodId, target.assignmentId, {
      actualMembershipId: target.plannedMemberId as string,
    });
    expect(reverted.statusCode).toBe(200);
    const revertedBody = reverted.json() as { readonly assignment: PastScheduleAssignment };
    expect(revertedBody.assignment.backfillAt).toBeUndefined();
    const [revertedTraceRows] = await client.database.execute(
      sql`SELECT backfill_at AS backfillAt FROM shift_assignments WHERE id = ${target.assignmentId}`,
    );
    expect(
      (revertedTraceRows as unknown as readonly { backfillAt: string | null }[])[0]?.backfillAt,
    ).toBeNull();
    const recordsAfterRevert = (await listBackfillRecords('owner-token')).json() as readonly {
      readonly assignmentId: string;
    }[];
    expect(recordsAfterRevert.some((record) => record.assignmentId === target.assignmentId)).toBe(
      false,
    );

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

  it('creates backfill assignments for months without a published schedule', async () => {
    const created = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        actualMembershipId: ownerMembershipId,
        businessDate: '2026-07-01',
        reason: '空月补录',
        scheduleRoleId: primaryRoleId,
        shiftTypeId: allDayShiftTypeId,
      },
      url: `/groups/${groupId}/past-schedules/assignments`,
    });
    expect(created.statusCode, created.body).toBe(200);
    const body = created.json() as { readonly assignment: PastScheduleAssignment };
    expect(body.assignment.businessDate).toBe('2026-07-01');
    expect(body.assignment.actualMemberId).toBe(ownerMembershipId);
    expect(body.assignment.backfillAt).toBeDefined();
    expect(body.assignment.backfillReason).toBe('空月补录');

    const [periodRows] = await client.database.execute(
      sql`SELECT status FROM schedule_periods WHERE group_id = ${groupId} AND business_month = '2026-07-01' AND deleted_at IS NULL`,
    );
    expect(
      (periodRows as unknown as readonly { status: string }[]).map((row) => row.status),
    ).toEqual(['past']);

    const [backfillEventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE group_id = ${groupId} AND event_type = 'schedule_backfill_completed'`,
    );
    expect(backfillEventCount).toEqual([{ count: 0 }]);

    const records = (await listBackfillRecords('owner-token')).json() as readonly {
      readonly assignmentId: string;
    }[];
    expect(records.some((record) => record.assignmentId === body.assignment.assignmentId)).toBe(
      true,
    );

    const periods = (await listPastPeriods('owner-token')).json() as PastSchedulePeriod[];
    expect(periods.filter((period) => period.businessMonth === '2026-07')).toHaveLength(1);

    const future = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        actualMembershipId: ownerMembershipId,
        businessDate: '2026-09-01',
        scheduleRoleId: primaryRoleId,
        shiftTypeId: allDayShiftTypeId,
      },
      url: `/groups/${groupId}/past-schedules/assignments`,
    });
    expect(future.statusCode).toBe(409);
  });

  it('auto-archives a stale completed duty adjustment when a past assignment is backfilled', async () => {
    await publishMonth('2026-08');
    const pastPeriodId = (await findPastPeriodId()) as string;
    const pastAssignments = (
      await listPastAssignments('owner-token', pastPeriodId)
    ).json() as PastScheduleAssignment[];
    const target = pastAssignments[0] as PastScheduleAssignment;
    const plannedMemberId = target.plannedMemberId as string;
    const overtimeMembershipId =
      plannedMemberId === ownerMembershipId ? candidateMembershipId : ownerMembershipId;
    const assignmentRows = (
      await client.database.execute(
        sql`SELECT version FROM shift_assignments WHERE id = ${target.assignmentId}`,
      )
    )[0] as unknown as readonly { version: number }[];
    const sequenceRows = (
      await client.database.execute(
        sql`SELECT COALESCE(MAX(workflow_sequence), 0) AS sequence
          FROM duty_adjustments`,
      )
    )[0] as unknown as readonly { sequence: number }[];
    const nextWorkflowSequence = (sequenceRows[0]?.sequence ?? 0) + 1;

    const dutyId = randomUUID();
    await client.database.execute(
      sql`INSERT INTO duty_adjustments (
          id, group_id, covered_assignment_id, overtime_membership_id,
          deducted_membership_id, assignment_version, status, workflow_sequence, decided_at
        ) VALUES (
          ${dutyId}, ${groupId}, ${target.assignmentId}, ${overtimeMembershipId},
          ${plannedMemberId}, ${assignmentRows[0]?.version ?? 1}, 'completed',
          ${nextWorkflowSequence}, NOW(3)
        )`,
    );

    const covered = await updatePastAssignment('owner-token', pastPeriodId, target.assignmentId, {
      actualMembershipId: overtimeMembershipId,
      reason: '补录为代值人员',
    });
    expect(covered.statusCode, covered.body).toBe(200);

    const reverted = await updatePastAssignment('owner-token', pastPeriodId, target.assignmentId, {
      actualMembershipId: plannedMemberId,
      reason: '改回计划人员触发自愈',
    });
    expect(reverted.statusCode, reverted.body).toBe(200);

    const adjustmentRows = (
      await client.database.execute(sql`SELECT status FROM duty_adjustments WHERE id = ${dutyId}`)
    )[0] as unknown as readonly { status: string }[];
    expect(adjustmentRows).toEqual([{ status: 'revoked' }]);

    const [revokedEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count
          FROM schedule_events
          WHERE object_id = ${dutyId} AND event_type = 'duty_adjustment_revoked'`,
    );
    expect(revokedEvents).toEqual([{ count: 1 }]);
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

  function listBackfillRecords(token: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/past-schedules/backfill-records`,
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
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
