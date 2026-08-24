import type { DutyAdjustmentRequest, LeaveRequest, SwapRequest } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createWorkflowClient,
  dutyAdjustmentPreviewDecoder,
  dutyAdjustmentRequestDecoder,
  leaveReflowPreviewDecoder,
  leaveRequestDecoder,
  swapPreviewDecoder,
  swapRequestDecoder,
  workflowEndpoints,
  type ClientTransport,
} from '../src/index.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const objectId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';

describe('workflow client', () => {
  it('describes every read, preview, setting, and dangerous write endpoint', () => {
    expect(Object.keys(workflowEndpoints)).toHaveLength(38);
    expect(workflowEndpoints.leaveMine.path({ groupId })).toBe(`/groups/${groupId}/leave-requests`);
    expect(
      workflowEndpoints.swapPreview.path({
        groupId,
        request: {
          initiatorAssignmentId: objectId,
          targetAssignmentId: objectId,
          targetMembershipId: objectId,
        },
      }),
    ).toBe(`/groups/${groupId}/swaps/preview`);
    expect(workflowEndpoints.dutySettings.path({ groupId })).toBe(
      `/groups/${groupId}/duty-adjustments/settings`,
    );
  });

  it('puts every dangerous operation id in both body and header descriptors', () => {
    const request = { expectedVersion: 1, operationId };
    const inputs = [
      [
        workflowEndpoints.leaveCreate,
        {
          groupId,
          request: {
            endsAt: '2026-09-02T00:00:00.000Z',
            leaveType: 'sick',
            operationId,
            startsAt: '2026-09-01T00:00:00.000Z',
          },
        },
      ],
      [
        workflowEndpoints.leaveApprove,
        {
          groupId,
          objectId,
          request: {
            expectedPeriodVersions: {},
            expectedRulesVersion: 1,
            expectedVersion: 1,
            operationId,
          },
        },
      ],
      [workflowEndpoints.leaveReject, { groupId, objectId, request }],
      [workflowEndpoints.leaveCancel, { groupId, objectId, request }],
      [workflowEndpoints.leaveRevoke, { groupId, objectId, request }],
      [
        workflowEndpoints.swapCreate,
        {
          groupId,
          request: {
            initiatorAssignmentId: objectId,
            operationId,
            targetAssignmentId: objectId,
            targetMembershipId: objectId,
          },
        },
      ],
      [
        workflowEndpoints.swapDirectCreate,
        {
          groupId,
          request: {
            initiatorAssignmentId: objectId,
            operationId,
            targetAssignmentId: objectId,
          },
        },
      ],
      [workflowEndpoints.swapAccept, { groupId, objectId, request }],
      [workflowEndpoints.swapApprove, { groupId, objectId, request }],
      [workflowEndpoints.swapReject, { groupId, objectId, request }],
      [workflowEndpoints.swapCancel, { groupId, objectId, request }],
      [workflowEndpoints.swapRevoke, { groupId, objectId, request }],
      [
        workflowEndpoints.dutyCreate,
        {
          groupId,
          request: {
            coveredAssignmentId: objectId,
            operationId,
            overtimeMembershipId: objectId,
          },
        },
      ],
      [
        workflowEndpoints.dutyDirectCreate,
        {
          groupId,
          request: {
            coveredAssignmentId: objectId,
            operationId,
            overtimeMembershipId: objectId,
          },
        },
      ],
      [workflowEndpoints.dutyAccept, { groupId, objectId, request }],
      [workflowEndpoints.dutyApprove, { groupId, objectId, request }],
      [workflowEndpoints.dutyReject, { groupId, objectId, request }],
      [workflowEndpoints.dutyCancel, { groupId, objectId, request }],
      [workflowEndpoints.dutyRevoke, { groupId, objectId, request }],
    ] as const;

    for (const [endpoint, input] of inputs) {
      expect(endpoint.body?.(input as never)).toEqual((input as { request: unknown }).request);
      expect(endpoint.idempotencyKey?.(input as never)).toBe(operationId);
    }
  });

  it('preserves endpoint receivers and request counts through one shared service', async () => {
    const responses = new Map<string, unknown>([
      ['workflow.leave-mine', []],
      ['workflow.swap-preview', { nextStatus: 'pending_target' }],
      ['workflow.duty-create', { id: objectId }],
    ]);
    const transport: ClientTransport = {
      request: vi.fn((endpoint) => Promise.resolve(responses.get(endpoint.id) as never)),
    };
    const client = createWorkflowClient(transport);

    await expect(client.listMyLeaveRequests(groupId)).resolves.toBe(
      responses.get('workflow.leave-mine'),
    );
    await expect(
      client.previewSwap(groupId, {
        initiatorAssignmentId: objectId,
        targetAssignmentId: objectId,
        targetMembershipId: objectId,
      }),
    ).resolves.toBe(responses.get('workflow.swap-preview'));
    await expect(
      client.createDutyAdjustmentRequest(groupId, {
        coveredAssignmentId: objectId,
        operationId,
        overtimeMembershipId: objectId,
      }),
    ).resolves.toBe(responses.get('workflow.duty-create'));
    expect(transport.request).toHaveBeenCalledTimes(3);
  });

  it('fails closed on malformed workflow states', () => {
    const leave = minimalLeaveRequest();
    const swap = minimalSwapRequest();
    const duty = minimalDutyAdjustmentRequest();
    expect(leaveRequestDecoder.safeDecode(leave).success).toBe(true);
    expect(leaveRequestDecoder.safeDecode({ ...leave, status: 'future' }).success).toBe(false);
    expect(swapRequestDecoder.safeDecode(swap).success).toBe(true);
    expect(swapRequestDecoder.safeDecode({ ...swap, version: 0 }).success).toBe(false);
    expect(dutyAdjustmentRequestDecoder.safeDecode(duty).success).toBe(true);
    expect(dutyAdjustmentRequestDecoder.safeDecode({ ...duty, status: 'future' }).success).toBe(
      false,
    );
    expect(leaveReflowPreviewDecoder.safeDecode({}).success).toBe(false);
    expect(swapPreviewDecoder.safeDecode({}).success).toBe(false);
    expect(dutyAdjustmentPreviewDecoder.safeDecode({}).success).toBe(false);
  });
});

