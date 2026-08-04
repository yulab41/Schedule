import { findContinuousDutyWarnings, findRotationHardConflicts } from '../conflicts.js';
import { toChinaStandardTimeShiftRange } from '../time.js';

import { assertRotationRule, findEligibleRotationMember, getBusinessDates } from './cursor.js';
import type {
  GeneratedRotationAssignment,
  RotationGenerationInput,
  RotationGenerationResult,
  RotationRule,
  RotationVacancy,
} from './types.js';

export function generateRotation(input: RotationGenerationInput): RotationGenerationResult {
  const businessDates = getBusinessDates(input.startDate, input.endDate);
  assertUniqueScheduleRoles(input.rules);

  const assignments: GeneratedRotationAssignment[] = [];
  const vacancies: RotationVacancy[] = [];
  for (const rule of input.rules) {
    assertRotationRule(rule);
    for (const businessDate of businessDates) {
      const shiftRange = toChinaStandardTimeShiftRange({
        businessDate,
        crossesMidnight: rule.defaultShiftType.crossesMidnight,
        endTime: rule.defaultShiftType.endTime,
        startTime: rule.defaultShiftType.startTime,
      });
      for (let slotPosition = 1; slotPosition <= rule.requiredMembersPerDay; slotPosition += 1) {
        const businessKey = createRotationBusinessKey(
          rule.scheduleRoleId,
          businessDate,
          slotPosition,
        );
        const member = findEligibleRotationMember({
          businessDate,
          ...(input.leaveIntervals === undefined ? {} : { leaveIntervals: input.leaveIntervals }),
          rule,
          slotPosition,
        });
        assignments.push({
          businessDate,
          businessKey,
          endsAt: shiftRange.endsAt,
          plannedMembershipId: member?.membershipId ?? null,
          scheduleRoleId: rule.scheduleRoleId,
          shiftTypeId: rule.defaultShiftType.id,
          slotPosition,
          startsAt: shiftRange.startsAt,
        });
        if (member === undefined) {
          vacancies.push({
            assignmentBusinessKey: businessKey,
            businessDate,
            code: 'NO_ELIGIBLE_MEMBER',
            scheduleRoleId: rule.scheduleRoleId,
            slotPosition,
          });
        }
      }
    }
  }

  return {
    assignments,
    continuousDutyWarnings: findContinuousDutyWarnings(assignments),
    hardConflicts: findRotationHardConflicts(assignments),
    vacancies,
  };
}

export function createRotationBusinessKey(
  scheduleRoleId: string,
  businessDate: string,
  slotPosition: number,
): string {
  return `rotation:${encodeURIComponent(scheduleRoleId)}:${businessDate}:${slotPosition}`;
}

function assertUniqueScheduleRoles(rules: readonly RotationRule[]): void {
  const roleIds = new Set<string>();
  for (const rule of rules) {
    if (roleIds.has(rule.scheduleRoleId)) {
      throw new Error('A rotation generation cannot contain the same schedule role twice.');
    }
    roleIds.add(rule.scheduleRoleId);
  }
}
