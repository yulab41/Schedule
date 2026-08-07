import { z } from 'zod';

export const swapRequestStatusSchema = z.enum([
  'pending_target',
  'pending_approval',
  'completed',
  'rejected',
  'cancelled',
  'revoked',
]);
export type SwapRequestStatus = z.infer<typeof swapRequestStatusSchema>;

export const swapConflictCodeSchema = z.enum([
  'MEMBER_LEAVE_OVERLAP',
  'MEMBER_NOT_ELIGIBLE',
  'MEMBER_TIME_OVERLAP',
  'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST',
  'ASSIGNMENT_HAS_PENDING_DUTY_ADJUSTMENT',
]);
export type SwapConflictCode = z.infer<typeof swapConflictCodeSchema>;

export const swapAssignmentSummarySchema = z
  .object({
    actualMemberId: z.string().optional(),
    actualMemberName: z.string().optional(),
    assignmentId: z.string().min(1),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    endsAt: z.string(),
    plannedMemberId: z.string().optional(),
    plannedMemberName: z.string().optional(),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string(),
    shiftTypeAbbreviation: z.string().min(1),
    shiftTypeColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    shiftTypeId: z.string().min(1),
    shiftTypeName: z.string().min(1),
    shiftTypeTextColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    slotPosition: z.number().int().min(1),
    startsAt: z.string(),
    version: z.number().int().min(1),
  })
  .strict();
export type SwapAssignmentSummary = z.infer<typeof swapAssignmentSummarySchema>;

export const swapConflictSchema = z
  .object({
    assignmentId: z.string().optional(),
    code: swapConflictCodeSchema,
    membershipId: z.string().min(1),
    message: z.string(),
  })
  .strict();
export type SwapConflict = z.infer<typeof swapConflictSchema>;

export const swapPreviewSchema = z
  .object({
    conflicts: z.readonly(z.array(swapConflictSchema)),
    groupId: z.string().min(1),
    initiatorAssignment: swapAssignmentSummarySchema,
    initiatorEligibleForTargetShift: z.boolean(),
    nextStatus: swapRequestStatusSchema,
    requiresApproval: z.boolean(),
    targetAssignment: swapAssignmentSummarySchema,
    targetAutoAccepts: z.boolean(),
    targetEligibleForInitiatorShift: z.boolean(),
  })
  .strict();
export type SwapPreview = z.infer<typeof swapPreviewSchema>;

export interface SwapPairInput {
  readonly initiatorAssignmentId: string;
  readonly initiatorMembershipId?: string;
  readonly targetAssignmentId: string;
  readonly targetMembershipId: string;
}

export interface CreateSwapRequestInput extends SwapPairInput {
  readonly operationId: string;
}

export interface CreateDirectSwapInput {
  readonly initiatorAssignmentId: string;
  readonly operationId: string;
  readonly targetAssignmentId: string;
}

export const swapRequestSchema = z
  .object({
    approverUserId: z.string().optional(),
    createdAt: z.string(),
    decidedByMemberName: z.string().optional(),
    decidedAt: z.string().optional(),
    groupId: z.string().min(1),
    id: z.string().min(1),
    initiatorAssignment: swapAssignmentSummarySchema,
    initiatorAssignmentId: z.string().min(1),
    initiatorAssignmentVersion: z.number().int(),
    initiatorMemberName: z.string().optional(),
    initiatorMembershipId: z.string().min(1),
    isRevocable: z.boolean().optional(),
    revocationBlockedReason: z.string().optional(),
    revocationReason: z.string().optional(),
    status: swapRequestStatusSchema,
    targetAssignment: swapAssignmentSummarySchema,
    targetAssignmentId: z.string().min(1),
    targetAssignmentVersion: z.number().int(),
    targetMemberName: z.string().optional(),
    targetMembershipId: z.string().min(1),
    version: z.number().int().min(1),
  })
  .strict();
export type SwapRequest = z.infer<typeof swapRequestSchema>;
export const swapRequestListSchema = z.array(swapRequestSchema);

export interface SwapRequestMutationInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface RevokeSwapRequestInput extends SwapRequestMutationInput {
  readonly reason?: string;
}

export const groupSwapSettingsSchema = z
  .object({
    requiresApproval: z.boolean(),
  })
  .strict();
export type GroupSwapSettings = z.infer<typeof groupSwapSettingsSchema>;

export interface UpdateGroupSwapSettingsInput {
  readonly requiresApproval: boolean;
}

export const memberSwapSettingsSchema = z
  .object({
    autoAcceptSwaps: z.boolean(),
  })
  .strict();
export type MemberSwapSettings = z.infer<typeof memberSwapSettingsSchema>;

export interface UpdateMemberSwapSettingsInput {
  readonly autoAcceptSwaps: boolean;
}
