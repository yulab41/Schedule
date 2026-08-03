import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { DutyAdjustmentPreview, DutyAdjustmentRequest } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  schedulePeriods,
  shiftAssignments,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { and, eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('paired duty adjustments', () => {
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

  it('previews a pair and completes it after the overtime member accepts and the admin approves', async () => {
    const context = await seedPublishedRotation();

    const previewResponse = await previewDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json() as DutyAdjustmentPreview;
    expect(preview).toMatchObject({
      conflicts: [],
      deductedMemberName: 'A Doctor',
      groupId: context.groupId,
      nextStatus: 'pending_target',
      overtimeAutoAccepts: false,
      overtimeMemberName: 'B Doctor',
      requiresApproval: true,
    });
    expect(preview.coveredAssignment).toMatchObject({
      assignmentId: context.assignments.aSep1.id,
      businessDate: '2026-09-01',
      plannedMemberId: context.membershipIds.a,
      scheduleRoleName: '一线',
      shiftTypeName: '全天班',
    });

    const created = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as DutyAdjustmentRequest;
    expect(createdBody).toMatchObject({
      deductedMemberName: 'A Doctor',
      overtimeMemberName: 'B Doctor',
      status: 'pending_target',
      version: 1,
    });
    expect(createdBody.assignmentVersion).toBe(context.assignments.aSep1.version);

    const mineAsB = (
      await listMyDutyAdjustments('b-token', context.groupId)
    ).json() as DutyAdjustmentRequest[];
    expect(mineAsB.map((request) => request.id)).toContain(createdBody.id);

    const accepted = await acceptDutyAdjustment('b-token', context.groupId, createdBody.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({
      status: 'pending_approval',
      version: 2,
    });

    const approved = await approveDutyAdjustment('owner-token', context.groupId, createdBody.id, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({
      status: 'completed',
      version: 3,
    });

    const actual = await readActualMember(context.assignments.aSep1.id);
    expect(actual).toEqual({
      actualMembershipId: context.membershipIds.b,
      actualMemberName: 'B Doctor',
    });
    const planned = await readPlannedMember(context.assignments.aSep1.id);
    expect(planned).toBe(context.membershipIds.a);

    const eventTypes = (
      await client.database.execute(
        sql`SELECT event_type AS eventType
            FROM schedule_events
            WHERE group_id = ${context.groupId} AND event_type LIKE 'duty_adjustment%'`,
      )
    )[0] as unknown as readonly { eventType: string }[];
    const types = eventTypes.map((row) => row.eventType).sort();
    expect(types).toEqual(
      [
        'duty_adjustment_request_created',
        'duty_adjustment_request_accepted',
        'duty_adjustment_request_approved',
        'duty_adjustment_completed',
      ].sort(),
    );

    const calendar = (
      await getCalendar('a-token', context.groupId, '2026-09')
    ).json() as CalendarResponse;
    const sep1 = calendar.assignments.find(
      (assignment) => assignment.businessDate === '2026-09-01',
    );
    expect(sep1).toMatchObject({ actualMemberName: 'B Doctor', changeMarkers: ['overtime'] });
  });

  it('completes immediately when the overtime member auto-accepts and the group does not require approval', async () => {
    const context = await seedPublishedRotation();
    expect((await updateGroupSettings('owner-token', context.groupId, false)).statusCode).toBe(200);
    expect((await updateMySettings('b-token', context.groupId, true)).statusCode).toBe(200);

    const preview = (
      await previewDutyAdjustment('a-token', context.groupId, {
        coveredAssignmentId: context.assignments.aSep1.id,
        overtimeMembershipId: context.membershipIds.b,
      })
    ).json() as DutyAdjustmentPreview;
    expect(preview).toMatchObject({
      nextStatus: 'completed',
      overtimeAutoAccepts: true,
      requiresApproval: false,
    });

    const created = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: 'completed', version: 2 });
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBe(
      context.membershipIds.b,
    );
  });

  it('does not let automatic acceptance bypass administrator approval', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, true);
    expect((await getGroupSettings('b-token', context.groupId)).json()).toEqual({
      requiresApproval: true,
    });

    const created = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as DutyAdjustmentRequest;
    expect(createdBody.status).toBe('pending_approval');
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBeNull();

    const memberApproval = await approveDutyAdjustment('b-token', context.groupId, createdBody.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(memberApproval.statusCode).toBe(403);

    const approved = await approveDutyAdjustment('owner-token', context.groupId, createdBody.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'completed', version: 2 });
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBe(
      context.membershipIds.b,
    );
  });

  it('lets only one active relation use the same shift and blocks swaps on it', async () => {
    const context = await seedPublishedRotation();
    const first = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(first.statusCode).toBe(201);

    const second = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.c,
    });
    expect(second.statusCode).toBe(409);
    expect((second.json() as ErrorResponse).error.message).toContain('已有一组');

    const blockedSwap = await createSwap('c-token', context.groupId, {
      initiatorAssignmentId: context.assignments.cSep3.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.aSep1.id,
      targetMembershipId: context.membershipIds.a,
    });
    expect(blockedSwap.statusCode).toBe(409);
    expect((blockedSwap.json() as ErrorResponse).error.message).toContain('加扣班');

    await rejectDutyAdjustment(
      'b-token',
      context.groupId,
      (first.json() as DutyAdjustmentRequest).id,
      {
        expectedVersion: 1,
        operationId: randomUUID(),
      },
    );
    const third = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.c,
    });
    expect(third.statusCode).toBe(201);
    const thirdBody = third.json() as DutyAdjustmentRequest;
    await acceptDutyAdjustment('c-token', context.groupId, thirdBody.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    await approveDutyAdjustment('owner-token', context.groupId, thirdBody.id, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });

    const fourth = await createDutyAdjustment('c-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(fourth.statusCode).toBe(409);

    await revokeDutyAdjustment('owner-token', context.groupId, thirdBody.id, {
      expectedVersion: 3,
      operationId: randomUUID(),
      reason: '重新安排',
    });
    const fifth = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(fifth.statusCode).toBe(201);

    const [requestCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM duty_adjustments WHERE group_id = ${context.groupId}`,
    );
    expect(requestCount).toEqual([{ count: 3 }]);
  });

  it('invalidates the request when the covered assignment version changes', async () => {
    const context = await seedPublishedRotation();
    const created = (
      await createDutyAdjustment('a-token', context.groupId, {
        coveredAssignmentId: context.assignments.aSep1.id,
        operationId: randomUUID(),
        overtimeMembershipId: context.membershipIds.b,
      })
    ).json() as DutyAdjustmentRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments SET version = version + 1 WHERE id = ${context.assignments.aSep1.id}`,
    );
    const accepted = await acceptDutyAdjustment('b-token', context.groupId, created.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(accepted.statusCode).toBe(409);
    expect((accepted.json() as ErrorResponse).error.latestData).toMatchObject({
      id: context.assignments.aSep1.id,
      objectType: 'shift_assignment',
      version: context.assignments.aSep1.version + 1,
    });
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBeNull();
  });

  it('blocks requests when the overtime member is no longer in the role or has approved leave', async () => {
    const context = await seedPublishedRotation();
    await replaceRoleMembers(context.groupId, context.roleId, [
      context.membershipIds.a,
      context.membershipIds.c,
    ]);

    const notEligible = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(notEligible.statusCode).toBe(409);
    const latestData = (notEligible.json() as ErrorResponse).error.latestData as {
      conflicts: readonly { code: string; membershipId: string }[];
    };
    expect(latestData.conflicts).toEqual([
      expect.objectContaining({
        code: 'MEMBER_NOT_ELIGIBLE',
        membershipId: context.membershipIds.b,
      }),
    ]);

    await replaceRoleMembers(context.groupId, context.roleId, [
      context.membershipIds.a,
      context.membershipIds.b,
      context.membershipIds.c,
    ]);
    const leaveRequestId = (
      await submitLeave('b-token', context.groupId, {
        endsAt: '2026-09-02T00:00:00.000Z',
        isAllDay: true,
        leaveType: 'sick',
        reason: 'B 九月一号请假',
        startsAt: '2026-09-01T00:00:00.000Z',
      })
    ).json() as { id: string };
    const leavePreview = (
      await previewLeave('owner-token', context.groupId, leaveRequestId.id)
    ).json() as { periodVersions: Record<string, number>; rulesVersion: number };
    expect(
      (
        await approveLeave('owner-token', context.groupId, leaveRequestId.id, {
          expectedPeriodVersions: leavePreview.periodVersions,
          expectedRulesVersion: leavePreview.rulesVersion,
          expectedVersion: 1,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(200);

    const leaveConflict = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(leaveConflict.statusCode).toBe(409);
    expect(
      (
        (leaveConflict.json() as ErrorResponse).error.latestData as {
          conflicts: readonly { code: string; membershipId: string }[];
        }
      ).conflicts,
    ).toEqual([
      expect.objectContaining({
        code: 'MEMBER_LEAVE_OVERLAP',
        membershipId: context.membershipIds.b,
      }),
    ]);
  });

  it('requires a reason and administrator permission for direct application', async () => {
    const context = await seedPublishedRotation();
    const withoutReason = await createDirectDutyAdjustment('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(withoutReason.statusCode).toBe(400);

    const asMember = await createDirectDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
      reason: '成员不能直接代值',
    });
    expect(asMember.statusCode).toBe(403);

    const direct = await createDirectDutyAdjustment('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
      reason: '管理员安排 B 代值',
    });
    expect(direct.statusCode).toBe(201);
    const directBody = direct.json() as DutyAdjustmentRequest;
    expect(directBody).toMatchObject({
      reason: '管理员安排 B 代值',
      status: 'completed',
      version: 2,
    });
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBe(
      context.membershipIds.b,
    );

    const calendar = (
      await getCalendar('a-token', context.groupId, '2026-09')
    ).json() as CalendarResponse;
    const sep1 = calendar.assignments.find(
      (assignment) => assignment.businessDate === '2026-09-01',
    );
    expect(sep1).toMatchObject({ actualMemberName: 'B Doctor', changeMarkers: ['overtime'] });
  });

  it('keeps archived assignment snapshots readable in approval history', async () => {
    const context = await seedPublishedRotation();
    const created = await createDirectDutyAdjustment('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
      reason: '历史记录回归测试',
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as DutyAdjustmentRequest;

    await client.database
      .update(shiftAssignments)
      .set({ deletedAt: new Date() })
      .where(eq(shiftAssignments.id, context.assignments.aSep1.id));

    const approvals = await listDutyAdjustmentApprovals('owner-token', context.groupId);
    expect(approvals.statusCode, approvals.body).toBe(200);
    expect((approvals.json() as DutyAdjustmentRequest[]).map((request) => request.id)).toContain(
      createdBody.id,
    );
  });

  it('rejects and cancels pending requests without touching the actual member', async () => {
    const context = await seedPublishedRotation();
    const first = (
      await createDutyAdjustment('a-token', context.groupId, {
        coveredAssignmentId: context.assignments.aSep1.id,
        operationId: randomUUID(),
        overtimeMembershipId: context.membershipIds.b,
      })
    ).json() as DutyAdjustmentRequest;
    const rejected = await rejectDutyAdjustment('b-token', context.groupId, first.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({ status: 'rejected' });
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBeNull();

    const second = (
      await createDutyAdjustment('a-token', context.groupId, {
        coveredAssignmentId: context.assignments.aSep4.id,
        operationId: randomUUID(),
        overtimeMembershipId: context.membershipIds.c,
      })
    ).json() as DutyAdjustmentRequest;
    const cancelled = await cancelDutyAdjustment('a-token', context.groupId, second.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ status: 'cancelled' });

    const approveRejected = await approveDutyAdjustment('owner-token', context.groupId, first.id, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    expect(approveRejected.statusCode).toBe(409);
  });

  it('revokes a completed relation with a required reason and restores the deducted member', async () => {
    const context = await seedPublishedRotation();
    const created = (
      await createDutyAdjustment('a-token', context.groupId, {
        coveredAssignmentId: context.assignments.aSep1.id,
        operationId: randomUUID(),
        overtimeMembershipId: context.membershipIds.b,
      })
    ).json() as DutyAdjustmentRequest;
    await acceptDutyAdjustment('b-token', context.groupId, created.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    const completed = (
      await approveDutyAdjustment('owner-token', context.groupId, created.id, {
        expectedVersion: 2,
        operationId: randomUUID(),
      })
    ).json() as DutyAdjustmentRequest;
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBe(
      context.membershipIds.b,
    );

    const withoutReason = await revokeDutyAdjustment('owner-token', context.groupId, completed.id, {
      expectedVersion: 3,
      operationId: randomUUID(),
    });
    expect(withoutReason.statusCode).toBe(400);

    const revoked = await revokeDutyAdjustment('owner-token', context.groupId, completed.id, {
      expectedVersion: 3,
      operationId: randomUUID(),
      reason: 'B 临时请假取消代值',
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toMatchObject({
      reason: 'B 临时请假取消代值',
      status: 'revoked',
      version: 4,
    });
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBe(
      context.membershipIds.a,
    );
    expect(await readPlannedMember(context.assignments.aSep1.id)).toBe(context.membershipIds.a);

    const eventTypes = (
      await client.database.execute(
        sql`SELECT event_type AS eventType
            FROM schedule_events
            WHERE group_id = ${context.groupId} AND event_type = 'duty_adjustment_revoked'`,
      )
    )[0] as unknown as readonly { eventType: string }[];
    expect(eventTypes).toHaveLength(1);

    const [rowCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM duty_adjustments WHERE group_id = ${context.groupId}`,
    );
    expect(rowCount).toEqual([{ count: 1 }]);
  });

  it('requires acknowledgement before withdrawing a schedule with active duty adjustments', async () => {
    const context = await seedPublishedRotation();
    const completed = await createDirectDutyAdjustment('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
      reason: '管理员安排 B 代值',
    });
    expect(completed.statusCode).toBe(201);
    const completedBody = completed.json() as DutyAdjustmentRequest;

    const periodRows = await client.database
      .select({ id: schedulePeriods.id, version: schedulePeriods.version })
      .from(schedulePeriods)
      .where(
        and(eq(schedulePeriods.groupId, context.groupId), eq(schedulePeriods.status, 'published')),
      );
    const period = periodRows[0];
    expect(period).toBeDefined();

    const preview = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${context.groupId}/schedules/${period?.id}/change-impact?action=withdraw`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      action: 'withdraw',
      workflowImpacts: [
        {
          businessDates: ['2026-09-01'],
          id: completedBody.id,
          kind: 'duty_adjustment',
          memberNames: ['A Doctor', 'B Doctor'],
          status: 'completed',
        },
      ],
    });

    const blocked = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { expectedVersion: period?.version, operationId: randomUUID() },
      url: `/groups/${context.groupId}/schedules/${period?.id}/withdraw`,
    });
    expect(blocked.statusCode).toBe(409);
    expect((blocked.json() as ErrorResponse).error.latestData).toMatchObject({
      workflowImpacts: [{ id: completedBody.id, kind: 'duty_adjustment' }],
    });

    const withdrawn = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        acknowledgeWorkflowRevocations: true,
        expectedVersion: period?.version,
        operationId: randomUUID(),
      },
      url: `/groups/${context.groupId}/schedules/${period?.id}/withdraw`,
    });
    expect(withdrawn.statusCode).toBe(200);
    expect(withdrawn.json()).toMatchObject({
      period: { status: 'withdrawn' },
      workflowImpacts: [{ id: completedBody.id, kind: 'duty_adjustment' }],
    });

    const mine = (
      await listMyDutyAdjustments('a-token', context.groupId)
    ).json() as DutyAdjustmentRequest[];
    expect(mine.find((request) => request.id === completedBody.id)).toMatchObject({
      revocationReason: '排班变更',
      status: 'revoked',
    });
    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBe(
      context.membershipIds.a,
    );
  });

  it('keeps both history rows when the same member adds once and deducts once', async () => {
    const context = await seedPublishedRotation();
    const first = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    await acceptDutyAdjustment(
      'b-token',
      context.groupId,
      (first.json() as DutyAdjustmentRequest).id,
      {
        expectedVersion: 1,
        operationId: randomUUID(),
      },
    );
    await approveDutyAdjustment(
      'owner-token',
      context.groupId,
      (first.json() as DutyAdjustmentRequest).id,
      {
        expectedVersion: 2,
        operationId: randomUUID(),
      },
    );

    const second = await createDutyAdjustment('b-token', context.groupId, {
      coveredAssignmentId: context.assignments.bSep2.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.a,
    });
    await acceptDutyAdjustment(
      'a-token',
      context.groupId,
      (second.json() as DutyAdjustmentRequest).id,
      {
        expectedVersion: 1,
        operationId: randomUUID(),
      },
    );
    await approveDutyAdjustment(
      'owner-token',
      context.groupId,
      (second.json() as DutyAdjustmentRequest).id,
      {
        expectedVersion: 2,
        operationId: randomUUID(),
      },
    );

    expect((await readActualMember(context.assignments.aSep1.id)).actualMembershipId).toBe(
      context.membershipIds.b,
    );
    expect((await readActualMember(context.assignments.bSep2.id)).actualMembershipId).toBe(
      context.membershipIds.a,
    );
    const [rowCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM duty_adjustments WHERE group_id = ${context.groupId}`,
    );
    const [completedEvents] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count
          FROM schedule_events
          WHERE group_id = ${context.groupId} AND event_type = 'duty_adjustment_completed'`,
    );
    expect(rowCount).toEqual([{ count: 2 }]);
    expect(completedEvents).toEqual([{ count: 2 }]);
  });

  it('replays the same create operation id without duplicates', async () => {
    const context = await seedPublishedRotation();
    const operationId = randomUUID();
    const body = {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId,
      overtimeMembershipId: context.membershipIds.b,
    };

    const first = await createDutyAdjustment('a-token', context.groupId, body);
    expect(first.statusCode).toBe(201);
    const replay = await createDutyAdjustment('a-token', context.groupId, body);
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());

    const [requestCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM duty_adjustments WHERE group_id = ${context.groupId}`,
    );
    const [eventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE event_type = 'duty_adjustment_request_created'`,
    );
    expect(requestCount).toEqual([{ count: 1 }]);
    expect(eventCount).toEqual([{ count: 1 }]);
  });

  it('restricts permissions and exposes group settings', async () => {
    const context = await seedPublishedRotation();
    expect(
      (
        await previewDutyAdjustment('outsider-token', context.groupId, {
          coveredAssignmentId: context.assignments.aSep1.id,
          overtimeMembershipId: context.membershipIds.b,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await createDutyAdjustment('outsider-token', context.groupId, {
          coveredAssignmentId: context.assignments.aSep1.id,
          operationId: randomUUID(),
          overtimeMembershipId: context.membershipIds.b,
        })
      ).statusCode,
    ).toBe(403);

    const created = (
      await createDutyAdjustment('a-token', context.groupId, {
        coveredAssignmentId: context.assignments.aSep1.id,
        operationId: randomUUID(),
        overtimeMembershipId: context.membershipIds.b,
      })
    ).json() as DutyAdjustmentRequest;
    expect(
      (
        await revokeDutyAdjustment('a-token', context.groupId, created.id, {
          expectedVersion: 1,
          operationId: randomUUID(),
          reason: '成员不能撤销',
        })
      ).statusCode,
    ).toBe(403);
    expect((await getGroupSettings('b-token', context.groupId)).json()).toEqual({
      requiresApproval: true,
    });
    expect((await updateGroupSettings('b-token', context.groupId, false)).statusCode).toBe(403);
    expect((await updateGroupSettings('owner-token', context.groupId, false)).statusCode).toBe(200);
    expect((await getGroupSettings('b-token', context.groupId)).json()).toEqual({
      requiresApproval: false,
    });
  });

  async function seedPublishedRotation(): Promise<Context> {
    const groupId = await createGroup('Duty group', '5678');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await addRosterEntry(groupId, 'C Doctor');
    for (const [token] of [
      ['a-token', 'A Doctor'],
      ['b-token', 'B Doctor'],
      ['c-token', 'C Doctor'],
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
    const membershipIds = Object.fromEntries(
      ['a', 'b', 'c'].map((key) => {
        const id = membershipById.get(`${key.toUpperCase()} Doctor`);
        expect(id).toBeDefined();
        return [key, id as string];
      }),
    ) as { a: string; b: string; c: string };
    await replaceRoleMembers(groupId, roleId, [membershipIds.a, membershipIds.b, membershipIds.c]);
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
    const generated = await generatePublished(groupId, roleId, rulesVersion);
    expect(generated.statusCode).toBe(200);

    const assignmentRows = (
      await client.database.execute(
        sql`SELECT id, business_date AS businessDate, planned_membership_id AS plannedMembershipId, version
            FROM shift_assignments
            WHERE business_date IN ('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04')
            ORDER BY business_date`,
      )
    )[0] as unknown as readonly {
      businessDate?: string;
      id: string;
      plannedMembershipId: string | null;
      version: number;
    }[];
    const byDate = new Map(assignmentRows.map((row) => [row.businessDate, row]));
    expect(byDate.get('2026-09-01')?.plannedMembershipId).toBe(membershipIds.a);
    expect(byDate.get('2026-09-02')?.plannedMembershipId).toBe(membershipIds.b);
    expect(byDate.get('2026-09-03')?.plannedMembershipId).toBe(membershipIds.c);
    expect(byDate.get('2026-09-04')?.plannedMembershipId).toBe(membershipIds.a);

    return {
      assignments: {
        aSep1: toAssignment(byDate.get('2026-09-01')),
        aSep4: toAssignment(byDate.get('2026-09-04')),
        bSep2: toAssignment(byDate.get('2026-09-02')),
        cSep3: toAssignment(byDate.get('2026-09-03')),
      },
      groupId,
      membershipIds,
      roleId,
    };
  }

  async function createDutyAdjustment(
    token: string,
    groupId: string,
    body: {
      readonly coveredAssignmentId: string;
      readonly operationId: string;
      readonly overtimeMembershipId: string;
      readonly reason?: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments`,
    });
  }

  async function previewDutyAdjustment(
    token: string,
    groupId: string,
    body: {
      readonly coveredAssignmentId: string;
      readonly overtimeMembershipId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/preview`,
    });
  }

  async function createDirectDutyAdjustment(
    token: string,
    groupId: string,
    body: {
      readonly coveredAssignmentId: string;
      readonly operationId: string;
      readonly overtimeMembershipId: string;
      readonly reason?: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/direct`,
    });
  }

  async function acceptDutyAdjustment(
    token: string,
    groupId: string,
    dutyAdjustmentId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/accept`,
    });
  }

  async function approveDutyAdjustment(
    token: string,
    groupId: string,
    dutyAdjustmentId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/approve`,
    });
  }

  async function rejectDutyAdjustment(
    token: string,
    groupId: string,
    dutyAdjustmentId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/reject`,
    });
  }

  async function cancelDutyAdjustment(
    token: string,
    groupId: string,
    dutyAdjustmentId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/cancel`,
    });
  }

  async function revokeDutyAdjustment(
    token: string,
    groupId: string,
    dutyAdjustmentId: string,
    body: {
      readonly expectedVersion: number;
      readonly operationId: string;
      readonly reason?: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/revoke`,
    });
  }

  async function listMyDutyAdjustments(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/duty-adjustments`,
    });
  }

  async function listDutyAdjustmentApprovals(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/duty-adjustments/approvals`,
    });
  }

  async function getGroupSettings(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/duty-adjustments/settings`,
    });
  }

  async function updateGroupSettings(token: string, groupId: string, requiresApproval: boolean) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { requiresApproval },
      url: `/groups/${groupId}/duty-adjustments/settings`,
    });
  }

  async function updateMySettings(token: string, groupId: string, autoAcceptSwaps: boolean) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { autoAcceptSwaps },
      url: `/groups/${groupId}/swaps/my-settings`,
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

  async function submitLeave(token: string, groupId: string, body: object) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/leave-requests`,
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
      readonly expectedPeriodVersions: Readonly<Record<string, number>>;
      readonly expectedRulesVersion: number;
      readonly expectedVersion: number;
      readonly operationId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/leave-requests/${leaveRequestId}/approve`,
    });
  }

  async function getCalendar(token: string, groupId: string, businessMonth: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/calendar?businessMonth=${businessMonth}`,
    });
  }

  async function readActualMember(assignmentId: string): Promise<ActualMemberValue> {
    const rows = (
      await client.database.execute(
        sql`SELECT actual_membership_id AS actualMembershipId,
                   actual_member_name AS actualMemberName
            FROM shift_assignments
            WHERE id = ${assignmentId}`,
      )
    )[0] as unknown as readonly {
      actualMemberName: string | null;
      actualMembershipId: string | null;
    }[];
    return (
      rows[0] ?? {
        actualMemberName: null,
        actualMembershipId: null,
      }
    );
  }

  async function readPlannedMember(assignmentId: string): Promise<string | null> {
    const rows = (
      await client.database.execute(
        sql`SELECT planned_membership_id AS plannedMembershipId
            FROM shift_assignments
            WHERE id = ${assignmentId}`,
      )
    )[0] as unknown as readonly { plannedMembershipId: string | null }[];
    return rows[0]?.plannedMembershipId ?? null;
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
});

interface Context {
  readonly assignments: {
    readonly aSep1: AssignmentSummary;
    readonly aSep4: AssignmentSummary;
    readonly bSep2: AssignmentSummary;
    readonly cSep3: AssignmentSummary;
  };
  readonly groupId: string;
  readonly membershipIds: { readonly a: string; readonly b: string; readonly c: string };
  readonly roleId: string;
}

interface AssignmentSummary {
  readonly id: string;
  readonly version: number;
}

interface ActualMemberValue {
  readonly actualMemberName: string | null;
  readonly actualMembershipId: string | null;
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
    readonly actualMemberName?: string;
    readonly businessDate: string;
    readonly changeMarkers: readonly string[];
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

function toAssignment(
  row:
    | {
        readonly businessDate?: string;
        readonly id: string;
        readonly plannedMembershipId: string | null;
        readonly version: number;
      }
    | undefined,
): AssignmentSummary {
  if (row === undefined) {
    throw new Error('The seeded assignment is missing.');
  }
  return { id: row.id, version: row.version };
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
