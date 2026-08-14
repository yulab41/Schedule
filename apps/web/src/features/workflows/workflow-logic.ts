import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  DutyAdjustmentStatus,
  SwapRequestStatus,
} from '@schedule/contracts';
import { isPastBusinessDate } from '@schedule/scheduling-domain';

import { getDutyMembershipId } from '../calendar/calendar-logic.js';

export type WorkflowRequestStatus = SwapRequestStatus | DutyAdjustmentStatus;
export type WorkflowStatusTone = 'danger' | 'neutral' | 'success' | 'warning';

export interface OperableCandidateAssignments {
  readonly operableAssignments: readonly CalendarDutyAssignment[];
  readonly myAssignments: readonly CalendarDutyAssignment[];
}

const workflowStatusLabels: Readonly<
  Record<Exclude<WorkflowRequestStatus, 'pending_target'>, string>
> = {
  cancelled: '已取消',
  completed: '已生效',
  pending_approval: '待管理员审批',
  rejected: '已驳回',
  revoked: '已撤销',
};

export function isOperableAssignment(
  assignment: CalendarDutyAssignment,
  now: Date = new Date(),
): boolean {
  return !isPastBusinessDate(assignment.businessDate, now);
}

export function filterOperableAssignments(
  assignments: readonly CalendarDutyAssignment[],
  now: Date = new Date(),
): readonly CalendarDutyAssignment[] {
  return assignments.filter((assignment) => isOperableAssignment(assignment, now));
}

export function buildOperableCandidateAssignments(
  calendar: CalendarReadModel,
  myMembershipId: string,
  now: Date = new Date(),
): OperableCandidateAssignments {
  const operableAssignments = filterOperableAssignments(calendar.assignments, now);
  const myAssignments = operableAssignments.filter(
    (assignment) => getDutyMembershipId(assignment) === myMembershipId,
  );
  return { operableAssignments, myAssignments };
}

export function groupAssignmentsByDutyMember(
  assignments: readonly CalendarDutyAssignment[],
): ReadonlyMap<string, readonly CalendarDutyAssignment[]> {
  const assignmentsByDutyMember = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of assignments) {
    const dutyMemberId = getDutyMembershipId(assignment);
    if (dutyMemberId === undefined) {
      continue;
    }
    const memberAssignments = assignmentsByDutyMember.get(dutyMemberId) ?? [];
    memberAssignments.push(assignment);
    assignmentsByDutyMember.set(dutyMemberId, memberAssignments);
  }
  return assignmentsByDutyMember;
}

export function getWorkflowStatusLabel(
  status: WorkflowRequestStatus,
  pendingTargetLabel: string,
): string {
  if (status === 'pending_target') {
    return `待${pendingTargetLabel}接受`;
  }
  return workflowStatusLabels[status];
}

export function getWorkflowStatusTone(status: WorkflowRequestStatus): WorkflowStatusTone {
  switch (status) {
    case 'pending_target':
    case 'pending_approval':
      return 'warning';
    case 'completed':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'cancelled':
    case 'revoked':
      return 'neutral';
  }
}

export function resolveNextWorkflowStatus(
  requiresApproval: boolean,
  targetAutoAccepts: boolean,
): WorkflowRequestStatus {
  if (!targetAutoAccepts) {
    return 'pending_target';
  }
  return requiresApproval ? 'pending_approval' : 'completed';
}

export function getWorkflowNextStatusDescription(
  status: WorkflowRequestStatus,
  targetMemberLabel: string,
): string {
  switch (status) {
    case 'pending_target':
      return `提交后将等待${targetMemberLabel}接受。`;
    case 'pending_approval':
      return `${targetMemberLabel}将自动接受，提交后进入管理员审批。`;
    case 'completed':
      return `${targetMemberLabel}已开启自动接受且群组无需审批，提交后将立即生效。`;
    default:
      return '';
  }
}
