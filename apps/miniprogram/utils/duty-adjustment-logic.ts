import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  CalendarReadModel,
  DutyAdjustmentConflict,
  DutyAdjustmentStatus,
} from '@schedule/contracts';

import { formatChinaDateTime } from './china-time.js';
import { getDutyMembershipId } from './calendar-logic.js';
import {
  buildOperableCandidateAssignments,
  getWorkflowNextStatusDescription,
  getWorkflowStatusLabel,
  resolveNextWorkflowStatus,
} from './workflow-logic.js';

export interface DutyAdjustmentCandidateOptions {
  readonly adminShiftOptions: readonly CalendarDutyAssignment[];
  readonly myAssignments: readonly CalendarDutyAssignment[];
  readonly overtimeOptions: readonly CalendarDutyMember[];
}

export function buildDutyAdjustmentCandidates(
  calendar: CalendarReadModel,
  myMembershipId: string,
): DutyAdjustmentCandidateOptions {
  const { operableAssignments, myAssignments } = buildOperableCandidateAssignments(
    calendar,
    myMembershipId,
  );
  const adminShiftOptions = operableAssignments.filter(
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

export function formatDutyAdjustmentShiftTime(startsAt: string, endsAt: string): string {
  const start = formatChinaDateTime(startsAt, { includeYear: false });
  const end = formatChinaDateTime(endsAt, { includeYear: false });
  return `${start.slice(0, 5)} ${start.slice(5)}–${end.slice(5)}`;
}
