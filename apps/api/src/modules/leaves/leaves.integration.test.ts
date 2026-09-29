import { HistoryMaintenanceJob } from '../../jobs/history-maintenance.js';
import {
  createScheduleFixture,
  configureScheduleFixture,
} from '../../test-support/schedule-fixture.js';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { LeaveApprovalPreview, LeaveRequest } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  shiftAssignments,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { getChinaStandardTimeCalendarDate } from '@schedule/scheduling-domain';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { insertDirectMembership } from '@schedule/test-fixtures';
import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { LeaveService } from './leave-service.js';
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

describeWithDatabase('leave hard conflicts and unchanged assignments', () => {
  let allDayShiftTypeId: string;
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-31T04:00:00.000Z'));
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
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('hard blocks submitting leave for an unfinished published assignment without writing a request', async () => {
    const context = await seedPublishedSchedule();
    vi.setSystemTime(new Date('2026-09-01T04:00:00.000Z'));
    const response = await submitLeave('a-token', context.groupId, {
      startsAt: '2026-09-01T04:00:00.000Z',
      endsAt: '2026-09-01T05:00:00.000Z',
      leaveType: 'sick',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.message).toContain('已发布班次');
    expect((await listMyLeaves('a-token', context.groupId)).json()).toEqual([]);
  });

  it('keeps every assignment unchanged when a legacy approved leave is revoked', async () => {
    const context = await seedPublishedSchedule();
    const response = await submitLeave('a-token', context.groupId, {
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-10-02T00:00:00.000Z',
      leaveType: 'sick',
    });
    expect(response.statusCode).toBe(201);
    const leave = response.json<LeaveRequest>();
    await client.database.execute(
      sql`UPDATE leave_requests SET status = 'approved' WHERE id = ${leave.id}`,
    );
    const before = await client.database.select().from(shiftAssignments);
    expect(
      (
        await revokeLeave('a-token', context.groupId, leave.id, {
          expectedVersion: leave.version,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(200);
    expect(await client.database.select().from(shiftAssignments)).toEqual(before);
  });

  it('hides closed leave older than 30 days while retaining spanning and pending leave for every client at month rollover', async () => {
    const context = await seedPublishedSchedule(['b', 'c']);
    const response = await submitLeave('a-token', context.groupId, {
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
    });
    expect(response.statusCode).toBe(201);
    const id = response.json().id as string;
    const service = new LeaveService(client);
    const mini = { cloudbaseUid: 'cloudbase-a', clientPlatform: 'miniprogram' } as const;
    const owner = { cloudbaseUid: 'cloudbase-owner', clientPlatform: 'miniprogram' } as const;
    vi.setSystemTime(new Date('2026-09-30T15:59:59.000Z'));
    await client.database.execute(
      sql`UPDATE leave_requests SET status = 'approved' WHERE id = ${id}`,
    );
    await new HistoryMaintenanceJob(client).run();
    expect((await service.listMine(mini, context.groupId)).map((row) => row.id)).toContain(id);
    vi.setSystemTime(new Date('2026-09-30T19:00:00.000Z'));
    await new HistoryMaintenanceJob(client).run();
    expect((await service.listMine(mini, context.groupId)).map((row) => row.id)).toContain(id);
    vi.setSystemTime(new Date('2026-10-02T19:00:00.000Z'));
    for (const status of ['approved', 'rejected']) {
      await client.database.execute(
        sql`UPDATE leave_requests SET status = ${status} WHERE id = ${id}`,
      );
      await new HistoryMaintenanceJob(client).run();
      expect(await service.listMine(mini, context.groupId)).toEqual([]);
      expect(await service.listForApproval(owner, context.groupId)).toEqual([]);
      for (const platform of [undefined, 'miniprogram', 'web']) {
        for (const [path, token] of [
          ['leave-requests', 'a-token'],
          ['leave-requests/approvals', 'owner-token'],
        ]) {
          const result = await app.inject({
            method: 'GET',
            url: `/groups/${context.groupId}/${path}`,
            headers: {
              authorization: `Bearer ${token}`,
              ...(platform === undefined ? {} : { 'x-schedule-client-platform': platform }),
            },
          });
          expect(result.statusCode).toBe(200);
          expect(result.json()).toEqual([]);
        }
      }
      expect(
        (await service.listMine({ cloudbaseUid: 'cloudbase-a' }, context.groupId)).map(
          (row) => row.id,
        ),
      ).not.toContain(id);
    }
    await client.database.execute(
      sql`UPDATE leave_requests SET ends_at = '2026-09-02 16:00:00.001' WHERE id = ${id}`,
    );
    await new HistoryMaintenanceJob(client).run();
    expect((await service.listMine(mini, context.groupId)).map((row) => row.id)).toContain(id);
    await client.database.execute(
      sql`UPDATE leave_requests SET ends_at = '2026-09-02 16:00:00.000' WHERE id = ${id}`,
    );
    await new HistoryMaintenanceJob(client).run();
    expect(await service.listMine(mini, context.groupId)).toEqual([]);
    await client.database.execute(
      sql`UPDATE leave_requests SET status = 'pending', ends_at = '2026-09-02 00:00:00' WHERE id = ${id}`,
    );
    await new HistoryMaintenanceJob(client).run();
    expect((await service.listMine(mini, context.groupId)).map((row) => row.id)).toContain(id);
  });

  it('rejects a leave request whose start date is before today', async () => {
    const context = await seedPublishedSchedule(['b', 'c']);
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
    const context = await seedPublishedSchedule(['b', 'c']);

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
    const context = await seedPublishedSchedule(['b', 'c']);
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
    const context = await seedPublishedSchedule(['b', 'c']);
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

  it('blocks revoking an approved leave that includes past dates', async () => {
    const context = await seedPublishedSchedule(['a', 'b', 'c'], '2026-09');
    const leaveRequestId = randomUUID();
    await client.database.execute(sql`
      INSERT INTO leave_requests
        (id, group_id, membership_id, leave_type, starts_at, ends_at, is_all_day,
         reason, status, version)
      VALUES
        (${leaveRequestId}, ${context.groupId}, ${context.membershipIds.a!}, 'sick',
         '2026-08-01 00:00:00.000', '2026-08-02 00:00:00.000', 1,
         '已过日期撤销测试', 'approved', 2)
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

  it('submits a leave without a reason', async () => {
    const context = await seedPublishedSchedule(['b', 'c'], '2026-09');
    const created = await submitLeave('a-token', context.groupId, {
      endsAt: '2026-09-04T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      startsAt: '2026-09-03T00:00:00.000Z',
    });
    expect(created.statusCode).toBe(201);
    expect((created.json() as LeaveRequest).reason).toBeUndefined();
  });

  it('rejects stale rules versions with the latest rules version', async () => {
    const context = await seedPublishedSchedule(['b', 'c']);
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '规则变化',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveApprovalPreview;
    await changeShiftTypeColor(context.groupId);

    const stale = await approveLeave('owner-token', context.groupId, leaveRequestId, {
      expectedPeriodVersions: preview.periodVersions,
      expectedAssignmentVersions: preview.assignmentVersions,
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
    const context = await seedPublishedSchedule(['b', 'c']);
    const leaveRequestId = await createLeave(context, 'a-token', {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '幂等',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    const preview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId)
    ).json() as LeaveApprovalPreview;
    const operationId = randomUUID();
    const body = {
      expectedPeriodVersions: preview.periodVersions,
      expectedAssignmentVersions: preview.assignmentVersions,
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
    expect(eventRows.filter((row) => row.eventType === 'leave_assignments_cleared')).toHaveLength(
      0,
    );
  });

  it('restricts preview and approval permissions', async () => {
    const context = await seedPublishedSchedule(['b', 'c']);
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
    ).json() as LeaveApprovalPreview;
    expect(
      (
        await approveLeave('b-token', context.groupId, leaveRequestId, {
          expectedPeriodVersions: preview.periodVersions,
          expectedAssignmentVersions: preview.assignmentVersions,
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
          expectedAssignmentVersions: preview.assignmentVersions,
          expectedRulesVersion: context.rulesVersion,
          expectedVersion: 1,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
  });

  it('rejects a pending request with an event and blocks later approval', async () => {
    const context = await seedPublishedSchedule(['b', 'c']);
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

  it('rejects legacy pending approval even when an old client acknowledges clearing', async () => {
    const context = await seedPublishedSchedule();
    const id = randomUUID();
    await client.database.execute(
      sql`INSERT INTO leave_requests (id, group_id, membership_id, leave_type, starts_at, ends_at, is_all_day) VALUES (${id}, ${context.groupId}, ${context.membershipIds.a}, 'sick', '2026-09-01', '2026-09-02', 1)`,
    );
    const preview = (
      await previewLeave('owner-token', context.groupId, id)
    ).json<LeaveApprovalPreview>();
    const before = await client.database.select().from(shiftAssignments);
    const response = await approveLeave('owner-token', context.groupId, id, {
      acknowledgeBlockers: true,
      expectedVersion: 1,
      expectedRulesVersion: context.rulesVersion,
      expectedPeriodVersions: preview.periodVersions,
      operationId: randomUUID(),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.message).toContain('已发布班次');
    expect(await client.database.select().from(shiftAssignments)).toEqual(before);
    const [events] = await client.database.execute(
      sql`SELECT id FROM schedule_events WHERE object_id = ${id} AND event_type = 'leave_request_approved'`,
    );
    expect(events).toEqual([]);
  });

  it('approves and revokes without clearing, cover events or assignment changes', async () => {
    const context = await seedPublishedSchedule(['b', 'c']);
    const created = (
      await submitLeave('a-token', context.groupId, {
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-09-04T00:00:00Z',
        isAllDay: true,
        leaveType: 'other',
      })
    ).json<LeaveRequest>();
    const preview = (
      await previewLeave('owner-token', context.groupId, created.id)
    ).json<LeaveApprovalPreview>();
    expect(preview.vacancies).toEqual([]);
    const before = await client.database.select().from(shiftAssignments);
    expect(
      (
        await approveLeave('owner-token', context.groupId, created.id, {
          expectedVersion: 1,
          expectedRulesVersion: context.rulesVersion,
          expectedPeriodVersions: preview.periodVersions,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await revokeLeave('a-token', context.groupId, created.id, {
          expectedVersion: 2,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(200);
    expect(await client.database.select().from(shiftAssignments)).toEqual(before);
    const [events] = await client.database.execute(
      sql`SELECT id FROM schedule_events WHERE event_type IN ('leave_assignments_cleared','leave_cover_completed')`,
    );
    expect(events).toEqual([]);
  });

  it('allows leave after the actual assignment was transferred away', async () => {
    const context = await seedPublishedSchedule();
    await client.database
      .update(shiftAssignments)
      .set({ actualMembershipId: context.membershipIds.b, actualMemberName: 'B Doctor' })
      .where(eq(shiftAssignments.businessDate, '2026-09-01'));
    expect(
      (
        await submitLeave('a-token', context.groupId, {
          startsAt: '2026-09-01T00:00:00Z',
          endsAt: '2026-09-02T00:00:00Z',
          isAllDay: true,
          leaveType: 'sick',
        })
      ).statusCode,
    ).toBe(201);
  });

  it('finds cross-month overnight and excludes the exact exclusive end', async () => {
    const context = await seedPublishedSchedule(['a']);
    await client.database
      .update(shiftAssignments)
      .set({ startsAt: new Date('2026-09-30T01:00:00Z'), endsAt: new Date('2026-10-01T01:00:00Z') })
      .where(eq(shiftAssignments.businessDate, '2026-09-30'));
    expect(
      (
        await submitLeave('a-token', context.groupId, {
          startsAt: '2026-10-01T00:00:00Z',
          endsAt: '2026-10-02T00:00:00Z',
          isAllDay: true,
          leaveType: 'sick',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await submitLeave('a-token', context.groupId, {
          startsAt: '2026-10-01T00:30:00Z',
          endsAt: '2026-10-01T01:30:00Z',
          leaveType: 'sick',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await submitLeave('a-token', context.groupId, {
          startsAt: '2026-10-01T01:00:00Z',
          endsAt: '2026-10-01T02:00:00Z',
          leaveType: 'sick',
        })
      ).statusCode,
    ).toBe(201);
  });

  it('returns private availability across year boundaries and restores it on rejection or cancellation', async () => {
    const context = await seedPublishedSchedule();
    const leave = (
      await submitLeave('a-token', context.groupId, {
        startsAt: '2026-12-31T00:00:00Z',
        endsAt: '2027-01-03T00:00:00Z',
        isAllDay: true,
        leaveType: 'sick',
        reason: 'private reason',
      })
    ).json<LeaveRequest>();
    const availability = async (startDate: string, endDate: string) =>
      (
        await app.inject({
          method: 'GET',
          headers: { authorization: 'Bearer owner-token' },
          url: `/groups/${context.groupId}/scheduling-availability?scheduleRoleId=${context.roleId}&startDate=${startDate}&endDate=${endDate}`,
        })
      ).json<{ membershipId: string; blocked: boolean }[]>();
    expect(await availability('2027-01-01', '2027-01-02')).toContainEqual({
      membershipId: context.membershipIds.a,
      blocked: true,
    });
    expect(await availability('2027-01-03', '2027-01-04')).toContainEqual({
      membershipId: context.membershipIds.a,
      blocked: false,
    });
    expect(JSON.stringify(await availability('2026-12-31', '2026-12-31'))).not.toContain('private');
    expect(
      (
        await rejectLeave('owner-token', context.groupId, leave.id, {
          expectedVersion: 1,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(200);
    expect(await availability('2027-01-01', '2027-01-02')).toContainEqual({
      membershipId: context.membershipIds.a,
      blocked: false,
    });
    const pending = (
      await submitLeave('a-token', context.groupId, {
        startsAt: '2026-12-31T00:00:00Z',
        endsAt: '2027-01-03T00:00:00Z',
        isAllDay: true,
        leaveType: 'sick',
      })
    ).json<LeaveRequest>();
    await cancelLeave('a-token', context.groupId, pending.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(await availability('2027-01-01', '2027-01-02')).toContainEqual({
      membershipId: context.membershipIds.a,
      blocked: false,
    });
  });

  it.each(['pending', 'approved'])(
    'blocks old draft publication for %s leave without partial publication',
    async (status) => {
      const context = await seedPublishedSchedule();
      await client.database.execute(
        sql`UPDATE schedule_periods SET status = 'draft' WHERE id = ${context.periodId}`,
      );
      const leave = await submitLeave('a-token', context.groupId, {
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-09-02T00:00:00Z',
        isAllDay: true,
        leaveType: 'sick',
      });
      expect(leave.statusCode).toBe(201);
      await client.database.execute(
        sql`UPDATE leave_requests SET status = ${status} WHERE id = ${leave.json().id}`,
      );
      const [versions] = await client.database.execute(
        sql`SELECT version FROM schedule_periods WHERE id = ${context.periodId}`,
      );
      const version = (versions as unknown as { version: number }[])[0]!.version;
      const before = await client.database.select().from(shiftAssignments);
      const response = await app.inject({
        method: 'POST',
        headers: { authorization: 'Bearer owner-token' },
        url: `/groups/${context.groupId}/schedules/${context.periodId}/publish`,
        payload: { expectedVersion: version, operationId: randomUUID(), acknowledgeBlockers: true },
      });
      expect(response.statusCode).toBe(409);
      expect(await client.database.select().from(shiftAssignments)).toEqual(before);
    },
  );

  it('serializes concurrent leave submission and publication using the group lock', async () => {
    const context = await seedPublishedSchedule();
    await client.database.execute(
      sql`UPDATE schedule_periods SET status = 'draft' WHERE id = ${context.periodId}`,
    );
    const [versions] = await client.database.execute(
      sql`SELECT version FROM schedule_periods WHERE id = ${context.periodId}`,
    );
    const version = (versions as unknown as { version: number }[])[0]!.version;
    const results = await Promise.all([
      submitLeave('a-token', context.groupId, {
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-09-02T00:00:00Z',
        isAllDay: true,
        leaveType: 'sick',
      }),
      app.inject({
        method: 'POST',
        headers: { authorization: 'Bearer owner-token' },
        url: `/groups/${context.groupId}/schedules/${context.periodId}/publish`,
        payload: { expectedVersion: version, operationId: randomUUID() },
      }),
    ]);
    expect(results.filter((response) => response.statusCode < 300)).toHaveLength(1);
    expect(results.filter((response) => response.statusCode === 409)).toHaveLength(1);
  });

  async function seedPublishedSchedule(
    memberKeys: readonly string[] = ['a', 'b', 'c'],
    businessMonth = '2026-09',
  ): Promise<Context> {
    const groupId = await createGroup('Leave group');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await addRosterEntry(groupId, 'C Doctor');
    for (const [token, realName] of [
      ['a-token', 'A Doctor'],
      ['b-token', 'B Doctor'],
      ['c-token', 'C Doctor'],
    ] as const) {
      await attachTestMember(token, groupId, realName);
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
    await configureFixturePattern(groupId, roleId, {
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

    return {
      groupId,
      membershipIds,
      periodId,
      roleId,
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

  async function listMyLeaves(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/leave-requests`,
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

  async function previewLeave(token: string, groupId: string, leaveRequestId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: {},
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
      readonly expectedAssignmentVersions?: Readonly<Record<string, number>>;
      readonly expectedRulesVersion: number;
      readonly expectedVersion: number;
      readonly operationId: string;
      readonly strategy?: string;
    },
  ) {
    const latest = await previewLeave(token, groupId, leaveRequestId);
    const versions =
      latest.statusCode === 200 ? latest.json<LeaveApprovalPreview>().assignmentVersions : {};
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: {
        acknowledgeBlockers: true,
        ...body,
        expectedAssignmentVersions: body.expectedAssignmentVersions ?? versions,
      },
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

  async function generatePublished(
    groupId: string,
    roleId: string,
    rulesVersion: number,
    businessMonth = '2026-09',
  ) {
    return createScheduleFixture(app, client, {
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        businessMonth,
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion,
        scheduleRoleIds: [roleId],
      },
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

  async function createGroup(name: string): Promise<string> {
    const response = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'POST',
      payload: { name },
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

  async function attachTestMember(
    token: string,
    targetGroupId: string,
    realName: string,
  ): Promise<void> {
    void token;
    await insertDirectMembership(client, { groupId: targetGroupId, realName });
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
      { readonly version: number } | undefined;
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: {
        expectedRoleVersion: role?.version,
        expectedRulesVersion: config.rulesVersion,
        membershipIds,
        operationId: randomUUID(),
      },
      url: `/groups/${groupId}/schedule-roles/${roleId}/members`,
    });

    expect(response.statusCode).toBe(200);
  }

  async function configureFixturePattern(
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
    await configureScheduleFixture(client, groupId, roleId, payload);
  }
});

interface Context {
  readonly groupId: string;
  readonly membershipIds: Readonly<Record<string, string>>;
  readonly periodId: string;
  readonly roleId: string;
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
  await client.database.execute(sql`DROP TABLE IF EXISTS external_duty_actions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS external_duty_checks`);
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
  await client.database.execute(sql`DROP TABLE IF EXISTS group_visitor_qr_assets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_calendar_changes`);
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
