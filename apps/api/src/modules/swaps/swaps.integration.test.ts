import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { DutyAdjustmentRequest, SwapPreview, SwapRequest } from '@schedule/contracts';
import { getChinaStandardTimeBusinessDate } from '@schedule/scheduling-domain';
import {
  createTestDatabaseClient,
  migrateDatabase,
  schedulePeriods,
  shiftAssignments,
  type DatabaseClient,
  type DatabaseConnectionOptions,
  withTransaction,
} from '@schedule/database';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertDirectMembership } from '@schedule/test-fixtures';
import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import {
  staleWorkflowArchiveReason,
  WorkflowSelfHealingService,
} from '../workflows/workflow-self-healing-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('member shift swaps', () => {
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

  it('previews a swap pair and completes it after the target accepts manually', async () => {
    const context = await seedPublishedRotation();
    await updateGroupSettings('owner-token', context.groupId, false);
    await updateMySettings('b-token', context.groupId, false);

    const previewResponse = await previewSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(previewResponse.statusCode).toBe(200);
    const preview = previewResponse.json() as SwapPreview;
    expect(preview).toMatchObject({
      conflicts: [],
      groupId: context.groupId,
      initiatorEligibleForTargetShift: true,
      nextStatus: 'pending_target',
      requiresApproval: false,
      targetAutoAccepts: false,
      targetEligibleForInitiatorShift: true,
    });
    expect(preview.initiatorAssignment).toMatchObject({
      assignmentId: context.assignments.aSep1.id,
      businessDate: '2026-09-01',
      plannedMemberId: context.membershipIds.a,
      scheduleRoleName: '一线',
      shiftTypeName: '全天班',
    });

    const created = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as SwapRequest;
    expect(createdBody).toMatchObject({
      initiatorMemberName: 'A Doctor',
      status: 'pending_target',
      targetMemberName: 'B Doctor',
      version: 1,
    });
    expect(createdBody.initiatorAssignmentVersion).toBe(context.assignments.aSep1.version);
    expect(createdBody.targetAssignmentVersion).toBe(context.assignments.bSep2.version);

    const mineAsB = (await listMySwaps('b-token', context.groupId)).json() as SwapRequest[];
    expect(mineAsB.map((request) => request.id)).toContain(createdBody.id);

    const accepted = await acceptSwap('b-token', context.groupId, createdBody.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({
      status: 'completed',
      version: 2,
    });

    const actuals = await readActualMembers(context);
    expect(actuals.aSep1).toEqual({
      actualMembershipId: context.membershipIds.b,
      actualMemberName: 'B Doctor',
    });
    expect(actuals.bSep2).toEqual({
      actualMembershipId: context.membershipIds.a,
      actualMemberName: 'A Doctor',
    });
    const planned = await readPlannedMembers(context);
    expect(planned.aSep1).toBe(context.membershipIds.a);
    expect(planned.bSep2).toBe(context.membershipIds.b);

    const eventTypes = (
      await client.database.execute(
        sql`SELECT event_type AS eventType
            FROM schedule_events
            WHERE group_id = ${context.groupId} AND event_type LIKE 'swap%'`,
      )
    )[0] as unknown as readonly { eventType: string }[];
    const types = eventTypes.map((row) => row.eventType).sort();
    expect(types).toEqual(
      ['swap_request_created', 'swap_request_accepted', 'swap_completed'].sort(),
    );

    const calendar = (
      await getCalendar('a-token', context.groupId, '2026-09')
    ).json() as CalendarResponse;
    const sep1 = calendar.assignments.find(
      (assignment) => assignment.businessDate === '2026-09-01',
    );
    const sep2 = calendar.assignments.find(
      (assignment) => assignment.businessDate === '2026-09-02',
    );
    expect(sep1).toMatchObject({ actualMemberName: 'B Doctor', changeMarkers: ['swap'] });
    expect(sep2).toMatchObject({ actualMemberName: 'A Doctor', changeMarkers: ['swap'] });
  });

  it('previews and completes member and administrator swaps across published months', async () => {
    const context = await seedPublishedRotation();
    await updateGroupSettings('owner-token', context.groupId, false);
    const rulesVersion = (await getConfig('owner-token', context.groupId)).rulesVersion;
    expect(
      (await generatePublished(context.groupId, context.roleId, rulesVersion, '2026-10'))
        .statusCode,
    ).toBe(200);

    const octoberRows = (
      await client.database.execute(
        sql`SELECT id, business_date AS businessDate, planned_membership_id AS plannedMembershipId, version
            FROM shift_assignments
            WHERE business_date IN ('2026-10-02', '2026-10-05')
            ORDER BY business_date`,
      )
    )[0] as unknown as readonly {
      businessDate?: string;
      id: string;
      plannedMembershipId: string | null;
      version: number;
    }[];
    const octoberByDate = new Map(octoberRows.map((row) => [row.businessDate, row]));
    const bOct2 = toAssignment(octoberByDate.get('2026-10-02'));
    const bOct5 = toAssignment(octoberByDate.get('2026-10-05'));
    expect(octoberByDate.get('2026-10-02')?.plannedMembershipId).toBe(context.membershipIds.b);
    expect(octoberByDate.get('2026-10-05')?.plannedMembershipId).toBe(context.membershipIds.b);

    const previewResponse = await previewSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      targetAssignmentId: bOct2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json() as SwapPreview).toMatchObject({
      conflicts: [],
      initiatorAssignment: { businessDate: '2026-09-01' },
      nextStatus: 'completed',
      targetAssignment: { businessDate: '2026-10-02' },
    });

    const memberSwap = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: bOct2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(memberSwap.statusCode, memberSwap.body).toBe(201);
    expect(memberSwap.json()).toMatchObject({ status: 'completed' });

    const administratorSwap = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep4.id,
      operationId: randomUUID(),
      targetAssignmentId: bOct5.id,
    });
    expect(administratorSwap.statusCode, administratorSwap.body).toBe(201);
    expect(administratorSwap.json()).toMatchObject({ status: 'completed' });

    const septemberCalendar = (
      await getCalendar('owner-token', context.groupId, '2026-09')
    ).json() as CalendarResponse;
    const octoberCalendar = (
      await getCalendar('owner-token', context.groupId, '2026-10')
    ).json() as CalendarResponse;
    expect(
      septemberCalendar.assignments.find((item) => item.businessDate === '2026-09-01'),
    ).toMatchObject({ actualMemberName: 'B Doctor', changeMarkers: ['swap'] });
    expect(
      octoberCalendar.assignments.find((item) => item.businessDate === '2026-10-02'),
    ).toMatchObject({ actualMemberName: 'A Doctor', changeMarkers: ['swap'] });
    expect(
      septemberCalendar.assignments.find((item) => item.businessDate === '2026-09-04'),
    ).toMatchObject({ actualMemberName: 'B Doctor', changeMarkers: ['swap'] });
    expect(
      octoberCalendar.assignments.find((item) => item.businessDate === '2026-10-05'),
    ).toMatchObject({ actualMemberName: 'A Doctor', changeMarkers: ['swap'] });

    const completedEventPeriods = (
      await client.database.execute(
        sql`SELECT DISTINCT schedule_period_id AS schedulePeriodId
            FROM schedule_events
            WHERE group_id = ${context.groupId} AND event_type = 'swap_completed'`,
      )
    )[0] as unknown as readonly { schedulePeriodId: string }[];
    expect(completedEventPeriods).toHaveLength(2);
  });

  it('allows swapping today shifts even when they have already started', async () => {
    const context = await seedPublishedRotation();
    const today = getChinaStandardTimeBusinessDate(new Date());
    await client.database
      .update(shiftAssignments)
      .set({
        businessDate: today,
        endsAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        startsAt: new Date(Date.now() - 60_000),
      })
      .where(eq(shiftAssignments.id, context.assignments.aSep1.id));
    await client.database
      .update(shiftAssignments)
      .set({
        businessDate: today,
        endsAt: new Date(Date.now() + 9 * 60 * 60 * 1000),
        startsAt: new Date(Date.now() - 120_000),
      })
      .where(eq(shiftAssignments.id, context.assignments.bSep2.id));

    const created = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(created.statusCode, created.body).toBe(201);
  });

  it('rejects swapping shifts on a past day', async () => {
    const context = await seedPublishedRotation();
    const yesterday = getChinaStandardTimeBusinessDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await client.database
      .update(shiftAssignments)
      .set({
        businessDate: yesterday,
        endsAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        startsAt: new Date(Date.now() - 60_000),
      })
      .where(eq(shiftAssignments.id, context.assignments.aSep1.id));
    await client.database
      .update(shiftAssignments)
      .set({
        businessDate: yesterday,
        endsAt: new Date(Date.now() + 9 * 60 * 60 * 1000),
        startsAt: new Date(Date.now() - 120_000),
      })
      .where(eq(shiftAssignments.id, context.assignments.bSep2.id));

    const created = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(created.statusCode, created.body).toBe(400);
    expect(created.body).toContain('已过日期');
  });

  it('completes immediately when the target auto-accepts and the group does not require approval', async () => {
    const context = await seedPublishedRotation();
    expect((await updateGroupSettings('owner-token', context.groupId, false)).statusCode).toBe(200);
    expect((await updateMySettings('b-token', context.groupId, true)).statusCode).toBe(200);

    const preview = (
      await previewSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep1.id,
        targetAssignmentId: context.assignments.bSep2.id,
        targetMembershipId: context.membershipIds.b,
      })
    ).json() as SwapPreview;
    expect(preview).toMatchObject({
      nextStatus: 'completed',
      requiresApproval: false,
      targetAutoAccepts: true,
    });

    const created = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: 'completed', version: 2 });
    const actuals = await readActualMembers(context);
    expect(actuals.aSep1.actualMembershipId).toBe(context.membershipIds.b);
    expect(actuals.bSep2.actualMembershipId).toBe(context.membershipIds.a);

    const swapEvents = (
      await client.database.execute(
        sql`SELECT before_data AS beforeData, after_data AS afterData
            FROM schedule_events
            WHERE group_id = ${context.groupId} AND event_type = 'swap_completed'`,
      )
    )[0] as unknown as readonly {
      readonly afterData: {
        readonly initiatorAssignment?: {
          readonly actualMemberId?: string | null;
          readonly actualMemberName?: string | null;
          readonly plannedMemberId?: string | null;
          readonly plannedMemberName?: string | null;
        };
      };
      readonly beforeData: {
        readonly initiatorAssignment?: {
          readonly actualMemberId?: string | null;
          readonly actualMemberName?: string | null;
          readonly plannedMemberId?: string | null;
          readonly plannedMemberName?: string | null;
        };
      };
    }[];
    expect(swapEvents).toHaveLength(1);
    expect(swapEvents[0]?.beforeData.initiatorAssignment).toMatchObject({
      plannedMemberId: context.membershipIds.a,
      plannedMemberName: 'A Doctor',
    });
    expect(swapEvents[0]?.afterData.initiatorAssignment).toMatchObject({
      actualMemberId: context.membershipIds.b,
      actualMemberName: 'B Doctor',
      plannedMemberId: context.membershipIds.a,
      plannedMemberName: 'A Doctor',
    });
  });

  it('treats a target who never set the preference as auto-accepting', async () => {
    const context = await seedPublishedRotation();
    expect((await getMySettings('b-token', context.groupId)).json()).toEqual({
      autoAcceptSwaps: true,
    });
    await updateGroupSettings('owner-token', context.groupId, false);

    const preview = (
      await previewSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep1.id,
        targetAssignmentId: context.assignments.bSep2.id,
        targetMembershipId: context.membershipIds.b,
      })
    ).json() as SwapPreview;
    expect(preview).toMatchObject({
      nextStatus: 'completed',
      requiresApproval: false,
      targetAutoAccepts: true,
    });

    const created = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: 'completed', version: 2 });
  });

  it('does not let automatic acceptance bypass administrator approval', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, true);
    await updateGroupSettings('owner-token', context.groupId, true);
    expect((await getGroupSettings('b-token', context.groupId)).json()).toEqual({
      requiresApproval: true,
    });

    const created = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as SwapRequest;
    expect(createdBody.status).toBe('pending_approval');
    expect((await readActualMembers(context)).aSep1.actualMembershipId).toBeNull();

    const memberApproval = await approveSwap('b-token', context.groupId, createdBody.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(memberApproval.statusCode).toBe(403);

    const approved = await approveSwap('owner-token', context.groupId, createdBody.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'completed', version: 2 });
    expect((await readActualMembers(context)).aSep1.actualMembershipId).toBe(
      context.membershipIds.b,
    );
    const approvals = (
      await listSwapApprovals('owner-token', context.groupId)
    ).json() as SwapRequest[];
    expect(approvals[0]).toMatchObject({
      decidedByMemberName: 'Owner Doctor',
      id: createdBody.id,
      status: 'completed',
    });
  });

  it('lets an owner directly swap any two members without approval or consent', async () => {
    const context = await seedPublishedRotation();

    const previewResponse = await previewSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      initiatorMembershipId: context.membershipIds.a,
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json() as SwapPreview).toMatchObject({
      conflicts: [],
      nextStatus: 'completed',
      requiresApproval: false,
      targetAutoAccepts: true,
    });

    const created = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as SwapRequest;
    expect(createdBody).toMatchObject({
      initiatorMemberName: 'A Doctor',
      status: 'completed',
      targetMemberName: 'B Doctor',
      version: 2,
    });

    const actuals = await readActualMembers(context);
    expect(actuals.aSep1).toEqual({
      actualMembershipId: context.membershipIds.b,
      actualMemberName: 'B Doctor',
    });
    expect(actuals.bSep2).toEqual({
      actualMembershipId: context.membershipIds.a,
      actualMemberName: 'A Doctor',
    });
    const mineAsA = (await listMySwaps('a-token', context.groupId)).json() as SwapRequest[];
    expect(mineAsA.map((request) => request.id)).toContain(createdBody.id);

    const swapEvents = (
      await client.database.execute(
        sql`SELECT before_data AS beforeData, after_data AS afterData
            FROM schedule_events
            WHERE group_id = ${context.groupId} AND event_type = 'swap_completed'`,
      )
    )[0] as unknown as readonly {
      readonly afterData: { readonly initiatorMemberName?: string };
      readonly beforeData: { readonly initiatorMemberName?: string };
    }[];
    expect(swapEvents).toHaveLength(1);
    expect(swapEvents[0]?.beforeData.initiatorMemberName).toBe('Owner Doctor');
    expect(swapEvents[0]?.afterData.initiatorMemberName).toBe('Owner Doctor');
  });

  it('lets admins and parties revoke completed swaps in reverse order only', async () => {
    const context = await seedPublishedRotation();
    const first = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json() as SwapRequest;

    const second = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
    });
    expect(second.statusCode).toBe(201);
    const secondBody = second.json() as SwapRequest;

    const duty = await createDirectDuty('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.a,
      reason: '代值',
    });
    expect(duty.statusCode).toBe(201);
    const dutyBody = duty.json() as DutyAdjustmentRequest;

    const approvals = (
      await listSwapApprovals('owner-token', context.groupId)
    ).json() as SwapRequest[];
    expect(approvals.find((request) => request.id === firstBody.id)?.isRevocable).toBe(false);
    expect(approvals.find((request) => request.id === secondBody.id)?.isRevocable).toBe(false);
    const dutyApprovals = (
      await app.inject({
        headers: { authorization: 'Bearer owner-token' },
        method: 'GET',
        url: `/groups/${context.groupId}/duty-adjustments/approvals`,
      })
    ).json() as DutyAdjustmentRequest[];
    expect(dutyApprovals.find((request) => request.id === dutyBody.id)?.isRevocable).toBe(true);

    const blockedFirst = await revokeSwap('owner-token', context.groupId, firstBody.id, {
      expectedVersion: firstBody.version,
      operationId: randomUUID(),
      reason: '顺序测试',
    });
    expect(blockedFirst.statusCode, blockedFirst.body).toBe(409);

    const blockedSecond = await revokeSwap('owner-token', context.groupId, secondBody.id, {
      expectedVersion: secondBody.version,
      operationId: randomUUID(),
      reason: '顺序测试',
    });
    expect(blockedSecond.statusCode, blockedSecond.body).toBe(409);

    const revokeDutyByParty = await revokeDuty('a-token', context.groupId, dutyBody.id, {
      expectedVersion: dutyBody.version,
      operationId: randomUUID(),
      reason: '当事人撤销',
    });
    expect(revokeDutyByParty.statusCode, revokeDutyByParty.body).toBe(200);

    const revokeSecondByParty = await revokeSwap('c-token', context.groupId, secondBody.id, {
      expectedVersion: secondBody.version,
      operationId: randomUUID(),
      reason: '当事人撤销',
    });
    expect(revokeSecondByParty.statusCode, revokeSecondByParty.body).toBe(200);

    const revokeFirstByParty = await revokeSwap('b-token', context.groupId, firstBody.id, {
      expectedVersion: firstBody.version,
      operationId: randomUUID(),
      reason: '当事人撤销',
    });
    expect(revokeFirstByParty.statusCode, revokeFirstByParty.body).toBe(200);

    const actuals = await readActualMembers(context);
    expect(actuals.aSep1.actualMembershipId).toBe(context.membershipIds.a);
    expect(actuals.bSep2.actualMembershipId).toBe(context.membershipIds.b);
    expect(actuals.cSep3.actualMembershipId).toBe(context.membershipIds.c);

    const outsider = await revokeSwap('outsider-token', context.groupId, firstBody.id, {
      expectedVersion: firstBody.version,
      operationId: randomUUID(),
      reason: '越权',
    });
    expect(outsider.statusCode).toBe(403);
  });

  it('revokes a completed swap without a reason and restores both shifts', async () => {
    const context = await seedPublishedRotation();
    const created = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as SwapRequest;

    const revoked = await revokeSwap('owner-token', context.groupId, createdBody.id, {
      expectedVersion: createdBody.version,
      operationId: randomUUID(),
    });
    expect(revoked.statusCode, revoked.body).toBe(200);
    expect(revoked.json()).toMatchObject({ status: 'revoked' });

    const actuals = await readActualMembers(context);
    expect(actuals.aSep1.actualMembershipId).toBe(context.membershipIds.a);
    expect(actuals.bSep2.actualMembershipId).toBe(context.membershipIds.b);
  });

  it('blocks revoking a completed swap whose shifts are already past', async () => {
    const context = await seedPublishedRotation();
    const created = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET business_date = '2026-08-01', starts_at = '2026-07-31 16:00:00', ends_at = '2026-08-01 16:00:00'
          WHERE id = ${context.assignments.aSep1.id}`,
    );
    await client.database.execute(
      sql`UPDATE shift_assignments
          SET business_date = '2026-08-02', starts_at = '2026-08-01 16:00:00', ends_at = '2026-08-02 16:00:00'
          WHERE id = ${context.assignments.bSep2.id}`,
    );

    const approvals = (
      await listSwapApprovals('owner-token', context.groupId)
    ).json() as SwapRequest[];
    expect(approvals.find((request) => request.id === createdBody.id)).toMatchObject({
      isRevocable: false,
      revocationBlockedReason: expect.stringContaining('已过日期'),
    });

    const blocked = await revokeSwap('owner-token', context.groupId, createdBody.id, {
      expectedVersion: createdBody.version,
      operationId: randomUUID(),
    });
    expect(blocked.statusCode, blocked.body).toBe(409);
    expect(blocked.json()).toMatchObject({
      error: {
        code: 'CONFLICT',
        message: expect.stringContaining('已过日期'),
      },
    });
  });

  it('keeps archived assignment snapshots readable in approval history', async () => {
    const context = await seedPublishedRotation();
    const created = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as SwapRequest;

    await client.database
      .update(shiftAssignments)
      .set({ deletedAt: new Date() })
      .where(eq(shiftAssignments.id, context.assignments.aSep1.id));

    const approvals = await listSwapApprovals('owner-token', context.groupId);
    expect(approvals.statusCode, approvals.body).toBe(200);
    expect((approvals.json() as SwapRequest[]).map((request) => request.id)).toContain(
      createdBody.id,
    );
  });

  it('revokes active swaps when an archived schedule version is republished', async () => {
    const archivedContext = await seedPublishedRotation();
    const rulesVersion = (await getConfig('owner-token', archivedContext.groupId)).rulesVersion;
    expect(
      (await generatePublished(archivedContext.groupId, archivedContext.roleId, rulesVersion))
        .statusCode,
    ).toBe(200);

    const periodRows = await client.database
      .select({
        id: schedulePeriods.id,
        status: schedulePeriods.status,
        version: schedulePeriods.version,
      })
      .from(schedulePeriods)
      .where(eq(schedulePeriods.groupId, archivedContext.groupId))
      .orderBy(schedulePeriods.revision);
    const archivedPeriod = periodRows.find((period) => period.status === 'replaced');
    expect(archivedPeriod).toBeDefined();

    const assignmentRows = await client.database
      .select({
        businessDate: shiftAssignments.businessDate,
        id: shiftAssignments.id,
        plannedMembershipId: shiftAssignments.plannedMembershipId,
        version: shiftAssignments.version,
      })
      .from(shiftAssignments)
      .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
      .where(
        and(
          eq(schedulePeriods.groupId, archivedContext.groupId),
          eq(schedulePeriods.status, 'published'),
          inArray(shiftAssignments.businessDate, ['2026-09-01', '2026-09-02']),
        ),
      )
      .orderBy(shiftAssignments.businessDate);
    const currentByDate = new Map(assignmentRows.map((row) => [row.businessDate, row]));
    const currentContext: Context = {
      ...archivedContext,
      assignments: {
        ...archivedContext.assignments,
        aSep1: toAssignment(currentByDate.get('2026-09-01')),
        bSep2: toAssignment(currentByDate.get('2026-09-02')),
      },
    };
    const swap = await directSwap('owner-token', currentContext.groupId, {
      initiatorAssignmentId: currentContext.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: currentContext.assignments.bSep2.id,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as SwapRequest;

    const impact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${currentContext.groupId}/schedules/${archivedPeriod?.id}/change-impact?action=publish`,
    });
    expect(impact.statusCode).toBe(200);
    expect(impact.json()).toMatchObject({
      action: 'publish',
      workflowImpacts: [
        {
          businessDates: ['2026-09-01', '2026-09-02'],
          id: swapBody.id,
          kind: 'swap',
          memberNames: ['A Doctor', 'B Doctor'],
          status: 'completed',
        },
      ],
    });

    const blocked = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        expectedVersion: archivedPeriod?.version,
        operationId: randomUUID(),
        replacePublished: true,
      },
      url: `/groups/${currentContext.groupId}/schedules/${archivedPeriod?.id}/publish`,
    });
    expect(blocked.statusCode).toBe(409);
    expect((blocked.json() as ErrorResponse).error.latestData).toMatchObject({
      workflowImpacts: [{ id: swapBody.id, kind: 'swap' }],
    });

    const republished = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        acknowledgeWorkflowRevocations: true,
        expectedVersion: archivedPeriod?.version,
        operationId: randomUUID(),
        replacePublished: true,
      },
      url: `/groups/${currentContext.groupId}/schedules/${archivedPeriod?.id}/publish`,
    });
    expect(republished.statusCode).toBe(200);
    expect(republished.json()).toMatchObject({
      period: { id: archivedPeriod?.id, status: 'published' },
      workflowImpacts: [{ id: swapBody.id, kind: 'swap' }],
    });

    const mine = (await listMySwaps('a-token', currentContext.groupId)).json() as SwapRequest[];
    expect(mine.find((request) => request.id === swapBody.id)).toMatchObject({
      revocationReason: '排班变更',
      status: 'revoked',
    });
    const restoredActuals = await readActualMembers(currentContext);
    expect(restoredActuals.aSep1.actualMembershipId).toBe(currentContext.membershipIds.a);
    expect(restoredActuals.bSep2.actualMembershipId).toBe(currentContext.membershipIds.b);
  });

  it('lets only one active swap request use the same shift', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, false);
    const first = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(first.statusCode).toBe(201);

    const second = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(second.statusCode).toBe(409);
    expect((second.json() as ErrorResponse).error.message).toContain('已有待处理');

    const third = await createSwap('c-token', context.groupId, {
      initiatorAssignmentId: context.assignments.cSep3.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(third.statusCode).toBe(409);

    const [requestCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM swap_requests WHERE group_id = ${context.groupId}`,
    );
    expect(requestCount).toEqual([{ count: 1 }]);
  });

  it('allows swap creation after a completed duty adjustment and preserves the duty relation', async () => {
    const context = await seedPublishedRotation();
    const duty = await createDirectDuty('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
      reason: '代值',
    });
    expect(duty.statusCode).toBe(201);
    const dutyBody = duty.json() as DutyAdjustmentRequest;

    const previewResponse = await previewSwap('b-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(previewResponse.statusCode).toBe(200);
    expect((previewResponse.json() as SwapPreview).conflicts).toEqual([]);

    const created = await createSwap('b-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(created.statusCode).toBe(201);

    const [dutyRows] = await client.database.execute(
      sql`SELECT status, overtime_membership_id AS overtimeMembershipId, deducted_membership_id AS deductedMembershipId
          FROM duty_adjustments
          WHERE id = ${dutyBody.id}`,
    );
    expect(dutyRows).toEqual([
      {
        deductedMembershipId: context.membershipIds.a,
        overtimeMembershipId: context.membershipIds.b,
        status: 'completed',
      },
    ]);
    const actuals = await readActualMembers(context);
    expect(actuals.aSep1.actualMembershipId).toBe(context.membershipIds.c);
    expect(actuals.cSep3.actualMembershipId).toBe(context.membershipIds.b);
  });

  it('surfaces pending swap requests in swap preview', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, false);
    const first = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(first.statusCode).toBe(201);

    const previewResponse = await previewSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(previewResponse.statusCode).toBe(200);
    expect((previewResponse.json() as SwapPreview).conflicts).toEqual([
      expect.objectContaining({
        assignmentId: context.assignments.aSep1.id,
        code: 'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST',
      }),
    ]);
  });

  it('blocks swap creation while a duty adjustment is still pending', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, false);
    const duty = await createDutyAdjustment('a-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
    });
    expect(duty.statusCode).toBe(201);

    const previewResponse = await previewSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(previewResponse.statusCode).toBe(200);
    expect((previewResponse.json() as SwapPreview).conflicts).toEqual([
      expect.objectContaining({
        assignmentId: context.assignments.aSep1.id,
        code: 'ASSIGNMENT_HAS_PENDING_DUTY_ADJUSTMENT',
      }),
    ]);

    const created = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(created.statusCode).toBe(409);
    expect((created.json() as ErrorResponse).error.message).toContain('加扣班');
  });

  it('blocks swap creation while the receiving member has a pending leave', async () => {
    const context = await seedPublishedRotation();
    const leave = await submitLeave('c-token', context.groupId, {
      endsAt: '2026-09-02T00:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      reason: '待审批请假',
      startsAt: '2026-09-01T00:00:00.000Z',
    });
    expect(leave.statusCode).toBe(201);

    const created = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(created.statusCode).toBe(409);
    expect((created.json() as ErrorResponse).error.message).toContain('请假');
  });

  it('enforces reverse-order revocation across swap and duty chains', async () => {
    const context = await seedPublishedRotation();
    const swap = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as SwapRequest;

    const duty = await createDirectDuty('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.c,
      reason: '代值',
    });
    expect(duty.statusCode).toBe(201);
    const dutyBody = duty.json() as DutyAdjustmentRequest;

    const blockedSwapRevoke = await revokeSwap('owner-token', context.groupId, swapBody.id, {
      expectedVersion: swapBody.version,
      operationId: randomUUID(),
      reason: '先撤换班',
    });
    expect(blockedSwapRevoke.statusCode).toBe(409);

    const revokedDuty = await revokeDuty('owner-token', context.groupId, dutyBody.id, {
      expectedVersion: dutyBody.version,
      operationId: randomUUID(),
      reason: '先撤加扣班',
    });
    expect(revokedDuty.statusCode).toBe(200);

    const revokedSwap = await revokeSwap('owner-token', context.groupId, swapBody.id, {
      expectedVersion: swapBody.version,
      operationId: randomUUID(),
      reason: '再撤换班',
    });
    expect(revokedSwap.statusCode).toBe(200);
  });

  it('requires swap revocation before revoking an earlier duty adjustment', async () => {
    const context = await seedPublishedRotation();
    const duty = await createDirectDuty('owner-token', context.groupId, {
      coveredAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      overtimeMembershipId: context.membershipIds.b,
      reason: '代值',
    });
    expect(duty.statusCode).toBe(201);
    const dutyBody = duty.json() as DutyAdjustmentRequest;

    const swap = await createSwap('b-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
      targetMembershipId: context.membershipIds.c,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as SwapRequest;

    const blockedDutyRevoke = await revokeDuty('owner-token', context.groupId, dutyBody.id, {
      expectedVersion: dutyBody.version,
      operationId: randomUUID(),
      reason: '先撤加扣班',
    });
    expect(blockedDutyRevoke.statusCode).toBe(409);

    const revokedSwap = await revokeSwap('owner-token', context.groupId, swapBody.id, {
      expectedVersion: swapBody.version,
      operationId: randomUUID(),
      reason: '先撤换班',
    });
    expect(revokedSwap.statusCode).toBe(200);

    const revokedDuty = await revokeDuty('owner-token', context.groupId, dutyBody.id, {
      expectedVersion: dutyBody.version,
      operationId: randomUUID(),
      reason: '再撤加扣班',
    });
    expect(revokedDuty.statusCode).toBe(200);
  });

  it('blocks revoking an earlier swap while a later swap still exists', async () => {
    const context = await seedPublishedRotation();
    const first = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json() as SwapRequest;

    const second = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
    });
    expect(second.statusCode).toBe(201);
    const secondBody = second.json() as SwapRequest;

    const blockedFirstRevoke = await revokeSwap('owner-token', context.groupId, firstBody.id, {
      expectedVersion: firstBody.version,
      operationId: randomUUID(),
      reason: '先撤较早换班',
    });
    expect(blockedFirstRevoke.statusCode).toBe(409);
    expect((blockedFirstRevoke.json() as ErrorResponse).error.message).toContain('后续');

    const revokedSecond = await revokeSwap('owner-token', context.groupId, secondBody.id, {
      expectedVersion: secondBody.version,
      operationId: randomUUID(),
      reason: '先撤较晚换班',
    });
    expect(revokedSecond.statusCode).toBe(200);

    const revokedFirst = await revokeSwap('owner-token', context.groupId, firstBody.id, {
      expectedVersion: firstBody.version,
      operationId: randomUUID(),
      reason: '再撤较早换班',
    });
    expect(revokedFirst.statusCode).toBe(200);
  });

  it('locks stale completed swaps as non-revocable with lingering markers', async () => {
    const context = await seedPublishedRotation();
    const swap = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET actual_membership_id = planned_membership_id, actual_member_name = planned_member_name
          WHERE id IN (${context.assignments.aSep1.id}, ${context.assignments.bSep2.id})`,
    );

    const approvals = (
      await listSwapApprovals('owner-token', context.groupId)
    ).json() as SwapRequest[];
    expect(approvals.find((request) => request.id === swapBody.id)).toMatchObject({
      isRevocable: false,
      revocationBlockedReason: expect.stringContaining('后续'),
      status: 'completed',
    });

    const calendar = (
      await getCalendar('owner-token', context.groupId, '2026-09')
    ).json() as CalendarResponse;
    expect(
      calendar.assignments.find((assignment) => assignment.id === context.assignments.aSep1.id)
        ?.changeMarkers,
    ).toEqual(['swap']);

    const revoked = await revokeSwap('owner-token', context.groupId, swapBody.id, {
      expectedVersion: swapBody.version,
      operationId: randomUUID(),
      reason: '尝试撤销失效换班',
    });
    expect(revoked.statusCode).toBe(409);
  });

  it('detects stale completed swaps as archiveable candidates', async () => {
    const context = await seedPublishedRotation();
    const swap = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET actual_membership_id = planned_membership_id, actual_member_name = planned_member_name
          WHERE id IN (${context.assignments.aSep1.id}, ${context.assignments.bSep2.id})`,
    );

    const selfHealing = new WorkflowSelfHealingService(client);
    const stale = await withTransaction(client, (transaction) =>
      selfHealing.findStaleCompletedWorkflows(transaction, {
        assignmentIds: [context.assignments.aSep1.id, context.assignments.bSep2.id],
        groupId: context.groupId,
      }),
    );
    expect(stale.map((candidate) => candidate.id)).toEqual([swapBody.id]);
    expect(stale[0]).toMatchObject({
      assignmentIds: [context.assignments.aSep1.id, context.assignments.bSep2.id],
      kind: 'swap',
      version: 2,
    });
  });

  it('keeps earlier chain swaps out of detection while a later swap exists', async () => {
    const context = await seedPublishedRotation();
    const first = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json() as SwapRequest;
    const second = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
    });
    expect(second.statusCode).toBe(201);
    const secondBody = second.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET actual_membership_id = planned_membership_id, actual_member_name = planned_member_name
          WHERE id = ${context.assignments.aSep1.id}`,
    );

    const selfHealing = new WorkflowSelfHealingService(client);
    const stale = await withTransaction(client, (transaction) =>
      selfHealing.findStaleCompletedWorkflows(transaction, {
        assignmentIds: [context.assignments.aSep1.id],
        groupId: context.groupId,
      }),
    );
    expect(stale.map((candidate) => candidate.id)).toEqual([secondBody.id]);
    expect(stale[0]?.id).not.toBe(firstBody.id);
  });

  it('archives a stale completed swap with a revocation event without touching actual members', async () => {
    const context = await seedPublishedRotation();
    const swap = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET actual_membership_id = planned_membership_id, actual_member_name = planned_member_name
          WHERE id IN (${context.assignments.aSep1.id}, ${context.assignments.bSep2.id})`,
    );

    const selfHealing = new WorkflowSelfHealingService(client);
    const ownerUserId = await readOwnerUserId();
    const archived = await withTransaction(client, (transaction) =>
      selfHealing.archiveStaleCompletedWorkflows(transaction, {
        actorUserId: ownerUserId,
        assignmentIds: [context.assignments.aSep1.id, context.assignments.bSep2.id],
        groupId: context.groupId,
        operationId: randomUUID(),
      }),
    );
    expect(archived).toEqual([{ id: swapBody.id, kind: 'swap', version: swapBody.version + 1 }]);

    const swapRows = (
      await client.database.execute(
        sql`SELECT status, revocation_reason AS revocationReason, version
          FROM swap_requests
          WHERE id = ${swapBody.id}`,
      )
    )[0] as unknown as readonly {
      revocationReason: string;
      status: string;
      version: number;
    }[];
    expect(swapRows).toEqual([
      { revocationReason: staleWorkflowArchiveReason, status: 'revoked', version: 3 },
    ]);

    const revokedEvents = (
      await client.database.execute(
        sql`SELECT affected_shift_ids AS affectedShiftIds
          FROM schedule_events
          WHERE object_id = ${swapBody.id} AND event_type = 'swap_revoked'`,
      )
    )[0] as unknown as readonly { affectedShiftIds: readonly string[] }[];
    expect(revokedEvents).toHaveLength(1);
    expect((revokedEvents[0] as { affectedShiftIds: readonly string[] }).affectedShiftIds).toEqual(
      expect.arrayContaining([context.assignments.aSep1.id, context.assignments.bSep2.id]),
    );

    const actuals = await readActualMembers(context);
    expect(actuals.aSep1).toEqual({
      actualMembershipId: context.membershipIds.a,
      actualMemberName: 'A Doctor',
    });
    expect(actuals.bSep2).toEqual({
      actualMembershipId: context.membershipIds.b,
      actualMemberName: 'B Doctor',
    });

    const calendar = (
      await getCalendar('owner-token', context.groupId, '2026-09')
    ).json() as CalendarResponse;
    expect(
      calendar.assignments.find((assignment) => assignment.id === context.assignments.aSep1.id)
        ?.changeMarkers,
    ).toEqual([]);
    expect(
      calendar.assignments.find((assignment) => assignment.id === context.assignments.bSep2.id)
        ?.changeMarkers,
    ).toEqual([]);

    const approvals = (
      await listSwapApprovals('owner-token', context.groupId)
    ).json() as SwapRequest[];
    expect(approvals.find((request) => request.id === swapBody.id)).toMatchObject({
      status: 'revoked',
    });
  });

  it('archives the whole stale swap chain in one run and stays idempotent', async () => {
    const context = await seedPublishedRotation();
    const first = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json() as SwapRequest;
    const second = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.cSep3.id,
    });
    expect(second.statusCode).toBe(201);
    const secondBody = second.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET actual_membership_id = planned_membership_id, actual_member_name = planned_member_name
          WHERE id = ${context.assignments.aSep1.id}`,
    );

    const selfHealing = new WorkflowSelfHealingService(client);
    const ownerUserId = await readOwnerUserId();
    const archiveInput = {
      actorUserId: ownerUserId,
      assignmentIds: [context.assignments.aSep1.id],
      groupId: context.groupId,
      operationId: randomUUID(),
    };
    const archived = await withTransaction(client, (transaction) =>
      selfHealing.archiveStaleCompletedWorkflows(transaction, archiveInput),
    );
    expect(archived.map((record) => record.id).sort()).toEqual(
      [firstBody.id, secondBody.id].sort(),
    );

    const swapRows = (
      await client.database.execute(
        sql`SELECT id, status
          FROM swap_requests
          WHERE id IN (${firstBody.id}, ${secondBody.id})`,
      )
    )[0] as unknown as readonly { id: string; status: string }[];
    expect(swapRows.map((row) => row.status)).toEqual(['revoked', 'revoked']);

    const repeated = await withTransaction(client, (transaction) =>
      selfHealing.archiveStaleCompletedWorkflows(transaction, archiveInput),
    );
    expect(repeated).toEqual([]);
  });

  it('auto-archives a stale completed swap when a later pending swap is cancelled', async () => {
    const context = await seedPublishedRotation();
    const completed = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(completed.statusCode).toBe(201);
    const completedBody = completed.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET actual_membership_id = planned_membership_id, actual_member_name = planned_member_name
          WHERE id IN (${context.assignments.aSep1.id}, ${context.assignments.bSep2.id})`,
    );

    await updateMySettings('b-token', context.groupId, false);
    const pending = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(pending.statusCode, pending.body).toBe(201);
    const pendingBody = pending.json() as SwapRequest;
    expect(pendingBody.status).toBe('pending_target');

    const cancelled = await cancelSwap('a-token', context.groupId, pendingBody.id, {
      expectedVersion: pendingBody.version,
      operationId: randomUUID(),
    });
    expect(cancelled.statusCode, cancelled.body).toBe(200);

    const swapRows = (
      await client.database.execute(
        sql`SELECT status FROM swap_requests WHERE id = ${completedBody.id}`,
      )
    )[0] as unknown as readonly { status: string }[];
    expect(swapRows).toEqual([{ status: 'revoked' }]);

    const calendar = (
      await getCalendar('owner-token', context.groupId, '2026-09')
    ).json() as CalendarResponse;
    expect(
      calendar.assignments.find((assignment) => assignment.id === context.assignments.aSep1.id)
        ?.changeMarkers,
    ).toEqual([]);
  });

  it('startup sweep archives stale completed workflows across all groups and stays idempotent', async () => {
    const context = await seedPublishedRotation();
    const swap = await directSwap('owner-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
    });
    expect(swap.statusCode).toBe(201);
    const swapBody = swap.json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET actual_membership_id = planned_membership_id, actual_member_name = planned_member_name
          WHERE id IN (${context.assignments.aSep1.id}, ${context.assignments.bSep2.id})`,
    );

    const selfHealing = new WorkflowSelfHealingService(client);
    const archived = await selfHealing.runStartupSweep();
    expect(archived.map((record) => record.id)).toContain(swapBody.id);

    const swapRows = (
      await client.database.execute(sql`SELECT status FROM swap_requests WHERE id = ${swapBody.id}`)
    )[0] as unknown as readonly { status: string }[];
    expect(swapRows).toEqual([{ status: 'revoked' }]);

    const repeated = await selfHealing.runStartupSweep();
    expect(repeated).toEqual([]);
  });

  it('invalidates the swap when either assignment version changes', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, false);
    const created = (
      await createSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep1.id,
        operationId: randomUUID(),
        targetAssignmentId: context.assignments.bSep2.id,
        targetMembershipId: context.membershipIds.b,
      })
    ).json() as SwapRequest;

    await client.database.execute(
      sql`UPDATE shift_assignments SET version = version + 1 WHERE id = ${context.assignments.aSep1.id}`,
    );
    const accepted = await acceptSwap('b-token', context.groupId, created.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(accepted.statusCode).toBe(409);
    expect((accepted.json() as ErrorResponse).error.latestData).toMatchObject({
      id: context.assignments.aSep1.id,
      objectType: 'shift_assignment',
      version: context.assignments.aSep1.version + 1,
    });
    expect((await readActualMembers(context)).aSep1.actualMembershipId).toBeNull();

    const rejected = await rejectSwap('b-token', context.groupId, created.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({ status: 'rejected' });
  });

  it('blocks swaps when the receiving member is no longer in the role', async () => {
    const context = await seedPublishedRotation();
    await replaceRoleMembers(context.groupId, context.roleId, [
      context.membershipIds.a,
      context.membershipIds.c,
    ]);

    const created = await createSwap('b-token', context.groupId, {
      initiatorAssignmentId: context.assignments.bSep2.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.aSep1.id,
      targetMembershipId: context.membershipIds.a,
    });
    expect(created.statusCode).toBe(409);
    const latestData = (created.json() as ErrorResponse).error.latestData as {
      conflicts: readonly { code: string; membershipId: string }[];
    };
    expect(latestData.conflicts).toEqual([
      expect.objectContaining({
        code: 'MEMBER_NOT_ELIGIBLE',
        membershipId: context.membershipIds.b,
      }),
    ]);
  });

  it('blocks swaps when the receiving member has approved leave overlap', async () => {
    const context = await seedPublishedRotation();
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

    const created = await createSwap('a-token', context.groupId, {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId: randomUUID(),
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    });
    expect(created.statusCode).toBe(409);
    const latestData = (created.json() as ErrorResponse).error.latestData as {
      conflicts: readonly { code: string; membershipId: string }[];
    };
    expect(latestData.conflicts).toEqual([
      expect.objectContaining({
        code: 'MEMBER_LEAVE_OVERLAP',
        membershipId: context.membershipIds.b,
      }),
    ]);
  });

  it('rejects and cancels pending swaps without touching actual members', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, false);
    await updateMySettings('c-token', context.groupId, false);
    const first = (
      await createSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep1.id,
        operationId: randomUUID(),
        targetAssignmentId: context.assignments.bSep2.id,
        targetMembershipId: context.membershipIds.b,
      })
    ).json() as SwapRequest;
    const rejected = await rejectSwap('b-token', context.groupId, first.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json()).toMatchObject({ status: 'rejected' });
    expect((await readActualMembers(context)).aSep1.actualMembershipId).toBeNull();

    const second = (
      await createSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep4.id,
        operationId: randomUUID(),
        targetAssignmentId: context.assignments.cSep3.id,
        targetMembershipId: context.membershipIds.c,
      })
    ).json() as SwapRequest;
    const cancelled = await cancelSwap('a-token', context.groupId, second.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ status: 'cancelled' });

    const approveRejected = await approveSwap('owner-token', context.groupId, first.id, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    expect(approveRejected.statusCode).toBe(409);
  });

  it('replays the same create operation id without duplicates', async () => {
    const context = await seedPublishedRotation();
    const operationId = randomUUID();
    const body = {
      initiatorAssignmentId: context.assignments.aSep1.id,
      operationId,
      targetAssignmentId: context.assignments.bSep2.id,
      targetMembershipId: context.membershipIds.b,
    };

    const first = await createSwap('a-token', context.groupId, body);
    expect(first.statusCode).toBe(201);
    const replay = await createSwap('a-token', context.groupId, body);
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());

    const [requestCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM swap_requests WHERE group_id = ${context.groupId}`,
    );
    const [eventCount] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM schedule_events WHERE event_type = 'swap_request_created'`,
    );
    expect(requestCount).toEqual([{ count: 1 }]);
    expect(eventCount).toEqual([{ count: 1 }]);
  });

  it('restricts swap permissions and exposes settings', async () => {
    const context = await seedPublishedRotation();
    expect(
      (
        await previewSwap('outsider-token', context.groupId, {
          initiatorAssignmentId: context.assignments.aSep1.id,
          targetAssignmentId: context.assignments.bSep2.id,
          targetMembershipId: context.membershipIds.b,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await createSwap('outsider-token', context.groupId, {
          initiatorAssignmentId: context.assignments.aSep1.id,
          operationId: randomUUID(),
          targetAssignmentId: context.assignments.bSep2.id,
          targetMembershipId: context.membershipIds.b,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await directSwap('a-token', context.groupId, {
          initiatorAssignmentId: context.assignments.aSep1.id,
          operationId: randomUUID(),
          targetAssignmentId: context.assignments.bSep2.id,
        })
      ).statusCode,
    ).toBe(403);

    expect((await getMySettings('b-token', context.groupId)).json()).toEqual({
      autoAcceptSwaps: true,
    });
    await updateMySettings('b-token', context.groupId, false);
    const created = (
      await createSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep1.id,
        operationId: randomUUID(),
        targetAssignmentId: context.assignments.bSep2.id,
        targetMembershipId: context.membershipIds.b,
      })
    ).json() as SwapRequest;
    expect(
      (
        await acceptSwap('a-token', context.groupId, created.id, {
          expectedVersion: 1,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
    expect((await getGroupSettings('b-token', context.groupId)).json()).toEqual({
      requiresApproval: false,
    });
    expect((await updateGroupSettings('b-token', context.groupId, false)).statusCode).toBe(403);
    expect((await updateGroupSettings('owner-token', context.groupId, false)).statusCode).toBe(200);
    expect((await getMySettings('b-token', context.groupId)).json()).toEqual({
      autoAcceptSwaps: false,
    });
    expect((await updateMySettings('b-token', context.groupId, true)).statusCode).toBe(200);
    expect((await getMySettings('b-token', context.groupId)).json()).toEqual({
      autoAcceptSwaps: true,
    });
  });

  async function seedPublishedRotation(): Promise<Context> {
    const groupId = await createGroup('Swap group', '5678');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await addRosterEntry(groupId, 'C Doctor');
    for (const [token, realName] of [
      ['a-token', 'A Doctor'],
      ['b-token', 'B Doctor'],
      ['c-token', 'C Doctor'],
    ] as const) {
      await claimGroup(token, '5678', realName);
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

  async function directSwap(
    token: string,
    groupId: string,
    body: {
      readonly initiatorAssignmentId: string;
      readonly operationId: string;
      readonly targetAssignmentId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/direct`,
    });
  }

  async function revokeSwap(
    token: string,
    groupId: string,
    swapRequestId: string,
    body: {
      readonly expectedVersion: number;
      readonly operationId: string;
      readonly reason?: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload:
        body.reason === undefined
          ? { expectedVersion: body.expectedVersion, operationId: body.operationId }
          : body,
      url: `/groups/${groupId}/swaps/${swapRequestId}/revoke`,
    });
  }

  async function createDirectDuty(
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

  async function createDutyAdjustment(
    token: string,
    groupId: string,
    body: {
      readonly coveredAssignmentId: string;
      readonly operationId: string;
      readonly overtimeMembershipId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments`,
    });
  }

  async function revokeDuty(
    token: string,
    groupId: string,
    dutyAdjustmentId: string,
    body: {
      readonly expectedVersion: number;
      readonly operationId: string;
      readonly reason: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/duty-adjustments/${dutyAdjustmentId}/revoke`,
    });
  }

  async function previewSwap(
    token: string,
    groupId: string,
    body: {
      readonly initiatorAssignmentId: string;
      readonly initiatorMembershipId?: string;
      readonly targetAssignmentId: string;
      readonly targetMembershipId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/preview`,
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

  async function rejectSwap(
    token: string,
    groupId: string,
    swapRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/${swapRequestId}/reject`,
    });
  }

  async function cancelSwap(
    token: string,
    groupId: string,
    swapRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/${swapRequestId}/cancel`,
    });
  }

  async function listMySwaps(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/swaps`,
    });
  }

  async function listSwapApprovals(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/swaps/approvals`,
    });
  }

  async function getGroupSettings(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/swaps/settings`,
    });
  }

  async function updateGroupSettings(token: string, groupId: string, requiresApproval: boolean) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: { requiresApproval },
      url: `/groups/${groupId}/swaps/settings`,
    });
  }

  async function getMySettings(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/swaps/my-settings`,
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

  async function submitLeave(token: string, groupId: string, body: object) {
    const operationId = randomUUID();
    return app.inject({
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': operationId },
      method: 'POST',
      payload: { ...body, operationId },
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

  async function readActualMembers(context: Context): Promise<{
    aSep1: ActualMemberValue;
    aSep4: ActualMemberValue;
    bSep2: ActualMemberValue;
    cSep3: ActualMemberValue;
  }> {
    const ids = Object.values(context.assignments).map((assignment) => assignment.id);
    const rows = (
      await client.database.execute(
        sql`SELECT id, actual_membership_id AS actualMembershipId, actual_member_name AS actualMemberName
            FROM shift_assignments WHERE id IN (${ids[0]}, ${ids[1]}, ${ids[2]}, ${ids[3]})`,
      )
    )[0] as unknown as readonly {
      actualMemberName: string | null;
      actualMembershipId: string | null;
      id: string;
    }[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      aSep1: toActualValue(byId.get(context.assignments.aSep1.id)),
      aSep4: toActualValue(byId.get(context.assignments.aSep4.id)),
      bSep2: toActualValue(byId.get(context.assignments.bSep2.id)),
      cSep3: toActualValue(byId.get(context.assignments.cSep3.id)),
    };
  }

  async function readPlannedMembers(context: Context): Promise<{
    aSep1: string | null;
    aSep4: string | null;
    bSep2: string | null;
    cSep3: string | null;
  }> {
    const rows = (
      await client.database.execute(
        sql`SELECT id, planned_membership_id AS plannedMembershipId FROM shift_assignments`,
      )
    )[0] as unknown as readonly { id: string; plannedMembershipId: string | null }[];
    const byId = new Map(rows.map((row) => [row.id, row.plannedMembershipId]));
    return {
      aSep1: byId.get(context.assignments.aSep1.id) ?? null,
      aSep4: byId.get(context.assignments.aSep4.id) ?? null,
      bSep2: byId.get(context.assignments.bSep2.id) ?? null,
      cSep3: byId.get(context.assignments.cSep3.id) ?? null,
    };
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

  async function registerUser(token: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });

    expect(response.statusCode).toBe(201);
  }

  async function readOwnerUserId(): Promise<string> {
    const rows = (
      await client.database.execute(
        sql`SELECT id FROM users WHERE cloudbase_uid = 'cloudbase-owner'`,
      )
    )[0] as unknown as readonly { id: string }[];
    const ownerUserId = rows[0]?.id;
    if (ownerUserId === undefined) {
      throw new Error('The owner user is missing.');
    }
    return ownerUserId;
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
    readonly id: string;
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

function toActualValue(
  row:
    | {
        readonly actualMemberName: string | null;
        readonly actualMembershipId: string | null;
      }
    | undefined,
): ActualMemberValue {
  return {
    actualMemberName: row?.actualMemberName ?? null,
    actualMembershipId: row?.actualMembershipId ?? null,
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
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
