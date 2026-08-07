import { describe, expect, it } from 'vitest';

import { ApiError } from '../../plugins/error-handler.js';
import { WorkflowConflictService, type WorkflowConflict } from './workflow-conflict-service.js';

const eligibilityConflict: WorkflowConflict = {
  assignmentId: 'assignment-1',
  code: 'MEMBER_NOT_ELIGIBLE',
  membershipId: 'membership-1',
  message: '该成员不在班次的排班角色中或不在生效区间。',
};

const activeWorkflowConflict: WorkflowConflict = {
  assignmentId: 'assignment-2',
  code: 'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST',
  membershipId: 'membership-2',
  message: '其中一个班次已有待处理的换班申请，请先处理后再发起新换班。',
};

function captureError(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to throw.');
}

describe('WorkflowConflictService.assertNoWorkflowConflicts', () => {
  it('does not throw when both conflict lists are empty', () => {
    const service = new WorkflowConflictService();

    expect(() =>
      service.assertNoWorkflowConflicts({
        activeWorkflowConflicts: [],
        conflicts: [],
        latestData: { groupId: 'group-1' },
      }),
    ).not.toThrow();
  });

  it('throws eligibility conflicts with joined messages and module context', () => {
    const service = new WorkflowConflictService();

    const caught = captureError(() =>
      service.assertNoWorkflowConflicts({
        activeWorkflowConflicts: [],
        conflicts: [eligibilityConflict],
        latestData: { groupId: 'group-1' },
      }),
    );

    expect(caught).toBeInstanceOf(ApiError);
    const error = caught as ApiError;
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('该成员不在班次的排班角色中或不在生效区间。');
    expect(error.latestData).toEqual({
      conflicts: [eligibilityConflict],
      groupId: 'group-1',
    });
  });

  it('throws active workflow conflicts when only those exist', () => {
    const service = new WorkflowConflictService();

    const caught = captureError(() =>
      service.assertNoWorkflowConflicts({
        activeWorkflowConflicts: [activeWorkflowConflict],
        conflicts: [],
        latestData: { groupId: 'group-1' },
      }),
    );

    expect(caught).toBeInstanceOf(ApiError);
    const error = caught as ApiError;
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('其中一个班次已有待处理的换班申请，请先处理后再发起新换班。');
    expect(error.latestData).toEqual({
      conflicts: [activeWorkflowConflict],
      groupId: 'group-1',
    });
  });

  it('reports eligibility conflicts before active workflow conflicts', () => {
    const service = new WorkflowConflictService();

    const caught = captureError(() =>
      service.assertNoWorkflowConflicts({
        activeWorkflowConflicts: [activeWorkflowConflict],
        conflicts: [eligibilityConflict],
        latestData: { groupId: 'group-1' },
      }),
    );

    expect(caught).toBeInstanceOf(ApiError);
    const error = caught as ApiError;
    expect(error.message).toContain('该成员不在班次的排班角色中或不在生效区间。');
    expect(error.latestData).toEqual({
      conflicts: [eligibilityConflict],
      groupId: 'group-1',
    });
  });
});
