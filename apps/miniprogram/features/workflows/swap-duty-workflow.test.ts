import type {
  CalendarReadModel,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  GroupMember,
  SwapPreview,
  SwapRequest,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createSwapDutyWorkflowController,
  type SwapDutyWorkflowDependencies,
} from './swap-duty-workflow.js';

const context = {
  groupId: 'group-1',
  groupRole: 'administrator' as const,
  groupVersion: 4,
  userId: 'user-1',
};

const operationId = '11111111-1111-4111-8111-111111111111';

const assignment = (id: string, businessDate: string, membershipId: string) => ({
  actualMemberId: membershipId,
  actualMembershipId: membershipId,
  actualMemberName: membershipId === 'member-1' ? '甲' : '乙',
  assignmentId: id,
  businessDate,
  changeMarkers: [] as const,
  endsAt: `${businessDate}T16:00:00.000+08:00`,
  plannedMemberId: membershipId,
  plannedMembershipId: membershipId,
  plannedMemberName: membershipId === 'member-1' ? '甲' : '乙',
  scheduleRoleId: 'role-1',
  scheduleRoleName: '值班',
  shiftTypeAbbreviation: 'D',
  shiftTypeColor: '#112233',
  shiftTypeId: 'shift-1',
  shiftTypeName: '白班',
  shiftTypeTextColor: '#FFFFFF',
  slotPosition: 1,
  startsAt: `${businessDate}T08:00:00.000+08:00`,
  version: 3,
});

const calendar: CalendarReadModel = {
  assignments: [
    {
      ...assignment('old', '2026-08-10', 'member-1'),
      id: 'old',
      schedulePeriodId: 'period-1',
    },
    {
      ...assignment('mine', '2026-08-11', 'member-1'),
      id: 'mine',
      schedulePeriodId: 'period-1',
    },
    {
      ...assignment('target', '2026-08-12', 'member-2'),
      id: 'target',
      schedulePeriodId: 'period-1',
    },
  ],
  businessMonth: '2026-08',
  groupId: context.groupId,
  members: [
    { isConfirmed: true, membershipId: 'member-1', realName: '甲' },
    { isConfirmed: true, membershipId: 'member-2', realName: '乙' },
  ],
  roles: [],
  shiftTypes: [],
};

const swapPreview: SwapPreview = {
  conflicts: [],
  groupId: context.groupId,
  initiatorAssignment: assignment('mine', '2026-08-11', 'member-1'),
  initiatorEligibleForTargetShift: true,
  nextStatus: 'pending_approval',
  requiresApproval: true,
  targetAssignment: assignment('target', '2026-08-12', 'member-2'),
  targetAutoAccepts: true,
  targetEligibleForInitiatorShift: true,
};

const dutyPreview: DutyAdjustmentPreview = {
  conflicts: [],
  coveredAssignment: assignment('mine', '2026-08-11', 'member-1'),
  deductedMemberName: '甲',
  groupId: context.groupId,
  nextStatus: 'pending_approval',
  overtimeAutoAccepts: false,
  overtimeMemberName: '乙',
  requiresApproval: true,
};

function swapRequest(status: SwapRequest['status'] = 'completed'): SwapRequest {
  return {
    createdAt: '2026-08-11T00:00:00.000+08:00',
    groupId: context.groupId,
    id: 'swap-1',
    initiatorAssignment: assignment('mine', '2026-08-11', 'member-1'),
    initiatorAssignmentId: 'mine',
    initiatorAssignmentVersion: 3,
    initiatorMembershipId: 'member-1',
    status,
    targetAssignment: assignment('target', '2026-08-12', 'member-2'),
    targetAssignmentId: 'target',
    targetAssignmentVersion: 3,
    targetMembershipId: 'member-2',
    version: 4,
  };
}

