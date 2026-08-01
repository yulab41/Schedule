import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { ManualApplyPreview, ShiftType } from '@schedule/contracts';
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

describeWithDatabase('manual schedule template apply', () => {
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
    groupId = await createGroup('Apply group', '1234');
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

  it('previews a single cycle without persisting any period', async () => {
    const templateId = await createTemplate();

    const preview = await applyPreview(templateId, { expectedRulesVersion: rulesVersion });
    expect(preview.statusCode).toBe(200);
    const body = preview.json() as ManualApplyPreview;
    expect(body).toMatchObject({
      applyEndDate: '2026-08-07',
      applyStartDate: '2026-08-01',
      cycleDays: 7,
      rulesVersion,
      scheduleRoleId: primaryRoleId,
      scheduleRoleName: '一线',
      templateId,
      templateVersion: 1,
    });
    expect(body.assignments.map((assignment) => assignment.businessDate)).toEqual([
      '2026-08-01',
      '2026-08-02',
    ]);
    expect(body.assignments[0]).toMatchObject({
      plannedMemberId: ownerMembershipId,
      plannedMemberName: 'Owner Doctor',
      scheduleRoleId: primaryRoleId,
      shiftTypeId: allDayShiftTypeId,
      slotPosition: 1,
    });
    expect(body.conflicts).toEqual([]);
    expect(body.vacancies).toEqual([]);
    expect(body.statistics).toMatchObject({
      assignmentCount: 2,
      countedAssignmentCount: 2,
      vacancyCount: 0,
    });

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    const [applyEventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE group_id = ${groupId} AND event_type = 'manual_schedule_template_applied'`,
    );
    expect(periodCount).toEqual([{ count: 0 }]);
    expect(applyEventCount).toEqual([{ count: 0 }]);
  });

  it('repeats the cycle and truncates at the requested end date', async () => {
    const templateId = await createTemplate();

    const preview = await applyPreview(templateId, {
      endDate: '2026-09-05',
      expectedRulesVersion: rulesVersion,
    });
    const body = preview.json() as ManualApplyPreview;

    expect(body.applyEndDate).toBe('2026-09-05');
    expect(body.assignments.map((assignment) => assignment.businessDate)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-08',
      '2026-08-09',
      '2026-08-15',
      '2026-08-16',
      '2026-08-22',
      '2026-08-23',
      '2026-08-29',
      '2026-08-30',
      '2026-09-05',
    ]);
    expect(body.statistics.assignmentCount).toBe(11);
    expect(body.assignments.some((assignment) => assignment.businessDate === '2026-09-06')).toBe(
      false,
    );
  });

  it('saves a draft under the default draft publish mode without touching the published version', async () => {
    const templateId = await createTemplate();
    const first = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
      publishMode: 'published',
    });
    expect(first.statusCode).toBe(200);

    const second = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
    });
    expect(second.statusCode).toBe(200);
    const saved = second.json() as {
      readonly periods: readonly { readonly businessMonth: string; readonly status: string }[];
      readonly publishMode: string;
      readonly status: string;
    };
    expect(saved.publishMode).toBe('draft');
    expect(saved.status).toBe('draft');
    expect(saved.periods).toEqual([
      expect.objectContaining({ businessMonth: '2026-08-01', status: 'draft' }),
    ]);

    const [publishedCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId} AND business_month = '2026-08-01' AND status = 'published'`,
    );
    const [draftCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId} AND business_month = '2026-08-01' AND status = 'draft'`,
    );
    expect(publishedCount).toEqual([{ count: 1 }]);
    expect(draftCount).toEqual([{ count: 1 }]);
  });

  it('publishes immediately when the group publish mode is published and replaces the prior version', async () => {
    const templateId = await createTemplate();
    await updatePublishMode('published');

    const first = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
    });
    expect(first.statusCode).toBe(200);
    const second = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
    });
    expect(second.statusCode).toBe(200);

    const [statuses] = await client.database.execute<{ status: string; revision: number }>(
      sql`SELECT status, revision FROM schedule_periods WHERE group_id = ${groupId} AND business_month = '2026-08-01' ORDER BY revision`,
    );
    expect(statuses).toEqual([
      { revision: 1, status: 'replaced' },
      { revision: 2, status: 'published' },
    ]);
    const [replacementEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE group_id = ${groupId} AND event_type = 'schedule_period_replaced'`,
    );
    expect(replacementEvents).toEqual([{ count: 1 }]);
  });

  it('records template version and scope events for every applied month', async () => {
    const templateId = await createTemplate();
    const response = await applyTemplate(templateId, {
      endDate: '2026-09-05',
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
    });
    expect(response.statusCode).toBe(200);

    const events = (
      await client.database.execute(
        sql`SELECT after_data AS afterData FROM schedule_events WHERE group_id = ${groupId} AND event_type = 'manual_schedule_template_applied' ORDER BY occurred_at`,
      )
    )[0] as unknown as readonly {
      afterData: {
        readonly applyEndDate: string;
        readonly applyStartDate: string;
        readonly businessMonth: string;
        readonly cycleDays: number;
        readonly publishMode: string;
        readonly rulesVersion: number;
        readonly templateId: string;
        readonly templateVersion: number;
      };
    }[];
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.afterData.businessMonth).sort()).toEqual([
      '2026-08',
      '2026-09',
    ]);
    expect(events[0]?.afterData).toMatchObject({
      applyEndDate: '2026-09-05',
      applyStartDate: '2026-08-01',
      cycleDays: 7,
      publishMode: 'draft',
      rulesVersion,
      templateId,
      templateVersion: 1,
    });
  });

  it('rejects stale rules versions with the latest rules version', async () => {
    const templateId = await createTemplate();
    await changeShiftTypeColor();
    const nextConfig = await getConfig('owner-token', groupId);

    const stale = await applyPreview(templateId, {
      expectedRulesVersion: rulesVersion,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        latestData: { rulesVersion: nextConfig.rulesVersion },
      },
    });
  });

  it('turns left members into vacancies and blocks unacknowledged publication', async () => {
    const templateId = await createTemplate();
    await replaceRoleMembers(groupId, primaryRoleId, [ownerMembershipId]);
    rulesVersion = (await getConfig('owner-token', groupId)).rulesVersion;

    const preview = await applyPreview(templateId, { expectedRulesVersion: rulesVersion });
    expect(preview.statusCode).toBe(200);
    const previewBody = preview.json() as ManualApplyPreview;
    expect(previewBody.vacancies).toHaveLength(1);
    expect(previewBody.vacancies[0]).toMatchObject({
      businessDate: '2026-08-02',
      code: 'NO_ELIGIBLE_MEMBER',
      scheduleRoleId: primaryRoleId,
      slotPosition: 1,
    });

    const blocked = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
      publishMode: 'published',
    });
    expect(blocked.statusCode).toBe(409);
    const latestData = (blocked.json() as ErrorResponse).error.latestData as {
      readonly preview: ManualApplyPreview;
    };
    expect(latestData.preview.vacancies).toHaveLength(1);

    const acknowledged = await applyTemplate(templateId, {
      acknowledgeBlockers: true,
      expectedRulesVersion: rulesVersion,
      operationId: randomUUID(),
      publishMode: 'published',
    });
    expect(acknowledged.statusCode).toBe(200);
    const [publishedCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId} AND business_month = '2026-08-01' AND status = 'published'`,
    );
    expect(publishedCount).toEqual([{ count: 1 }]);
  });

  it('rejects templates that reference a disabled shift type', async () => {
    const customShift = await createEnabledShiftType();
    const templateId = await createTemplate([
      { cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId },
      { cycleDay: 2, membershipId: candidateMembershipId, shiftTypeId: customShift.id },
    ]);
    await disableShiftType(customShift.id);
    rulesVersion = (await getConfig('owner-token', groupId)).rulesVersion;

    const preview = await applyPreview(templateId, { expectedRulesVersion: rulesVersion });
    expect(preview.statusCode).toBe(400);
    expect((preview.json() as ErrorResponse).error.message).toContain('停用');
  });

  it('replays the same operation id without creating duplicates', async () => {
    const templateId = await createTemplate();
    const operationId = randomUUID();

    const first = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId,
    });
    expect(first.statusCode).toBe(200);
    const replay = await applyTemplate(templateId, {
      expectedRulesVersion: rulesVersion,
      operationId,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    const [eventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE event_type = 'manual_schedule_template_applied'`,
    );
    expect(periodCount).toEqual([{ count: 1 }]);
    expect(eventCount).toEqual([{ count: 1 }]);
  });

  it('restricts preview and apply to administrators', async () => {
    const templateId = await createTemplate();
    const body = { expectedRulesVersion: rulesVersion };

    expect((await applyPreview(templateId, body, 'candidate-token')).statusCode).toBe(403);
    expect((await applyPreview(templateId, body, 'outsider-token')).statusCode).toBe(403);
    expect(
      (
        await applyTemplate(
          templateId,
          {
            expectedRulesVersion: rulesVersion,
            operationId: randomUUID(),
          },
          'candidate-token',
        )
      ).statusCode,
    ).toBe(403);
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

  async function createTemplate(
    cells: readonly {
      readonly cycleDay: number;
      readonly membershipId: string;
      readonly shiftTypeId: string;
    }[] = [
      { cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId },
      { cycleDay: 2, membershipId: candidateMembershipId, shiftTypeId: allDayShiftTypeId },
    ],
  ): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        cells,
        cycleDays: 7,
        membershipIds: [ownerMembershipId, candidateMembershipId],
        scheduleRoleId: primaryRoleId,
        startDate: '2026-08-01',
      },
      url: `/groups/${groupId}/manual-schedule-templates`,
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function applyPreview(
    templateId: string,
    body: { readonly endDate?: string; readonly expectedRulesVersion: number },
    token = 'owner-token',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/manual-schedule-templates/${templateId}/apply-preview`,
    });
  }

  async function applyTemplate(
    templateId: string,
    body: {
      readonly acknowledgeBlockers?: boolean;
      readonly endDate?: string;
      readonly expectedRulesVersion: number;
      readonly operationId: string;
      readonly publishMode?: 'draft' | 'published';
    },
    token = 'owner-token',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/manual-schedule-templates/${templateId}/apply`,
    });
  }

  async function updatePublishMode(publishMode: 'draft' | 'published'): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { publishMode },
      url: `/groups/${groupId}/schedule-publish-mode`,
    });

    expect(response.statusCode).toBe(200);
  }

  async function createEnabledShiftType(): Promise<ShiftType> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        abbreviation: '白',
        color: '#0F766E',
        countsTowardStatistics: true,
        crossesMidnight: false,
        endTime: '18:00',
        isEnabled: true,
        name: '白班',
        startTime: '09:00',
      },
      url: `/groups/${groupId}/shift-types`,
    });

    expect(response.statusCode).toBe(201);
    return response.json() as ShiftType;
  }

  async function disableShiftType(shiftTypeId: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: '白',
        color: '#0F766E',
        countsTowardStatistics: true,
        crossesMidnight: false,
        endTime: '18:00',
        isEnabled: false,
        name: '白班',
        startTime: '09:00',
      },
      url: `/groups/${groupId}/shift-types/${shiftTypeId}`,
    });

    expect(response.statusCode).toBe(200);
  }

  async function changeShiftTypeColor(): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: '全',
        color: '#1E3A8A',
        countsTowardStatistics: true,
        crossesMidnight: true,
        endTime: '08:00',
        isEnabled: true,
        name: '全天班',
        startTime: '08:00',
      },
      url: `/groups/${groupId}/shift-types/${allDayShiftTypeId}`,
    });

    expect(response.statusCode).toBe(200);
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
    readonly latestData?: unknown;
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
