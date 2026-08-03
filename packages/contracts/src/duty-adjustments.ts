export type DutyAdjustmentStatus =
  'pending_target' | 'pending_approval' | 'completed' | 'rejected' | 'cancelled' | 'revoked';

export type DutyAdjustmentConflictCode =
  'MEMBER_LEAVE_OVERLAP' | 'MEMBER_NOT_ELIGIBLE' | 'MEMBER_TIME_OVERLAP';

export interface DutyAdjustmentAssignmentSummary {
  readonly actualMemberId?: string;
  readonly actualMemberName?: string;
  readonly assignmentId: string;
  readonly businessDate: string;
  readonly endsAt: string;
  readonly plannedMemberId?: string;
  readonly plannedMemberName?: string;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly shiftTypeTextColor: string;
  readonly slotPosition: number;
  readonly startsAt: string;
  readonly version: number;
}

export interface DutyAdjustmentConflict {
  readonly assignmentId?: string;
  readonly code: DutyAdjustmentConflictCode;
  readonly membershipId: string;
  readonly message: string;
}

export interface DutyAdjustmentPreview {
  readonly conflicts: readonly DutyAdjustmentConflict[];
  readonly coveredAssignment: DutyAdjustmentAssignmentSummary;
  readonly deductedMemberName?: string;
  readonly groupId: string;
  readonly nextStatus: DutyAdjustmentStatus;
  readonly overtimeAutoAccepts: boolean;
  readonly overtimeMemberName?: string;
  readonly requiresApproval: boolean;
}

export interface DutyAdjustmentPairInput {
  readonly coveredAssignmentId: string;
  readonly overtimeMembershipId: string;
}

export interface CreateDutyAdjustmentRequestInput extends DutyAdjustmentPairInput {
  readonly operationId: string;
  readonly reason?: string;
}

export interface CreateDirectDutyAdjustmentInput extends DutyAdjustmentPairInput {
  readonly operationId: string;
  readonly reason: string;
}

export interface DutyAdjustmentRequest {
  readonly approverUserId?: string;
  readonly assignmentVersion: number;
  readonly coveredAssignment: DutyAdjustmentAssignmentSummary;
  readonly coveredAssignmentId: string;
  readonly createdAt: string;
  readonly decidedAt?: string;
  readonly deductedMemberName?: string;
  readonly deductedMembershipId: string;
  readonly groupId: string;
  readonly id: string;
  readonly overtimeMemberName?: string;
  readonly overtimeMembershipId: string;
  readonly reason?: string;
  readonly revocationReason?: string;
  readonly status: DutyAdjustmentStatus;
  readonly version: number;
}

export interface DutyAdjustmentMutationInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface RevokeDutyAdjustmentInput extends DutyAdjustmentMutationInput {
  readonly reason: string;
}

export interface GroupDutyAdjustmentSettings {
  readonly requiresApproval: boolean;
}

export interface UpdateGroupDutyAdjustmentSettingsInput {
  readonly requiresApproval: boolean;
}