function dutyRequest(status: DutyAdjustmentRequest['status'] = 'completed'): DutyAdjustmentRequest {
  return {
    assignmentVersion: 3,
    coveredAssignment: assignment('mine', '2026-08-11', 'member-1'),
    coveredAssignmentId: 'mine',
    createdAt: '2026-08-11T00:00:00.000+08:00',
    deductedMembershipId: 'member-1',
    groupId: context.groupId,
    id: 'duty-1',
    overtimeMembershipId: 'member-2',
    status,
    version: 4,
  };
}

function dependencies(
  overrides: Partial<SwapDutyWorkflowDependencies> = {},
): SwapDutyWorkflowDependencies {
  const groupMembers: readonly GroupMember[] = [
    { id: 'member-1', isCurrentUser: true, realName: '甲', role: 'member' },
    { id: 'member-2', isCurrentUser: false, realName: '乙', role: 'member' },
  ];
  return {
    acceptDutyAdjustment: vi.fn(async () => dutyRequest()),
    acceptSwapRequest: vi.fn(async () => swapRequest()),
    approveDutyAdjustment: vi.fn(async () => dutyRequest()),
    approveSwapRequest: vi.fn(async () => swapRequest()),
    cancelDutyAdjustment: vi.fn(async () => dutyRequest('cancelled')),
    cancelSwapRequest: vi.fn(async () => swapRequest('cancelled')),
    createDirectDutyAdjustment: vi.fn(async () => dutyRequest()),
    createDirectSwapRequest: vi.fn(async () => swapRequest()),
    createDutyAdjustmentRequest: vi.fn(async () => dutyRequest('pending_approval')),
    createOperationId: vi.fn(() => operationId),
    createSwapRequest: vi.fn(async () => swapRequest('pending_approval')),
    getCalendar: vi.fn(async () => calendar),
    getGroupDutyAdjustmentSettings: vi.fn(async () => ({ requiresApproval: true })),
    getGroupSwapSettings: vi.fn(async () => ({ requiresApproval: true })),
    getMyDutyAdjustmentSettings: vi.fn(async () => ({ autoAcceptSwaps: false })),
    getMySwapSettings: vi.fn(async () => ({ autoAcceptSwaps: true })),
    invalidateCalendarMonth: vi.fn(),
    listDutyAdjustmentApprovals: vi.fn(async () => []),
    listDutyAdjustmentRequests: vi.fn(async () => []),
    listGroupMembers: vi.fn(async () => groupMembers),
    listSwapApprovals: vi.fn(async () => []),
    listSwapRequests: vi.fn(async () => []),
    previewDutyAdjustment: vi.fn(async () => dutyPreview),
    previewSwap: vi.fn(async () => swapPreview),
    rejectDutyAdjustment: vi.fn(async () => dutyRequest('rejected')),
    rejectSwapRequest: vi.fn(async () => swapRequest('rejected')),
    revokeDutyAdjustment: vi.fn(async () => dutyRequest('revoked')),
    revokeSwapRequest: vi.fn(async () => swapRequest('revoked')),
    updateGroupDutyAdjustmentSettings: vi.fn(async () => ({ requiresApproval: false })),
    updateGroupSwapSettings: vi.fn(async () => ({ requiresApproval: false })),
    updateMySwapSettings: vi.fn(async () => ({ autoAcceptSwaps: false })),
    ...overrides,
  };
}

