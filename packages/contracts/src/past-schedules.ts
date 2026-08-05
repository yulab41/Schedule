export interface PastSchedulePeriod {
  readonly businessMonth: string;
  readonly id: string;
  readonly periodStatus: 'past' | 'published';
  readonly revision: number;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly version: number;
}

export interface PastScheduleAssignment {
  readonly actualMemberId?: string;
  readonly actualMemberName?: string;
  readonly assignmentId: string;
  readonly businessDate: string;
  readonly plannedMemberId?: string;
  readonly plannedMemberName?: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly slotPosition: number;
}

export interface UpdatePastScheduleAssignmentInput {
  readonly actualMembershipId?: string;
  readonly reason?: string;
  readonly shiftTypeId?: string;
}

export interface CreatePastScheduleAssignmentInput {
  readonly actualMembershipId: string;
  readonly businessDate: string;
  readonly reason?: string;
  readonly scheduleRoleId: string;
  readonly shiftTypeId: string;
}

export interface UpdatePastScheduleAssignmentResult {
  readonly assignment: PastScheduleAssignment;
  readonly eventId: string;
}
