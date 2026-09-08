export interface ScheduleAssignmentSnapshot {
  readonly businessDate: string;
  readonly businessKey: string;
  readonly endsAt: Date;
  readonly plannedMembershipId: string | null;
  readonly scheduleRoleId: string;
  readonly shiftTypeId: string;
  readonly slotPosition: number;
  readonly startsAt: Date;
}

export interface ScheduleHardConflict {
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

export interface ScheduleVacancy {
  readonly assignmentBusinessKey: string;
  readonly businessDate: string;
  readonly code: 'NO_ELIGIBLE_MEMBER';
  readonly scheduleRoleId: string;
  readonly slotPosition: number;
}
