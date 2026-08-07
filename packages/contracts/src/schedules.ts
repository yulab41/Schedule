import { z } from 'zod';

export type SchedulePublishMode = 'draft' | 'published';

export interface GenerateSchedulePreviewRequest {
  readonly businessMonth: string;
  readonly publishMode?: SchedulePublishMode;
  readonly rulesVersion: number;
  readonly scheduleRoleIds: readonly string[];
}

export interface SaveGeneratedScheduleRequest extends GenerateSchedulePreviewRequest {
  readonly acknowledgeBlockers?: boolean;
  readonly acknowledgeWorkflowRevocations?: boolean;
  readonly operationId: string;
}

export interface PublishSchedulePeriodRequest {
  readonly acknowledgeBlockers?: boolean;
  readonly acknowledgeWorkflowRevocations?: boolean;
  readonly expectedVersion: number;
  readonly operationId: string;
  readonly replacePublished?: boolean;
}

export interface SchedulePreviewAssignment {
  readonly businessDate: string;
  readonly endsAt: string;
  readonly plannedMemberId?: string;
  readonly plannedMemberName?: string;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName?: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly slotPosition: number;
  readonly startsAt: string;
}

export interface ScheduleGenerationConflict {
  readonly assignmentBusinessKeys: readonly [string, string];
  readonly code: 'MEMBER_TIME_OVERLAP';
  readonly membershipId: string;
  readonly memberName?: string;
}

export const scheduleGenerationConflictSchema = z
  .object({
    assignmentBusinessKeys: z.tuple([z.string(), z.string()]),
    code: z.literal('MEMBER_TIME_OVERLAP'),
    membershipId: z.string().min(1),
    memberName: z.string().optional(),
  })
  .passthrough();

export interface ScheduleGenerationWarning {
  readonly assignmentBusinessKeys: readonly string[];
  readonly code: 'CONTINUOUS_DUTY_24_HOURS';
  readonly endsAt: string;
  readonly membershipId: string;
  readonly memberName?: string;
  readonly startsAt: string;
}

export const scheduleGenerationWarningSchema = z
  .object({
    assignmentBusinessKeys: z.readonly(z.array(z.string())),
    code: z.literal('CONTINUOUS_DUTY_24_HOURS'),
    endsAt: z.string(),
    membershipId: z.string().min(1),
    memberName: z.string().optional(),
    startsAt: z.string(),
  })
  .passthrough();

export interface ScheduleGenerationVacancy {
  readonly assignmentBusinessKey: string;
  readonly businessDate: string;
  readonly code: 'NO_ELIGIBLE_MEMBER';
  readonly scheduleRoleId: string;
  readonly slotPosition: number;
}

export const scheduleGenerationVacancySchema = z
  .object({
    assignmentBusinessKey: z.string(),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    code: z.literal('NO_ELIGIBLE_MEMBER'),
    scheduleRoleId: z.string(),
    slotPosition: z.number().int().min(1),
  })
  .passthrough();

export interface ScheduleGenerationShiftTypeCount {
  readonly assignmentCount: number;
  readonly countedAssignmentCount: number;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
}

// 旧守卫只校验 assignmentCount/shiftTypeId；schema 保持同样不约束其余字段。
export const scheduleGenerationShiftTypeCountSchema = z
  .object({
    assignmentCount: z.number(),
    countedAssignmentCount: z.number().int().min(0).optional(),
    shiftTypeAbbreviation: z.string().optional(),
    shiftTypeId: z.string(),
    shiftTypeName: z.string().optional(),
  })
  .passthrough();

export interface ScheduleGenerationRoleCount {
  readonly assignmentCount: number;
  readonly countedAssignmentCount: number;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly vacancyCount: number;
}

// 旧守卫只校验 assignmentCount/scheduleRoleId/vacancyCount；schema 保持同样不约束其余字段。
export const scheduleGenerationRoleCountSchema = z
  .object({
    assignmentCount: z.number(),
    countedAssignmentCount: z.number().int().min(0).optional(),
    scheduleRoleId: z.string(),
    scheduleRoleName: z.string().optional(),
    vacancyCount: z.number(),
  })
  .passthrough();

export interface ScheduleGenerationStatistics {
  readonly assignmentCount: number;
  readonly byRole: readonly ScheduleGenerationRoleCount[];
  readonly byShiftType: readonly ScheduleGenerationShiftTypeCount[];
  readonly countedAssignmentCount: number;
  readonly vacancyCount: number;
}

export const scheduleGenerationStatisticsSchema = z
  .object({
    assignmentCount: z.number().int(),
    byRole: z.readonly(z.array(scheduleGenerationRoleCountSchema)),
    byShiftType: z.readonly(z.array(scheduleGenerationShiftTypeCountSchema)),
    countedAssignmentCount: z.number().int(),
    vacancyCount: z.number().int(),
  })
  .passthrough();

// 旧守卫只校验这两个字段；其余字段由完整契约类型补充。
export const schedulePreviewAssignmentSchema = z
  .object({
    businessDate: z.string(),
    shiftTypeId: z.string(),
  })
  .passthrough();

export const schedulePeriodSummarySchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}/u),
    id: z.string().min(1),
    revision: z.number().int(),
    rulesVersion: z.number().int().optional(),
    scheduleRoleId: z.string().optional(),
    status: z.string().min(1),
    version: z.number().int().optional(),
  })
  .passthrough();
// schema 只校验旧守卫检查过的字段；导出类型保留完整契约。
export type SchedulePeriodSummary = {
  readonly businessMonth: string;
  readonly id: string;
  readonly revision: number;
  readonly rulesVersion: number;
  readonly scheduleRoleId: string;
  readonly status: string;
  readonly version: number;
};

