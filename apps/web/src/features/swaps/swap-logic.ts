import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  CalendarReadModel,
  SwapConflict,
  SwapAssignmentSummary,
  SwapRequestStatus,
} from '@schedule/contracts';
import { formatChinaDateTime } from '@schedule/scheduling-domain';

import { getDutyMemberName } from '../calendar/calendar-logic.js';
import {
  buildOperableCandidateAssignments,
  getWorkflowNextStatusDescription,
  getWorkflowStatusLabel,
  groupAssignmentsByDutyMember,
  resolveNextWorkflowStatus,
} from '../workflows/workflow-logic.js';

export interface SwapCandidateOptions {
  readonly assignmentsByTarget: ReadonlyMap<string, readonly CalendarDutyAssignment[]>;
  readonly myAssignments: readonly CalendarDutyAssignment[];
  readonly targetOptions: readonly CalendarDutyMember[];
}

export function buildSwapCandidates(
  calendar: CalendarReadModel,
  myMembershipId: string,
): SwapCandidateOptions {
  const { operableAssignments, myAssignments } = buildOperableCandidateAssignments(
    calendar,
    myMembershipId,
  );
  const assignmentsByTarget = groupAssignmentsByDutyMember(operableAssignments);
  const targetOptions = calendar.members.filter(
    (member) =>
      member.membershipId !== myMembershipId && assignmentsByTarget.has(member.membershipId),
  );

  return { assignmentsByTarget, myAssignments, targetOptions };
}

export function getSwapStatusLabel(status: SwapRequestStatus): string {
  return getWorkflowStatusLabel(status, '对方');
}

export function getSwapConflictMessage(conflict: SwapConflict): string {
  return conflict.message;
}

export function resolveNextSwapStatus(
  requiresApproval: boolean,
  targetAutoAccepts: boolean,
): SwapRequestStatus {
  return resolveNextWorkflowStatus(requiresApproval, targetAutoAccepts);
}

export function getSwapNextStatusDescription(status: SwapRequestStatus): string {
  return getWorkflowNextStatusDescription(status, '目标成员');
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
  const start = formatChinaDateTime(startsAt, { includeYear: false });
  const end = formatChinaDateTime(endsAt, { includeYear: false });
  return `${start.slice(0, 5)} ${start.slice(5)}–${end.slice(5)}`;
}
