import { findContinuousDutyWarnings, findRotationHardConflicts } from '../conflicts.js';
import type { ContinuousDutyWarning } from '../rotation/types.js';

import {
  findLeaveOverlappingAssignments,
  intervalsOverlap,
  leaveOverlapsInterval,
} from './overlap.js';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export type LeaveReflowStrategy = 'keep-original-order' | 'shift-forward';

export interface LeaveReflowInterval {
  readonly endsAt: Date;
  readonly isAllDay?: boolean | number;
  readonly membershipId: string;
  readonly startsAt: Date;
}

export interface ReflowMember {
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly isActive: boolean;
  readonly membershipId: string;
  readonly position: number;
}

export interface ReflowRotationRule {
  readonly members: readonly ReflowMember[];
  readonly requiredMembersPerDay: number;
  readonly rotationStartDate: string;
  readonly scheduleRoleId: string;
  readonly startingMembershipId?: string;
}

export interface ReflowAssignment {
  readonly businessDate: string;
  readonly businessKey: string;
  readonly endsAt: Date;
  readonly plannedMembershipId: string | null;
  readonly scheduleRoleId: string;
  readonly shiftTypeId: string;
  readonly slotPosition: number;
  readonly startsAt: Date;
}

export interface LeaveReflowInput {
  readonly assignments: readonly ReflowAssignment[];
  readonly leave: LeaveReflowInterval;
  readonly leaves: readonly LeaveReflowInterval[];
  readonly rules: readonly ReflowRotationRule[];
  readonly strategy: LeaveReflowStrategy;
}

export interface ReflowVacancy {
  readonly assignmentBusinessKey: string;
  readonly businessDate: string;
  readonly code: 'NO_ELIGIBLE_MEMBER';
  readonly scheduleRoleId: string;
  readonly slotPosition: number;
}

export interface ReflowConflict {
  readonly assignmentBusinessKeys: readonly [string, string] | readonly [string];
  readonly code: 'MEMBER_LEAVE_OVERLAP' | 'MEMBER_TIME_OVERLAP';
  readonly membershipId: string;
}

export interface LeaveReflowResult {
  readonly assignments: readonly ReflowAssignment[];
  readonly affectedBusinessKeys: readonly string[];
  readonly conflicts: readonly ReflowConflict[];
  readonly continuousDutyWarnings: readonly ContinuousDutyWarning[];
  readonly vacancies: readonly ReflowVacancy[];
  readonly nextCursorPositions: ReadonlyMap<string, number>;
}

export function reflowLeaveAssignments(input: LeaveReflowInput): LeaveReflowResult {
  assertReflowInput(input);
  const rulesByRoleId = new Map(input.rules.map((rule) => [rule.scheduleRoleId, rule]));
  const assignmentsByRole = groupAssignmentsByRole(input.assignments);
  const adjustedByKey = new Map(
    input.assignments.map((assignment) => [assignment.businessKey, assignment]),
  );
  const affectedBusinessKeys = new Set<string>();
  const nextCursorPositions = new Map<string, number>();

  for (const [scheduleRoleId, roleAssignments] of assignmentsByRole) {
    const orderedAssignments = [...roleAssignments].sort(compareAssignments);
    const affectedAssignments = findLeaveOverlappingAssignments(orderedAssignments, input.leave);
    if (affectedAssignments.length === 0) {
      continue;
    }
    for (const assignment of affectedAssignments) {
      affectedBusinessKeys.add(assignment.businessKey);
    }

    const rule = rulesByRoleId.get(scheduleRoleId);
    if (rule === undefined || rule.members.length === 0) {
      for (const assignment of affectedAssignments) {
        adjustedByKey.set(assignment.businessKey, { ...assignment, plannedMembershipId: null });
      }
      continue;
    }

    if (input.strategy === 'keep-original-order') {
      applyKeepOriginalOrder(rule, affectedAssignments, input, adjustedByKey);
    } else {
      applyShiftForward(
        rule,
        orderedAssignments,
        affectedAssignments,
        input,
        adjustedByKey,
        affectedBusinessKeys,
        nextCursorPositions,
      );
    }
  }

  const adjustedAssignments = [...adjustedByKey.values()].sort(compareAssignments);
  const conflicts: ReflowConflict[] = [
    ...findRotationHardConflicts(adjustedAssignments).map((conflict) => ({
      assignmentBusinessKeys: conflict.assignmentBusinessKeys,
      code: conflict.code,
      membershipId: conflict.membershipId,
    })),
    ...findRemainingLeaveConflicts(adjustedAssignments, input.leaves),
  ];

  return {
    affectedBusinessKeys: [...affectedBusinessKeys],
    assignments: adjustedAssignments,
    conflicts,
    continuousDutyWarnings: findContinuousDutyWarnings(adjustedAssignments),
    nextCursorPositions,
    vacancies: adjustedAssignments
      .filter((assignment) => assignment.plannedMembershipId === null)
      .map((assignment): ReflowVacancy => ({
        assignmentBusinessKey: assignment.businessKey,
        businessDate: assignment.businessDate,
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: assignment.scheduleRoleId,
        slotPosition: assignment.slotPosition,
      })),
  };
}

