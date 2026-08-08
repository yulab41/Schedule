import type { CalendarDutyAssignment } from '@schedule/contracts';
import { h, type VNode } from 'vue';

import { getDutyMemberName } from '../calendar/calendar-logic.js';
import { getWeekdayLabel, isWeekend } from '../calendar/calendar-views.js';

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
  readonly content: () => VNode;
  readonly label: string;
  readonly value: string;
}

export function createAssignmentOption(assignment: CalendarDutyAssignment): AssignmentSelectOption {
  return {
    content: () => renderAssignmentOption(assignment),
    label: formatAssignmentOption(assignment),
    value: assignment.id,
  };
}

function renderAssignmentOption(assignment: CalendarDutyAssignment): VNode {
  const weekday = getWeekdayLabel(assignment.businessDate);
  return h('span', null, [
    `${assignment.businessDate} ${assignment.shiftTypeName}`,
    h(
      'span',
      {
        class: isWeekend(assignment.businessDate)
          ? 'assignment-option-weekday is-weekend'
          : 'assignment-option-weekday',
      },
      `（${weekday}）`,
    ),
    `· ${getDutyMemberName(assignment) ?? '待定'}`,
  ]);
}
