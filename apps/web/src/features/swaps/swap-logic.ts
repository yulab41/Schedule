import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  CalendarReadModel,
  SwapConflict,
  SwapAssignmentSummary,
  SwapRequestStatus,
} from '@schedule/contracts';
import { chinaStandardTimeOffsetMilliseconds } from '@schedule/scheduling-domain';

import { getDutyMembershipId, getDutyMemberName } from '../calendar/calendar-logic.js';

export interface SwapCandidateOptions {
  readonly assignmentsByTarget: ReadonlyMap<string, readonly CalendarDutyAssignment[]>;
  readonly myAssignments: readonly CalendarDutyAssignment[];
  readonly targetOptions: readonly CalendarDutyMember[];
}

export const swapStatusLabels: Readonly<Record<SwapRequestStatus, string>> = {
  cancelled: '已取消',
  revoked: '已撤销',
  completed: '已生效',
  pending_approval: '待管理员审批',
  pending_target: '待对方接受',
  rejected: '已驳回',
};

export function buildSwapCandidates(
  calendar: CalendarReadModel,
  myMembershipId: string,
): SwapCandidateOptions {
  const futureAssignments = calendar.assignments.filter(isFutureAssignment);
  const myAssignments = futureAssignments.filter(
    (assignment) => getDutyMembershipId(assignment) === myMembershipId,
  );
  const assignmentsByTarget = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of futureAssignments) {
    const dutyMemberId = getDutyMembershipId(assignment);
    if (dutyMemberId === undefined) {
      continue;
    }
    const assignments = assignmentsByTarget.get(dutyMemberId) ?? [];
    assignments.push(assignment);
    assignmentsByTarget.set(dutyMemberId, assignments);
  }
  const targetOptions = calendar.members.filter(
    (member) =>
      member.membershipId !== myMembershipId && assignmentsByTarget.has(member.membershipId),
  );

  return { assignmentsByTarget, myAssignments, targetOptions };
}

export function getSwapStatusLabel(status: SwapRequestStatus): string {
  return swapStatusLabels[status];
}

export function getSwapConflictMessage(conflict: SwapConflict): string {
  return conflict.message;
}

export function resolveNextSwapStatus(
  requiresApproval: boolean,
  targetAutoAccepts: boolean,
): SwapRequestStatus {
  if (!targetAutoAccepts) {
    return 'pending_target';
  }
  return requiresApproval ? 'pending_approval' : 'completed';
}

export function getSwapNextStatusDescription(status: SwapRequestStatus): string {
  switch (status) {
    case 'pending_target':
      return '提交后将等待目标成员接受。';
    case 'pending_approval':
      return '目标成员将自动接受，提交后进入管理员审批。';
    case 'completed':
      return '目标成员已开启自动接受且群组无需审批，提交后将立即生效。';
    default:
      return '';
  }
}

export function formatSwapAssignmentOption(assignment: CalendarDutyAssignment): string {
  const dutyName = getDutyMemberName(assignment) ?? '待定';
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${assignment.shiftTypeAbbreviation}）· ${dutyName}`;
}

export function formatSwapAssignmentSummaryOption(assignment: SwapAssignmentSummary): string {
  const dutyName = assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定';
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${assignment.shiftTypeAbbreviation}）· ${dutyName}`;
}

export function formatSwapShiftTime(startsAt: string, endsAt: string): string {
  const start = formatChinaStandardTime(startsAt);
  const end = formatChinaStandardTime(endsAt);
  return `${start.slice(0, 5)} ${start.slice(5)}–${end.slice(5)}`;
}

function formatChinaStandardTime(value: string): string {
  return new Date(new Date(value).valueOf() + chinaStandardTimeOffsetMilliseconds)
    .toISOString()
    .slice(5, 16)
    .replace('T', ' ');
}

function isFutureAssignment(assignment: CalendarDutyAssignment): boolean {
  return new Date(assignment.startsAt).valueOf() > Date.now();
}
