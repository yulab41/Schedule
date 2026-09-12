import {
  createScheduleFixture,
  configureScheduleFixture,
  type FixtureScheduleResult,
} from '../../test-support/schedule-fixture.js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { CalendarDutyAssignment, CalendarReadModel } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  groups,
  leaveRequests,
  migrateDatabase,
  scheduleEvents,
  shiftAssignments,
  shiftTypes,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { getChinaStandardTimeBusinessDate } from '@schedule/scheduling-domain';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { toCalendarChangeMarker } from './calendar-query.js';
import { inspectVisitorLink, setVisitorLink } from '../groups/visitor-link-operations.js';
import { GroupRecycleJob } from '../../jobs/group-recycle.js';

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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));
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
    app.addHook('preValidation', (request, _reply, done) => {
      if (
        (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') &&
        request.headers['idempotency-key'] === undefined
      ) {
        request.headers['idempotency-key'] = randomUUID();
      }
      done();
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    await registerUser('outsider-token', 'Outside Doctor');
    groupId = await createGroup('Calendar group', '1234');
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
    await configureFixturePattern(groupId, primaryRoleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: role?.members[0]?.id as string,
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

  it('reads only validated group display settings for linked guests and revokes access live', async () => {
    const linkedGroupId = await linkOutsiderGroup();
    const read = () =>
      app.inject({
        method: 'GET',
        headers: { authorization: 'Bearer outsider-token' },
        url: `/groups/${groupId}/guest-calendar/display-settings`,
      });
    const shiftId = allDayShiftTypeId;
    await client.database
      .update(groups)
      .set({ defaultMonthShiftTypeId: shiftId })
      .where(eq(groups.id, groupId));
    const result = await read();
    expect(result.statusCode).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.json()).toEqual({ groupId, groupDefaultMonthShiftTypeId: shiftId });
    await client.database.execute(sql`UPDATE shift_types SET is_enabled=0 WHERE id=${shiftId}`);
    expect((await read()).json()).toEqual({ groupId, groupDefaultMonthShiftTypeId: null });
    const [foreignShift] = await client.database
      .select({ id: shiftTypes.id })
      .from(shiftTypes)
      .where(eq(shiftTypes.groupId, linkedGroupId))
      .limit(1);
    await client.database
      .update(groups)
      .set({ defaultMonthShiftTypeId: foreignShift!.id })
      .where(eq(groups.id, groupId));
    expect((await read()).json()).toEqual({ groupId, groupDefaultMonthShiftTypeId: null });
    await client.database.execute(sql`UPDATE group_visitor_links SET is_enabled=0`);
    expect((await read()).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/groups/${groupId}/guest-calendar/display-settings`,
        })
      ).statusCode,
    ).toBe(401);
  });

  it('gives linked and anonymous visitors the member calendar and scoped paginated events', async () => {
    await savePublished('2026-08');
    const linkedGroupId = await linkOutsiderGroup();
    const contact = await app.inject({
      method: 'PUT',
      url: `/groups/${groupId}/members/${ownerMembershipId}/contact`,
      headers: { authorization: 'Bearer owner-token' },
      payload: { expectedVersion: 0, mobilePhone: '13800138000', shortPhone: '12345' },
    });
    expect(contact.statusCode).toBe(200);
    const member = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    const shiftId = member.assignments[0]!.id;
    const expected = (await readCalendar('owner-token', '2026-08')).json();
    expect((await linkedCalendar()).json().calendar).toEqual(expected);
    const key = await getVisitorKey(groupId);
    const anonymous = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/calendar?businessMonth=2026-08&visitorKey=${key}`,
    });
    expect(anonymous.json().calendar).toEqual(expected);
    expect(anonymous.headers['cache-control']).toBe('no-store');
    expect((await linkedCalendar()).headers['cache-control']).toBe('no-store');
    for (let index = 0; index < 3; index++) {
      await client.database.insert(scheduleEvents).values({
        id: randomUUID(),
        groupId,
        affectedShiftIds: [shiftId],
        affectedMembershipIds: [],
        eventStatus: 'completed',
        eventType: 'swap_completed',
        objectId: shiftId,
        objectType: 'shift_assignment',
        operationId: randomUUID(),
      });
    }
    const base = `/groups/${groupId}/guest-calendar/shifts/${shiftId}/events`;
    const headers = { authorization: 'Bearer outsider-token' };
    const first = await app.inject({ method: 'GET', url: base + '?pageSize=2', headers });
    expect(first.statusCode, first.body).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.json().events).toHaveLength(2);
    const second = await app.inject({
      method: 'GET',
      url: base + `?pageSize=2&cursor=${encodeURIComponent(first.json().nextCursor)}`,
      headers,
    });
    expect(second.json().events).toHaveLength(1);
    const publicEvents = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/calendar/shifts/${shiftId}/events?visitorKey=${key}`,
    });
    expect(publicEvents.statusCode, publicEvents.body).toBe(200);
    expect(publicEvents.json().events).toHaveLength(3);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/groups/${groupId}/events?shiftId=${shiftId}`,
          headers,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'GET', url: base.replace(shiftId, randomUUID()), headers }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/guest/groups/${groupId}/calendar/shifts/${shiftId}/events?visitorKey=${'0'.repeat(32)}`,
        })
      ).statusCode,
    ).not.toBe(200);
    const memberEvents = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/events?shiftId=${shiftId}`,
      headers: { authorization: 'Bearer owner-token' },
    });
    expect(publicEvents.json()).toEqual(memberEvents.json());
    const crossGroup = await app.inject({
      method: 'GET',
      url: `/guest/groups/${linkedGroupId}/calendar/shifts/${shiftId}/events?visitorKey=${await getVisitorKey(linkedGroupId)}`,
    });
    expect(crossGroup.statusCode).toBe(404);
    const periodId = member.assignments[0]!.schedulePeriodId;
    await client.database.execute(
      sql`UPDATE schedule_periods SET status='draft' WHERE id=${periodId}`,
    );
    expect((await app.inject({ method: 'GET', url: base, headers })).statusCode).toBe(404);
    await client.database.execute(
      sql`UPDATE schedule_periods SET status='past' WHERE id=${periodId}`,
    );
    expect((await app.inject({ method: 'GET', url: base, headers })).statusCode).toBe(200);
    await client.database.execute(sql`UPDATE group_visitor_links SET is_enabled=0`);
    expect((await app.inject({ method: 'GET', url: base, headers })).statusCode).toBe(403);
    await client.database.execute(sql`UPDATE group_visitor_links SET is_enabled=1`);
    const revoke = await app.inject({
      method: 'PUT',
      url: `/groups/${groupId}/mobile-phone-consent`,
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        consented: false,
        expectedContactVersion: contact.json().version,
        noticeVersion: 'v1',
      },
    });
    expect(revoke.statusCode, revoke.body).toBe(200);
    const withdrawn = (await readCalendar('owner-token', '2026-08')).json();
    expect(
      withdrawn.members.find(
        (value: { membershipId: string }) => value.membershipId === ownerMembershipId,
      ),
    ).not.toHaveProperty('mobilePhone');
    expect((await linkedCalendar()).json().calendar).toEqual(withdrawn);
    const withdrawnGuest = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/calendar?businessMonth=2026-08&visitorKey=${key}`,
    });
    expect(withdrawnGuest.json().calendar).toEqual(withdrawn);
    await client.database.execute(
      sql`UPDATE shift_assignments SET deleted_at=NOW() WHERE id=${shiftId}`,
    );
    expect((await app.inject({ method: 'GET', url: base, headers })).statusCode).toBe(404);
  });

  it('audits historic backfill differences without calling them ghost assignments', async () => {
    const published = await savePublished('2026-08');
    expect(published.statusCode, published.body).toBe(200);
    const auditSql = await readFile(
      new URL('../../../../../scripts/audit-calendar-changes.sql', import.meta.url),
      'utf8',
    );
    expect((await client.database.execute(sql.raw(auditSql)))[0]).toEqual([]);
    await client.database.execute(
      sql`UPDATE shift_assignments SET planned_membership_id=NULL, planned_member_name=NULL, actual_membership_id=${ownerMembershipId}, actual_member_name='Synthetic member', backfill_at='2026-08-01 00:00:00', starts_at=starts_at WHERE business_date='2026-08-08'`,
    );
    const [rows] = await client.database.execute(sql.raw(auditSql));
    const results = rows as unknown as readonly Record<string, unknown>[];
    expect(results).toHaveLength(1);
    const result = results[0] ?? {};
    expect(Number(result.difference_without_timeline)).toBe(1);
    expect(Number(result.difference_with_backfill)).toBe(1);
    expect(Number(result.actual_only_snapshot)).toBe(1);
    expect(Number(result.unexplained_snapshot_difference)).toBe(0);
    expect(Object.keys(result).some((key) => /name|phone|membership/i.test(key))).toBe(false);
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

  it('uses current shift colours for published assignments without rewriting their snapshots', async () => {
    await savePublished('2026-08');
    const before = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    await client.database
      .update(shiftTypes)
      .set({ color: '#123456', textColor: '#FFFFFF' })
      .where(eq(shiftTypes.id, allDayShiftTypeId));
    const after = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    expect(after.assignments[0]?.shiftTypeColor).toBe('#123456');
    expect(after.shiftTypes[0]?.color).toBe('#123456');
    const [snapshot] = await client.database
      .select()
      .from(shiftAssignments)
      .where(eq(shiftAssignments.id, before.assignments[0]!.id));
    expect(snapshot?.shiftTypeColor).toBe(before.assignments[0]?.shiftTypeColor);
  });

  it('uses the current abbreviation for every snapshot and preserves assignment history', async () => {
    await savePublished('2026-08');
    const before = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    await client.database
      .update(shiftAssignments)
      .set({ shiftTypeAbbreviation: '旧' })
      .where(eq(shiftAssignments.id, before.assignments[0]!.id));
    const snapshots = await client.database.select().from(shiftAssignments);
    await client.database
      .update(shiftTypes)
      .set({ abbreviation: '全天' })
      .where(eq(shiftTypes.id, allDayShiftTypeId));
    for (const token of ['owner-token', 'candidate-token']) {
      const after = (await readCalendar(token, '2026-08')).json() as CalendarReadModel;
      expect(after.assignments.length).toBeGreaterThan(1);
      expect(after.assignments.every((row) => row.shiftTypeAbbreviation === '全天')).toBe(true);
      expect(after.shiftTypes[0]?.abbreviation).toBe('全天');
      expect(after.assignments.map((row) => ({ ...row, shiftTypeAbbreviation: '' }))).toEqual(
        before.assignments.map((row) => ({ ...row, shiftTypeAbbreviation: '' })),
      );
    }
    expect(await client.database.select().from(shiftAssignments)).toEqual(snapshots);
  });

  it('retains snapshot abbreviations when the configured shift has been deleted', async () => {
    await savePublished('2026-08');
    const before = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    await client.database
      .update(shiftTypes)
      .set({ abbreviation: '新', deletedAt: new Date() })
      .where(eq(shiftTypes.id, allDayShiftTypeId));
    const after = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    expect(after.assignments).toEqual(before.assignments);
    expect(after.shiftTypes).toEqual(before.shiftTypes);
  });

  it('suggests the next date after the last published duty rather than a gap or a draft', async () => {
    const route = `/groups/${groupId}/manual-schedule-start-date/${primaryRoleId}`;
    expect(
      (
        await app.inject({
          method: 'GET',
          url: route,
          headers: { authorization: 'Bearer owner-token' },
        })
      ).json(),
    ).toEqual({ startDate: '2026-08-01' });
    await savePublished('2026-10');
    await saveDraft('2026-11');
    expect(
      (
        await app.inject({
          method: 'GET',
          url: route,
          headers: { authorization: 'Bearer owner-token' },
        })
      ).json(),
    ).toEqual({ startDate: '2026-11-01' });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: route,
          headers: { authorization: 'Bearer outsider-token' },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('excludes drafts and replaced revisions from the calendar', async () => {
    const draft = await saveDraft('2026-09');
    expect((draft.json() as FixtureScheduleResult).periods[0]).toMatchObject({
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
    vi.setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
    const second = await savePublished('2026-08');
    const firstPeriodId = (first.json() as FixtureScheduleResult).periods[0]?.id as string;
    const latestPeriodId = (second.json() as FixtureScheduleResult).periods[0]?.id as string;
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
        expectedVersion: 0,
        isConfirmed: true,
        mobilePhone: '13800138000',
        shortPhone: '12345',
      },
      url: `/groups/${groupId}/members/${ownerMembershipId}/contact`,
    });
    expect(contact.statusCode).toBe(200);
    const operationId = randomUUID();
    const consent = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': operationId,
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: (contact.json() as { version: number }).version,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(consent.statusCode, consent.body).toBe(200);

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

  it('shows member mobile phones by default, supports explicit control, and applies the same visibility to valid guests', async () => {
    await savePublished('2026-08');
    const saved = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13900139000', shortPhone: '67890' },
      url: `/groups/${groupId}/members/${candidateMembershipId}/contact`,
    });
    expect(saved.statusCode, saved.body).toBe(200);
    const contactVersion = (saved.json() as { version: number }).version;
    const verified = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: contactVersion, isConfirmed: true },
      url: `/groups/${groupId}/members/${candidateMembershipId}/contact`,
    });
    expect(verified.statusCode, verified.body).toBe(200);

    const beforeConsent = (
      await readCalendar('owner-token', '2026-08')
    ).json() as CalendarReadModel;
    expect(
      beforeConsent.members.find((member) => member.membershipId === candidateMembershipId),
    ).toEqual({
      isConfirmed: true,
      membershipId: candidateMembershipId,
      mobilePhone: '13900139000',
      realName: 'Candidate Doctor',
      shortPhone: '67890',
    });

    const operationId = randomUUID();
    const granted = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': operationId,
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: contactVersion + 1,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(granted.statusCode, granted.body).toBe(200);
    const afterConsent = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    expect(
      afterConsent.members.find((member) => member.membershipId === candidateMembershipId),
    ).toMatchObject({ mobilePhone: '13900139000', shortPhone: '67890' });

    const visitorKey = await getVisitorKey(groupId);
    const guestResponse = await app.inject({
      method: 'GET',
      url: `/guest/groups/${groupId}/calendar?businessMonth=2026-08&visitorKey=${visitorKey}`,
    });
    expect(guestResponse.statusCode, guestResponse.body).toBe(200);
    expect(
      (guestResponse.json() as { calendar: CalendarReadModel }).calendar.members.find(
        (member) => member.membershipId === candidateMembershipId,
      ),
    ).toEqual({
      isConfirmed: true,
      membershipId: candidateMembershipId,
      realName: 'Candidate Doctor',
      shortPhone: '67890',
      mobilePhone: '13900139000',
    });
  });

  it('resolves a visitor key and returns the same visible contacts as members', async () => {
    await savePublished('2026-08');
    const contact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedVersion: 0,
        isConfirmed: true,
        mobilePhone: '13800138000',
        shortPhone: '12345',
      },
      url: `/groups/${groupId}/members/${ownerMembershipId}/contact`,
    });
    expect(contact.statusCode).toBe(200);

    const unconfirmedContact = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: {
        expectedVersion: 0,
        mobilePhone: '13900139000',
        shortPhone: '67890',
      },
      url: `/groups/${groupId}/members/${candidateMembershipId}/contact`,
    });
    expect(unconfirmedContact.statusCode).toBe(200);

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
      realName: 'Owner Doctor',
      shortPhone: '12345',
    });
    expect(ownerMember).toHaveProperty('mobilePhone', '13800138000');
    const candidateMember = body.calendar.members.find(
      (member) => member.membershipId === candidateMembershipId,
    );
    expect(candidateMember).toEqual({
      isConfirmed: false,
      membershipId: candidateMembershipId,
      realName: 'Candidate Doctor',
      mobilePhone: '13900139000',
      shortPhone: '67890',
    });
    expect(
      body.calendar.assignments.every((assignment) => assignment.changeMarkers.length === 0),
    ).toBe(true);
  });

  it('shows the same workflow change markers to guests', async () => {
    const saved = await savePublished('2026-08');
    const periodId = (saved.json() as FixtureScheduleResult).periods[0]?.id as string;
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
    ).toEqual(['swap']);
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
    const archivedPeriodId = (first.json() as FixtureScheduleResult).periods[0]?.id as string;

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
    const periodId = (saved.json() as FixtureScheduleResult).periods[0]?.id as string;
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

  it('does not keep a leave-cover marker after its leave request is cancelled', async () => {
    const saved = await savePublished('2026-08');
    const periodId = (saved.json() as FixtureScheduleResult).periods[0]?.id as string;
    const [assignmentRow] = await client.database
      .select({ id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.schedulePeriodId, periodId))
      .orderBy(sql`${shiftAssignments.businessDate}`)
      .limit(1);
    const leaveRequestId = randomUUID();
    await client.database.insert(leaveRequests).values({
      endsAt: new Date('2026-08-28T00:00:00.000Z'),
      groupId,
      id: leaveRequestId,
      isAllDay: 1,
      leaveType: 'sick',
      membershipId: candidateMembershipId,
      startsAt: new Date('2026-08-27T00:00:00.000Z'),
      status: 'approved',
    });
    await client.database.insert(scheduleEvents).values({
      affectedMembershipIds: [candidateMembershipId],
      affectedShiftIds: [assignmentRow?.id as string],
      eventStatus: 'completed',
      eventType: 'leave_cover_completed',
      groupId,
      id: randomUUID(),
      objectId: leaveRequestId,
      objectType: 'leave_cover',
      operationId: randomUUID(),
      schedulePeriodId: periodId,
    });

    const active = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    expect(
      active.assignments.find((assignment) => assignment.id === assignmentRow?.id)?.changeMarkers,
    ).toEqual(['leave-cover']);

    await client.database
      .update(leaveRequests)
      .set({ deletedAt: new Date() })
      .where(eq(leaveRequests.id, leaveRequestId));
    const cancelled = (await readCalendar('owner-token', '2026-08')).json() as CalendarReadModel;
    expect(
      cancelled.assignments.find((assignment) => assignment.id === assignmentRow?.id)
        ?.changeMarkers,
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

  async function getVisitorKey(targetGroupId: string): Promise<string> {
    const [rows] = (await client.database.execute(
      sql`SELECT visitor_key AS visitorKey FROM \`groups\` WHERE id = ${targetGroupId}`,
    )) as unknown as [{ visitorKey: string }[], unknown];
    return rows[0]?.visitorKey as string;
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
      payload: { expectedRulesVersion: config.rulesVersion, name },
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
    const role = config.roles.find((item) => item.id === roleId);
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: role?.version,
        expectedRulesVersion: config.rulesVersion,
        membershipIds,
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

  async function savePublished(businessMonth: string) {
    const config = await getConfig('owner-token', groupId);
    return createScheduleFixture(app, client, {
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        businessMonth,
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion: config.rulesVersion,
        scheduleRoleIds: [primaryRoleId],
      },
    });
  }

  async function saveDraft(businessMonth: string) {
    const config = await getConfig('owner-token', groupId);
    return createScheduleFixture(app, client, {
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        businessMonth,
        operationId: randomUUID(),
        rulesVersion: config.rulesVersion,
        scheduleRoleIds: [primaryRoleId],
      },
    });
  }

  it('serves a guest-shaped calendar only to logged-in guest members', async () => {
    await savePublished('2026-08');
    const unconfirmedContact = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13900139000', shortPhone: '67890' },
      url: `/groups/${groupId}/members/${candidateMembershipId}/contact`,
    });
    expect(unconfirmedContact.statusCode).toBe(200);
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
      calendar: { assignments: expect.any(Array), groupId },
    });
    const guestBody = guestCalendar.json() as { calendar: CalendarReadModel };
    expect(guestBody.calendar).toEqual((await readCalendar('owner-token', '2026-08')).json());

    const shiftId = guestBody.calendar.assignments[0]!.id;
    const guestEvents = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/guest-calendar/shifts/${shiftId}/events`,
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(guestEvents.statusCode, guestEvents.body).toBe(200);
    expect(guestEvents.json()).toEqual(
      (
        await app.inject({
          method: 'GET',
          url: `/groups/${groupId}/events?shiftId=${shiftId}`,
          headers: { authorization: 'Bearer owner-token' },
        })
      ).json(),
    );

    const memberCalendar = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/guest-calendar?businessMonth=2026-08`,
    });
    expect(memberCalendar.statusCode).toBe(403);
  });

  async function linkOutsiderGroup() {
    const created = await app.inject({
      method: 'POST',
      url: '/groups',
      headers: { authorization: 'Bearer outsider-token' },
      payload: { name: 'Linked nurses' },
    });
    expect(created.statusCode, created.body).toBe(201);
    const otherId = (created.json() as { id: string }).id;
    const pair = [groupId, otherId].sort();
    await client.database.execute(
      sql`INSERT INTO group_visitor_links(id,first_group_id,second_group_id) VALUES(${randomUUID()},${pair[0]},${pair[1]})`,
    );
    return otherId;
  }

  const linkedCalendar = () =>
    app.inject({
      method: 'GET',
      url: `/groups/${groupId}/guest-calendar?businessMonth=2026-08`,
      headers: { authorization: 'Bearer outsider-token' },
    });

  it('previews unique groups and applies versioned, audited, idempotent association operations', async () => {
    const otherId = await linkOutsiderGroup();
    const preview = await inspectVisitorLink(client, 'Calendar group', 'Linked nurses');
    expect(preview.enabled).toBe(true);
    expect(preview.directions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceGroupId: groupId,
          targetGroupId: otherId,
          formalMembers: 3,
          membersWithoutDirectAccess: 2,
        }),
        expect.objectContaining({
          sourceGroupId: otherId,
          targetGroupId: groupId,
          formalMembers: 2,
          membersWithoutDirectAccess: 1,
        }),
      ]),
    );
    const input = {
      firstGroupId: otherId,
      secondGroupId: groupId,
      enabled: false,
      expectedVersion: preview.version,
      operator: 'integration-test',
    };
    expect((await setVisitorLink(client, input)).changed).toBe(true);
    expect((await setVisitorLink(client, input)).changed).toBe(false);
    expect((await linkedCalendar()).statusCode).toBe(403);
    await expect(setVisitorLink(client, { ...input, enabled: true })).rejects.toThrow('版本');
    expect(
      (await setVisitorLink(client, { ...input, enabled: true, expectedVersion: 2 })).version,
    ).toBe(3);
    expect((await linkedCalendar()).statusCode).toBe(200);
    const [audit] = await client.database.execute(
      sql`SELECT action FROM audit_logs WHERE action='group_visitor_link_changed'`,
    );
    expect(audit).toHaveLength(2);
    await client.database.execute(
      sql`UPDATE \`groups\` SET name='Calendar group' WHERE id=${otherId}`,
    );
    await expect(inspectVisitorLink(client, 'Calendar group', 'Linked nurses')).rejects.toThrow(
      '群名',
    );
  });

  it('recycles either association endpoint without deleting the other group', async () => {
    const otherId = await linkOutsiderGroup();
    await client.database.execute(
      sql`UPDATE \`groups\` SET deleted_at='2026-06-01' WHERE id=${otherId}`,
    );
    expect((await new GroupRecycleJob(client).run(new Date('2026-08-01T00:00:00Z'))).purged).toBe(
      1,
    );
    const [links] = await client.database.execute(sql`SELECT id FROM group_visitor_links`);
    expect(links).toEqual([]);
    const [remaining] = await client.database.execute(
      sql`SELECT id FROM \`groups\` WHERE id=${groupId}`,
    );
    expect(remaining).toEqual([{ id: groupId }]);
  });

  it('handles future formal members, real leave, non-transitive links and group renames', async () => {
    const otherId = await linkOutsiderGroup();
    const third = await app.inject({
      method: 'POST',
      url: '/groups',
      headers: { authorization: 'Bearer candidate-token' },
      payload: { name: 'Third group' },
    });
    expect(third.statusCode).toBe(201);
    const thirdId = (third.json() as { id: string }).id;
    await setVisitorLink(client, {
      firstGroupId: otherId,
      secondGroupId: thirdId,
      enabled: true,
      expectedVersion: 0,
      operator: 'integration-test',
    });
    const ownerList = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer owner-token' },
    });
    expect(ownerList.json().some((group: { id: string }) => group.id === thirdId)).toBe(false);
    await client.database.execute(
      sql`UPDATE \`groups\` SET name='Renamed nurses' WHERE id=${otherId}`,
    );
    const renamed = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer owner-token' },
    });
    expect(renamed.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: otherId, name: 'Renamed nurses', role: 'guest' }),
      ]),
    );
    const leave = await app.inject({
      method: 'POST',
      url: `/groups/${groupId}/leave`,
      headers: { authorization: 'Bearer candidate-token' },
    });
    expect(leave.statusCode).toBe(204);
    // Removing the additional third-group source leaves no association path.
    await setVisitorLink(client, {
      firstGroupId: otherId,
      secondGroupId: thirdId,
      enabled: false,
      expectedVersion: 1,
      operator: 'integration-test',
    });
    const afterLeave = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer candidate-token' },
    });
    expect(afterLeave.json().some((group: { id: string }) => group.id === otherId)).toBe(false);
    await client.database.execute(
      sql`INSERT INTO group_memberships(id,group_id,user_id,role) SELECT ${randomUUID()},${groupId},id,'administrator' FROM users WHERE cloudbase_uid='cloudbase-candidate'`,
    );
    const afterJoin = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer candidate-token' },
    });
    expect(afterJoin.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherId, role: 'guest' })]),
    );
  });

  it('lists reciprocal linked guests without memberships and serves only published guest data', async () => {
    const otherId = await linkOutsiderGroup();
    await savePublished('2026-08');
    await saveDraft('2026-09');
    await client.database
      .execute(sql`INSERT INTO group_member_contacts(id,membership_id,mobile_phone,short_phone,is_confirmed)
      VALUES(${randomUUID()},${candidateMembershipId},'13900139000','67890',1)
      ON DUPLICATE KEY UPDATE mobile_phone='13900139000',short_phone='67890',is_confirmed=1`);
    for (const [token, target] of [
      ['outsider-token', groupId],
      ['owner-token', otherId],
      ['candidate-token', otherId],
    ] as const) {
      const response = await app.inject({
        method: 'GET',
        url: '/groups',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.json()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: target, role: 'guest' })]),
      );
      const catalog = await app.inject({
        method: 'GET',
        url: '/groups/catalog',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(catalog.json()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: target, relation: 'active-guest' })]),
      );
    }
    const response = await linkedCalendar();
    expect(response.statusCode).toBe(200);
    const calendar = (response.json() as { calendar: CalendarReadModel }).calendar;
    expect(calendar.assignments.length).toBeGreaterThan(0);
    expect(calendar).toEqual((await readCalendar('owner-token', '2026-08')).json());
    const draft = await app.inject({
      method: 'GET',
      url: `/groups/${groupId}/guest-calendar?businessMonth=2026-09`,
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(draft.statusCode).toBe(200);
    expect(draft.json().calendar.assignments).toEqual([]);
    const [rows] = await client.database.execute(
      sql`SELECT id FROM group_memberships WHERE group_id=${groupId} AND user_id=(SELECT id FROM users WHERE cloudbase_uid='cloudbase-outsider')`,
    );
    expect(rows).toEqual([]);
  });

  it.each([
    'inactive',
    'guest',
    'removed',
    'disabled-user',
    'deleted-user',
    'deleted-profile',
    'dissolved-source',
    'dissolved-target',
    'disabled-link',
  ])('revokes linked guest access on the next request: %s', async (change) => {
    await savePublished('2026-08');
    const shiftId = (await readCalendar('owner-token', '2026-08')).json().assignments[0].id;
    const readEvents = () =>
      app.inject({
        method: 'GET',
        url: `/groups/${groupId}/guest-calendar/shifts/${shiftId}/events`,
        headers: { authorization: 'Bearer outsider-token' },
      });
    const otherId = await linkOutsiderGroup();
    expect((await readEvents()).statusCode).toBe(200);
    expect((await linkedCalendar()).statusCode).toBe(200);
    if (change === 'inactive')
      await client.database.execute(
        sql`UPDATE group_memberships SET status='inactive' WHERE group_id=${otherId}`,
      );
    if (change === 'guest')
      await client.database.execute(
        sql`UPDATE group_memberships SET role='guest' WHERE group_id=${otherId}`,
      );
    if (change === 'removed')
      await client.database.execute(
        sql`UPDATE group_memberships SET deleted_at=current_timestamp(3) WHERE group_id=${otherId}`,
      );
    if (change === 'disabled-user')
      await client.database.execute(
        sql`UPDATE users SET status='suspended' WHERE cloudbase_uid='cloudbase-outsider'`,
      );
    if (change === 'deleted-user')
      await client.database.execute(
        sql`UPDATE users SET deleted_at=current_timestamp(3) WHERE cloudbase_uid='cloudbase-outsider'`,
      );
    if (change === 'deleted-profile')
      await client.database.execute(
        sql`UPDATE user_profiles SET deleted_at=current_timestamp(3) WHERE user_id=(SELECT id FROM users WHERE cloudbase_uid='cloudbase-outsider')`,
      );
    if (change === 'dissolved-source')
      await client.database.execute(
        sql`UPDATE \`groups\` SET deleted_at=current_timestamp(3) WHERE id=${otherId}`,
      );
    if (change === 'dissolved-target')
      await client.database.execute(
        sql`UPDATE \`groups\` SET deleted_at=current_timestamp(3) WHERE id=${groupId}`,
      );
    if (change === 'disabled-link')
      await client.database.execute(sql`UPDATE group_visitor_links SET is_enabled=0`);
    expect([403, 404]).toContain((await linkedCalendar()).statusCode);
    expect([403, 404]).toContain((await readEvents()).statusCode);
    const list = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(list.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: groupId })]),
    );
  });

  it('preserves independent guests and formal memberships when an association is disabled', async () => {
    const joined = await app.inject({
      method: 'POST',
      url: `/groups/${groupId}/join-guest`,
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(joined.statusCode).toBe(201);
    const otherId = await linkOutsiderGroup();
    await client.database.execute(sql`UPDATE group_visitor_links SET is_enabled=0`);
    expect((await linkedCalendar()).statusCode).toBe(200);
    await client.database.execute(sql`UPDATE group_visitor_links SET is_enabled=1`);
    const list = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(list.json().filter((group: { id: string }) => group.id === groupId)).toHaveLength(1);
    expect(list.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherId, role: 'owner' })]),
    );
    await client.database
      .execute(sql`UPDATE group_memberships SET role='member' WHERE group_id=${groupId}
      AND user_id=(SELECT id FROM users WHERE cloudbase_uid='cloudbase-outsider')`);
    const formalList = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(formalList.json().filter((group: { id: string }) => group.id === groupId)).toEqual([
      expect.objectContaining({ id: groupId, role: 'member' }),
    ]);
  });

  it('rejects leaving or independently joining a derived guest and never grants administrator powers', async () => {
    await linkOutsiderGroup();
    for (const action of ['leave', 'join-guest']) {
      const response = await app.inject({
        method: 'POST',
        url: `/groups/${groupId}/${action}`,
        headers: { authorization: 'Bearer outsider-token' },
      });
      expect(response.statusCode).toBe(409);
      expect(response.body).toContain('此访问权限来自群组关联，随原群成员资格变更');
    }
    await client.database.execute(
      sql`UPDATE users SET is_developer_admin=1 WHERE cloudbase_uid='cloudbase-outsider'`,
    );
    expect((await linkedCalendar()).statusCode).toBe(200);
    const list = await app.inject({
      method: 'GET',
      url: '/groups',
      headers: { authorization: 'Bearer outsider-token' },
    });
    expect(
      list.json().find((group: { id: string }) => group.id === groupId).isDeveloperAdmin,
    ).toBeUndefined();
    for (const suffix of [
      'members',
      'contacts',
      'directory',
      'scheduling-config',
      'calendar?businessMonth=2026-08',
    ]) {
      const denied = await app.inject({
        method: 'GET',
        url: `/groups/${groupId}/${suffix}`,
        headers: { authorization: 'Bearer outsider-token' },
      });
      expect(denied.statusCode, suffix).toBe(403);
    }
    const deniedWrite = await app.inject({
      method: 'PUT',
      url: `/groups/${groupId}/name`,
      headers: { authorization: 'Bearer outsider-token' },
      payload: { name: 'Forbidden', expectedVersion: 1 },
    });
    expect(deniedWrite.statusCode).toBe(403);
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
    readonly version: number;
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
