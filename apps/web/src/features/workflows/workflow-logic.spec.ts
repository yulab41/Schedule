import type { CalendarDutyAssignment, CalendarReadModel } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildFutureCandidateAssignments,
  filterFutureAssignments,
  getWorkflowNextStatusDescription,
  getWorkflowStatusLabel,
  groupAssignmentsByDutyMember,
  isFutureAssignment,
  resolveNextWorkflowStatus,
} from './workflow-logic.js';

function assignment(
  id: string,
  businessDate: string,
  membershipId: string | undefined,
): CalendarDutyAssignment {
  return {
    businessDate,
    changeMarkers: [],
    endsAt: `${businessDate}T16:00:00.000Z`,
    id,
    plannedMemberName:
      membershipId === 'me' ? '张医生' : membershipId === 'target' ? '李医生' : undefined,
    plannedMembershipId: membershipId,
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-1',
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: `${businessDate}T00:00:00.000Z`,
  };
}

const calendar: CalendarReadModel = {
  assignments: [
    assignment('past-me', '2000-01-01', 'me'),
    assignment('future-me', '2099-01-01', 'me'),
    assignment('future-target', '2099-01-02', 'target'),
  ],
  businessMonth: '2099-01',
  groupId: 'group-1',
  members: [
    { isConfirmed: false, membershipId: 'me', realName: '张医生' },
    { isConfirmed: false, membershipId: 'target', realName: '李医生' },
  ],
  roles: [{ id: 'role-1', name: '一线' }],
  shiftTypes: [],
};

describe('shared swap/duty adjustment workflow logic', () => {
  it('judges future assignments against an explicit clock', () => {
    const now = new Date('2026-08-07T00:00:00.000Z').valueOf();

    expect(isFutureAssignment(assignment('later', '2026-09-01', 'me'), now)).toBe(true);
    expect(isFutureAssignment(assignment('past', '2026-07-01', 'me'), now)).toBe(false);
    expect(isFutureAssignment(assignment('now', '2026-08-07T00:00:00.000Z', 'me'), now)).toBe(
      false,
    );
  });

  it('keeps only future assignments in the original order', () => {
    const past = assignment('past', '2000-01-01', 'me');
    const future = assignment('future', '2099-01-01', 'me');

    expect(filterFutureAssignments([past, future])).toEqual([future]);
  });

  it('builds future assignments and my future assignments', () => {
    const candidates = buildFutureCandidateAssignments(calendar, 'me');

    expect(candidates.futureAssignments.map((item) => item.id)).toEqual([
      'future-me',
      'future-target',
    ]);
    expect(candidates.myAssignments.map((item) => item.id)).toEqual(['future-me']);
  });

  it('groups future assignments by the current duty member and skips unassigned ones', () => {
    const plannedMe = assignment('planned-me', '2099-01-03', 'me');
    const reassigned = {
      ...assignment('reassigned', '2099-01-04', 'me'),
      actualMembershipId: 'target',
      actualMemberName: '李医生',
    };
    const unassigned = assignment('unassigned', '2099-01-05', undefined);

    const grouped = groupAssignmentsByDutyMember([
      unassigned,
      plannedMe,
      reassigned,
      calendar.assignments[2]!,
    ]);

    expect(grouped.get('me')?.map((item) => item.id)).toEqual(['planned-me']);
    expect(grouped.get('target')?.map((item) => item.id)).toEqual(['reassigned', 'future-target']);
    expect(grouped.has('unassigned')).toBe(false);
  });

  it('labels statuses with the workflow-specific pending target wording', () => {
    expect(getWorkflowStatusLabel('pending_target', '对方')).toBe('待对方接受');
    expect(getWorkflowStatusLabel('pending_target', '加班成员')).toBe('待加班成员接受');
    expect(getWorkflowStatusLabel('pending_approval', '对方')).toBe('待管理员审批');
    expect(getWorkflowStatusLabel('revoked', '对方')).toBe('已撤销');
  });

  it('describes the next status with the workflow-specific target member wording', () => {
    expect(getWorkflowNextStatusDescription('pending_target', '目标成员')).toBe(
      '提交后将等待目标成员接受。',
    );
    expect(getWorkflowNextStatusDescription('pending_target', '加班成员')).toBe(
      '提交后将等待加班成员接受。',
    );
    expect(getWorkflowNextStatusDescription('pending_approval', '目标成员')).toBe(
      '目标成员将自动接受，提交后进入管理员审批。',
    );
    expect(getWorkflowNextStatusDescription('pending_approval', '加班成员')).toBe(
      '加班成员将自动接受，提交后进入管理员审批。',
    );
    expect(getWorkflowNextStatusDescription('completed', '目标成员')).toBe(
      '目标成员已开启自动接受且群组无需审批，提交后将立即生效。',
    );
    expect(getWorkflowNextStatusDescription('completed', '加班成员')).toBe(
      '加班成员已开启自动接受且群组无需审批，提交后将立即生效。',
    );
    expect(getWorkflowNextStatusDescription('rejected', '目标成员')).toBe('');
  });

  it('resolves the next workflow status from group and member settings', () => {
    expect(resolveNextWorkflowStatus(true, false)).toBe('pending_target');
    expect(resolveNextWorkflowStatus(false, false)).toBe('pending_target');
    expect(resolveNextWorkflowStatus(true, true)).toBe('pending_approval');
    expect(resolveNextWorkflowStatus(false, true)).toBe('completed');
  });
});
