import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { ManualScheduleTemplate, ShiftType } from '@schedule/contracts';
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

describeWithDatabase('manual schedule templates', () => {
  let app: ReturnType<typeof createApp>;
  let allDayShiftTypeId: string;
  let candidateMembershipId: string;
  let client: DatabaseClient;
  let groupId: string;
  let ownerMembershipId: string;
  let primaryRoleId: string;

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
    groupId = await createGroup('Template group', '1234');
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
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('creates and lists a template with reference versions and no formal shifts', async () => {
    const created = await createTemplate({
      cells: [
        { cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId },
        { cycleDay: 2, membershipId: candidateMembershipId, shiftTypeId: allDayShiftTypeId },
      ],
      cycleDays: 7,
      membershipIds: [ownerMembershipId, candidateMembershipId],
      startDate: '2026-08-01',
    });

    expect(created.statusCode).toBe(201);
    const template = created.json() as ManualScheduleTemplate;
    expect(template).toMatchObject({
      cycleDays: 7,
      groupId,
      scheduleRoleId: primaryRoleId,
      scheduleRoleName: '一线',
      startDate: '2026-08-01',
      version: 1,
    });
    expect(template.members).toHaveLength(2);
    expect(template.members[0]).toMatchObject({
      isAvailable: true,
      isStale: false,
      memberScheduleRoleVersion: 1,
    });
    expect(template.cells).toHaveLength(2);
    expect(template.cells[0]).toMatchObject({
      isShiftTypeEnabled: true,
      isStale: false,
      shiftTypeConfigurationVersion: 1,
      shiftTypeName: '全天班',
    });

    const [periodCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_periods WHERE group_id = ${groupId}`,
    );
    const [templateCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM manual_schedule_templates WHERE group_id = ${groupId}`,
    );
    const [events] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE event_type = 'manual_schedule_template_created'`,
    );

    expect(periodCount).toEqual([{ count: 0 }]);
    expect(templateCount).toEqual([{ count: 1 }]);
    expect(events).toEqual([{ count: 1 }]);

    const list = await listTemplates();
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([template]);
  });

  it('soft-deletes a template and hides it from later lists', async () => {
    const created = await createTemplate({
      cells: [{ cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId }],
      cycleDays: 7,
      membershipIds: [ownerMembershipId],
      startDate: '2026-08-01',
    });
    expect(created.statusCode).toBe(201);
    const template = created.json() as ManualScheduleTemplate;

    const deleted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: `/groups/${groupId}/manual-schedule-templates/${template.id}`,
    });
    expect(deleted.statusCode).toBe(200);

    const list = await listTemplates();
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([]);

    const [eventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE event_type = 'manual_schedule_template_deleted' AND object_id = ${template.id}`,
    );
    expect(eventCount).toEqual([{ count: 1 }]);

    const again = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: `/groups/${groupId}/manual-schedule-templates/${template.id}`,
    });
    expect(again.statusCode).toBe(404);

    const memberDelete = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'DELETE',
      url: `/groups/${groupId}/manual-schedule-templates/${template.id}`,
    });
    expect(memberDelete.statusCode).toBe(403);
  });

  it('updates a template by replacing members and cells with the expected version', async () => {
    const created = await createTemplate({
      cells: [
        { cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId },
        { cycleDay: 2, membershipId: candidateMembershipId, shiftTypeId: allDayShiftTypeId },
      ],
      cycleDays: 7,
      membershipIds: [ownerMembershipId, candidateMembershipId],
      startDate: '2026-08-01',
    });
    const template = created.json() as ManualScheduleTemplate;

    const updated = await updateTemplate(template.id, {
      cells: [{ cycleDay: 3, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId }],
      cycleDays: 5,
      expectedVersion: template.version,
      membershipIds: [ownerMembershipId],
      startDate: '2026-09-01',
    });
    expect(updated.statusCode).toBe(200);
    const updatedTemplate = updated.json() as ManualScheduleTemplate;
    expect(updatedTemplate).toMatchObject({
      cycleDays: 5,
      startDate: '2026-09-01',
      version: 2,
    });
    expect(updatedTemplate.members).toEqual([
      expect.objectContaining({ membershipId: ownerMembershipId }),
    ]);
    expect(updatedTemplate.cells).toEqual([
      expect.objectContaining({ cycleDay: 3, membershipId: ownerMembershipId }),
    ]);

    const [activeCells] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM manual_schedule_cells WHERE template_id = ${template.id} AND deleted_at IS NULL`,
    );
    const [totalCells] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM manual_schedule_cells WHERE template_id = ${template.id}`,
    );
    expect(activeCells).toEqual([{ count: 1 }]);
    expect(totalCells).toEqual([{ count: 3 }]);

    const stale = await updateTemplate(template.id, {
      cells: [],
      cycleDays: 5,
      expectedVersion: template.version,
      membershipIds: [ownerMembershipId],
      startDate: '2026-09-01',
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        latestData: { id: template.id, version: 2 },
      },
    });
  });

  it('rejects disabled shift types, invalid cycles, duplicates, and non-role members', async () => {
    const customShift = await createEnabledShiftType();
    await disableShiftType(customShift.id);

    const disabledFill = await createTemplate({
      cells: [{ cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: customShift.id }],
      cycleDays: 7,
      membershipIds: [ownerMembershipId],
      startDate: '2026-08-01',
    });
    expect(disabledFill.statusCode).toBe(400);
    expect((disabledFill.json() as ErrorResponse).error.message).toContain('停用');

    const base = {
      cells: [{ cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId }],
      membershipIds: [ownerMembershipId],
      scheduleRoleId: primaryRoleId,
      startDate: '2026-08-01',
    };
    expect((await createTemplate({ ...base, cycleDays: 0 })).statusCode).toBe(400);
    expect(
      (
        await createTemplate({
          ...base,
          cells: [{ cycleDay: 8, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId }],
          cycleDays: 7,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await createTemplate({
          ...base,
          cells: [
            { cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId },
            { cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId },
          ],
          cycleDays: 7,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await createTemplate({
          ...base,
          cells: [{ cycleDay: 1, membershipId: randomUUID(), shiftTypeId: allDayShiftTypeId }],
          cycleDays: 7,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await createTemplate({
          ...base,
          membershipIds: [randomUUID()],
          cycleDays: 7,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await createTemplate({
          ...base,
          cycleDays: 7,
          startDate: '2026-8-1',
        })
      ).statusCode,
    ).toBe(400);
  });

  it('flags stale members and shift types in the template read model', async () => {
    const customShift = await createEnabledShiftType();
    const created = await createTemplate({
      cells: [
        { cycleDay: 1, membershipId: ownerMembershipId, shiftTypeId: allDayShiftTypeId },
        { cycleDay: 2, membershipId: candidateMembershipId, shiftTypeId: customShift.id },
      ],
      cycleDays: 7,
      membershipIds: [ownerMembershipId, candidateMembershipId],
      startDate: '2026-08-01',
    });
    const template = created.json() as ManualScheduleTemplate;

    await disableShiftType(customShift.id);
    await replaceRoleMembers(groupId, primaryRoleId, [ownerMembershipId]);

    const list = await listTemplates();
    const [stored] = list.json() as ManualScheduleTemplate[];
    expect(
      stored?.members.find((member) => member.membershipId === candidateMembershipId),
    ).toMatchObject({
      isAvailable: false,
      isStale: true,
    });
    expect(stored?.cells.find((cell) => cell.shiftTypeId === customShift.id)).toMatchObject({
      isShiftTypeEnabled: false,
      isStale: true,
    });
    expect(stored?.cells.find((cell) => cell.shiftTypeId === allDayShiftTypeId)).toMatchObject({
      isShiftTypeEnabled: true,
      isStale: false,
    });
    expect(template.id).toBe(stored?.id);
  });

  it('restricts template reads and writes to administrators', async () => {
    const body = {
      cells: [],
      cycleDays: 7,
      membershipIds: [ownerMembershipId],
      scheduleRoleId: primaryRoleId,
      startDate: '2026-08-01',
    };

    const memberList = await listTemplates('candidate-token');
    const memberCreate = await createTemplate(body, 'candidate-token');
    const outsiderList = await listTemplates('outsider-token');
    const outsiderUpdate = await updateTemplate(
      randomUUID(),
      {
        ...body,
        expectedVersion: 1,
      },
      'outsider-token',
    );

    expect(memberList.statusCode).toBe(403);
    expect(memberCreate.statusCode).toBe(403);
    expect(outsiderList.statusCode).toBe(403);
    expect(outsiderUpdate.statusCode).toBe(403);
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

  async function createTemplate(
    body: {
      readonly cells: readonly {
        readonly cycleDay: number;
        readonly membershipId: string;
        readonly shiftTypeId: string;
      }[];
      readonly cycleDays: number;
      readonly membershipIds: readonly string[];
      readonly startDate: string;
    },
    token = 'owner-token',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { ...body, scheduleRoleId: primaryRoleId },
      url: `/groups/${groupId}/manual-schedule-templates`,
    });
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
    token = 'owner-token',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { ...body, scheduleRoleId: primaryRoleId },
      url: `/groups/${groupId}/manual-schedule-templates/${templateId}`,
    });
  }

  async function listTemplates(token = 'owner-token') {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/manual-schedule-templates`,
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