describe('swap and duty workflow controller', () => {
  it('filters yesterday, generates normal swap preview before writing, and preserves server nextStatus', async () => {
    const api = dependencies();
    const controller = createSwapDutyWorkflowController(api, () => '2026-08-11');
    controller.activate(context);
    await controller.refresh();

    expect(controller.state.swap.candidates.map(({ assignment }) => assignment.id)).toEqual([
      'mine',
      'target',
    ]);
    controller.setSwapAssignments('mine', 'target');
    await expect(controller.submitSwap(false)).rejects.toThrow('预览');
    expect(api.previewSwap).toHaveBeenCalledWith(context.groupId, {
      initiatorAssignmentId: 'mine',
      initiatorMembershipId: 'member-1',
      targetAssignmentId: 'target',
      targetMembershipId: 'member-2',
    });
    expect(controller.state.swap.preview?.nextStatus).toBe('pending_approval');
    expect(api.createSwapRequest).not.toHaveBeenCalled();

    await controller.submitSwap(false);
    expect(api.createSwapRequest).toHaveBeenCalledWith(context.groupId, {
      initiatorAssignmentId: 'mine',
      initiatorMembershipId: 'member-1',
      operationId,
      targetAssignmentId: 'target',
      targetMembershipId: 'member-2',
    });
  });

  it('requires preview for direct swap, omits reason, completes directly, and invalidates only result months', async () => {
    const api = dependencies();
    const controller = createSwapDutyWorkflowController(api, () => '2026-08-11');
    controller.activate(context);
    await controller.refresh();
    controller.setSwapAssignments('mine', 'target');

    await expect(controller.submitSwap(true)).rejects.toThrow('预览');
    await controller.submitSwap(true);

    expect(api.createDirectSwapRequest).toHaveBeenCalledWith(context.groupId, {
      initiatorAssignmentId: 'mine',
      operationId,
      targetAssignmentId: 'target',
    });
    expect(api.invalidateCalendarMonth).toHaveBeenCalledWith({
      ...context,
      businessMonth: '2026-08',
    });
  });

  it('never calls preview for direct duty and omits an empty reason while invalidating a completed write', async () => {
    const api = dependencies();
    const controller = createSwapDutyWorkflowController(api, () => '2026-08-11');
    controller.activate(context);
    await controller.refresh();
    controller.setDutyAdjustment('mine', 'member-2', '   ');

    await controller.submitDuty(true);

    expect(api.previewDutyAdjustment).not.toHaveBeenCalled();
    expect(api.createDirectDutyAdjustment).toHaveBeenCalledWith(context.groupId, {
      coveredAssignmentId: 'mine',
      operationId,
      overtimeMembershipId: 'member-2',
    });
    expect(api.invalidateCalendarMonth).toHaveBeenCalledWith({
      ...context,
      businessMonth: '2026-08',
    });
  });

  it('clears the swap preview, refreshes, and preserves the original 409 message', async () => {
    const conflict = Object.assign(new Error('authoritative swap conflict'), {
      latestData: { periodVersions: { 'period-1': 8 }, unknown: 'ignore' },
      status: 409,
    });
    const api = dependencies({ createSwapRequest: vi.fn(() => Promise.reject(conflict)) });
    const controller = createSwapDutyWorkflowController(api, () => '2026-08-11');
    controller.activate(context);
    await controller.refresh();
    controller.setSwapAssignments('mine', 'target');

    await expect(controller.submitSwap(false)).rejects.toThrow('预览');
    await expect(controller.submitSwap(false)).rejects.toBe(conflict);

    expect(controller.state.swap.preview).toBeUndefined();
    expect(controller.state.conflict).toEqual({
      message: 'authoritative swap conflict',
      summary: { periodVersions: { 'period-1': 8 } },
    });
    expect(api.listSwapRequests).toHaveBeenCalledTimes(2);
  });

  it('updates only the intended setting fields through their real endpoints', async () => {
    const api = dependencies();
    const controller = createSwapDutyWorkflowController(api, () => '2026-08-11');
    controller.activate(context);
    await controller.refresh();

    await controller.updateSwapRequiresApproval(false);
    await controller.updateDutyRequiresApproval(false);
    await controller.updateMemberAutoAccepts(false);

    expect(api.updateGroupSwapSettings).toHaveBeenCalledWith(context.groupId, {
      requiresApproval: false,
    });
    expect(api.updateGroupDutyAdjustmentSettings).toHaveBeenCalledWith(context.groupId, {
      requiresApproval: false,
    });
    expect(api.updateMySwapSettings).toHaveBeenCalledWith(context.groupId, {
      autoAcceptSwaps: false,
    });
  });
});
