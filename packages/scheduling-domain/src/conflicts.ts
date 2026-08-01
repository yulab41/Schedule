import type {
  ContinuousDutyWarning,
  GeneratedRotationAssignment,
  RotationHardConflict,
} from './rotation/types.js';

const continuousDutyWarningThresholdMilliseconds = 24 * 60 * 60 * 1000;

export function findRotationHardConflicts(
  assignments: readonly GeneratedRotationAssignment[],
): readonly RotationHardConflict[] {
  const conflicts: RotationHardConflict[] = [];
  for (const [membershipId, memberAssignments] of getAssignmentsByMembership(assignments)) {
    const orderedAssignments = sortAssignments(memberAssignments);
    for (let leftIndex = 0; leftIndex < orderedAssignments.length; leftIndex += 1) {
      const left = orderedAssignments[leftIndex];
      if (left === undefined) {
        continue;
      }
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < orderedAssignments.length;
        rightIndex += 1
      ) {
        const right = orderedAssignments[rightIndex];
        if (right === undefined) {
          continue;
        }
        if (right.startsAt >= left.endsAt) {
          break;
        }
        conflicts.push({
          assignmentBusinessKeys: [left.businessKey, right.businessKey],
          code: 'MEMBER_TIME_OVERLAP',
          membershipId,
        });
      }
    }
  }

  return conflicts;
}

export function findContinuousDutyWarnings(
  assignments: readonly GeneratedRotationAssignment[],
): readonly ContinuousDutyWarning[] {
  const warnings: ContinuousDutyWarning[] = [];
  for (const [membershipId, memberAssignments] of getAssignmentsByMembership(assignments)) {
    const orderedAssignments = sortAssignments(memberAssignments);
    let currentChain: GeneratedRotationAssignment[] = [];
    let chainEnd: Date | undefined;

    for (const assignment of orderedAssignments) {
      if (chainEnd === undefined || assignment.startsAt > chainEnd) {
        appendContinuousDutyWarning(warnings, membershipId, currentChain, chainEnd);
        currentChain = [assignment];
        chainEnd = assignment.endsAt;
        continue;
      }

      currentChain.push(assignment);
      if (assignment.endsAt > chainEnd) {
        chainEnd = assignment.endsAt;
      }
    }
    appendContinuousDutyWarning(warnings, membershipId, currentChain, chainEnd);
  }

  return warnings;
}

function getAssignmentsByMembership(
  assignments: readonly GeneratedRotationAssignment[],
): ReadonlyMap<string, GeneratedRotationAssignment[]> {
  const assignmentsByMembership = new Map<string, GeneratedRotationAssignment[]>();
  for (const assignment of assignments) {
    if (assignment.plannedMembershipId === null) {
      continue;
    }

    const memberAssignments = assignmentsByMembership.get(assignment.plannedMembershipId);
    if (memberAssignments === undefined) {
      assignmentsByMembership.set(assignment.plannedMembershipId, [assignment]);
    } else {
      memberAssignments.push(assignment);
    }
  }

  return assignmentsByMembership;
}

function sortAssignments(
  assignments: readonly GeneratedRotationAssignment[],
): readonly GeneratedRotationAssignment[] {
  return [...assignments].sort((left, right) => {
    const startDifference = left.startsAt.valueOf() - right.startsAt.valueOf();
    if (startDifference !== 0) {
      return startDifference;
    }

    const endDifference = left.endsAt.valueOf() - right.endsAt.valueOf();
    if (endDifference !== 0) {
      return endDifference;
    }

    return left.businessKey.localeCompare(right.businessKey);
  });
}

function appendContinuousDutyWarning(
  warnings: ContinuousDutyWarning[],
  membershipId: string,
  assignments: readonly GeneratedRotationAssignment[],
  chainEnd: Date | undefined,
): void {
  const firstAssignment = assignments[0];
  if (
    firstAssignment === undefined ||
    chainEnd === undefined ||
    assignments.length < 2 ||
    chainEnd.valueOf() - firstAssignment.startsAt.valueOf() <
      continuousDutyWarningThresholdMilliseconds
  ) {
    return;
  }

  warnings.push({
    assignmentBusinessKeys: assignments.map((assignment) => assignment.businessKey),
    code: 'CONTINUOUS_DUTY_24_HOURS',
    endsAt: chainEnd,
    membershipId,
    startsAt: firstAssignment.startsAt,
  });
}
