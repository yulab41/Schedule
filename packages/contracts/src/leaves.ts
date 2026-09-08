import { z } from 'zod';

import { scheduleGenerationVacancySchema, type ScheduleGenerationVacancy } from './schedules.js';

export const leaveRequestTypeSchema = z.enum([
  'training',
  'rotation',
  'sick',
  'maternity',
  'other',
]);
export type LeaveRequestType = z.infer<typeof leaveRequestTypeSchema>;
export const leaveRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type LeaveRequestStatus = z.infer<typeof leaveRequestStatusSchema>;

export interface CreateLeaveRequestInput {
  readonly endsAt: string;
  readonly isAllDay?: boolean;
  readonly leaveType: LeaveRequestType;
  readonly operationId: string;
  readonly reason?: string;
  readonly startsAt: string;
}

export const leaveAffectedShiftSchema = z
  .object({
    assignmentId: z.string(),
    businessDate: z.string(),
    isCovered: z.boolean(),
    shiftTypeAbbreviation: z.string(),
    shiftTypeName: z.string(),
  })
  .strict();
export type LeaveAffectedShift = z.infer<typeof leaveAffectedShiftSchema>;
export const leaveAffectedShiftListSchema = z.array(leaveAffectedShiftSchema);

export interface LeavePreviewAffectedShift {
  readonly businessDate: string;
  readonly memberName?: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeName: string;
}

const leavePreviewAffectedShiftSchema = z
  .object({
    businessDate: z.string(),
    memberName: z.string().optional(),
    shiftTypeAbbreviation: z.string(),
    shiftTypeName: z.string(),
  })
  .strict();

export interface LeaveAffectedShiftsInput {
  readonly endsAt: string;
  readonly isAllDay?: boolean;
  readonly startsAt: string;
}

export const leaveRequestSchema = z
  .object({
    approverUserId: z.string().optional(),
    createdAt: z.string(),
    decidedByMemberName: z.string().optional(),
    decidedAt: z.string().optional(),
    endsAt: z.string(),
    groupId: z.string().min(1),
    id: z.string().min(1),
    isAllDay: z.boolean(),
    isRevocable: z.boolean().optional(),
    leaveType: leaveRequestTypeSchema,
    memberName: z.string().optional(),
    membershipId: z.string().min(1),
    reason: z.string().optional(),
    revocationBlockedReason: z.string().optional(),
    startsAt: z.string(),
    status: leaveRequestStatusSchema,
    version: z.number().int().min(1),
  })
  .strict();
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export const leaveRequestListSchema = z.array(leaveRequestSchema);

export const leaveAffectedAssignmentSchema = z
  .object({
    assignmentId: z.string().min(1),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    endsAt: z.string(),
    nextMemberId: z.string().optional(),
    nextMemberName: z.string().optional(),
    previousMemberId: z.string().optional(),
    previousMemberName: z.string().optional(),
    shiftTypeAbbreviation: z.string(),
    shiftTypeColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    shiftTypeId: z.string().min(1),
    shiftTypeName: z.string().min(1),
    shiftTypeTextColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    slotPosition: z.number().int().min(1),
    startsAt: z.string(),
  })
  .strict();
export type LeaveAffectedAssignment = z.infer<typeof leaveAffectedAssignmentSchema>;

