import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { LeaveReflowPreview, LeaveRequest } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { getChinaStandardTimeCalendarDate } from '@schedule/scheduling-domain';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertDirectMembership } from '@schedule/test-fixtures';
import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { isLeaveStartBeforeChinaToday } from './leave-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describe('leave natural-calendar-date guard', () => {
  it('allows China Standard Time midnight on the same calendar date after the 08:00 handover', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    const sameCalendarDateStart = new Date('2026-08-23T16:00:00.000Z');

    expect(getChinaStandardTimeCalendarDate(now)).toBe('2026-08-24');
    expect(isLeaveStartBeforeChinaToday(sameCalendarDateStart, now)).toBe(false);
  });

  it('rejects the previous China Standard Time calendar date before the 08:00 handover', () => {
    const now = new Date('2026-08-23T18:00:00.000Z');
    const previousCalendarDateStart = new Date('2026-08-22T16:00:00.000Z');

    expect(getChinaStandardTimeCalendarDate(now)).toBe('2026-08-24');
    expect(isLeaveStartBeforeChinaToday(previousCalendarDateStart, now)).toBe(true);
  });
});

describeWithDatabase('leave requests and reflow', () => {
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
        'c-token': 'cloudbase-c',
        'outsider-token': 'cloudbase-outsider',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('a-token', 'A Doctor');
    await registerUser('b-token', 'B Doctor');
    await registerUser('c-token', 'C Doctor');
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

  it('rejects a leave request whose start date is before today', async () => {
    const context = await seedPublishedRotation();
    const today = getChinaStandardTimeCalendarDate(new Date());
    const yesterday = new Date(`${today}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const start = yesterday.toISOString();
    const end = new Date(yesterday.valueOf() + 24 * 60 * 60 * 1000).toISOString();

    const response = await submitLeave('a-token', context.groupId, {
      endsAt: end,
      isAllDay: true,
      leaveType: 'sick',
      startsAt: start,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { message: expect.stringContaining('最早只能是当天') },
    });
  });

  it('submits a typed all-day leave with a reason and rejects overlapping intervals', async () => {
    const context = await seedPublishedRotation();

    const submitted = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '发烧需要休息',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    expect(submitted.statusCode).toBe(201);
    expect(submitted.json()).toMatchObject({
      groupId: context.groupId,
      isAllDay: true,
      leaveType: 'sick',
      memberName: 'A Doctor',
      membershipId: context.membershipIds.a,
      reason: '发烧需要休息',
      reflowStrategy: 'keep-original-order',
      status: 'pending',
      version: 1,
    });

    const overlap = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-02T12:00:00.000Z',
      isAllDay: false,
      leaveType: 'other',
      reason: '重复提交',
      startsAt: '2026-09-01T12:00:00.000Z',
    });
    expect(overlap.statusCode).toBe(409);
    expect((overlap.json() as ErrorResponse).error.message).toContain('重叠');

    const invalid = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-01T00:00:00.000Z',
      isAllDay: false,
      leaveType: 'other',
      reason: '时间颠倒',
      startsAt: '2026-09-02T00:00:00.000Z',
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('replays leave creation by operation id and rejects payload or header mismatches', async () => {
    const context = await seedPublishedRotation();
    const operationId = randomUUID();
    const body = {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      operationId,
      reason: '幂等创建',
      startsAt: '2026-09-01T00:00:00.000Z',
    };

    const created = await submitLeave('a-token', context.groupId, body, operationId);
    expect(created.statusCode).toBe(201);
    const replayed = await submitLeave('a-token', context.groupId, body, operationId);
    expect(replayed.statusCode).toBe(201);
    expect(replayed.json()).toEqual(created.json());

    const reused = await submitLeave(
      'a-token',
      context.groupId,
      { ...body, reason: '另一个请求' },
      operationId,
    );
    expect(reused.statusCode).toBe(409);
    const mismatched = await submitLeave('a-token', context.groupId, body, randomUUID());
    expect(mismatched.statusCode).toBe(400);

    const [rows] = (await client.database.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM leave_requests WHERE group_id = ${context.groupId}) AS leaveCount,
        (SELECT COUNT(*) FROM schedule_events WHERE event_type = 'leave_request_submitted') AS eventCount
    `)) as unknown as [readonly { eventCount: number; leaveCount: number }[], unknown];
    expect(rows).toEqual([{ eventCount: 1, leaveCount: 1 }]);
  });

  it('lets the applicant cancel a pending leave request and records the event', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      leaveType: 'sick',
      reason: '取消测试',
      startsAt: '2026-09-01T16:00:00.000Z',
    });

    const asOtherMember = await cancelLeave('b-token', context.groupId, leaveRequestId, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(asOtherMember.statusCode).toBe(403);

    const cancelled = await cancelLeave('a-token', context.groupId, leaveRequestId, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({
      leaveRequestId,
      status: 'cancelled',
    });

    const mine = (await listMyLeaves('a-token', context.groupId)).json() as LeaveRequest[];
    expect(mine.map((request) => request.id)).not.toContain(leaveRequestId);
    const [eventRows] = await client.database.execute(
      sql`SELECT event_type AS eventType FROM schedule_events WHERE object_id = ${leaveRequestId}`,
    );
    expect(
      (eventRows as unknown as readonly { eventType: string }[]).map((row) => row.eventType),
    ).toContain('leave_request_cancelled');

    const again = await cancelLeave('a-token', context.groupId, leaveRequestId, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(again.statusCode).toBe(404);
  });

  it('lets an administrator revoke an approved leave request and removes swap blocking', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '撤销测试',
      startsAt: '2026-09-01T16:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;
    expect(
      (
        await approveLeave('owner-token', context.groupId, leaveRequestId, {
          expectedPeriodVersions: preview.periodVersions,
          expectedRulesVersion: preview.rulesVersion,
          expectedVersion: 1,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(200);

    const asMember = await revokeLeave('b-token', context.groupId, leaveRequestId, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    expect(asMember.statusCode).toBe(403);

    const revoked = await revokeLeave('owner-token', context.groupId, leaveRequestId, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toMatchObject({
      leaveRequestId,
      status: 'revoked',
    });

    const approvals = (
      await listLeaveApprovals('owner-token', context.groupId)
    ).json() as LeaveRequest[];
    expect(approvals.map((request) => request.id)).not.toContain(leaveRequestId);
    const [eventRows] = await client.database.execute(
      sql`SELECT event_type AS eventType FROM schedule_events WHERE object_id = ${leaveRequestId}`,
    );
    expect(
      (eventRows as unknown as readonly { eventType: string }[]).map((row) => row.eventType),
    ).toContain('leave_request_revoked');
  });

  it('blocks revoking an approved leave that includes past dates', async () => {
    const context = await seedPublishedRotation(['a', 'b', 'c'], '2026-09');
    const leaveRequestId = randomUUID();
    await client.database.execute(sql`
      INSERT INTO leave_requests
        (id, group_id, membership_id, leave_type, starts_at, ends_at, is_all_day,
         reason, status, reflow_strategy, version)
      VALUES
        (${leaveRequestId}, ${context.groupId}, ${context.membershipIds.a!}, 'sick',
         '2026-08-01 00:00:00.000', '2026-08-02 00:00:00.000', 1,
         '已过日期撤销测试', 'approved', 'keep-original-order', 2)
    `);

    const blocked = await revokeLeave('owner-token', context.groupId, leaveRequestId, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        message: expect.stringContaining('已过日期'),
      },
    });
  });

  it('submits leave without forcing manual coverage and reflows on approval', async () => {
    const context = await seedPublishedRotation(['a', 'b', 'c'], '2026-09');
    const leaveStart = '2026-09-01T00:00:00.000Z';
    const leaveEnd = '2026-09-02T00:00:00.000Z';

    const affected = (
      await affectedShifts('a-token', context.groupId, {
        endsAt: leaveEnd,
        isAllDay: true,
        startsAt: leaveStart,
      })
    ).json() as readonly { businessDate: string; isCovered: boolean }[];
    expect(affected).toEqual([
      expect.objectContaining({ businessDate: '2026-09-01', isCovered: false }),
    ]);

    const submitted = await submitLeave('a-token', context.groupId, {
      endsAt: leaveEnd,
      isAllDay: true,
      leaveType: 'sick',
      reason: '手动未安排',
      resolutionMode: 'manual',
      startsAt: leaveStart,
    });
    expect(submitted.statusCode).toBe(201);
    expect(submitted.json()).toMatchObject({ reflowStrategy: 'keep-original-order' });

    const assignmentRows = (
      await client.database.execute(
        sql`SELECT id, business_date AS businessDate, planned_membership_id AS plannedMembershipId
            FROM shift_assignments
            WHERE schedule_period_id = ${context.periodId}
              AND business_date IN ('2026-09-01', '2026-09-02')`,
      )
    )[0] as unknown as readonly {
      businessDate: string;
      id: string;
      plannedMembershipId: string | null;
    }[];
    const aSep1 = assignmentRows.find(
      (row) =>
        row.businessDate === '2026-09-01' && row.plannedMembershipId === context.membershipIds.a,
    )?.id;
    const bSep2 = assignmentRows.find(
      (row) =>
        row.businessDate === '2026-09-02' && row.plannedMembershipId === context.membershipIds.b,
    )?.id;
    expect(aSep1).toBeDefined();
    expect(bSep2).toBeDefined();
    expect((await updateSwapAutoAccept('b-token', context.groupId, false)).statusCode).toBe(200);
    const swap = await createSwapRequest('a-token', context.groupId, {
      initiatorAssignmentId: aSep1!,
      operationId: randomUUID(),
      targetAssignmentId: bSep2!,
      targetMembershipId: context.membershipIds.b!,
    });
    expect(swap.statusCode).toBe(201);
    expect(swap.json()).toMatchObject({ status: 'pending_target' });

    const covered = (
      await affectedShifts('a-token', context.groupId, {
        endsAt: leaveEnd,
        isAllDay: true,
        startsAt: leaveStart,
      })
    ).json() as readonly { businessDate: string; isCovered: boolean }[];
    expect(covered.find((shift) => shift.businessDate === '2026-09-01')?.isCovered).toBe(true);

    const forwarded = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-08T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'other',
      reason: '顺延',
      resolutionMode: 'shift-forward',
      startsAt: '2026-09-07T00:00:00.000Z',
    });
    expect(forwarded.statusCode).toBe(201);
    expect(forwarded.json()).toMatchObject({ reflowStrategy: 'shift-forward' });
  });

  it('submits a leave without a reason', async () => {
    const context = await seedPublishedRotation(['a'], '2026-09');
    const created = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-04T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      startsAt: '2026-09-03T00:00:00.000Z',
    });
    expect(created.statusCode).toBe(201);
    expect((created.json() as LeaveRequest).reason).toBeUndefined();
  });

  it('excludes the exclusive end-date shift from affected shifts', async () => {
    const context = await seedPublishedRotation(['a', 'b', 'c'], '2026-09');
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-04T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '截止日排他测试',
      startsAt: '2026-09-01T00:00:00.000Z',
    });

    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;
    expect(preview.affectedShiftCount).toBe(1);
    expect(preview.affectedShifts.map((shift) => shift.businessDate)).toEqual(['2026-09-01']);
    expect(
      preview.affectedAssignments.some((assignment) => assignment.businessDate === '2026-09-04'),
    ).toBe(false);
  });

  it('does not count a completed historical swap as leave coverage but still allows submission', async () => {
    const context = await seedPublishedRotation(['a', 'b', 'c'], '2026-09');
    expect((await updateSwapAutoAccept('b-token', context.groupId, false)).statusCode).toBe(200);
    const assignmentRows = (
      await client.database.execute(
        sql`SELECT id, business_date AS businessDate, planned_membership_id AS plannedMembershipId
            FROM shift_assignments
            WHERE schedule_period_id = ${context.periodId}
              AND business_date IN ('2026-09-01', '2026-09-02')`,
      )
    )[0] as unknown as readonly {
      businessDate: string;
      id: string;
      plannedMembershipId: string | null;
    }[];
    const aSep1 = assignmentRows.find(
      (row) =>
        row.businessDate === '2026-09-01' && row.plannedMembershipId === context.membershipIds.a,
    )?.id;
    const bSep2 = assignmentRows.find(
      (row) =>
        row.businessDate === '2026-09-02' && row.plannedMembershipId === context.membershipIds.b,
    )?.id;
    const swap = await createSwapRequest('a-token', context.groupId, {
      initiatorAssignmentId: aSep1!,
      operationId: randomUUID(),
      targetAssignmentId: bSep2!,
      targetMembershipId: context.membershipIds.b!,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as { id: string; version: number };
    expect(
      (await acceptSwapRequest('b-token', context.groupId, swapBody.id, swapBody.version))
        .statusCode,
    ).toBe(200);

    const affected = (
      await affectedShifts('a-token', context.groupId, {
        endsAt: '2026-09-03T00:00:00.000Z',
        isAllDay: true,
        startsAt: '2026-09-02T00:00:00.000Z',
      })
    ).json() as readonly { businessDate: string; isCovered: boolean }[];
    expect(affected).toEqual([
      expect.objectContaining({ businessDate: '2026-09-02', isCovered: false }),
    ]);

    const submitted = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-03T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '历史换班不算覆盖',
      resolutionMode: 'manual',
      startsAt: '2026-09-02T00:00:00.000Z',
    });
    expect(submitted.statusCode).toBe(201);
  });

  it('blocks leave approval while a completed duty adjustment makes the member actual', async () => {
    const context = await seedPublishedRotation(['a', 'b', 'c'], '2026-09');
    const [assignmentRows] = await client.database.execute(
      sql`SELECT id
          FROM shift_assignments
          WHERE schedule_period_id = ${context.periodId}
            AND business_date = '2026-09-01'
          LIMIT 1`,
    );
    const assignmentId = (assignmentRows as unknown as readonly { id: string }[])[0]?.id as string;
    expect(assignmentId).toBeDefined();

    const duty = await createDirectDutyAdjustment('owner-token', context.groupId, {
      coveredAssignmentId: assignmentId,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b!,
      reason: '代值',
    });
    expect(duty.statusCode).toBe(201);

    const leaveRequestId = await createLeave(context, 'b-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '实际当值请假',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;
    expect(preview.workflowBlockers).toEqual([
      expect.objectContaining({
        assignmentId,
        message: expect.stringContaining('换班或加扣班'),
      }),
    ]);
    const approved = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: preview.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(approved.statusCode).toBe(409);
    expect((approved.json() as ErrorResponse).error.message).toContain('换班或加扣班');
  });

  it('blocks leave approval while a completed swap makes the member actual', async () => {
    const context = await seedPublishedRotation(['a', 'b', 'c'], '2026-09');
    expect((await updateSwapAutoAccept('b-token', context.groupId, false)).statusCode).toBe(200);
    const [assignmentRows] = await client.database.execute(
      sql`SELECT id, business_date AS businessDate, planned_membership_id AS plannedMembershipId
          FROM shift_assignments
          WHERE schedule_period_id = ${context.periodId}
            AND business_date IN ('2026-09-01', '2026-09-02')`,
    );
    const rows = assignmentRows as unknown as readonly {
      businessDate: string;
      id: string;
      plannedMembershipId: string | null;
    }[];
    const aSep1 = rows.find(
      (row) =>
        row.businessDate === '2026-09-01' && row.plannedMembershipId === context.membershipIds.a,
    )?.id;
    const bSep2 = rows.find(
      (row) =>
        row.businessDate === '2026-09-02' && row.plannedMembershipId === context.membershipIds.b,
    )?.id;
    expect(aSep1).toBeDefined();
    expect(bSep2).toBeDefined();

    const swap = await createSwapRequest('a-token', context.groupId, {
      initiatorAssignmentId: aSep1!,
      operationId: randomUUID(),
      targetAssignmentId: bSep2!,
      targetMembershipId: context.membershipIds.b!,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as { id: string; version: number };
    expect(
      (await acceptSwapRequest('b-token', context.groupId, swapBody.id, swapBody.version))
        .statusCode,
    ).toBe(200);

    const leaveRequestId = await createLeave(context, 'b-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '换班后实际当值请假',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;
    expect(preview.workflowBlockers.length).toBeGreaterThan(0);
    const approved = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: preview.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(approved.statusCode).toBe(409);
  });

  it('previews a partial all-day overlap and keeps the original order on approval', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-01T20:00:00.000Z',
      leaveType: 'training',
      reason: '外出进修半天',
      startsAt: '2026-09-01T16:00:00.000Z',
    });

    const previewResponse = await previewLeave('owner-token', context.groupId, leaveRequestId);
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json() as LeaveReflowPreview;
    expect(preview).toMatchObject({
      affectedAssignments: [
        {
          businessDate: '2026-09-01',
          nextMemberId: context.membershipIds.b,
          nextMemberName: 'B Doctor',
          previousMemberId: context.membershipIds.a,
          previousMemberName: 'A Doctor',
          shiftTypeName: '全天班',
          slotPosition: 1,
        },
      ],
      groupDefaultStrategy: 'keep-original-order',
      leaveRequestId,
      leaveRequestVersion: 1,
      rulesVersion: context.rulesVersion,
      strategy: 'keep-original-order',
    });
    expect(preview.conflicts).toEqual([]);
    expect(preview.vacancies).toEqual([]);
    expect(preview.statisticsDelta).toMatchObject({
      byMember: [
        {
          assignmentDelta: -1,
          countedDelta: -1,
          membershipId: context.membershipIds.a,
          realName: 'A Doctor',
          weekendDelta: 0,
        },
        {
          assignmentDelta: 1,
          countedDelta: 1,
          membershipId: context.membershipIds.b,
          realName: 'B Doctor',
          weekendDelta: 0,
        },
      ],
      totalAssignmentDelta: 0,
      totalCountedDelta: 0,
      totalWeekendDelta: 0,
    });

    const approval = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(approval.statusCode).toBe(200);
    expect(approval.json()).toMatchObject({
      leaveRequest: { status: 'approved', version: 2 },
      status: 'approved',
      strategy: 'keep-original-order',
    });

    const planned = await readPlannedNames(context.groupId, context.periodId, 4);
    expect(planned).toEqual(['B Doctor', 'B Doctor', 'C Doctor', 'A Doctor']);
    const [coverEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE group_id = ${context.groupId} AND event_type = 'leave_cover_completed'`,
    );
    expect(coverEvents).toEqual([{ count: 1 }]);

    const calendar = await getCalendar('owner-token', context.groupId, '2026-09');
    expect(calendar.statusCode).toBe(200);
    const calendarBody = calendar.json() as CalendarResponse;
    const firstAssignment = calendarBody.assignments.find(
      (assignment) => assignment.businessDate === '2026-09-01',
    );
    expect(firstAssignment?.plannedMemberName).toBe('B Doctor');
    expect(firstAssignment?.changeMarkers).toContain('leave-cover');
  });

  it('shift-forward skips the member, advances the cursor, and lets them rejoin', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '病假一天',
      startsAt: '2026-09-01T00:00:00.000Z',
    });

    const previewResponse = await previewLeave(
      'owner-token',
      context.groupId,
      leaveRequestId,
      'shift-forward',
    );
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json() as LeaveReflowPreview;
    expect(preview.strategy).toBe('shift-forward');
    expect(
      preview.affectedAssignments.map((assignment) => assignment.businessDate).slice(0, 6),
    ).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);

    const approval = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
      strategy: 'shift-forward',
    });
    expect(approval.statusCode).toBe(200);

    const planned = await readPlannedNames(context.groupId, context.periodId, 6);
    expect(planned).toEqual([
      'B Doctor',
      'C Doctor',
      'A Doctor',
      'B Doctor',
      'C Doctor',
      'A Doctor',
    ]);
    const [cursor] = await client.database.execute<{ position: number; version: number }>(
      sql`SELECT current_position AS position, version FROM rotation_rules WHERE schedule_role_id = ${context.roleId}`,
    );
    expect(cursor).toEqual([{ position: 1, version: context.rotationRuleVersion + 1 }]);
    const [nextRulesVersion] = await client.database.execute<{ rulesVersion: number }>(
      sql`SELECT rules_version AS rulesVersion FROM \`groups\` WHERE id = ${context.groupId}`,
    );
    expect(nextRulesVersion).toEqual([{ rulesVersion: context.rulesVersion + 1 }]);

    const staleGeneration = await generatePreview(
      'owner-token',
      context.groupId,
      context.roleId,
      context.rulesVersion,
    );
    expect(staleGeneration.statusCode).toBe(409);
    const freshGeneration = await generatePreview(
      'owner-token',
      context.groupId,
      context.roleId,
      context.rulesVersion + 1,
    );
    expect(freshGeneration.statusCode).toBe(200);
  });

  it('creates a pending vacancy when no cover exists and blocks unacknowledged approval', async () => {
    const context = await seedPublishedRotation(['a']);
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '无人替班',
      startsAt: '2026-09-01T00:00:00.000Z',
    });

    const previewResponse = await previewLeave('owner-token', context.groupId, leaveRequestId);
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json() as LeaveReflowPreview;
    expect(preview.vacancies).toHaveLength(1);
    expect(preview.vacancies[0]).toMatchObject({
      businessDate: '2026-09-01',
      code: 'NO_ELIGIBLE_MEMBER',
      scheduleRoleId: context.roleId,
      slotPosition: 1,
    });
    expect(preview.affectedAssignments[0]?.nextMemberId).toBeUndefined();

    const blocked = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(blocked.statusCode).toBe(409);
    expect(
      ((blocked.json() as ErrorResponse).error.latestData as { preview: LeaveReflowPreview })
        .preview.vacancies,
    ).toHaveLength(1);

    const acknowledged = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      acknowledgeBlockers: true,
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(acknowledged.statusCode).toBe(200);
    const [vacancyRows] = await client.database.execute<{ plannedMemberName: string | null }>(
      sql`SELECT planned_member_name AS plannedMemberName FROM shift_assignments WHERE schedule_period_id = ${context.periodId} AND business_date = '2026-09-01'`,
    );
    expect(vacancyRows).toEqual([{ plannedMemberName: null }]);
  });

  it('rejects stale leave versions and stale period versions', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '版本冲突',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;

    const firstApproval = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(firstApproval.statusCode).toBe(200);
    const replay = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(replay.statusCode).toBe(409);
    expect((replay.json() as ErrorResponse).error.latestData).toMatchObject({
      id: leaveRequestId,
      objectType: 'leave_request',
      status: 'approved',
      version: 2,
    });

    const secondLeaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-04T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'other',
      reason: '期间版本变化',
      startsAt: '2026-09-03T00:00:00.000Z',
    });
    const secondPreview = (
      await previewLeave('owner-token', context.groupId, secondLeaveRequestId)
    ).json() as LeaveReflowPreview;
    await client.database.execute(
      sql`UPDATE schedule_periods SET version = version + 1 WHERE id = ${context.periodId}`,
    );
    const stalePeriods = await approveLeave('owner-token', context.groupId, secondLeaveRequestId, {
      expectedPeriodVersions: secondPreview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(stalePeriods.statusCode).toBe(409);
    expect((stalePeriods.json() as ErrorResponse).error.latestData).toMatchObject({
      id: context.periodId,
      objectType: 'schedule_period',
      version: 3,
    });
  });

  it('rejects stale rules versions with the latest rules version', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '规则变化',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;
    await changeShiftTypeColor(context.groupId);

    const stale = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(stale.statusCode).toBe(409);
    expect((stale.json() as ErrorResponse).error.latestData).toMatchObject({
      rulesVersion: context.rulesVersion + 1,
    });
  });

  it('replays the same approval operation id without duplicates', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '幂等',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;
    const operationId = randomUUID();
    const body = {
      expectedPeriodVersions: preview.periodVersions,
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 1,
      operationId,
    };

    const first = await approveLeave('owner-token', context.groupId, leaveRequestId, body);
    expect(first.statusCode).toBe(200);
    const replay = await approveLeave('owner-token', context.groupId, leaveRequestId, body);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const eventRows = (
      await client.database.execute<{ eventType: string }>(
        sql`SELECT event_type AS eventType FROM schedule_events WHERE group_id = ${context.groupId}`,
      )
    )[0] as unknown as readonly { eventType: string }[];
    expect(eventRows.filter((row) => row.eventType === 'leave_request_approved')).toHaveLength(1);
    expect(eventRows.filter((row) => row.eventType === 'leave_cover_completed')).toHaveLength(1);
  });

  it('restricts preview and approval permissions', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '权限',
      startsAt: '2026-09-01T00:00:00.000Z',
    });

    expect((await previewLeave('b-token', context.groupId, leaveRequestId)).statusCode).toBe(403);
    expect((await previewLeave('outsider-token', context.groupId, leaveRequestId)).statusCode).toBe(
      403,
    );
    expect((await previewLeave('a-token', context.groupId, leaveRequestId)).statusCode).toBe(200);
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveReflowPreview;
    expect(
      (
        await approveLeave('b-token', context.groupId, leaveRequestId, {
          expectedPeriodVersions: preview.periodVersions,
          expectedRulesVersion: context.rulesVersion,
          expectedVersion: 1,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await approveLeave('outsider-token', context.groupId, leaveRequestId, {
          expectedPeriodVersions: preview.periodVersions,
          expectedRulesVersion: context.rulesVersion,
          expectedVersion: 1,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
  });

  it('rejects a pending request with an event and blocks later approval', async () => {
    const context = await seedPublishedRotation();
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '取消申请',
      startsAt: '2026-09-01T00:00:00.000Z',
    });

    const rejected = await rejectLeave('owner-token', context.groupId, leaveRequestId, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({
      leaveRequest: { status: 'rejected', version: 2 },
      status: 'rejected',
    });
    const [rejectionEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE group_id = ${context.groupId} AND event_type = 'leave_request_rejected'`,
    );
    expect(rejectionEvents).toEqual([{ count: 1 }]);

    const approval = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: {},
      expectedRulesVersion: context.rulesVersion,
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    expect(approval.statusCode).toBe(409);
  });

  it('updates the group default strategy and applies it to new requests', async () => {
    const context = await seedPublishedRotation();
    expect(
      (
        (await getStrategy('owner-token', context.groupId)).json() as {
          strategy: string;
        }
      ).strategy,
    ).toBe('keep-original-order');
    expect((await updateStrategy('a-token', context.groupId, 'shift-forward')).statusCode).toBe(
      403,
    );
    expect((await updateStrategy('owner-token', context.groupId, 'shift-forward')).statusCode).toBe(
      200,
    );

    const submitted = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '默认顺延',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    expect(submitted.statusCode).toBe(201);
    expect(submitted.json()).toMatchObject({ reflowStrategy: 'shift-forward' });
  });

  async function seedPublishedRotation(
    memberKeys: readonly string[] = ['a', 'b', 'c'],
    businessMonth = '2026-09',
  ): Promise<Context> {
    const groupId = await createGroup('Leave group', '4321');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await addRosterEntry(groupId, 'C Doctor');
    for (const [token, realName] of [
      ['a-token', 'A Doctor'],
      ['b-token', 'B Doctor'],
      ['c-token', 'C Doctor'],
    ] as const) {
      await claimGroup(token, '4321', realName);
      expect((await listGroupMembers(groupId)).some((member) => member.realName === realName)).toBe(
        true,
      );
    }

    const config = await getConfig('owner-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    expect(allDayShift).toBeDefined();
    allDayShiftTypeId = allDayShift?.id as string;
    const roleId = await createRole(groupId, '一线');
    const members = await listGroupMembers(groupId);
    const membershipById = new Map(members.map((member) => [member.realName, member.id]));
    const membershipIds = Object.fromEntries(
      ['owner', 'a', 'b', 'c'].map((key) => {
        const name = `${key === 'owner' ? 'Owner' : key.toUpperCase()} Doctor`;
        const id = membershipById.get(name);
        expect(id).toBeDefined();
        return [key, id as string];
      }),
    ) as Record<string, string>;
    const selectedMembershipIds = memberKeys.flatMap((key) => {
      const membershipId = membershipIds[key];
      return membershipId === undefined ? [] : [membershipId];
    });
    await replaceRoleMembers(groupId, roleId, selectedMembershipIds);
    const roleConfig = (await getConfig('owner-token', groupId)).roles.find(
      (role) => role.id === roleId,
    );
    expect(roleConfig?.members).toHaveLength(selectedMembershipIds.length);
    const startingMemberScheduleRoleId =
      memberKeys[0] === 'owner'
        ? roleConfig?.members.find((member) => member.realName === 'Owner Doctor')?.id
        : roleConfig?.members.find(
            (member) => member.realName === `${memberKeys[0]?.toUpperCase()} Doctor`,
          )?.id;
    expect(startingMemberScheduleRoleId).toBeDefined();
    await updateRotationRule(groupId, roleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: `${businessMonth}-01`,
      startingMemberScheduleRoleId: startingMemberScheduleRoleId as string,
    });
    const rulesVersion = (await getConfig('owner-token', groupId)).rulesVersion;
    const generated = await generatePublished(groupId, roleId, rulesVersion, businessMonth);
    expect(generated.statusCode).toBe(200);
    const periodRows = (
      await client.database.execute(
        sql`SELECT id FROM schedule_periods WHERE group_id = ${groupId} AND business_month = ${`${businessMonth}-01`} AND status = 'published'`,
      )
    )[0] as unknown as readonly { id: string }[];
    const periodId = periodRows[0]?.id as string;
    expect(periodId).toBeDefined();
    const ruleVersionRows = (
      await client.database.execute(
        sql`SELECT version FROM rotation_rules WHERE schedule_role_id = ${roleId}`,
      )
    )[0] as unknown as readonly { version: number }[];
    const rotationRuleVersion = ruleVersionRows[0]?.version as number;

    return {
      groupId,
      membershipIds,
      periodId,
      roleId,
      rotationRuleVersion,
      rulesVersion,
    };
  }

  async function createLeave(
    context: Context,
    token: string,
    body: {
      readonly endsAt: string;
      readonly isAllDay?: boolean;
      readonly leaveType: string;
      readonly reason: string;
      readonly startsAt: string;
    },
  ): Promise<string> {
    const response = await submitLeave(token, context.groupId, body);
    expect(response.statusCode).toBe(201);
    return (response.json() as LeaveRequest).id;
  }

  async function createDirectDutyAdjustment(
    token: string,
    groupId: string,
    body: {
      readonly coveredAssignmentId: string;
      readonly operationId: string;
      readonly overtimeMembershipId: string;
      readonly reason: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/direct`,
    });
  }

  async function submitLeave(token: string, groupId: string, body: object, operationId?: string) {
    const bodyOperationId =
      'operationId' in body && typeof body.operationId === 'string'
        ? body.operationId
        : (operationId ?? randomUUID());
    return app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': operationId ?? bodyOperationId,
      },
      method: 'POST',
      payload: { ...body, operationId: bodyOperationId },
      url: `/groups/${groupId}/leave-requests`,
    });
  }

  async function affectedShifts(
    token: string,
    groupId: string,
    body: { readonly endsAt: string; readonly isAllDay?: boolean; readonly startsAt: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/leave-requests/affected-shifts`,
    });
  }

  async function createSwapRequest(
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

  async function acceptSwapRequest(
    token: string,
    groupId: string,
    swapRequestId: string,
    expectedVersion: number,
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { expectedVersion, operationId: randomUUID() },
      url: `/groups/${groupId}/swaps/${swapRequestId}/accept`,
    });
  }

  async function updateSwapAutoAccept(token: string, groupId: string, autoAcceptSwaps: boolean) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { autoAcceptSwaps },
      url: `/groups/${groupId}/swaps/my-settings`,
    });
  }

  async function listMyLeaves(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/leave-requests`,
    });
  }

  async function listLeaveApprovals(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/leave-requests/approvals`,
    });
  }

  async function cancelLeave(
    token: string,
    groupId: string,
    leaveRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/leave-requests/${leaveRequestId}/cancel`,
    });
  }

  async function revokeLeave(
    token: string,
    groupId: string,
    leaveRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/leave-requests/${leaveRequestId}/revoke`,
    });
  }

  async function previewLeave(
    token: string,
    groupId: string,
    leaveRequestId: string,
    strategy?: string,
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: strategy === undefined ? {} : { strategy },
      url: `/groups/${groupId}/leave-requests/${leaveRequestId}/preview`,
    });
  }

  async function approveLeave(
    token: string,
    groupId: string,
    leaveRequestId: string,
    body: {
      readonly acknowledgeBlockers?: boolean;
      readonly expectedPeriodVersions: Readonly<Record<string, number>>;
      readonly expectedRulesVersion: number;
      readonly expectedVersion: number;
      readonly operationId: string;
      readonly strategy?: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/leave-requests/${leaveRequestId}/approve`,
    });
  }

  async function rejectLeave(
    token: string,
    groupId: string,
    leaveRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/leave-requests/${leaveRequestId}/reject`,
    });
  }

  async function getStrategy(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/leave-reflow-strategy`,
    });
  }

  async function updateStrategy(token: string, groupId: string, strategy: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { strategy },
      url: `/groups/${groupId}/leave-reflow-strategy`,
    });
  }

  async function getCalendar(token: string, groupId: string, businessMonth: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/calendar?businessMonth=${businessMonth}`,
    });
  }

  async function readPlannedNames(
    groupId: string,
    periodId: string,
    dayCount: number,
  ): Promise<string[]> {
    const rows = (
      await client.database.execute<{ businessDate: string; plannedMemberName: string | null }>(
        sql`SELECT business_date AS businessDate, planned_member_name AS plannedMemberName
            FROM shift_assignments
            WHERE schedule_period_id = ${periodId}
            ORDER BY business_date`,
      )
    )[0] as unknown as readonly {
      businessDate: string;
      plannedMemberName: string | null;
    }[];
    return rows.slice(0, dayCount).map((row) => row.plannedMemberName ?? '');
  }

  async function generatePublished(
    groupId: string,
    roleId: string,
    rulesVersion: number,
    businessMonth = '2026-09',
  ) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        businessMonth,
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion,
        scheduleRoleIds: [roleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
    });
  }

  async function generatePreview(
    token: string,
    groupId: string,
    roleId: string,
    rulesVersion: number,
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: {
        businessMonth: '2026-09',
        rulesVersion,
        scheduleRoleIds: [roleId],
      },
      url: `/groups/${groupId}/schedules/generate-preview`,
    });
  }

  async function changeShiftTypeColor(groupId: string): Promise<void> {
    const config = await getConfig('owner-token', groupId);
    const shiftType = config.shiftTypes.find((item) => item.id === allDayShiftTypeId) as
      { readonly version: number } | undefined;
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        abbreviation: '全',
        color: '#1E3A8A',
        countsTowardStatistics: true,
        crossesMidnight: true,
        endTime: '08:00',
        expectedRulesVersion: config.rulesVersion,
        expectedVersion: shiftType?.version,
        isEnabled: true,
        name: '全天班',
        operationId: randomUUID(),
        startTime: '08:00',
      },
      url: `/groups/${groupId}/shift-types/${allDayShiftTypeId}`,
    });

    expect(response.statusCode).toBe(200);
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

  async function addRosterEntry(groupId: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
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
    const config = await getConfig('owner-token', groupId);
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { expectedRulesVersion: config.rulesVersion, name, operationId: randomUUID() },
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
    const config = await getConfig('owner-token', groupId);
    const role = config.roles.find((item) => item.id === roleId) as
      { readonly rotationRule: { readonly version: number }; readonly version: number } | undefined;
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: role?.version,
        expectedRotationRuleVersion: role?.rotationRule.version,
        expectedRulesVersion: config.rulesVersion,
        membershipIds,
        operationId: randomUUID(),
      },
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
    const config = await getConfig('owner-token', groupId);
    const role = config.roles.find((item) => item.id === roleId) as
      { readonly rotationRule: { readonly version: number }; readonly version: number } | undefined;
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        ...payload,
        expectedRoleVersion: role?.version,
        expectedRotationRuleVersion: role?.rotationRule.version,
        expectedRulesVersion: config.rulesVersion,
        operationId: randomUUID(),
      },
      url: `/groups/${groupId}/schedule-roles/${roleId}/rotation-rule`,
    });

    expect(response.statusCode).toBe(200);
  }
});

interface Context {
  readonly groupId: string;
  readonly membershipIds: Readonly<Record<string, string>>;
  readonly periodId: string;
  readonly roleId: string;
  readonly rotationRuleVersion: number;
  readonly rulesVersion: number;
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

interface CalendarResponse {
  readonly assignments: readonly {
    readonly businessDate: string;
    readonly changeMarkers: readonly string[];
    readonly plannedMemberName?: string;
  }[];
}

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly latestData?: Record<string, unknown>;
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
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