function assignment() {
  return {
    assignmentId: objectId,
    businessDate: '2026-09-01',
    endsAt: '2026-09-02T00:00:00.000Z',
    scheduleRoleId: objectId,
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: objectId,
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-09-01T00:00:00.000Z',
    version: 1,
  };
}

function minimalLeaveRequest(): LeaveRequest {
  return {
    createdAt: '2026-08-24T00:00:00.000Z',
    endsAt: '2026-09-02T00:00:00.000Z',
    groupId,
    id: objectId,
    isAllDay: true,
    leaveType: 'sick',
    membershipId: objectId,
    reflowStrategy: 'keep-original-order',
    startsAt: '2026-09-01T00:00:00.000Z',
    status: 'pending',
    version: 1,
  };
}

function minimalSwapRequest(): SwapRequest {
  return {
    createdAt: '2026-08-24T00:00:00.000Z',
    groupId,
    id: objectId,
    initiatorAssignment: assignment(),
    initiatorAssignmentId: objectId,
    initiatorAssignmentVersion: 1,
    initiatorMembershipId: objectId,
    status: 'pending_target',
    targetAssignment: assignment(),
    targetAssignmentId: objectId,
    targetAssignmentVersion: 1,
    targetMembershipId: objectId,
    version: 1,
  };
}

function minimalDutyAdjustmentRequest(): DutyAdjustmentRequest {
  return {
    assignmentVersion: 1,
    coveredAssignment: assignment(),
    coveredAssignmentId: objectId,
    createdAt: '2026-08-24T00:00:00.000Z',
    deductedMembershipId: objectId,
    groupId,
    id: objectId,
    overtimeMembershipId: objectId,
    status: 'pending_target',
    version: 1,
  };
}