export const leaveWorkflowBlockerSchema = z
  .object({
    assignmentId: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();
export type LeaveWorkflowBlocker = z.infer<typeof leaveWorkflowBlockerSchema>;

export const leaveMemberStatisticsDeltaSchema = z
  .object({
    assignmentDelta: z.number(),
    countedDelta: z.number(),
    membershipId: z.string(),
    realName: z.string(),
    weekendDelta: z.number(),
  })
  .strict();
export type LeaveMemberStatisticsDelta = z.infer<typeof leaveMemberStatisticsDeltaSchema>;

export const leaveStatisticsDeltaSchema = z
  .object({
    byMember: z.readonly(z.array(leaveMemberStatisticsDeltaSchema)),
    totalAssignmentDelta: z.number(),
    totalCountedDelta: z.number(),
    totalWeekendDelta: z.number(),
  })
  .strict();
export type LeaveStatisticsDelta = z.infer<typeof leaveStatisticsDeltaSchema>;

export const leaveApprovalPreviewSchema = z
  .object({
    affectedAssignments: z.readonly(z.array(leaveAffectedAssignmentSchema)),
    affectedShiftCount: z.number().int().min(0).optional(),
    affectedShifts: z.readonly(z.array(leavePreviewAffectedShiftSchema)).optional(),
    leaveRequestId: z.string().min(1),
    leaveRequestVersion: z.number().int(),
    overlapsUnpublishedPeriod: z.boolean().optional(),
    periodVersions: z.record(z.string(), z.number()),
    assignmentVersions: z.record(z.string(), z.number()),
    rulesVersion: z.number().int(),
    statisticsDelta: leaveStatisticsDeltaSchema,
    vacancies: z.readonly(z.array(scheduleGenerationVacancySchema)),
    workflowBlockers: z.readonly(z.array(leaveWorkflowBlockerSchema)),
  })
  .strict();
// schema 只校验旧守卫检查过的字段；导出类型保留完整契约。
export type LeaveApprovalPreview = {
  readonly affectedAssignments: readonly LeaveAffectedAssignment[];
  readonly affectedShiftCount: number;
  readonly affectedShifts: readonly LeavePreviewAffectedShift[];
  readonly leaveRequestId: string;
  readonly leaveRequestVersion: number;
  readonly overlapsUnpublishedPeriod: boolean;
  readonly periodVersions: Readonly<Record<string, number>>;
  readonly assignmentVersions: Readonly<Record<string, number>>;
  readonly rulesVersion: number;
  readonly statisticsDelta: LeaveStatisticsDelta;
  readonly vacancies: readonly ScheduleGenerationVacancy[];
  readonly workflowBlockers: readonly LeaveWorkflowBlocker[];
};

export type PreviewLeaveRequestInput = Record<string, never>;

export interface ApproveLeaveRequestInput {
  readonly acknowledgeBlockers?: boolean;
  readonly expectedPeriodVersions: Readonly<Record<string, number>>;
  readonly expectedAssignmentVersions: Readonly<Record<string, number>>;
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface RejectLeaveRequestInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface LeaveRequestMutationInput {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export const leaveRestorationResultSchema = z
  .object({
    restoredAssignmentIds: z.array(z.string()),
    skippedAssignments: z.array(
      z.object({ assignmentId: z.string(), reason: z.string() }).strict(),
    ),
    restorationUnavailable: z.boolean(),
  })
  .strict();
export type LeaveRestorationResult = z.infer<typeof leaveRestorationResultSchema>;

export const leaveRequestMutationResultSchema = z
  .object({
    leaveRequestId: z.string().min(1),
    operationId: z.string().min(1),
    status: z.enum(['cancelled', 'revoked']),
    restoration: leaveRestorationResultSchema.optional(),
  })
  .strict();
export type LeaveRequestMutationResult = z.infer<typeof leaveRequestMutationResultSchema>;

export const approvedLeaveRequestResultSchema = z
  .object({
    leaveRequest: leaveRequestSchema,
    operationId: z.string().min(1),
    preview: leaveApprovalPreviewSchema,
    status: z.literal('approved'),
  })
  .strict();
// schema 只校验旧守卫检查过的字段；导出类型保留完整契约。
export type ApprovedLeaveRequestResult = {
  readonly leaveRequest: LeaveRequest;
  readonly operationId: string;
  readonly preview: LeaveApprovalPreview;
  readonly status: 'approved';
};

export const rejectedLeaveRequestResultSchema = z
  .object({
    leaveRequest: leaveRequestSchema,
    operationId: z.string().min(1),
    status: z.literal('rejected'),
  })
  .strict();
export type RejectedLeaveRequestResult = z.infer<typeof rejectedLeaveRequestResultSchema>;
