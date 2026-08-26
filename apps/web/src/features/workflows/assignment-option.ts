import type { CalendarDutyAssignment } from '@schedule/contracts';
import {
  formatAssignmentSummaryOption,
  isWorkflowWeekendDate,
  type AssignmentSummaryOptionLike,
} from '@schedule/presentation-core';
import { h, type VNode } from 'vue';

import { getDutyMemberName } from '../calendar/calendar-logic.js';
import { getWeekdayLabel } from '../calendar/calendar-views.js';

export { formatAssignmentSummaryOption, type AssignmentSummaryOptionLike };

export function formatAssignmentOption(assignment: CalendarDutyAssignment): string {
  const dutyName = getDutyMemberName(assignment) ?? '待定';
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
        class: isWorkflowWeekendDate(assignment.businessDate)
          ? 'assignment-option-weekday is-weekend'
          : 'assignment-option-weekday',
      },
      `（${weekday}）`,
    ),
    `· ${getDutyMemberName(assignment) ?? '待定'}`,
  ]);
}
