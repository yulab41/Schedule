import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  DutyAdjustmentStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  SwapRequestStatus,
} from '@schedule/contracts';

import { formatChinaTime, formatChinaDateShort } from './time.js';
import { getDutyMembershipId } from './calendar.js';

export const leaveTypeLabels: Readonly<Record<LeaveRequestType, string>> = {
  maternity: '产假',
  other: '其他',
  rotation: '轮科',
  sick: '病假',
  training: '进修',
};

export const leaveStatusLabels: Readonly<Record<LeaveRequestStatus, string>> = {
  approved: '已批准',
  pending: '待审批',
  rejected: '已驳回',
};

const workflowStatusLabels: Readonly<
  Record<Exclude<SwapRequestStatus | DutyAdjustmentStatus, 'pending_target'>, string>
> = {
  cancelled: '已取消',
  completed: '已生效',
  pending_approval: '待管理员审批',
  rejected: '已驳回',
  revoked: '已撤销',
};

export function getWorkflowStatusLabel(
  status: SwapRequestStatus | DutyAdjustmentStatus,
  pendingTargetLabel: string,
): string {
  if (status === 'pending_target') {
    return `待${pendingTargetLabel}接受`;
  }
  return workflowStatusLabels[status];
}

export function getWorkflowNextStatusDescription(
  status: SwapRequestStatus | DutyAdjustmentStatus,
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

export function isOperableAssignment(assignment: CalendarDutyAssignment, today: string): boolean {
  return assignment.businessDate >= today;
}

export function buildMyOperableAssignments(
  assignments: readonly CalendarDutyAssignment[],
  myMembershipId: string,
  today: string,
): readonly CalendarDutyAssignment[] {
  return assignments.filter(
    (assignment) =>
      assignment.businessDate >= today && getDutyMembershipId(assignment) === myMembershipId,
  );
}

export function groupAssignmentsByDutyMember(
  assignments: readonly CalendarDutyAssignment[],
): ReadonlyMap<string, readonly CalendarDutyAssignment[]> {
  const byMember = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of assignments) {
    const dutyMemberId = getDutyMembershipId(assignment);
    if (dutyMemberId === undefined) {
      continue;
    }
    const list = byMember.get(dutyMemberId) ?? [];
    list.push(assignment);
    byMember.set(dutyMemberId, list);
  }
  return byMember;
}

export function getTargetOptions(
  members: readonly CalendarDutyMember[],
  myMembershipId: string,
  assignmentsByTarget: ReadonlyMap<string, readonly CalendarDutyAssignment[]>,
): readonly CalendarDutyMember[] {
  return members.filter(
    (member) =>
      member.membershipId !== myMembershipId && assignmentsByTarget.has(member.membershipId),
  );
}

export function formatAssignmentOption(assignment: CalendarDutyAssignment): string {
  return `${formatChinaDateShort(assignment.businessDate)} ${formatChinaTime(
    assignment.startsAt,
  )}–${formatChinaTime(assignment.endsAt)} ${assignment.shiftTypeName}(${
    assignment.shiftTypeAbbreviation
  })`;
}