export const scheduleDraftSummarySchema = schedulePeriodSummarySchema.extend({
  scheduleRoleName: z.string().min(1),
});
export type ScheduleDraftSummary = SchedulePeriodSummary & {
  readonly scheduleRoleName: string;
};
export const scheduleDraftSummaryListSchema = z.array(scheduleDraftSummarySchema);

export const schedulePeriodHistoryItemSchema = z
  .object({
    applyEndDate: z.string().optional(),
    applyStartDate: z.string().optional(),
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/u),
    createdAt: z.string(),
    id: z.string().min(1),
    operationId: z.string().optional(),
    publishedAt: z.string().optional(),
    revision: z.number().int().min(1),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    status: z.enum(['draft', 'pending_publication', 'published', 'replaced', 'withdrawn', 'past']),
    version: z.number().int().min(1),
  })
  .passthrough();
export type SchedulePeriodHistoryItem = z.infer<typeof schedulePeriodHistoryItemSchema>;
export const schedulePeriodHistoryItemListSchema = z.array(schedulePeriodHistoryItemSchema);

export type ScheduleWorkflowKind = 'duty_adjustment' | 'swap';

export const scheduleWorkflowImpactSchema = z
  .object({
    businessDates: z.readonly(z.array(z.string())),
    id: z.string(),
    kind: z.enum(['duty_adjustment', 'swap']),
    memberNames: z.readonly(z.array(z.string())),
    status: z.string(),
  })
  .passthrough();
export type ScheduleWorkflowImpact = z.infer<typeof scheduleWorkflowImpactSchema>;

export const scheduleChangeImpactPreviewSchema = z
  .object({
    action: z.enum(['publish', 'withdraw']),
    affectedPeriodIds: z.readonly(z.array(z.string())),
    workflowImpacts: z.readonly(z.array(scheduleWorkflowImpactSchema)),
  })
  .passthrough();
export type ScheduleChangeImpactPreview = z.infer<typeof scheduleChangeImpactPreviewSchema>;

export const scheduleGenerationPreviewSchema = z
  .object({
    assignments: z.readonly(z.array(schedulePreviewAssignmentSchema)),
    businessMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/u),
    continuousDutyWarnings: z.readonly(z.array(scheduleGenerationWarningSchema)).optional(),
    hardConflicts: z.readonly(z.array(scheduleGenerationConflictSchema)).optional(),
    rulesVersion: z.number().int(),
    scheduleRoleIds: z.readonly(z.array(z.string())),
    statistics: scheduleGenerationStatisticsSchema,
    vacancies: z.readonly(z.array(scheduleGenerationVacancySchema)).optional(),
  })
  .passthrough();
// schema 只校验旧守卫检查过的字段；导出类型保留完整契约。
export type ScheduleGenerationPreview = {
  readonly assignments: readonly SchedulePreviewAssignment[];
  readonly businessMonth: string;
  readonly continuousDutyWarnings: readonly ScheduleGenerationWarning[];
  readonly hardConflicts: readonly ScheduleGenerationConflict[];
  readonly rulesVersion: number;
  readonly scheduleRoleIds: readonly string[];
  readonly statistics: ScheduleGenerationStatistics;
  readonly vacancies: readonly ScheduleGenerationVacancy[];
};

export interface SchedulePeriodMutationRequest {
  readonly acknowledgeWorkflowRevocations?: boolean;
  readonly expectedVersion: number;
  readonly operationId: string;
}

export const schedulePeriodMutationResultSchema = z
  .object({
    period: schedulePeriodSummarySchema,
    workflowImpacts: z.readonly(z.array(scheduleWorkflowImpactSchema)),
  })
  .passthrough();
// schema 只校验旧守卫检查过的字段；导出类型保留完整契约。
export type SchedulePeriodMutationResult = {
  readonly period: SchedulePeriodSummary;
  readonly workflowImpacts: readonly ScheduleWorkflowImpact[];
};

export interface PublishSchedulePeriodBatchRequest {
  readonly acknowledgeBlockers?: boolean;
  readonly acknowledgeWorkflowRevocations?: boolean;
  readonly operationId: string;
  readonly replacePublished?: boolean;
  readonly schedulePeriodIds: readonly string[];
}

export const publishSchedulePeriodBatchResultSchema = z
  .object({
    periods: z.readonly(z.array(schedulePeriodSummarySchema)),
  })
  .passthrough();
// schema 只校验旧守卫检查过的字段；导出类型保留完整契约。
export type PublishSchedulePeriodBatchResult = {
  readonly periods: readonly SchedulePeriodSummary[];
};

export interface SavedScheduleGeneration {
  readonly operationId: string;
  readonly periods: readonly SchedulePeriodSummary[];
  readonly preview: ScheduleGenerationPreview;
  readonly publishMode: SchedulePublishMode;
  readonly status: 'draft' | 'published';
}

export const groupSchedulePublishModeSchema = z
  .object({
    publishMode: z.enum(['draft', 'published']),
  })
  .passthrough();
export type GroupSchedulePublishMode = z.infer<typeof groupSchedulePublishModeSchema>;

export interface UpdateGroupSchedulePublishModeRequest {
  readonly publishMode: SchedulePublishMode;
}

export const publishSchedulePeriodResultSchema = z
  .object({
    period: schedulePeriodSummarySchema,
    preview: scheduleGenerationPreviewSchema,
    workflowImpacts: z.readonly(z.array(scheduleWorkflowImpactSchema)),
  })
  .passthrough();
// schema 只校验旧守卫检查过的字段；导出类型保留完整契约。
export type PublishSchedulePeriodResult = {
  readonly period: SchedulePeriodSummary;
  readonly preview: ScheduleGenerationPreview;
  readonly workflowImpacts: readonly ScheduleWorkflowImpact[];
};
