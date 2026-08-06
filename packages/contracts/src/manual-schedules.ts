import { z } from 'zod';

import {
  scheduleGenerationStatisticsSchema,
  scheduleGenerationVacancySchema,
  scheduleGenerationWarningSchema,
  schedulePeriodSummarySchema,
  type ScheduleGenerationStatistics,
  type ScheduleGenerationVacancy,
  type ScheduleGenerationWarning,
  type SchedulePeriodSummary,
  type SchedulePreviewAssignment,
  type SchedulePublishMode,
} from './schedules.js';

export interface ManualScheduleTemplateCellInput {
  readonly cycleDay: number;
  readonly membershipId: string;
  readonly shiftTypeId: string;
}

export const manualScheduleTemplateMemberSchema = z
  .object({
    currentMemberScheduleRoleVersion: z.number().int().min(0),
    isAvailable: z.boolean(),
    isStale: z.boolean(),
    membershipId: z.string().min(1),
    memberScheduleRoleVersion: z.number().int().min(1),
    realName: z.string().min(1),
  })
  .passthrough();
export type ManualScheduleTemplateMember = z.infer<typeof manualScheduleTemplateMemberSchema>;

export const manualScheduleTemplateCellSchema = z
  .object({
    cycleDay: z.number().int().min(1).max(31),
    currentShiftTypeConfigurationVersion: z.number().int().min(0),
    isShiftTypeEnabled: z.boolean(),
    isStale: z.boolean(),
    membershipId: z.string().min(1),
    shiftTypeAbbreviation: z.string().min(1),
    shiftTypeColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    shiftTypeConfigurationVersion: z.number().int().min(1),
    shiftTypeId: z.string().min(1),
    shiftTypeName: z.string().min(1),
    shiftTypeTextColor: z.string().regex(/^#[\dA-F]{6}$/iu),
  })
  .passthrough();
export type ManualScheduleTemplateCell = z.infer<typeof manualScheduleTemplateCellSchema>;

export const manualScheduleTemplateSchema = z
  .object({
    cells: z.readonly(z.array(manualScheduleTemplateCellSchema)),
    cycleDays: z.number().int().min(1).max(31),
    groupId: z.string().min(1),
    id: z.string().min(1),
    members: z.readonly(z.array(manualScheduleTemplateMemberSchema)),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    version: z.number().int().min(1),
  })
  .passthrough();
export type ManualScheduleTemplate = z.infer<typeof manualScheduleTemplateSchema>;
export const manualScheduleTemplateListSchema = z.array(manualScheduleTemplateSchema);

export interface CreateManualScheduleTemplateRequest {
  readonly cells: readonly ManualScheduleTemplateCellInput[];
  readonly cycleDays: number;
  readonly membershipIds: readonly string[];
  readonly scheduleRoleId: string;
  readonly startDate: string;
}

export interface UpdateManualScheduleTemplateRequest extends CreateManualScheduleTemplateRequest {
  readonly expectedVersion: number;
}

export const manualApplyConflictSchema = z
  .object({
    assignmentBusinessKeys: z.readonly(z.array(z.string())),
    code: z.enum(['MEMBER_LEAVE_OVERLAP', 'MEMBER_TIME_OVERLAP']),
    memberName: z.string().optional(),
    membershipId: z.string().min(1),
  })
  .passthrough();
export type ManualApplyConflict = z.infer<typeof manualApplyConflictSchema>;

// 旧守卫只校验 businessDate/shiftTypeId 等字段；scheduleRoleName 按旧守卫要求非空。
export const manualApplyAssignmentSchema = z
  .object({
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    endsAt: z.string(),
    plannedMemberId: z.string().optional(),
    plannedMemberName: z.string().optional(),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    shiftTypeAbbreviation: z.string().min(1),
    shiftTypeColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    shiftTypeId: z.string().min(1),
    shiftTypeName: z.string().min(1),
    slotPosition: z.number().int().min(1),
    startsAt: z.string(),
  })
  .passthrough();

export const manualApplyPreviewSchema = z
  .object({
    applyEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    applyStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    assignments: z.readonly(z.array(manualApplyAssignmentSchema)),
    conflicts: z.readonly(z.array(manualApplyConflictSchema)),
    continuousDutyWarnings: z.readonly(z.array(scheduleGenerationWarningSchema)),
    cycleDays: z.number().int(),
    rulesVersion: z.number().int(),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    statistics: scheduleGenerationStatisticsSchema,
    templateId: z.string().min(1),
    templateVersion: z.number().int(),
    vacancies: z.readonly(z.array(scheduleGenerationVacancySchema)),
  })
  .passthrough();
// schema 推断类型比导出契约类型宽松（统计分项含未校验字段）；导出类型保留完整契约。
export type ManualApplyPreview = {
  readonly applyEndDate: string;
  readonly applyStartDate: string;
  readonly assignments: readonly SchedulePreviewAssignment[];
  readonly conflicts: readonly ManualApplyConflict[];
  readonly continuousDutyWarnings: readonly ScheduleGenerationWarning[];
  readonly cycleDays: number;
  readonly rulesVersion: number;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly statistics: ScheduleGenerationStatistics;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly vacancies: readonly ScheduleGenerationVacancy[];
};

export interface PreviewManualTemplateApplyRequest {
  readonly endDate?: string;
  readonly expectedRulesVersion: number;
  readonly startDate?: string;
}

export interface ApplyManualScheduleTemplateRequest {
  readonly acknowledgeBlockers?: boolean;
  readonly acknowledgeWorkflowRevocations?: boolean;
  readonly endDate?: string;
  readonly expectedRulesVersion: number;
  readonly operationId: string;
  readonly publishMode?: SchedulePublishMode;
  readonly replacePublished?: boolean;
  readonly replaceExistingDrafts?: boolean;
  readonly startDate?: string;
}

export const appliedManualScheduleTemplateResultSchema = z
  .object({
    operationId: z.string().min(1),
    periods: z.readonly(z.array(schedulePeriodSummarySchema)),
    preview: manualApplyPreviewSchema,
    publishMode: z.enum(['draft', 'published']),
    status: z.enum(['draft', 'published']),
    templateId: z.string().min(1),
    templateVersion: z.number().int(),
  })
  .passthrough();
// schema 推断类型比导出契约类型宽松；导出类型保留完整契约。
export type AppliedManualScheduleTemplateResult = {
  readonly operationId: string;
  readonly periods: readonly SchedulePeriodSummary[];
  readonly preview: ManualApplyPreview;
  readonly publishMode: SchedulePublishMode;
  readonly status: 'draft' | 'published';
  readonly templateId: string;
  readonly templateVersion: number;
};
