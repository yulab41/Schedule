import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { ScheduleEventDetail, ScheduleEventPage } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  withTransaction,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { EventWriter } from './event-writer.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('schedule event center routes', () => {
  let allDayShiftTypeId: string;
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'a-token': 'cloudbase-a',
        'b-token': 'cloudbase-b',
        'outsider-token': 'cloudbase-outsider',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
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

  it('lists own-group events with pagination, member access, and outsider rejection', async () => {
    const context = await seedSwapEvents();

    const firstPageResponse = await listEvents('b-token', context.groupId, { pageSize: 2 });
    expect(firstPageResponse.statusCode).toBe(200);
    const firstPage = firstPageResponse.json() as ScheduleEventPage;
    expect(firstPage.events).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const nextCursor = firstPage.nextCursor;
    if (nextCursor === undefined) {
      throw new Error('Expected the first page to include a cursor.');
    }

    const secondPageResponse = await listEvents('b-token', context.groupId, {
      cursor: nextCursor,
      pageSize: 2,
    });
    expect(secondPageResponse.statusCode).toBe(200);
    const secondPage = secondPageResponse.json() as ScheduleEventPage;
    const firstIds = new Set(firstPage.events.map((event) => event.id));
    expect(secondPage.events).toHaveLength(2);
    expect(secondPage.events.every((event) => !firstIds.has(event.id))).toBe(true);

    expect((await listEvents('outsider-token', context.groupId, {})).statusCode).toBe(403);
    expect((await listEvents('b-token', context.groupId, { pageSize: 101 })).statusCode).toBe(400);
    expect(
      (await listEvents('b-token', context.groupId, { cursor: 'not-a-cursor' })).statusCode,
    ).toBe(400);
  });

  it('filters events by event type, membership, operator, and date range', async () => {
    const context = await seedSwapEvents();

    const byType = (
      await listEvents('b-token', context.groupId, { eventTypes: ['swap_completed'] })
    ).json() as ScheduleEventPage;
    expect(byType.events.length).toBeGreaterThanOrEqual(1);
    expect(byType.events.every((event) => event.eventType === 'swap_completed')).toBe(true);

    const byMembership = (
      await listEvents('b-token', context.groupId, { membershipId: context.membershipIds.b })
    ).json() as ScheduleEventPage;
    expect(byMembership.events.length).toBeGreaterThanOrEqual(1);
    expect(
      byMembership.events.every((event) =>
        event.affectedMembershipIds.includes(context.membershipIds.b),
      ),
    ).toBe(true);

    const byOperator = (
      await listEvents('b-token', context.groupId, { operatorUserId: context.userIds.b })
    ).json() as ScheduleEventPage;
    expect(byOperator.events.length).toBeGreaterThanOrEqual(1);
    expect(byOperator.events.every((event) => event.operatorUserId === context.userIds.b)).toBe(
      true,
    );

    const invalidRange = await listEvents('b-token', context.groupId, {
      from: '2099-01-01T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
    });
    expect(invalidRange.statusCode).toBe(400);
  });

  it('filters events by schedule role and affected shift', async () => {
    const context = await seedSwapEvents();

    const byShift = (
      await listEvents('b-token', context.groupId, { shiftId: context.assignments.aSep1 })
    ).json() as ScheduleEventPage;
    expect(byShift.events.length).toBeGreaterThanOrEqual(1);
    expect(
      byShift.events.every((event) => event.affectedShiftIds.includes(context.assignments.aSep1)),
    ).toBe(true);

    const byRole = (
      await listEvents('b-token', context.groupId, { scheduleRoleId: context.roleId })
    ).json() as ScheduleEventPage;
    const byShiftIds = new Set(byShift.events.map((event) => event.id));
    expect(byRole.events.length).toBeGreaterThanOrEqual(byShift.events.length);
    expect(byShiftIds.size > 0).toBe(true);
    expect(byRole.events.some((event) => byShiftIds.has(event.id))).toBe(true);

    const noRoleEvents = (
      await listEvents('b-token', context.groupId, { scheduleRoleId: randomUUID() })
    ).json() as ScheduleEventPage;
    expect(noRoleEvents.events).toEqual([]);
  });

  it('excludes period-level events from per-shift queries even when they list the shift', async () => {
    const context = await seedSwapEvents();
    const periodEventId = randomUUID();
    const periodRows = (
      await client.database.execute(
        sql`SELECT id FROM schedule_periods WHERE group_id = ${context.groupId} LIMIT 1`,
      )
    )[0] as unknown as readonly { id: string }[];
    const periodId = periodRows[0]?.id as string;
    await withTransaction(client, (transaction) =>
      new EventWriter().append(transaction, {
        affectedMembershipIds: [],
        affectedShiftIds: [context.assignments.aSep1],
        afterData: { businessMonth: '2026-09-01', revision: 1, status: 'draft' },
        eventStatus: 'completed',
        eventType: 'schedule_period_created',
        groupId: context.groupId,
        objectId: periodEventId,
        objectType: 'schedule_period',
        operationId: randomUUID(),
        schedulePeriodId: periodId,
      }),
    );

    const byShift = (
      await listEvents('b-token', context.groupId, { shiftId: context.assignments.aSep1 })
    ).json() as ScheduleEventPage;
    expect(byShift.events.map((event) => event.id)).not.toContain(periodEventId);
  });

  it('returns the event detail with its parent and child chain and rejects other groups', async () => {
    const context = await seedSwapEvents();
    const otherGroupId = await createGroup('Other group', '3456');
    const eventWriter = new EventWriter();
    const firstEventId = randomUUID();
    const secondEventId = randomUUID();
    const thirdEventId = randomUUID();

    await client.database.execute(
      sql`INSERT INTO schedule_events (
        id, group_id, event_type, event_status, object_type, operation_id,
        affected_membership_ids, affected_shift_ids
      ) VALUES
        (${firstEventId}, ${context.groupId}, 'schedule_role_corrected', 'completed', 'schedule_role', ${randomUUID()}, JSON_ARRAY(), JSON_ARRAY()),
        (${secondEventId}, ${context.groupId}, 'schedule_role_corrected', 'completed', 'schedule_role', ${randomUUID()}, JSON_ARRAY(), JSON_ARRAY()),
        (${thirdEventId}, ${context.groupId}, 'schedule_role_corrected', 'completed', 'schedule_role', ${randomUUID()}, JSON_ARRAY(), JSON_ARRAY())`,
    );
    await client.database.execute(
      sql`UPDATE schedule_events
          SET parent_event_id = ${firstEventId}
          WHERE id = ${secondEventId}`,
    );
    await client.database.execute(
      sql`UPDATE schedule_events
          SET parent_event_id = ${secondEventId}
          WHERE id = ${thirdEventId}`,
    );
    const otherGroupEventId = await withEventWriterInsert(eventWriter, otherGroupId, randomUUID());

    const detailResponse = await getEventDetail('b-token', context.groupId, secondEventId);
    expect(detailResponse.statusCode).toBe(200);
    const detail = detailResponse.json() as ScheduleEventDetail;
    expect(detail.event.id).toBe(secondEventId);
    expect(detail.relatedEvents.map((event) => event.id).sort()).toEqual(
      [firstEventId, thirdEventId].sort(),
    );

    expect((await getEventDetail('b-token', context.groupId, otherGroupEventId)).statusCode).toBe(
      404,
    );
    expect(
      (await getEventDetail('outsider-token', context.groupId, secondEventId)).statusCode,
    ).toBe(403);
    expect((await getEventDetail('b-token', context.groupId, randomUUID())).statusCode).toBe(404);
  });

  it('rejects queries with too many event types or malformed timestamps', async () => {
    const context = await seedSwapEvents();
    const tooManyTypes = Array.from({ length: 21 }, (_, index) => `type_${index}`);

    expect(
      (await listEvents('b-token', context.groupId, { eventTypes: tooManyTypes })).statusCode,
    ).toBe(400);
    expect(
      (await listEvents('b-token', context.groupId, { from: 'not-a-timestamp' })).statusCode,
    ).toBe(400);
    expect(
      (await listEvents('b-token', context.groupId, { to: 'not-a-timestamp' })).statusCode,
    ).toBe(400);
  });

  async function seedSwapEvents(): Promise<Context> {
    const groupId = await createGroup('Events group', '5678');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    for (const [token] of [
      ['a-token', 'A Doctor'],
      ['b-token', 'B Doctor'],
    ] as const) {
      await claimGroup(token, '5678');
    }

    const config = await getConfig('owner-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    expect(allDayShift).toBeDefined();
    allDayShiftTypeId = allDayShift?.id as string;
    const roleId = await createRole(groupId, '一线');
    const members = await listGroupMembers(groupId);
    const membershipById = new Map(members.map((member) => [member.realName, member.id]));
    const membershipIds = {
      a: membershipById.get('A Doctor') as string,
      b: membershipById.get('B Doctor') as string,
    };
    expect(membershipIds.a).toBeDefined();
    expect(membershipIds.b).toBeDefined();
    await replaceRoleMembers(groupId, roleId, [membershipIds.a, membershipIds.b]);
    const roleConfig = (await getConfig('owner-token', groupId)).roles.find(
      (role) => role.id === roleId,
    );
    const startingMemberScheduleRoleId = roleConfig?.members.find(
      (member) => member.realName === 'A Doctor',
    )?.id;
    expect(startingMemberScheduleRoleId).toBeDefined();
    await updateRotationRule(groupId, roleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-09-01',
      startingMemberScheduleRoleId: startingMemberScheduleRoleId as string,
    });
    const rulesVersion = (await getConfig('owner-token', groupId)).rulesVersion;
    expect((await generatePublished(groupId, roleId, rulesVersion)).statusCode).toBe(200);

    const assignmentRows = (
      await client.database.execute(
        sql`SELECT id, business_date AS businessDate
            FROM shift_assignments
            WHERE business_date IN ('2026-09-01', '2026-09-02')
            ORDER BY business_date`,
      )
    )[0] as unknown as readonly { businessDate: string; id: string }[];
    const byDate = new Map(assignmentRows.map((row) => [row.businessDate, row.id]));
    const aSep1 = byDate.get('2026-09-01') as string;
    const bSep2 = byDate.get('2026-09-02') as string;
    expect(aSep1).toBeDefined();
    expect(bSep2).toBeDefined();
    expect(
      (
        await app.inject({
          headers: { authorization: 'Bearer b-token' },
          method: 'PUT',
          payload: { autoAcceptSwaps: false },
          url: `/groups/${groupId}/swaps/my-settings`,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          headers: { authorization: 'Bearer owner-token' },
          method: 'PUT',
          payload: { requiresApproval: true },
          url: `/groups/${groupId}/swaps/settings`,
        })
      ).statusCode,
    ).toBe(200);

    const created = (
      await createSwap('a-token', groupId, {
        initiatorAssignmentId: aSep1,
        operationId: randomUUID(),
        targetAssignmentId: bSep2,
        targetMembershipId: membershipIds.b,
      })
    ).json() as { id: string; version: number };
    await acceptSwap('b-token', groupId, created.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    await approveSwap('owner-token', groupId, created.id, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });

    const userIdRows = (
      await client.database.execute(sql`SELECT id, cloudbase_uid AS cloudbaseUid FROM users`)
    )[0] as unknown as readonly { cloudbaseUid: string; id: string }[];
    const userIds = {
      a: userIdRows.find((row) => row.cloudbaseUid === 'cloudbase-a')?.id as string,
      b: userIdRows.find((row) => row.cloudbaseUid === 'cloudbase-b')?.id as string,
    };

    return {
      assignments: { aSep1, bSep2 },
      groupId,
      membershipIds,
      roleId,
      userIds,
    };
  }

  async function withEventWriterInsert(
    eventWriter: EventWriter,
    groupId: string,
    operationId: string,
  ): Promise<string> {
    return withTransaction(client, (transaction) =>
      eventWriter.append(transaction, {
        affectedMembershipIds: [],
        affectedShiftIds: [],
        eventStatus: 'completed',
        eventType: 'schedule_role_changed',
        groupId,
        objectType: 'schedule_role',
        operationId,
      }),
    );
  }

  async function listEvents(
    token: string,
    groupId: string,
    query: {
      readonly cursor?: string;
      readonly eventTypes?: readonly string[];
      readonly from?: string;
      readonly membershipId?: string;
      readonly operatorUserId?: string;
      readonly pageSize?: number;
      readonly scheduleRoleId?: string;
      readonly shiftId?: string;
      readonly to?: string;
    },
  ) {
    const params = new URLSearchParams();
    if (query.cursor !== undefined) {
      params.set('cursor', query.cursor);
    }
    if (query.eventTypes !== undefined && query.eventTypes.length > 0) {
      params.set('eventTypes', query.eventTypes.join(','));
    }
    if (query.from !== undefined) {
      params.set('from', query.from);
    }
    if (query.membershipId !== undefined) {
      params.set('membershipId', query.membershipId);
    }
    if (query.operatorUserId !== undefined) {
      params.set('operatorUserId', query.operatorUserId);
    }
    if (query.pageSize !== undefined) {
      params.set('pageSize', String(query.pageSize));
    }
    if (query.scheduleRoleId !== undefined) {
      params.set('scheduleRoleId', query.scheduleRoleId);
    }
    if (query.shiftId !== undefined) {
      params.set('shiftId', query.shiftId);
    }
    if (query.to !== undefined) {
      params.set('to', query.to);
    }
    const queryString = params.toString();
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/events${queryString === '' ? '' : `?${queryString}`}`,
    });
  }

  async function getEventDetail(token: string, groupId: string, eventId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/events/${eventId}`,
    });
  }

  async function generatePublished(groupId: string, roleId: string, rulesVersion: number) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        businessMonth: '2026-09',
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion,
        scheduleRoleIds: [roleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
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

  async function addRosterEntry(groupId: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
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
      headers: { authorization: 'Bearer owner-token' },
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
      headers: { authorization: 'Bearer owner-token' },
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
      headers: { authorization: 'Bearer owner-token' },
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
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload,
      url: `/groups/${groupId}/schedule-roles/${roleId}/rotation-rule`,
    });

    expect(response.statusCode).toBe(200);
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
});

interface Context {
  readonly assignments: { readonly aSep1: string; readonly bSep2: string };
  readonly groupId: string;
  readonly membershipIds: { readonly a: string; readonly b: string };
  readonly roleId: string;
  readonly userIds: { readonly a: string; readonly b: string };
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
