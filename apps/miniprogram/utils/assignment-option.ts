import type { CalendarDutyAssignment } from '@schedule/contracts';

import { getDutyMemberName } from './calendar-logic.js';
import { getWeekdayLabel, isWeekend } from './calendar-views.js';

export interface AssignmentSummaryOptionLike {
  readonly actualMemberName?: string | null | undefined;
  readonly businessDate: string;
  readonly plannedMemberName?: string | null | undefined;
  readonly shiftTypeName: string;
  readonly [key: string]: unknown;
}

export function formatAssignmentOption(assignment: CalendarDutyAssignment): string {
  const dutyName = getDutyMemberName(assignment) ?? '待定';
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${getWeekdayLabel(
    assignment.businessDate,
  )}）· ${dutyName}`;
}

export function formatAssignmentSummaryOption(assignment: AssignmentSummaryOptionLike): string {
  const dutyName = assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定';
  return `${assignment.businessDate} ${assignment.shiftTypeName}（${getWeekdayLabel(
    assignment.businessDate,
  )}）· ${dutyName}`;
}

export interface AssignmentSelectOption {
  readonly label: string;
  readonly value: string;
  readonly weekend: boolean;
}

export function createAssignmentOption(assignment: CalendarDutyAssignment): AssignmentSelectOption {
  return {
    label: formatAssignmentOption(assignment),
    value: assignment.id,
    weekend: isWeekend(assignment.businessDate),
  };
}
