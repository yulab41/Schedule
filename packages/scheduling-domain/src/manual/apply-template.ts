import {
  MAX_MANUAL_CELLS,
  MAX_MANUAL_DAYS,
  MAX_MANUAL_MEMBERS,
  isManualScheduleDateRangeWithinLimit,
  isValidManualScheduleDate,
} from '@schedule/contracts/manual-schedule-limits';

import { findContinuousDutyWarnings, findRotationHardConflicts } from '../conflicts.js';
import type { ContinuousDutyWarning, GeneratedRotationAssignment } from '../rotation/types.js';
import { getBusinessDates } from '../rotation/cursor.js';
import { toChinaStandardTimeShiftRange } from '../time.js';

export interface ManualApplyMember {
  readonly currentMemberScheduleRoleVersion: number;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly isActive: boolean;
  readonly membershipId: string;
  readonly realName: string;
}

export interface ManualApplyShiftType {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime: string;
  readonly textColor: string;
}

export interface ManualApplyCell {
  readonly cycleDay: number;
  readonly membershipId: string;
  readonly shiftTypeId: string;
}

export interface ManualLeaveInterval {
  readonly endsAt: Date;
  readonly membershipId: string;
  readonly startsAt: Date;
}

export interface ManualApplyTemplateInput {
  readonly cells: readonly ManualApplyCell[];
  readonly cycleDays: number;
  readonly endDate?: string;
  readonly leaveIntervals?: readonly ManualLeaveInterval[];
  readonly members: readonly ManualApplyMember[];
  readonly scheduleRoleId: string;
  readonly shiftTypes: readonly ManualApplyShiftType[];
  readonly startDate: string;
}

export interface ManualApplyVacancy {
  readonly assignmentBusinessKey: string;
  readonly businessDate: string;
  readonly code: 'NO_ELIGIBLE_MEMBER';
  readonly scheduleRoleId: string;
  readonly slotPosition: number;
}

export interface ManualApplyConflict {
  readonly assignmentBusinessKeys: readonly string[];
  readonly code: 'MEMBER_LEAVE_OVERLAP' | 'MEMBER_TIME_OVERLAP';
  readonly membershipId: string;
}

export interface ManualApplyResult {
  readonly assignments: readonly GeneratedRotationAssignment[];
  readonly conflicts: readonly ManualApplyConflict[];
  readonly continuousDutyWarnings: readonly ContinuousDutyWarning[];
  readonly vacancies: readonly ManualApplyVacancy[];
}

