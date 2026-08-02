import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  CalendarReadModel,
  DutyAdjustmentConflict,
  DutyAdjustmentAssignmentSummary,
  DutyAdjustmentStatus,
} from '@schedule/contracts';

import { getDutyMemberName, getDutyMembershipId } from '../calendar/calendar-logic.js';

const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;

export interface DutyAdjustmentCandidateOptions {
  readonly adminShiftOptions: readonly CalendarDutyAssignment[];
  readonly myAssignments: readonly CalendarDutyAssignment[];
  readonly overtimeOptions: readonly CalendarDutyMember[];
}

export const dutyAdjustmentStatusLabels: Readonly<Record<DutyAdjustmentStatus, string>> = {
  cancelled: '已取消',
  completed: '已生效',
  pending_approval: '待管理员审批',
  pending_target: '待加班成员接受',
  rejected: '已驳回',
  revoked: '已撤销',
};

export function buildDutyAdjustmentCandidates(
  calendar: CalendarReadModel,
  myMembershipId: string,
): DutyAdjustmentCandidateOptions {
  const myAssignments = calendar.assignments.filter(
    (assignment) => getDutyMembershipId(assignment) === myMembershipId,
  );
  const adminShiftOptions = calendar.assignments.filter(
    (assignment) => getDutyMembershipId(assignment) !== undefined,
  );
  const overtimeOptions = calendar.members.filter(
    (member) => member.membershipId !== myMembershipId,
  );

  return { adminShiftOptions, myAssignments, overtimeOptions };
}

export function getDutyAdjustmentStatusLabel(status: DutyAdjustmentStatus): string {
  return dutyAdjustmentStatusLabels[status];
}

export function getDutyAdjustmentConflictMessage(conflict: DutyAdjustmentConflict): string {
  return conflict.message;
}

export function resolveNextDutyAdjustmentStatus(
  requiresApproval: boolean,
  overtimeAutoAccepts: boolean,
): DutyAdjustmentStatus {
  if (!overtimeAutoAccepts) {
    return 'pending_target';
  }
  return requiresApproval ? 'pending_approval' : 'completed';
}

export function getDutyAdjustmentNextStatusDescription(status: DutyAdjustmentStatus): string {
  switch (status) {
    case 'pending_target':
      return '提交后将等待加班成员接受。';
    case 'pending_approval':
      return '加班成员将自动接受，提交后进入管理员审批。';
    case 'completed':
      return '加班成员已开启自动接受且群组无需审批，提交后将立即生效。';
    default:
      return '';
  }
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
