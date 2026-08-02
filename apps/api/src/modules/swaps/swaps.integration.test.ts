import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { SwapPreview, SwapRequest } from '@schedule/contracts';
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
  });

  it('does not let automatic acceptance bypass administrator approval', async () => {
    const context = await seedPublishedRotation();
    await updateMySettings('b-token', context.groupId, true);
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
  });

  it('lets only one active swap request use the same shift', async () => {
    const context = await seedPublishedRotation();
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

  it('invalidates the swap when either assignment version changes', async () => {
    const context = await seedPublishedRotation();
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
      requiresApproval: true,
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

  async function previewSwap(
    token: string,
    groupId: string,
    body: {
      readonly initiatorAssignmentId: string;
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
