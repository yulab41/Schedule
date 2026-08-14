import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';

import {
  getAvailablePhoneOptions,
  getDutyMemberName,
  getDutyMembershipId,
  type PhoneOption,
} from './calendar-logic.js';
import { getWeekdayLabel, groupAssignmentsByDate, parseBusinessDate } from './calendar-views.js';

export type SelectedDateDutyStatus = 'changed' | 'pending' | 'scheduled';

export interface SelectedDateDutyRow {
  readonly assignment: CalendarDutyAssignment;
  readonly dutyName: string;
  readonly member: CalendarDutyMember | undefined;
  readonly phoneOptions: readonly PhoneOption[];
  readonly status: SelectedDateDutyStatus;
  readonly statusLabel: string;
}

export function buildSelectedDateDutyRows(
  selectedDate: string,
  assignments: readonly CalendarDutyAssignment[],
  members: readonly CalendarDutyMember[],
): readonly SelectedDateDutyRow[] {
  const membersById = new Map(members.map((member) => [member.membershipId, member]));
  const selectedAssignments = groupAssignmentsByDate(assignments).get(selectedDate) ?? [];

  return selectedAssignments.map((assignment) => {
    const membershipId = getDutyMembershipId(assignment);
    const member = membershipId === undefined ? undefined : membersById.get(membershipId);
    const dutyName = getDutyMemberName(assignment) ?? '待安排';
    const status = getDutyStatus(assignment, membershipId);
    return {
      assignment,
      dutyName,
      member,
      phoneOptions: getAvailablePhoneOptions(member),
      status,
      statusLabel: getDutyStatusLabel(status),
    };
  });
}

export function formatSelectedDateLabel(selectedDate: string): string {
  const { day, month } = parseBusinessDate(selectedDate);
  return `${month}月${day}日 ${getWeekdayLabel(selectedDate)}`;
}

function getDutyStatus(
  assignment: CalendarDutyAssignment,
  membershipId: string | undefined,
): SelectedDateDutyStatus {
  if (membershipId === undefined && getDutyMemberName(assignment) === undefined) {
    return 'pending';
  }
  if (
    assignment.changeMarkers.length > 0 ||
    (assignment.actualMembershipId !== undefined &&
      assignment.actualMembershipId !== assignment.plannedMembershipId)
  ) {
    return 'changed';
  }
  return 'scheduled';
}

function getDutyStatusLabel(status: SelectedDateDutyStatus): string {
  switch (status) {
    case 'changed':
      return '有变更';
    case 'pending':
      return '待安排';
    case 'scheduled':
      return '已排班';
  }
}
