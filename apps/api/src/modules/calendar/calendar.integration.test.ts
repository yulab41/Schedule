import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  SavedScheduleGeneration,
} from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  scheduleEvents,
  shiftAssignments,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { getChinaStandardTimeBusinessDate } from '@schedule/scheduling-domain';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { toCalendarChangeMarker } from './calendar-query.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

it('maps workflow event types to calendar change markers', () => {
  expect(toCalendarChangeMarker('swap_completed')).toBe('swap');
  expect(toCalendarChangeMarker('leave_cover_completed')).toBe('leave-cover');
  expect(toCalendarChangeMarker('assignment_manually_updated')).toBeUndefined();
  expect(toCalendarChangeMarker('duty_adjustment_completed')).toBe('overtime');
  expect(toCalendarChangeMarker('schedule_period_published')).toBeUndefined();
});

describeWithDatabase('current month calendar read model', () => {
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
        'outsider-token': 'cloudbase-outsider',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    await registerUser('outsider-token', 'Outside Doctor');
    groupId = await createGroup('Calendar group', '1234');
    await addRosterEntry(groupId, 'Candidate Doctor');
    await insertDirectMembership(client, { groupCode: '1234', realName: 'Candidate Doctor' });

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
    await updateRotationRule(groupId, primaryRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: role?.members[0]?.id as string,
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

  it('returns the published month with duty names, roles, shift types, and no markers', async () => {
    await savePublished('2026-08');

    const response = await readCalendar('owner-token', '2026-08');
    expect(response.statusCode).toBe(200);
    const calendar = response.json() as CalendarReadModel;
    expect(calendar.businessMonth).toBe('2026-08');
    expect(calendar.groupId).toBe(groupId);
    expect(calendar.assignments).toHaveLength(31);
    expect(calendar.roles).toEqual([{ id: primaryRoleId, name: '一线' }]);
    expect(calendar.shiftTypes[0]).toMatchObject({
      id: allDayShiftTypeId,
      isAllDay: true,
      startTime: '08:00',
      endTime: '08:00',
    });
    expect(calendar.members).toHaveLength(2);
    expect(calendar.assignments[0]).toMatchObject({
      changeMarkers: [],
      plannedMemberName: expect.any(String),
      scheduleRoleName: '一线',
      shiftTypeName: '全天班',
    });
    expect(
      calendar.assignments.every((assignment) => assignment.endsAt > assignment.startsAt),
    ).toBe(true);

    const memberResponse = await readCalendar('candidate-token', '2026-08');
    expect(memberResponse.statusCode).toBe(200);
    expect(memberResponse.json()).toEqual(calendar);
  });

  it('excludes drafts and replaced revisions from the calendar', async () => {
    const draft = await saveDraft('2026-09');
    expect((draft.json() as SavedScheduleGeneration).periods[0]).toMatchObject({
      status: 'draft',
    });
    const emptyMonth = await readCalendar('owner-token', '2026-09');
    expect(emptyMonth.statusCode).toBe(200);
    expect(emptyMonth.json()).toMatchObject({
      assignments: [],
      members: [],
      roles: [],
      shiftTypes: [],
    });

    const first = await savePublished('2026-08');
    const second = await savePublished('2026-08');
    const firstPeriodId = (first.json() as SavedScheduleGeneration).periods[0]?.id as string;
    const latestPeriodId = (second.json() as SavedScheduleGeneration).periods[0]?.id as string;
    expect(firstPeriodId).not.toBe(latestPeriodId);

    const calendar = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    expect(calendar.assignments).toHaveLength(31);
    const displayedPeriodIds = new Set(
      calendar.assignments.map((assignment) => assignment.schedulePeriodId),
    );
    expect(displayedPeriodIds.has(latestPeriodId)).toBe(true);
    expect(displayedPeriodIds.has(firstPeriodId)).toBe(false);
    expect(displayedPeriodIds.size).toBe(2);
  });

  it('rejects invalid months and users outside the group', async () => {
    const invalidMonth = await readCalendar('owner-token', '2026-8');
    expect(invalidMonth.statusCode).toBe(400);
    const missingMonth = await readCalendar('owner-token', undefined);
    expect(missingMonth.statusCode).toBe(400);

    const outsider = await readCalendar('outsider-token', '2026-08');
    expect(outsider.statusCode).toBe(403);
  });

  it('includes confirmed contacts for quick dial and omits unconfirmed numbers', async () => {
    await savePublished('2026-08');
    const contact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        confirm: true,
        mobilePhone: '13800138000',
        shortPhone: '12345',
      },
      url: `/groups/${groupId}/members/${ownerMembershipId}/contact`,
    });
    expect(contact.statusCode).toBe(200);

    const calendar = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    const ownerMember = calendar.members.find(
      (member) => member.membershipId === ownerMembershipId,
    );
    const candidateMember = calendar.members.find(
      (member) => member.membershipId === candidateMembershipId,
    );

    expect(ownerMember).toMatchObject({
      isConfirmed: true,
      mobilePhone: '13800138000',
      realName: 'Owner Doctor',
      shortPhone: '12345',
    });
    expect(candidateMember).toEqual({
      isConfirmed: false,
      membershipId: candidateMembershipId,
      realName: 'Candidate Doctor',
    });
  });

  it('resolves a visitor key and reads the selected calendar with contacts but without event markers', async () => {
    await savePublished('2026-08');
    const contact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        confirm: true,
        mobilePhone: '13800138000',
        shortPhone: '12345',
      },
      url: `/groups/${groupId}/members/${ownerMembershipId}/contact`,
    });
    expect(contact.statusCode).toBe(200);

    const visitorKey = await getVisitorKey(groupId);
    const resolve = await app.inject({
      method: 'POST',
      payload: { visitorKey },
      url: '/guest/groups/resolve',
    });
    expect(resolve.statusCode, resolve.body).toBe(200);
    expect(resolve.json()).toEqual({ groupId, groupName: 'Calendar group' });

    const response = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/calendar?businessMonth=2026-08&visitorKey=${visitorKey}`,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      groupName: 'Calendar group',
      calendar: {
        assignments: expect.any(Array),
        businessMonth: '2026-08',
      },
    });
    const body = response.json() as { calendar: CalendarReadModel };
    expect(body.calendar.assignments).toHaveLength(31);
    const ownerMember = body.calendar.members.find(
      (member) => member.membershipId === ownerMembershipId,
    );
    expect(ownerMember).toMatchObject({
      isConfirmed: true,
      mobilePhone: '13800138000',
      realName: 'Owner Doctor',
      shortPhone: '12345',
    });
    expect(
      body.calendar.assignments.every((assignment) => assignment.changeMarkers.length === 0),
    ).toBe(true);
  });

  it('hides workflow change markers from guests even when events exist', async () => {
    const saved = await savePublished('2026-08');
    const periodId = (saved.json() as SavedScheduleGeneration).periods[0]?.id as string;
    const [assignmentRow] = await client.database
      .select({ id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, periodId))
      .orderBy(sql`${shiftAssignments.businessDate}`)
      .limit(1);
    const assignmentId = assignmentRow?.id as string;

    await client.database.insert(scheduleEvents).values({
      affectedMembershipIds: [],
      affectedShiftIds: [assignmentId],
      eventStatus: 'completed',
      eventType: 'swap_completed',
      groupId,
      id: randomUUID(),
      objectId: assignmentId,
      objectType: 'shift_assignment',
      operationId: randomUUID(),
      schedulePeriodId: periodId,
    });

    const authenticated = (
      await readCalendar('owner-token', '2026-08')
    ).json() as CalendarReadModel;
    expect(
      authenticated.assignments.find((assignment) => assignment.id === assignmentId)?.changeMarkers,
    ).toEqual(['swap']);

    const visitorKey = await getVisitorKey(groupId);
    const guest = (
      await app.inject({
        method: 'GET',
        url: `/guest/groups/${groupId}/calendar?businessMonth=2026-08&visitorKey=${visitorKey}`,
      })
    ).json() as { calendar: CalendarReadModel };
    expect(
      guest.calendar.assignments.find((assignment) => assignment.id === assignmentId)
        ?.changeMarkers,
    ).toEqual([]);
  });

  it('rejects unknown visitor keys and rate limits repeated failures', async () => {
    const visitorKey = 'b'.repeat(32);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        payload: { visitorKey },
        url: '/guest/groups/resolve',
      });
      expect(response.statusCode).toBe(404);
    }

    const limited = await app.inject({
      method: 'POST',
      payload: { visitorKey },
      url: '/guest/groups/resolve',
    });
    expect(limited.statusCode).toBe(429);
  });

  it('does not reset the visitor failure budget after a valid key', async () => {
    const badVisitorKey = 'c'.repeat(32);
    await savePublished('2026-08');
    const goodVisitorKey = await getVisitorKey(groupId);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        payload: { visitorKey: badVisitorKey },
        url: '/guest/groups/resolve',
      });
      expect(response.statusCode).toBe(404);
    }

    const valid = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/calendar?businessMonth=2026-08&visitorKey=${goodVisitorKey}`,
    });
    expect(valid.statusCode, valid.body).toBe(200);

    const limited = await app.inject({
      method: 'POST',
      payload: { visitorKey: badVisitorKey },
      url: '/guest/groups/resolve',
    });
    expect(limited.statusCode).toBe(429);
  });

  it('reads the exact archived publication version as a calendar', async () => {
    const first = await savePublished('2026-08');
    await savePublished('2026-08');
    const archivedPeriodId = (first.json() as SavedScheduleGeneration).periods[0]?.id as string;

    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/calendar/periods/${archivedPeriodId}`,
    });

    expect(response.statusCode).toBe(200);
    const calendar = response.json() as CalendarReadModel;
    const today = getChinaStandardTimeBusinessDate(new Date());
    const pastDayCount = Number(today.slice(8)) - 1;
    expect(calendar.assignments).toHaveLength(31 - pastDayCount);
    expect(calendar.assignments.every((assignment) => assignment.businessDate >= today)).toBe(true);
    expect(new Set(calendar.assignments.map((assignment) => assignment.schedulePeriodId))).toEqual(
      new Set([archivedPeriodId]),
    );
  });

  it('marks assignments affected by workflow events', async () => {
    const saved = await savePublished('2026-08');
    const periodId = (saved.json() as SavedScheduleGeneration).periods[0]?.id as string;
    const [assignmentRow] = await client.database
      .select({ id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, periodId))
      .orderBy(sql`${shiftAssignments.businessDate}`)
      .limit(1);
    const assignmentId = assignmentRow?.id as string;

    await client.database.insert(scheduleEvents).values({
      affectedMembershipIds: [],
      affectedShiftIds: [assignmentId],
      eventStatus: 'completed',
      eventType: 'swap_completed',
      groupId,
      id: randomUUID(),
      objectId: assignmentId,
      objectType: 'shift_assignment',
      operationId: randomUUID(),
      schedulePeriodId: periodId,
    });

    const calendar = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    const marked = calendar.assignments.find(
      (assignment) => assignment.id === assignmentId,
    ) as CalendarDutyAssignment;
    const unmarked = calendar.assignments.find(
      (assignment) => assignment.id !== assignmentId,
    ) as CalendarDutyAssignment;

    expect(marked.changeMarkers).toEqual(['swap']);
    expect(unmarked.changeMarkers).toEqual([]);

    await client.database.insert(scheduleEvents).values({
      affectedMembershipIds: [],
      affectedShiftIds: [assignmentId],
      eventStatus: 'completed',
      eventType: 'swap_revoked',
      groupId,
      id: randomUUID(),
      objectId: assignmentId,
      objectType: 'swap_request',
      operationId: randomUUID(),
      reason: '排班变更',
      schedulePeriodId: periodId,
    });

    const restored = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    expect(
      restored.assignments.find((assignment) => assignment.id === assignmentId)?.changeMarkers,
    ).toEqual([]);
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

  async function getVisitorKey(targetGroupId: string): Promise<string> {
    const [rows] = (await client.database.execute(
      sql`SELECT visitor_key AS visitorKey FROM \`groups\` WHERE id = ${targetGroupId}`,
    )) as unknown as [{ visitorKey: string }[], unknown];
    return rows[0]?.visitorKey as string;
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

  async function savePublished(businessMonth: string) {
    const config = await getConfig('owner-token', groupId);
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        businessMonth,
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion: config.rulesVersion,
        scheduleRoleIds: [primaryRoleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
    });
  }

  async function saveDraft(businessMonth: string) {
    const config = await getConfig('owner-token', groupId);
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        businessMonth,
        operationId: randomUUID(),
        rulesVersion: config.rulesVersion,
        scheduleRoleIds: [primaryRoleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
    });
  }

  it('serves a guest-shaped calendar only to logged-in guest members', async () => {
    const guestJoin = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'POST',
      url: `/groups/${groupId}/join-guest`,
    });
    expect(guestJoin.statusCode).toBe(201);

    const guestCalendar = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'GET',
      url: `/groups/${groupId}/guest-calendar?businessMonth=2026-08`,
    });
    expect(guestCalendar.statusCode).toBe(200);
    expect(guestCalendar.json()).toMatchObject({
      groupName: 'Calendar group',
      calendar: { assignments: [], groupId },
    });

    const memberCalendar = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/guest-calendar?businessMonth=2026-08`,
    });
    expect(memberCalendar.statusCode).toBe(403);
  });

  async function readCalendar(token: string, businessMonth: string | undefined) {
    const query =
      businessMonth === undefined ? '' : `?businessMonth=${encodeURIComponent(businessMonth)}`;
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/calendar${query}`,
    });
  }
});

interface MemberResponse {
  readonly id: string;
  readonly realName: string;
}

interface SchedulingConfigResponse {
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
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
