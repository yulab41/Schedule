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

export interface ScheduleGenerationWarning {
  readonly assignmentBusinessKeys: readonly string[];
  readonly code: 'CONTINUOUS_DUTY_24_HOURS';
  readonly endsAt: string;
  readonly membershipId: string;
  readonly memberName?: string;
  readonly startsAt: string;
}

export interface ScheduleGenerationVacancy {
  readonly assignmentBusinessKey: string;
  readonly businessDate: string;
  readonly code: 'NO_ELIGIBLE_MEMBER';
  readonly scheduleRoleId: string;
  readonly slotPosition: number;
}

export interface ScheduleGenerationShiftTypeCount {
  readonly assignmentCount: number;
  readonly countedAssignmentCount: number;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
}

export interface ScheduleGenerationRoleCount {
  readonly assignmentCount: number;
  readonly countedAssignmentCount: number;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly vacancyCount: number;
}

export interface ScheduleGenerationStatistics {
  readonly assignmentCount: number;
  readonly byRole: readonly ScheduleGenerationRoleCount[];
  readonly byShiftType: readonly ScheduleGenerationShiftTypeCount[];
  readonly countedAssignmentCount: number;
  readonly vacancyCount: number;
}

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
    // 旧守卫不校验以下字段；schema 保持同样不约束，导出类型保留必填。
    rulesVersion: z.custom<number>(() => true).optional(),
    scheduleRoleId: z.custom<string>(() => true).optional(),
    status: z.string().min(1),
    version: z.custom<number>(() => true).optional(),
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
    // 旧守卫不校验以下字段；schema 保持同样不约束，导出类型保留必填。
    continuousDutyWarnings: z.custom<readonly ScheduleGenerationWarning[]>(() => true).optional(),
    hardConflicts: z.custom<readonly ScheduleGenerationConflict[]>(() => true).optional(),
    rulesVersion: z.number().int(),
    scheduleRoleIds: z.custom<readonly string[]>((value) => Array.isArray(value)),
    statistics: z.custom<ScheduleGenerationStatistics>(
      (value) => value !== null && typeof value === 'object',
    ),
    vacancies: z.custom<readonly ScheduleGenerationVacancy[]>(() => true).optional(),
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
