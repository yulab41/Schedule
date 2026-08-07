import { z } from 'zod';

export const dutyAdjustmentStatusSchema = z.enum([
  'pending_target',
  'pending_approval',
  'completed',
  'rejected',
  'cancelled',
  'revoked',
]);
export type DutyAdjustmentStatus = z.infer<typeof dutyAdjustmentStatusSchema>;

export const dutyAdjustmentConflictCodeSchema = z.enum([
  'MEMBER_LEAVE_OVERLAP',
  'MEMBER_NOT_ELIGIBLE',
  'MEMBER_TIME_OVERLAP',
  'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST',
  'ASSIGNMENT_HAS_ACTIVE_DUTY_ADJUSTMENT',
]);
export type DutyAdjustmentConflictCode = z.infer<typeof dutyAdjustmentConflictCodeSchema>;

export const dutyAdjustmentAssignmentSummarySchema = z
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
export type DutyAdjustmentAssignmentSummary = z.infer<typeof dutyAdjustmentAssignmentSummarySchema>;

export const dutyAdjustmentConflictSchema = z
  .object({
    assignmentId: z.string().optional(),
    code: dutyAdjustmentConflictCodeSchema,
    membershipId: z.string().min(1),
    message: z.string(),
  })
  .strict();
export type DutyAdjustmentConflict = z.infer<typeof dutyAdjustmentConflictSchema>;

export const dutyAdjustmentPreviewSchema = z
  .object({
    conflicts: z.readonly(z.array(dutyAdjustmentConflictSchema)),
    coveredAssignment: dutyAdjustmentAssignmentSummarySchema,
    deductedMemberName: z.string().optional(),
    groupId: z.string().min(1),
    nextStatus: dutyAdjustmentStatusSchema,
    overtimeAutoAccepts: z.boolean(),
    overtimeMemberName: z.string().optional(),
    requiresApproval: z.boolean(),
  })
  .strict();
export type DutyAdjustmentPreview = z.infer<typeof dutyAdjustmentPreviewSchema>;

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
  readonly reason?: string;
}

export const dutyAdjustmentRequestSchema = z
  .object({
    approverUserId: z.string().optional(),
    assignmentVersion: z.number().int(),
    coveredAssignment: dutyAdjustmentAssignmentSummarySchema,
    coveredAssignmentId: z.string().min(1),
    createdAt: z.string(),
    decidedByMemberName: z.string().optional(),
    decidedAt: z.string().optional(),
    deductedMemberName: z.string().optional(),
    deductedMembershipId: z.string().min(1),
    groupId: z.string().min(1),
    id: z.string().min(1),
    isRevocable: z.boolean().optional(),
    overtimeMemberName: z.string().optional(),
    overtimeMembershipId: z.string().min(1),
    reason: z.string().optional(),
    revocationBlockedReason: z.string().optional(),
    revocationReason: z.string().optional(),
    status: dutyAdjustmentStatusSchema,
    version: z.number().int().min(1),
  })
  .strict();
export type DutyAdjustmentRequest = z.infer<typeof dutyAdjustmentRequestSchema>;
export const dutyAdjustmentRequestListSchema = z.array(dutyAdjustmentRequestSchema);

export interface DutyAdjustmentMutationInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface RevokeDutyAdjustmentInput extends DutyAdjustmentMutationInput {
  readonly reason?: string;
}

export const groupDutyAdjustmentSettingsSchema = z
  .object({
    requiresApproval: z.boolean(),
  })
  .strict();
export type GroupDutyAdjustmentSettings = z.infer<typeof groupDutyAdjustmentSettingsSchema>;

export interface UpdateGroupDutyAdjustmentSettingsInput {
  readonly requiresApproval: boolean;
}
