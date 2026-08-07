import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  CalendarReadModel,
  DutyAdjustmentConflict,
  DutyAdjustmentAssignmentSummary,
  DutyAdjustmentStatus,
} from '@schedule/contracts';
import { chinaStandardTimeOffsetMilliseconds } from '@schedule/scheduling-domain';

import { getDutyMemberName, getDutyMembershipId } from '../calendar/calendar-logic.js';
import {
  buildFutureCandidateAssignments,
  getWorkflowNextStatusDescription,
  getWorkflowStatusLabel,
  resolveNextWorkflowStatus,
} from '../workflows/workflow-logic.js';

export interface DutyAdjustmentCandidateOptions {
  readonly adminShiftOptions: readonly CalendarDutyAssignment[];
  readonly myAssignments: readonly CalendarDutyAssignment[];
  readonly overtimeOptions: readonly CalendarDutyMember[];
}

export function buildDutyAdjustmentCandidates(
  calendar: CalendarReadModel,
  myMembershipId: string,
): DutyAdjustmentCandidateOptions {
  const { futureAssignments, myAssignments } = buildFutureCandidateAssignments(
    calendar,
    myMembershipId,
  );
  const adminShiftOptions = futureAssignments.filter(
    (assignment) => getDutyMembershipId(assignment) !== undefined,
  );
  const overtimeOptions = calendar.members.filter(
    (member) => member.membershipId !== myMembershipId,
  );

  return { adminShiftOptions, myAssignments, overtimeOptions };
}

export function getDutyAdjustmentStatusLabel(status: DutyAdjustmentStatus): string {
  return getWorkflowStatusLabel(status, '加班成员');
}

export function getDutyAdjustmentConflictMessage(conflict: DutyAdjustmentConflict): string {
  return conflict.message;
}

export function resolveNextDutyAdjustmentStatus(
  requiresApproval: boolean,
  overtimeAutoAccepts: boolean,
): DutyAdjustmentStatus {
  return resolveNextWorkflowStatus(requiresApproval, overtimeAutoAccepts);
}

export function getDutyAdjustmentNextStatusDescription(status: DutyAdjustmentStatus): string {
  return getWorkflowNextStatusDescription(status, '加班成员');
}

export function formatDutyAdjustmentAssignmentOption(assignment: CalendarDutyAssignment): string {
  const dutyName = getDutyMemberName(assignment) ?? '待定';
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${assignment.shiftTypeAbbreviation}）· ${dutyName}`;
}

export function formatDutyAdjustmentAssignmentSummaryOption(
  assignment: DutyAdjustmentAssignmentSummary,
): string {
  const dutyName = assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定';
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${assignment.shiftTypeAbbreviation}）· ${dutyName}`;
}

export function formatDutyAdjustmentShiftTime(startsAt: string, endsAt: string): string {
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
