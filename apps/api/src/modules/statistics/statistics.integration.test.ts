import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type {
  MonthStatisticsSnapshot,
  StatisticsRecalculateCheckResult,
  YearStatistics,
} from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertDirectMembership } from '@schedule/test-fixtures';
import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('statistics snapshots', () => {
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
      holidayAdminUids: new Set(['cloudbase-admin']),
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

  it('publishes month statistics with weekend/holiday mutual exclusion', async () => {
    const context = await seedMembersOnly();
    const roleId = await setupRole(context.groupId);
    await importHolidays2026();
    const rulesVersion = (await getConfig('admin-token', context.groupId)).rulesVersion;
    await generateSchedule(context.groupId, roleId, '2026-09', rulesVersion, 'published');

    const month = (
      await getMonthStatistics('a-token', context.groupId, '2026-09')
    ).json() as MonthStatisticsSnapshot;
    expect(month.version).toBeGreaterThanOrEqual(1);
    expect(month.summary.plannedCount).toBe(30);
    expect(month.summary.actualCount).toBe(30);
    expect(month.summary.weekendCount).toBe(7);
    expect(month.summary.holidayCount).toBe(1);
    const memberA = month.summary.members.find(
      (member) => member.membershipId === context.membershipIds.a,
    );
    const memberB = month.summary.members.find(
      (member) => member.membershipId === context.membershipIds.b,
    );
    expect(memberA).toMatchObject({
      plannedCount: 15,
      actualCount: 15,
      holidayCount: 1,
      weekendCount: 3,
    });
    expect(memberB).toMatchObject({
      plannedCount: 15,
      actualCount: 15,
      holidayCount: 0,
      weekendCount: 4,
    });
    expect(month.summary.byRole[0]).toMatchObject({
      plannedCount: 30,
      actualCount: 30,
      scheduleRoleName: 'Primary',
    });
  });

  it('excludes drafts and replaced revisions from official statistics', async () => {
    const context = await seedMembersOnly();
    const roleId = await setupRole(context.groupId);
    const rulesVersion = (await getConfig('admin-token', context.groupId)).rulesVersion;

    await generateSchedule(context.groupId, roleId, '2026-11', rulesVersion, 'draft');
    const draftMonth = (
      await getMonthStatistics('a-token', context.groupId, '2026-11')
    ).json() as MonthStatisticsSnapshot;
    expect(draftMonth.summary.plannedCount).toBe(0);
    expect(draftMonth.summary.actualCount).toBe(0);

    await generateSchedule(context.groupId, roleId, '2026-10', rulesVersion, 'published');
    const firstPublished = (
      await getMonthStatistics('a-token', context.groupId, '2026-10')
    ).json() as MonthStatisticsSnapshot;
    expect(firstPublished.summary.plannedCount).toBe(31);

    await generateSchedule(context.groupId, roleId, '2026-10', rulesVersion, 'published');
    const replaced = (
      await getMonthStatistics('a-token', context.groupId, '2026-10')
    ).json() as MonthStatisticsSnapshot;
    expect(replaced.summary.plannedCount).toBe(31);
    const [periodRows] = await client.database.execute(
      sql`SELECT status FROM schedule_periods WHERE business_month = '2026-10-01' ORDER BY revision`,
    );
    expect(periodRows as unknown as readonly { status: string }[]).toContainEqual({
      status: 'replaced',
    });
  });

  it('refreshes snapshots after swaps and duty adjustments with net-zero duty impact', async () => {
    const context = await seedPublishedSeptember();
    const month = (
      await getMonthStatistics('a-token', context.groupId, '2026-09')
    ).json() as MonthStatisticsSnapshot;
    const firstVersion = month.version;

    const created = (
      await createSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep1,
        operationId: randomUUID(),
        targetAssignmentId: context.assignments.bSep2,
        targetMembershipId: context.membershipIds.b,
      })
    ).json() as { id: string; version: number };
    await acceptSwap('b-token', context.groupId, created.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    await approveSwap('admin-token', context.groupId, created.id, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });

    const afterSwap = (
      await getMonthStatistics('a-token', context.groupId, '2026-09')
    ).json() as MonthStatisticsSnapshot;
    expect(afterSwap.version).toBeGreaterThan(firstVersion);
    expect(afterSwap.summary.swapCount).toBe(2);
    expect(afterSwap.summary.actualCount).toBe(30);
    const memberA = afterSwap.summary.members.find(
      (member) => member.membershipId === context.membershipIds.a,
    );
    expect(memberA).toMatchObject({ swapCount: 1, deltaCount: 0 });
    expect(memberA?.actualVsPlanned).toHaveLength(1);

    await createDirectDutyAdjustment(context.groupId, {
      coveredAssignmentId: context.assignments.aSep3,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
      reason: '补位',
    });

    const afterDuty = (
      await getMonthStatistics('a-token', context.groupId, '2026-09')
    ).json() as MonthStatisticsSnapshot;
    expect(afterDuty.summary.overtimeCount).toBe(1);
    expect(afterDuty.summary.deductionCount).toBe(1);
    expect(afterDuty.summary.netDutyAdjustment).toBe(0);
    const memberB = afterDuty.summary.members.find(
      (member) => member.membershipId === context.membershipIds.b,
    );
    expect(memberB).toMatchObject({ overtimeCount: 1, deltaCount: 1 });
  });

  it('recalculates and compares against the snapshot with a durable check record', async () => {
    const context = await seedPublishedSeptember();

    const matched = (
      await recalculateCheck('admin-token', context.groupId, '2026-09')
    ).json() as StatisticsRecalculateCheckResult;
    expect(matched.matched).toBe(true);
    expect(matched.mismatches).toEqual([]);

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET planned_membership_id = NULL,
              planned_member_name = NULL
          WHERE id = ${context.assignments.aSep1}`,
    );
    const mismatched = (
      await recalculateCheck('admin-token', context.groupId, '2026-09')
    ).json() as StatisticsRecalculateCheckResult;
    expect(mismatched.matched).toBe(false);
    expect(mismatched.mismatches.length).toBeGreaterThan(0);
    expect(mismatched.snapshotVersion).toBeGreaterThanOrEqual(1);

    const [checkRows] = await client.database.execute(
      sql`SELECT matched FROM statistics_recalc_checks ORDER BY checked_at`,
    );
    expect(checkRows as unknown as readonly { matched: number }[]).toEqual([
      { matched: 1 },
      { matched: 0 },
    ]);

    const memberRefresh = await app.inject({
      headers: { authorization: 'Bearer a-token' },
      method: 'POST',
      payload: { businessMonth: '2026-09' },
      url: `/groups/${context.groupId}/statistics/refresh`,
    });
    expect(memberRefresh.statusCode).toBe(403);
    expect(
      (
        await app.inject({
          headers: { authorization: 'Bearer a-token' },
          method: 'POST',
          payload: { businessMonth: '2026-09' },
          url: `/groups/${context.groupId}/statistics/recalculate-check`,
        })
      ).statusCode,
    ).toBe(403);
  });

  it('aggregates year statistics from month snapshots', async () => {
    const context = await seedMembersOnly();
    const roleId = await setupRole(context.groupId);
    const rulesVersion = (await getConfig('admin-token', context.groupId)).rulesVersion;
    await generateSchedule(context.groupId, roleId, '2026-09', rulesVersion, 'published');
    await generateSchedule(context.groupId, roleId, '2026-10', rulesVersion, 'published');

    const year = (
      await getYearStatistics('a-token', context.groupId, 2026)
    ).json() as YearStatistics;
    expect(year.year).toBe(2026);
    expect(year.months.filter((entry) => entry.summary.plannedCount > 0)).toHaveLength(2);
    expect(year.summary.plannedCount).toBe(30 + 31);
    expect(year.summary.actualCount).toBe(30 + 31);
    process.stdout.write(`DEBUG_MEMBERS ${JSON.stringify(year.summary.members)}\n`);
    const memberA = year.summary.members.find(
      (member) => member.membershipId === context.membershipIds.a,
    );
    expect(memberA).toMatchObject({ plannedCount: 15 + 16, actualCount: 15 + 16 });
  });

  async function seedMembersOnly(): Promise<Context> {
    const groupId = await createGroup('Statistics group', '6655');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await claimGroup('a-token', '6655', 'A Doctor');
    await claimGroup('b-token', '6655', 'B Doctor');
    const members = await listGroupMembers(groupId);
    const membershipById = new Map(members.map((member) => [member.realName, member.id]));
    return {
      assignments: {
        aSep1: '',
        aSep3: '',
        bSep2: '',
      },
      groupId,
      membershipIds: {
        a: membershipById.get('A Doctor') as string,
        b: membershipById.get('B Doctor') as string,
      },
    };
  }

  async function seedPublishedSeptember(): Promise<Context> {
    const groupId = await createGroup('Statistics schedule group', '5544');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await claimGroup('a-token', '5544', 'A Doctor');
    await claimGroup('b-token', '5544', 'B Doctor');
    const roleId = await setupRole(groupId);
    const rulesVersion = (await getConfig('admin-token', groupId)).rulesVersion;
    expect(
      (await generateSchedule(groupId, roleId, '2026-09', rulesVersion, 'published')).statusCode,
    ).toBe(200);

    const assignmentRows = (
      await client.database.execute(
        sql`SELECT id, business_date AS businessDate
            FROM shift_assignments
            WHERE business_date IN ('2026-09-01', '2026-09-02', '2026-09-03')
            ORDER BY business_date`,
      )
    )[0] as unknown as readonly { businessDate: string; id: string }[];
    const byDate = new Map(assignmentRows.map((row) => [row.businessDate, row.id]));
    const members = await listGroupMembers(groupId);
    const membershipById = new Map(members.map((member) => [member.realName, member.id]));

    return {
      assignments: {
        aSep1: byDate.get('2026-09-01') as string,
        aSep3: byDate.get('2026-09-03') as string,
        bSep2: byDate.get('2026-09-02') as string,
      },
      groupId,
      membershipIds: {
        a: membershipById.get('A Doctor') as string,
        b: membershipById.get('B Doctor') as string,
      },
    };
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

  async function importHolidays2026(): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: {
        dates: [
          { date: '2026-09-05', holidayName: '测试节假日', isOffDay: true, isWorkday: false },
        ],
        year: 2026,
      },
      url: '/holidays/import',
    });
    expect(response.statusCode).toBe(201);
    await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      url: `/holidays/versions/${(response.json() as { calendarVersionId: string }).calendarVersionId}/confirm`,
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

  async function claimGroup(token: string, groupCode: string, realName: string): Promise<void> {
    void token;
    await insertDirectMembership(client, { groupCode, realName });
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
    publishMode: 'draft' | 'published',
  ) {
    return app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: {
        businessMonth,
        operationId: randomUUID(),
        publishMode,
        rulesVersion,
        scheduleRoleIds: [roleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
    });
  }

  async function createSwap(
    token: string,
    groupId: string,
    body: {
      readonly initiatorAssignmentId: string;
      readonly operationId: string;
      readonly targetAssignmentId: string;
      readonly targetMembershipId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps`,
    });
  }

  async function acceptSwap(
    token: string,
    groupId: string,
    swapRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/${swapRequestId}/accept`,
    });
  }

  async function approveSwap(
    token: string,
    groupId: string,
    swapRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/${swapRequestId}/approve`,
    });
  }

  async function createDirectDutyAdjustment(
    groupId: string,
    body: {
      readonly coveredAssignmentId: string;
      readonly operationId: string;
      readonly overtimeMembershipId: string;
      readonly reason: string;
    },
  ) {
    const response = await app.inject({
      headers: { authorization: 'Bearer admin-token' },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/direct`,
    });
    expect(response.statusCode).toBe(201);
    return response;
  }

  async function getMonthStatistics(token: string, groupId: string, businessMonth: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/statistics?businessMonth=${businessMonth}`,
    });
  }

  async function getYearStatistics(token: string, groupId: string, year: number) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/statistics/year?year=${year}`,
    });
  }

  async function recalculateCheck(token: string, groupId: string, businessMonth: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { businessMonth },
      url: `/groups/${groupId}/statistics/recalculate-check`,
    });
  }
});

interface Context {
  readonly assignments: { readonly aSep1: string; readonly aSep3: string; readonly bSep2: string };
  readonly groupId: string;
  readonly membershipIds: { readonly a: string; readonly b: string };
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
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