function assertReflowInput(input: LeaveReflowInput): void {
  if (Number.isNaN(input.leave.startsAt.valueOf()) || Number.isNaN(input.leave.endsAt.valueOf())) {
    throw new Error('The leave interval timestamps must be valid.');
  }
  if (input.leave.startsAt.valueOf() >= input.leave.endsAt.valueOf()) {
    throw new Error('The leave interval must end after it starts.');
  }
  if (input.strategy !== 'keep-original-order' && input.strategy !== 'shift-forward') {
    throw new Error('The leave reflow strategy is invalid.');
  }
  for (const rule of input.rules) {
    assertReflowRule(rule);
  }
}

function assertReflowRule(rule: ReflowRotationRule): void {
  if (!Number.isSafeInteger(rule.requiredMembersPerDay) || rule.requiredMembersPerDay < 1) {
    throw new Error('The required members per day must be a positive integer.');
  }
  const orderedMembers = [...rule.members].sort((left, right) => left.position - right.position);
  const membershipIds = new Set<string>();
  for (const [index, member] of orderedMembers.entries()) {
    if (membershipIds.has(member.membershipId)) {
      throw new Error('A rotation member cannot appear more than once.');
    }
    membershipIds.add(member.membershipId);
    if (!Number.isSafeInteger(member.position) || member.position !== index + 1) {
      throw new Error('Rotation member positions must be contiguous positive integers.');
    }
  }
}

function applyKeepOriginalOrder(
  rule: ReflowRotationRule,
  affectedAssignments: readonly ReflowAssignment[],
  input: LeaveReflowInput,
  adjustedByKey: Map<string, ReflowAssignment>,
): void {
  const orderedMembers = [...rule.members].sort((left, right) => left.position - right.position);
  const leaveMemberIndex = orderedMembers.findIndex(
    (member) => member.membershipId === input.leave.membershipId,
  );
  const startIndex = leaveMemberIndex < 0 ? 0 : leaveMemberIndex;

  for (const assignment of affectedAssignments) {
    const decided = [...adjustedByKey.values()];
    const replacement = findNextEligibleMember(
      orderedMembers,
      startIndex,
      assignment,
      input.leaves,
      decided,
    );
    adjustedByKey.set(assignment.businessKey, {
      ...assignment,
      plannedMembershipId: replacement?.membershipId ?? null,
    });
  }
}

function applyShiftForward(
  rule: ReflowRotationRule,
  orderedAssignments: readonly ReflowAssignment[],
  affectedAssignments: readonly ReflowAssignment[],
  input: LeaveReflowInput,
  adjustedByKey: Map<string, ReflowAssignment>,
  affectedBusinessKeys: Set<string>,
  nextCursorPositions: Map<string, number>,
): void {
  const orderedMembers = [...rule.members].sort((left, right) => left.position - right.position);
  const firstAffected = affectedAssignments[0];
  if (firstAffected === undefined) {
    return;
  }
  const firstIndex = orderedAssignments.findIndex(
    (assignment) => assignment.businessKey === firstAffected.businessKey,
  );
  let cursorIndex = getBaseCursorIndex(rule, orderedMembers, firstAffected);
  let lastSelectedPosition = 1;

  for (let index = firstIndex; index < orderedAssignments.length; index += 1) {
    const assignment = orderedAssignments[index];
    if (assignment === undefined) {
      continue;
    }
    const decided = [...adjustedByKey.values()];
    const replacement = findNextEligibleMember(
      orderedMembers,
      cursorIndex,
      assignment,
      input.leaves,
      decided,
    );
    if (replacement !== undefined) {
      adjustedByKey.set(assignment.businessKey, {
        ...assignment,
        plannedMembershipId: replacement.membershipId,
      });
      if (assignment.plannedMembershipId !== replacement.membershipId) {
        affectedBusinessKeys.add(assignment.businessKey);
      }
      lastSelectedPosition = replacement.position;
      cursorIndex =
        orderedMembers.findIndex((member) => member.membershipId === replacement.membershipId) + 1;
    } else {
      adjustedByKey.set(assignment.businessKey, { ...assignment, plannedMembershipId: null });
      if (assignment.plannedMembershipId !== null) {
        affectedBusinessKeys.add(assignment.businessKey);
      }
      cursorIndex += 1;
    }
  }

  nextCursorPositions.set(rule.scheduleRoleId, lastSelectedPosition);
}

