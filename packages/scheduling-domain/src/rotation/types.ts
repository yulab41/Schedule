export interface RotationShiftType {
  readonly crossesMidnight: boolean;
  readonly endTime: string;
  readonly id: string;
  readonly isEnabled: boolean;
  readonly startTime: string;
}

export interface RotationMember {
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly isActive: boolean;
  readonly membershipId: string;
  readonly position: number;
}

export interface RotationRule {
  readonly defaultShiftType: RotationShiftType;
  readonly members: readonly RotationMember[];
  readonly requiredMembersPerDay: number;
  readonly rotationStartDate: string;
  readonly scheduleRoleId: string;
  readonly startingMembershipId?: string;
}

export interface RotationGenerationInput {
  readonly endDate: string;
  readonly rules: readonly RotationRule[];
  readonly startDate: string;
}

export interface RotationCursorInput {
  readonly businessDate: string;
  readonly rule: RotationRule;
  readonly slotPosition: number;
}

export interface RotationCursor {
  readonly member: RotationMember;
  readonly slotPosition: number;
}

export interface GeneratedRotationAssignment {
  readonly businessDate: string;
  readonly businessKey: string;
  readonly endsAt: Date;
  readonly plannedMembershipId: string | null;
  readonly scheduleRoleId: string;
  readonly shiftTypeId: string;
  readonly slotPosition: number;
  readonly startsAt: Date;
}

export interface RotationHardConflict {
  readonly assignmentBusinessKeys: readonly [string, string];
  readonly code: 'MEMBER_TIME_OVERLAP';
  readonly membershipId: string;
}

export interface ContinuousDutyWarning {
  readonly assignmentBusinessKeys: readonly string[];
  readonly code: 'CONTINUOUS_DUTY_24_HOURS';
  readonly endsAt: Date;
  readonly membershipId: string;
  readonly startsAt: Date;
}

export interface RotationVacancy {
  readonly assignmentBusinessKey: string;
  readonly businessDate: string;
  readonly code: 'NO_ELIGIBLE_MEMBER';
  readonly scheduleRoleId: string;
  readonly slotPosition: number;
}

export interface RotationGenerationResult {
  readonly assignments: readonly GeneratedRotationAssignment[];
  readonly continuousDutyWarnings: readonly ContinuousDutyWarning[];
  readonly hardConflicts: readonly RotationHardConflict[];
  readonly vacancies: readonly RotationVacancy[];
}