export function applyManualTemplate(input: ManualApplyTemplateInput): ManualApplyResult {
  assertApplyTemplateInput(input);
  const membersById = new Map(input.members.map((member) => [member.membershipId, member]));
  const shiftTypesById = new Map(input.shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
  const endDate = input.endDate ?? addDays(input.startDate, input.cycleDays - 1);
  const businessDates = getBusinessDates(input.startDate, endDate);

  const assignments: GeneratedRotationAssignment[] = [];
  const vacancies: ManualApplyVacancy[] = [];
  for (const [dateIndex, businessDate] of businessDates.entries()) {
    const cycleDay = (dateIndex % input.cycleDays) + 1;
    const cells = input.cells
      .filter((cell) => cell.cycleDay === cycleDay)
      .sort((first, second) => first.membershipId.localeCompare(second.membershipId));

    for (const [positionIndex, cell] of cells.entries()) {
      const member = membersById.get(cell.membershipId);
      if (member === undefined) {
        throw new Error('The manual template references an unknown member.');
      }
      const shiftType = shiftTypesById.get(cell.shiftTypeId);
      if (shiftType === undefined || !shiftType.isEnabled) {
        throw new Error('The manual template references an unknown or disabled shift type.');
      }

      const slotPosition = positionIndex + 1;
      const shiftRange = toChinaStandardTimeShiftRange({
        businessDate,
        crossesMidnight: shiftType.crossesMidnight,
        endTime: shiftType.endTime,
        startTime: shiftType.startTime,
      });
      const businessKey = createManualAssignmentBusinessKey(
        input.scheduleRoleId,
        businessDate,
        slotPosition,
      );
      const isAvailable = isManualMemberAvailable(member, businessDate);
      assignments.push({
        businessDate,
        businessKey,
        endsAt: shiftRange.endsAt,
        plannedMembershipId: isAvailable ? member.membershipId : null,
        scheduleRoleId: input.scheduleRoleId,
        shiftTypeId: shiftType.id,
        slotPosition,
        startsAt: shiftRange.startsAt,
      });
      if (!isAvailable) {
        vacancies.push({
          assignmentBusinessKey: businessKey,
          businessDate,
          code: 'NO_ELIGIBLE_MEMBER',
          scheduleRoleId: input.scheduleRoleId,
          slotPosition,
        });
      }
    }
  }

  const leaveIntervals = input.leaveIntervals ?? [];
  const leaveConflicts = findManualLeaveConflicts(assignments, leaveIntervals);

  return {
    assignments,
    conflicts: [
      ...findRotationHardConflicts(assignments).map((conflict) => ({
        assignmentBusinessKeys: conflict.assignmentBusinessKeys,
        code: conflict.code,
        membershipId: conflict.membershipId,
      })),
      ...leaveConflicts,
    ],
    continuousDutyWarnings: findContinuousDutyWarnings(assignments),
    vacancies,
  };
}

export function createManualAssignmentBusinessKey(
  scheduleRoleId: string,
  businessDate: string,
  slotPosition: number,
): string {
  return `manual:${encodeURIComponent(scheduleRoleId)}:${businessDate}:${slotPosition}`;
}

function assertApplyTemplateInput(input: ManualApplyTemplateInput): void {
  if (
    !Number.isSafeInteger(input.cycleDays) ||
    input.cycleDays < 1 ||
    input.cycleDays > MAX_MANUAL_DAYS
  ) {
    throw new Error(`The template cycle days must be an integer between 1 and ${MAX_MANUAL_DAYS}.`);
  }
  if (input.members.length < 1 || input.members.length > MAX_MANUAL_MEMBERS) {
    throw new Error(`The manual template must contain 1 to ${MAX_MANUAL_MEMBERS} members.`);
  }
  if (input.cells.length > MAX_MANUAL_CELLS) {
    throw new Error(`The manual template cannot contain more than ${MAX_MANUAL_CELLS} cells.`);
  }
  if (!isValidManualScheduleDate(input.startDate)) {
    throw new Error('The apply start date must use a valid YYYY-MM-DD format.');
  }
  const applyEndDate = input.endDate ?? addDays(input.startDate, input.cycleDays - 1);
  if (!isValidManualScheduleDate(applyEndDate)) {
    throw new Error('The apply end date must use a valid YYYY-MM-DD format.');
  }
  if (applyEndDate < input.startDate) {
    throw new Error('The apply end date cannot precede the template start date.');
  }
  if (!isManualScheduleDateRangeWithinLimit(input.startDate, applyEndDate)) {
    throw new Error(`The manual apply date range must not exceed ${MAX_MANUAL_DAYS} days.`);
  }

  const memberIds = new Set(input.members.map((member) => member.membershipId));
  if (memberIds.size !== input.members.length) {
    throw new Error('A manual template member cannot appear more than once.');
  }
  const shiftTypeIds = new Set(input.shiftTypes.map((shiftType) => shiftType.id));
  const cellKeys = new Set<string>();
  for (const cell of input.cells) {
    if (
      !Number.isSafeInteger(cell.cycleDay) ||
      cell.cycleDay < 1 ||
      cell.cycleDay > input.cycleDays
    ) {
      throw new Error('A template cell cycle day must be within the template cycle.');
    }
    if (!memberIds.has(cell.membershipId)) {
      throw new Error('A template cell references a member outside the template.');
    }
    if (!shiftTypeIds.has(cell.shiftTypeId)) {
      throw new Error('A template cell references a shift type outside the template.');
    }
    const cellKey = `${cell.cycleDay}:${cell.membershipId}`;
    if (cellKeys.has(cellKey)) {
      throw new Error('A template cannot assign the same member twice on the same cycle day.');
    }
    cellKeys.add(cellKey);
  }
}

function isManualMemberAvailable(member: ManualApplyMember, businessDate: string): boolean {
  if (!member.isActive) {
    return false;
  }
  if (member.effectiveFrom !== undefined && businessDate < member.effectiveFrom) {
    return false;
  }
  if (member.effectiveTo !== undefined && businessDate > member.effectiveTo) {
    return false;
  }

  return true;
}

function findManualLeaveConflicts(
  assignments: readonly GeneratedRotationAssignment[],
  leaveIntervals: readonly ManualLeaveInterval[],
): readonly ManualApplyConflict[] {
  const conflicts: ManualApplyConflict[] = [];
  for (const assignment of assignments) {
    if (assignment.plannedMembershipId === null) {
      continue;
    }
    for (const leave of leaveIntervals) {
      if (
        leave.membershipId === assignment.plannedMembershipId &&
        leave.startsAt.valueOf() < assignment.endsAt.valueOf() &&
        leave.endsAt.valueOf() > assignment.startsAt.valueOf()
      ) {
        conflicts.push({
          assignmentBusinessKeys: [assignment.businessKey],
          code: 'MEMBER_LEAVE_OVERLAP',
          membershipId: assignment.plannedMembershipId,
        });
      }
    }
  }

  return conflicts;
}

function addDays(value: string, days: number): string {
  const { day, month, year } = parseDate(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseDate(value: string): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error('The date must use the YYYY-MM-DD format.');
  }

  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}
