import type {
  LeaveAffectedShift,
  LeaveReflowPreview,
  LeaveRequest,
  LeaveRequestType,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createLeaveWorkflowController,
  createLeaveWorkflowOperationId,
  type LeaveWorkflowDependencies,
} from './leave-workflow.js';

const context = {
  groupId: 'group-1',
  groupRole: 'administrator' as const,
  groupVersion: 4,
  userId: 'user-1',
};

const operationId = '11111111-1111-4111-8111-111111111111';

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function request(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    createdAt: '2026-08-11T00:00:00.000+08:00',
    endsAt: '2026-08-13T00:00:00.000+08:00',
    groupId: context.groupId,
    id: 'leave-1',
    isAllDay: true,
    leaveType: 'sick',
    membershipId: 'member-1',
    reflowStrategy: 'keep-original-order',
    startsAt: '2026-08-11T00:00:00.000+08:00',
    status: 'pending',
    version: 3,
    ...overrides,
  };
}

function preview(overrides: Partial<LeaveReflowPreview> = {}): LeaveReflowPreview {
  return {
    affectedAssignments: [],
    affectedShiftCount: 0,
    affectedShifts: [],
    conflicts: [],
    continuousDutyWarnings: [],
    groupDefaultStrategy: 'keep-original-order',
    leaveRequestId: 'leave-1',
    leaveRequestVersion: 3,
    overlapsUnpublishedPeriod: false,
    periodVersions: { 'period-1': 7 },
    rulesVersion: 9,
    statisticsDelta: {
      byMember: [],
      totalAssignmentDelta: 0,
      totalCountedDelta: 0,
      totalWeekendDelta: 0,
    },
    strategy: 'keep-original-order',
    vacancies: [],
    workflowBlockers: [],
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<LeaveWorkflowDependencies> = {},
): LeaveWorkflowDependencies {
  return {
    approveLeaveRequest: vi.fn(async () => ({
      leaveRequest: request({ status: 'approved' }),
      operationId: 'approve-1',
      preview: preview(),
      status: 'approved' as const,
      strategy: 'keep-original-order' as const,
    })),
    cancelLeaveRequest: vi.fn(async () => ({
      leaveRequestId: 'leave-1',
      operationId: 'cancel-1',
      status: 'cancelled' as const,
    })),
    createLeaveRequest: vi.fn(async () => request()),
    createOperationId: vi.fn(() => operationId),
    getGroupStrategy: vi.fn(async () => ({ strategy: 'keep-original-order' as const })),
    getLeaveAffectedShifts: vi.fn(async () => [] satisfies readonly LeaveAffectedShift[]),
    invalidateCalendarMonth: vi.fn(),
    listLeaveRequestApprovals: vi.fn(async () => [request()]),
    listLeaveRequests: vi.fn(async () => [request()]),
    previewLeaveRequestApproval: vi.fn(async () => preview()),
    rejectLeaveRequest: vi.fn(async () => ({
      leaveRequest: request({ status: 'rejected' }),
      operationId: 'reject-1',
      status: 'rejected' as const,
    })),
    revokeLeaveRequest: vi.fn(async () => ({
      leaveRequestId: 'leave-1',
      operationId: 'revoke-1',
      status: 'revoked' as const,
    })),
    updateGroupStrategy: vi.fn(async () => ({ strategy: 'shift-forward' as const })),
    ...overrides,
  };
}

describe('leave workflow controller', () => {
  it('creates UUID v4 operation ids for leave mutations', () => {
    expect(createLeaveWorkflowOperationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it('uses the CST all-day half-open interval, omits an empty reason and never sends operationId on create', async () => {
    const api = dependencies();
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);
    await controller.updateForm({
      endDate: '2026-08-12',
      leaveType: 'sick' as LeaveRequestType,
      reason: '   ',
      startDate: '2026-08-11',
    });
    expect(controller.state.dayCount).toBe(2);

    await controller.submitCreate();

    expect(api.createLeaveRequest).toHaveBeenCalledWith(context.groupId, {
      endsAt: '2026-08-13T00:00:00.000+08:00',
      isAllDay: true,
      leaveType: 'sick',
      startsAt: '2026-08-11T00:00:00.000+08:00',
    });
    expect(api.createLeaveRequest).toHaveBeenCalledTimes(1);
    expect(api.listLeaveRequests).toHaveBeenCalledTimes(1);
  });

  it('distinguishes unavailable auxiliary impact from a confirmed empty result and leaves both non-blocking', async () => {
    const api = dependencies({
      getLeaveAffectedShifts: vi
        .fn<LeaveWorkflowDependencies['getLeaveAffectedShifts']>()
        .mockRejectedValueOnce(new Error('impact unavailable'))
        .mockResolvedValueOnce([]),
    });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);

    await controller.updateForm({ endDate: '2026-08-12', startDate: '2026-08-11' });
    expect(controller.state.impact.kind).toBe('unavailable');
    expect(controller.state.canSubmit).toBe(true);

    await controller.updateForm({ endDate: '2026-08-13' });
    expect(controller.state.impact.kind).toBe('none');
    expect(controller.state.canSubmit).toBe(true);
  });

  it('single-flights a fast double create while retaining the form on an error', async () => {
    const create = deferred<LeaveRequest>();
    const api = dependencies({ createLeaveRequest: vi.fn(() => create.promise) });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);
    await controller.updateForm({ endDate: '2026-08-12', startDate: '2026-08-11' });

    const first = controller.submitCreate();
    const second = controller.submitCreate();
    expect(second).toBe(first);
    expect(api.createLeaveRequest).toHaveBeenCalledTimes(1);

    create.reject(new Error('server refused'));
    await expect(first).rejects.toThrow('server refused');
    expect(controller.state.form.startDate).toBe('2026-08-11');
    expect(controller.state.form.endDate).toBe('2026-08-12');
  });

  it('does not share an in-flight leave mutation after its workflow context changes', async () => {
    const firstCreate = deferred<LeaveRequest>();
    const secondCreate = deferred<LeaveRequest>();
    const api = dependencies({
      createLeaveRequest: vi
        .fn<LeaveWorkflowDependencies['createLeaveRequest']>()
        .mockReturnValueOnce(firstCreate.promise)
        .mockReturnValueOnce(secondCreate.promise),
    });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);

    const oldOperation = controller.submitCreate();
    const nextContext = { ...context, groupId: 'group-2', groupVersion: 5 };
    controller.activate(nextContext);
    const nextOperation = controller.submitCreate();

    expect(nextOperation).not.toBe(oldOperation);
    expect(api.createLeaveRequest).toHaveBeenNthCalledWith(1, context.groupId, expect.anything());
    expect(api.createLeaveRequest).toHaveBeenNthCalledWith(
      2,
      nextContext.groupId,
      expect.anything(),
    );

    firstCreate.resolve(request());
    secondCreate.resolve(request({ groupId: nextContext.groupId }));
    await Promise.all([oldOperation, nextOperation]);
  });

  it('retires stale auxiliary impact and follows the conflict refresh order without replacing the original message', async () => {
    const firstImpact = deferred<readonly LeaveAffectedShift[]>();
    const conflict = Object.assign(new Error('authoritative conflict'), {
      latestData: { periodVersions: { 'period-1': 8 }, unknown: 'do not display' },
      status: 409,
    });
    const api = dependencies({
      createLeaveRequest: vi.fn(() => Promise.reject(conflict)),
      getLeaveAffectedShifts: vi
        .fn<LeaveWorkflowDependencies['getLeaveAffectedShifts']>()
        .mockReturnValueOnce(firstImpact.promise)
        .mockResolvedValueOnce([]),
    });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);

    const firstForm = controller.updateForm({ endDate: '2026-08-12', startDate: '2026-08-11' });
    const secondForm = controller.updateForm({ endDate: '2026-08-13' });
    firstImpact.resolve([
      {
        assignmentId: 'old',
        businessDate: '2026-08-11',
        isCovered: false,
        shiftTypeAbbreviation: 'D',
        shiftTypeName: 'Day',
      },
    ]);
    await Promise.all([firstForm, secondForm]);
    expect(controller.state.impact.kind).not.toBe('ready');

    await expect(controller.submitCreate()).rejects.toBe(conflict);
    expect(controller.state.impact.kind).toBe('idle');
    expect(controller.state.conflict).toEqual({
      message: 'authoritative conflict',
      summary: { periodVersions: { 'period-1': 8 } },
    });
    expect(api.listLeaveRequests).toHaveBeenCalledTimes(1);
  });

  it('requires a current approval preview, invalidates it when strategy changes and resets acknowledgement', async () => {
    const firstPreview = deferred<LeaveReflowPreview>();
    const api = dependencies({
      previewLeaveRequestApproval: vi
        .fn<LeaveWorkflowDependencies['previewLeaveRequestApproval']>()
        .mockReturnValueOnce(firstPreview.promise)
        .mockResolvedValueOnce(
          preview({
            conflicts: [
              {
                assignmentBusinessKeys: ['2026-08-11:shift-1'],
                code: 'MEMBER_TIME_OVERLAP',
                membershipId: 'member-2',
              },
            ],
            strategy: 'shift-forward',
          }),
        ),
    });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);

    const opening = controller.openApproval(request());
    const changing = controller.setApprovalStrategy('shift-forward');
    firstPreview.resolve(preview());
    await Promise.all([opening, changing]);

    expect(api.previewLeaveRequestApproval).toHaveBeenNthCalledWith(1, context.groupId, 'leave-1', {
      strategy: 'keep-original-order',
    });
    expect(api.previewLeaveRequestApproval).toHaveBeenNthCalledWith(2, context.groupId, 'leave-1', {
      strategy: 'shift-forward',
    });
    expect(controller.state.approval?.preview?.strategy).toBe('shift-forward');
    expect(controller.state.approval?.acknowledgeBlockers).toBe(false);
    expect(controller.state.canApproveApproval).toBe(false);
    expect(controller.state.approvalBlockReason).toContain('确认');

    await expect(controller.approve()).rejects.toThrow('确认');
    controller.setAcknowledgeBlockers(true);
    expect(controller.state.canApproveApproval).toBe(true);
    await controller.approve();
    expect(api.approveLeaveRequest).toHaveBeenCalledWith(context.groupId, 'leave-1', {
      acknowledgeBlockers: true,
      expectedPeriodVersions: { 'period-1': 7 },
      expectedRulesVersion: 9,
      expectedVersion: 3,
      operationId,
      strategy: 'shift-forward',
    });
  });

  it('never lets acknowledgement bypass workflowBlockers and invalidates only published months changed by approval', async () => {
    const api = dependencies({
      previewLeaveRequestApproval: vi.fn(async () =>
        preview({
          affectedAssignments: [
            {
              assignmentId: 'assignment-1',
              businessDate: '2026-08-30',
              endsAt: '2026-08-30T08:00:00.000+08:00',
              nextMemberName: 'Next',
              previousMemberName: 'Previous',
              shiftTypeAbbreviation: 'D',
              shiftTypeColor: '#112233',
              shiftTypeId: 'shift-1',
              shiftTypeName: 'Day',
              shiftTypeTextColor: '#FFFFFF',
              slotPosition: 1,
              startsAt: '2026-08-30T00:00:00.000+08:00',
            },
            {
              assignmentId: 'assignment-2',
              businessDate: '2026-09-01',
              endsAt: '2026-09-01T08:00:00.000+08:00',
              shiftTypeAbbreviation: 'N',
              shiftTypeColor: '#112233',
              shiftTypeId: 'shift-2',
              shiftTypeName: 'Night',
              shiftTypeTextColor: '#FFFFFF',
              slotPosition: 1,
              startsAt: '2026-09-01T00:00:00.000+08:00',
            },
          ],
          workflowBlockers: [{ assignmentId: 'assignment-3', message: 'active swap' }],
        }),
      ),
    });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);
    await controller.openApproval(request());
    controller.setAcknowledgeBlockers(true);

    await expect(controller.approve()).rejects.toThrow('阻塞');
    expect(controller.state.canApproveApproval).toBe(false);
    expect(controller.state.approvalBlockReason).toContain('阻塞');
    expect(api.approveLeaveRequest).not.toHaveBeenCalled();

    await controller.cancel(request());
    await controller.revoke(request({ status: 'approved' }));
    expect(api.invalidateCalendarMonth).not.toHaveBeenCalled();
  });

  it('invalidates only the exact published months changed by a successful approval', async () => {
    const affectedAssignments = [
      {
        assignmentId: 'assignment-1',
        businessDate: '2026-08-30',
        endsAt: '2026-08-30T08:00:00.000+08:00',
        shiftTypeAbbreviation: 'D',
        shiftTypeColor: '#112233',
        shiftTypeId: 'shift-1',
        shiftTypeName: 'Day',
        shiftTypeTextColor: '#FFFFFF',
        slotPosition: 1,
        startsAt: '2026-08-30T00:00:00.000+08:00',
      },
      {
        assignmentId: 'assignment-2',
        businessDate: '2026-09-01',
        endsAt: '2026-09-01T08:00:00.000+08:00',
        shiftTypeAbbreviation: 'N',
        shiftTypeColor: '#112233',
        shiftTypeId: 'shift-2',
        shiftTypeName: 'Night',
        shiftTypeTextColor: '#FFFFFF',
        slotPosition: 1,
        startsAt: '2026-09-01T00:00:00.000+08:00',
      },
    ] as const;
    const finalPreview = preview({ affectedAssignments });
    const api = dependencies({
      approveLeaveRequest: vi.fn(async () => ({
        leaveRequest: request({ status: 'approved' }),
        operationId: 'approve-1',
        preview: finalPreview,
        status: 'approved' as const,
        strategy: 'keep-original-order' as const,
      })),
      previewLeaveRequestApproval: vi.fn(async () => finalPreview),
    });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);
    await controller.openApproval(request());
    await controller.approve();

    expect(api.invalidateCalendarMonth).toHaveBeenCalledTimes(2);
    expect(api.invalidateCalendarMonth).toHaveBeenNthCalledWith(1, {
      ...context,
      businessMonth: '2026-08',
    });
    expect(api.invalidateCalendarMonth).toHaveBeenNthCalledWith(2, {
      ...context,
      businessMonth: '2026-09',
    });
  });

  it('uses the admin-only setting endpoint without operationId, refreshes after success and preserves a failed draft', async () => {
    const update = vi
      .fn<LeaveWorkflowDependencies['updateGroupStrategy']>()
      .mockResolvedValueOnce({ strategy: 'shift-forward' })
      .mockRejectedValueOnce(Object.assign(new Error('settings forbidden'), { status: 403 }))
      .mockRejectedValueOnce(Object.assign(new Error('settings conflict'), { status: 409 }));
    const api = dependencies({
      getGroupStrategy: vi
        .fn<LeaveWorkflowDependencies['getGroupStrategy']>()
        .mockResolvedValueOnce({ strategy: 'keep-original-order' })
        .mockResolvedValueOnce({ strategy: 'shift-forward' })
        .mockResolvedValueOnce({ strategy: 'shift-forward' })
        .mockResolvedValueOnce({ strategy: 'shift-forward' }),
      updateGroupStrategy: update,
    });
    const controller = createLeaveWorkflowController(api);
    controller.activate(context);
    await controller.refresh();

    controller.setGroupStrategyDraft('shift-forward');
    await controller.saveGroupStrategy();
    expect(update).toHaveBeenLastCalledWith(context.groupId, { strategy: 'shift-forward' });
    expect(controller.state.groupStrategy).toEqual({
      draft: 'shift-forward',
      saved: 'shift-forward',
    });

    controller.setGroupStrategyDraft('keep-original-order');
    await expect(controller.saveGroupStrategy()).rejects.toThrow('settings forbidden');
    expect(controller.state.groupStrategy?.draft).toBe('keep-original-order');
    expect(api.getGroupStrategy).toHaveBeenCalledTimes(3);

    await expect(controller.saveGroupStrategy()).rejects.toThrow('settings conflict');
    expect(controller.state.groupStrategy?.draft).toBe('keep-original-order');
    expect(api.getGroupStrategy).toHaveBeenCalledTimes(4);

    const memberApi = dependencies();
    const member = createLeaveWorkflowController(memberApi);
    member.activate({ ...context, groupRole: 'member' });
    await member.refresh();
    expect(member.state.groupStrategy).toBeUndefined();
    expect(memberApi.getGroupStrategy).not.toHaveBeenCalled();
    expect(() => member.setGroupStrategyDraft('shift-forward')).toThrow('管理员');
  });

  it('does not call workflow endpoints for a guest context', async () => {
    const api = dependencies();
    const controller = createLeaveWorkflowController(api);
    controller.activate({ ...context, groupRole: 'guest' });

    await expect(controller.refresh()).rejects.toThrow('访客');
    await expect(controller.submitCreate()).rejects.toThrow('访客');
    expect(controller.state.canSubmit).toBe(false);
    expect(api.listLeaveRequests).not.toHaveBeenCalled();
    expect(api.createLeaveRequest).not.toHaveBeenCalled();
  });
});
