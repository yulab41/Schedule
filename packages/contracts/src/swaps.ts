export type SwapRequestStatus =
  'pending_target' | 'pending_approval' | 'completed' | 'rejected' | 'cancelled';

export type SwapConflictCode =
  'MEMBER_LEAVE_OVERLAP' | 'MEMBER_NOT_ELIGIBLE' | 'MEMBER_TIME_OVERLAP';

export interface SwapAssignmentSummary {
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

export interface SwapConflict {
  readonly assignmentId?: string;
  readonly code: SwapConflictCode;
  readonly membershipId: string;
  readonly message: string;
}

export interface SwapPreview {
  readonly conflicts: readonly SwapConflict[];
  readonly groupId: string;
  readonly initiatorAssignment: SwapAssignmentSummary;
  readonly initiatorEligibleForTargetShift: boolean;
  readonly nextStatus: SwapRequestStatus;
  readonly requiresApproval: boolean;
  readonly targetAssignment: SwapAssignmentSummary;
  readonly targetAutoAccepts: boolean;
  readonly targetEligibleForInitiatorShift: boolean;
}

export interface SwapPairInput {
  readonly initiatorAssignmentId: string;
  readonly targetAssignmentId: string;
  readonly targetMembershipId: string;
}

export interface CreateSwapRequestInput extends SwapPairInput {
  readonly operationId: string;
}

export interface SwapRequest {
  readonly approverUserId?: string;
  readonly createdAt: string;
  readonly decidedAt?: string;
  readonly groupId: string;
  readonly id: string;
  readonly initiatorAssignment: SwapAssignmentSummary;
  readonly initiatorAssignmentId: string;
  readonly initiatorAssignmentVersion: number;
  readonly initiatorMemberName?: string;
  readonly initiatorMembershipId: string;
  readonly status: SwapRequestStatus;
  readonly targetAssignment: SwapAssignmentSummary;
  readonly targetAssignmentId: string;
  readonly targetAssignmentVersion: number;
  readonly targetMemberName?: string;
  readonly targetMembershipId: string;
  readonly version: number;
}

export interface SwapRequestMutationInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface GroupSwapSettings {
  readonly requiresApproval: boolean;
}

export interface UpdateGroupSwapSettingsInput {
  readonly requiresApproval: boolean;
}

export interface MemberSwapSettings {
  readonly autoAcceptSwaps: boolean;
}

export interface UpdateMemberSwapSettingsInput {
  readonly autoAcceptSwaps: boolean;
}