function findNextEligibleMember(
  orderedMembers: readonly ReflowMember[],
  startIndex: number,
  assignment: ReflowAssignment,
  leaves: readonly LeaveReflowInterval[],
  decided: readonly ReflowAssignment[],
): ReflowMember | undefined {
  const normalizedStart =
    ((startIndex % orderedMembers.length) + orderedMembers.length) % orderedMembers.length;
  for (let offset = 0; offset < orderedMembers.length; offset += 1) {
    const member = orderedMembers[(normalizedStart + offset) % orderedMembers.length];
    if (
      member !== undefined &&
      isMemberEligibleForAssignment(member, assignment, leaves, decided)
    ) {
      return member;
    }
  }

  return undefined;
}

function isMemberEligibleForAssignment(
  member: ReflowMember,
  assignment: ReflowAssignment,
  leaves: readonly LeaveReflowInterval[],
  decided: readonly ReflowAssignment[],
): boolean {
  if (!member.isActive) {
    return false;
  }
  if (member.effectiveFrom !== undefined && assignment.businessDate < member.effectiveFrom) {
    return false;
  }
  if (member.effectiveTo !== undefined && assignment.businessDate > member.effectiveTo) {
    return false;
  }
  if (
    member.effectiveFrom !== undefined &&
    member.effectiveTo !== undefined &&
    member.effectiveFrom > member.effectiveTo
  ) {
    throw new Error('The member effective date range is invalid.');
  }

  return (
    !hasLeaveOverlap(member.membershipId, assignment.startsAt, assignment.endsAt, leaves) &&
    !hasDecidedTimeOverlap(member.membershipId, assignment.startsAt, assignment.endsAt, decided)
  );
}

function hasLeaveOverlap(
  membershipId: string,
  startsAt: Date,
  endsAt: Date,
  leaves: readonly LeaveReflowInterval[],
): boolean {
  return leaves.some(
    (leave) => leave.membershipId === membershipId && intervalsOverlap(leave, { endsAt, startsAt }),
  );
}

function hasDecidedTimeOverlap(
  membershipId: string,
  startsAt: Date,
  endsAt: Date,
  decided: readonly ReflowAssignment[],
): boolean {
  return decided.some(
    (assignment) =>
      assignment.plannedMembershipId === membershipId &&
      intervalsOverlap(assignment, { endsAt, startsAt }),
  );
}

function getBaseCursorIndex(
  rule: ReflowRotationRule,
  orderedMembers: readonly ReflowMember[],
  assignment: ReflowAssignment,
): number {
  const startingMembershipId = rule.startingMembershipId;
  if (startingMembershipId === undefined) {
    throw new Error('A non-empty rotation must specify a starting member.');
  }
  const startingIndex = orderedMembers.findIndex(
    (member) => member.membershipId === startingMembershipId,
  );
  if (startingIndex < 0) {
    throw new Error('The starting member must belong to the rotation.');
  }

  const elapsedDays =
    (toBusinessDateTimestamp(assignment.businessDate) -
      toBusinessDateTimestamp(rule.rotationStartDate)) /
    millisecondsPerDay;
  if (elapsedDays < 0) {
    throw new Error('The business date cannot precede the rotation start date.');
  }
  const offset = elapsedDays * rule.requiredMembersPerDay + assignment.slotPosition - 1;

  return (startingIndex + offset) % orderedMembers.length;
}

function findRemainingLeaveConflicts(
  assignments: readonly ReflowAssignment[],
  leaves: readonly LeaveReflowInterval[],
): ReflowConflict[] {
  const conflicts: ReflowConflict[] = [];
  for (const assignment of assignments) {
    if (assignment.plannedMembershipId === null) {
      continue;
    }
    for (const leave of leaves) {
      if (
        leave.membershipId === assignment.plannedMembershipId &&
        leaveOverlapsInterval(leave, assignment)
      ) {
        conflicts.push({
          assignmentBusinessKeys: [assignment.businessKey],
          code: 'MEMBER_LEAVE_OVERLAP',
          membershipId: leave.membershipId,
        });
      }
    }
  }

  return conflicts;
}

function groupAssignmentsByRole(
  assignments: readonly ReflowAssignment[],
): ReadonlyMap<string, ReflowAssignment[]> {
  const assignmentsByRole = new Map<string, ReflowAssignment[]>();
  for (const assignment of assignments) {
    const roleAssignments = assignmentsByRole.get(assignment.scheduleRoleId) ?? [];
    roleAssignments.push(assignment);
    assignmentsByRole.set(assignment.scheduleRoleId, roleAssignments);
  }

  return assignmentsByRole;
}

function compareAssignments(left: ReflowAssignment, right: ReflowAssignment): number {
  const dateDifference = left.businessDate.localeCompare(right.businessDate);
  if (dateDifference !== 0) {
    return dateDifference;
  }
  const slotDifference = left.slotPosition - right.slotPosition;
  if (slotDifference !== 0) {
    return slotDifference;
  }

  return left.businessKey.localeCompare(right.businessKey);
}

function toBusinessDateTimestamp(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error('The business date must use a valid YYYY-MM-DD format.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const candidate = new Date(timestamp);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error('The business date must use a valid YYYY-MM-DD format.');
  }

  return timestamp;
}
