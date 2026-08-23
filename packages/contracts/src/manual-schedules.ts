import { z } from 'zod';

import {
  MAX_MANUAL_CELLS,
  MAX_MANUAL_DAYS,
  MAX_MANUAL_MEMBERS,
  isManualScheduleDateRangeWithinLimit,
  isValidManualScheduleDate,
} from './manual-schedule-limits.js';

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

const manualScheduleDateSchema = z
  .string()
  .refine(isValidManualScheduleDate, '日期必须使用有效的 YYYY-MM-DD 格式。');
const manualScheduleUuidSchema = z.string().uuid();

export const manualScheduleTemplateCellInputSchema = z
  .object({
    cycleDay: z.number().int().min(1).max(MAX_MANUAL_DAYS),
    membershipId: manualScheduleUuidSchema,
    shiftTypeId: manualScheduleUuidSchema,
  })
  .strict();
export type ManualScheduleTemplateCellInput = z.infer<typeof manualScheduleTemplateCellInputSchema>;

export const manualScheduleTemplateMemberSchema = z
  .object({
    currentMemberScheduleRoleVersion: z.number().int().min(0),
    isAvailable: z.boolean(),
    isStale: z.boolean(),
    membershipId: z.string().min(1),
    memberScheduleRoleVersion: z.number().int().min(1),
    realName: z.string().min(1),
  })
  .strict();
export type ManualScheduleTemplateMember = z.infer<typeof manualScheduleTemplateMemberSchema>;

export const manualScheduleTemplateCellSchema = z
  .object({
    cycleDay: z.number().int().min(1).max(MAX_MANUAL_DAYS),
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
  .strict();
export type ManualScheduleTemplateCell = z.infer<typeof manualScheduleTemplateCellSchema>;

export const manualScheduleTemplateSchema = z
  .object({
    cells: z.readonly(z.array(manualScheduleTemplateCellSchema).max(MAX_MANUAL_CELLS)),
    cycleDays: z.number().int().min(1).max(MAX_MANUAL_DAYS),
    groupId: z.string().min(1),
    id: z.string().min(1),
    members: z.readonly(z.array(manualScheduleTemplateMemberSchema).max(MAX_MANUAL_MEMBERS)),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    startDate: manualScheduleDateSchema,
    version: z.number().int().min(1),
  })
  .strict()
  .superRefine(validateManualTemplateResponse);
export type ManualScheduleTemplate = z.infer<typeof manualScheduleTemplateSchema>;
export const manualScheduleTemplateListSchema = z.array(manualScheduleTemplateSchema);

export interface CreateManualScheduleTemplateRequest {
  readonly cells: readonly ManualScheduleTemplateCellInput[];
  readonly cycleDays: number;
  readonly membershipIds: readonly string[];
  readonly scheduleRoleId: string;
  readonly startDate: string;
}

const createManualScheduleTemplateRequestBaseSchema = z
  .object({
    cells: z.array(manualScheduleTemplateCellInputSchema).max(MAX_MANUAL_CELLS),
    cycleDays: z.number().int().min(1).max(MAX_MANUAL_DAYS),
    membershipIds: z.array(manualScheduleUuidSchema).min(1).max(MAX_MANUAL_MEMBERS),
    scheduleRoleId: manualScheduleUuidSchema,
    startDate: manualScheduleDateSchema,
  })
  .strict();

export const createManualScheduleTemplateRequestSchema =
  createManualScheduleTemplateRequestBaseSchema.superRefine(validateManualTemplateRequest);

export interface UpdateManualScheduleTemplateRequest extends CreateManualScheduleTemplateRequest {
  readonly expectedVersion: number;
}

export const updateManualScheduleTemplateRequestSchema =
  createManualScheduleTemplateRequestBaseSchema
    .extend({ expectedVersion: z.number().int().min(1) })
    .strict()
    .superRefine(validateManualTemplateRequest);

export const manualApplyConflictSchema = z
  .object({
    assignmentBusinessKeys: z.readonly(z.array(z.string())),
    code: z.enum(['MEMBER_LEAVE_OVERLAP', 'MEMBER_TIME_OVERLAP']),
    memberName: z.string().optional(),
    membershipId: z.string().min(1),
  })
  .strict();
export type ManualApplyConflict = z.infer<typeof manualApplyConflictSchema>;

// 旧守卫只校验 businessDate/shiftTypeId 等字段；scheduleRoleName 按旧守卫要求非空。
export const manualApplyAssignmentSchema = z
  .object({
    businessDate: manualScheduleDateSchema,
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
  .strict();

export const manualApplyPreviewSchema = z
  .object({
    applyEndDate: manualScheduleDateSchema,
    applyStartDate: manualScheduleDateSchema,
    assignments: z.readonly(z.array(manualApplyAssignmentSchema).max(MAX_MANUAL_CELLS)),
    conflicts: z.readonly(z.array(manualApplyConflictSchema)),
    continuousDutyWarnings: z.readonly(z.array(scheduleGenerationWarningSchema)),
    cycleDays: z.number().int().min(1).max(MAX_MANUAL_DAYS),
    rulesVersion: z.number().int(),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    statistics: scheduleGenerationStatisticsSchema,
    templateId: z.string().min(1),
    templateVersion: z.number().int(),
    vacancies: z.readonly(z.array(scheduleGenerationVacancySchema)),
  })
  .strict()
  .superRefine((value, context) => {
    if (!isManualScheduleDateRangeWithinLimit(value.applyStartDate, value.applyEndDate)) {
      context.addIssue({
        code: 'custom',
        message: `手动排班应用范围最多 ${MAX_MANUAL_DAYS} 天。`,
        path: ['applyEndDate'],
      });
    }
  });
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

const previewManualTemplateApplyRequestBaseSchema = z
  .object({
    endDate: manualScheduleDateSchema.optional(),
    expectedRulesVersion: z.number().int().min(1),
    startDate: manualScheduleDateSchema.optional(),
  })
  .strict();

export const previewManualTemplateApplyRequestSchema =
  previewManualTemplateApplyRequestBaseSchema.superRefine(validateExplicitManualApplyRange);

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

export const applyManualScheduleTemplateRequestSchema = previewManualTemplateApplyRequestBaseSchema
  .extend({
    acknowledgeBlockers: z.boolean().optional(),
    acknowledgeWorkflowRevocations: z.boolean().optional(),
    operationId: manualScheduleUuidSchema,
    publishMode: z.enum(['draft', 'published']).optional(),
    replacePublished: z.boolean().optional(),
    replaceExistingDrafts: z.boolean().optional(),
  })
  .strict()
  .superRefine(validateExplicitManualApplyRange);

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
  .strict();
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

function validateManualTemplateRequest(
  input: CreateManualScheduleTemplateRequest,
  context: z.RefinementCtx,
): void {
  const membershipIds = new Set(input.membershipIds);
  if (membershipIds.size !== input.membershipIds.length) {
    context.addIssue({
      code: 'custom',
      message: '模板成员不能重复。',
      path: ['membershipIds'],
    });
  }

  const cellKeys = new Set<string>();
  for (const [index, cell] of input.cells.entries()) {
    if (cell.cycleDay > input.cycleDays) {
      context.addIssue({
        code: 'custom',
        message: '模板单元格的周期日必须在模板周期天数内。',
        path: ['cells', index, 'cycleDay'],
      });
    }
    if (!membershipIds.has(cell.membershipId)) {
      context.addIssue({
        code: 'custom',
        message: '模板单元格的成员必须属于模板。',
        path: ['cells', index, 'membershipId'],
      });
    }
    const cellKey = `${cell.cycleDay}:${cell.membershipId}`;
    if (cellKeys.has(cellKey)) {
      context.addIssue({
        code: 'custom',
        message: '同一成员在同一天只能有一个模板单元格。',
        path: ['cells', index],
      });
    }
    cellKeys.add(cellKey);
  }
}

function validateManualTemplateResponse(
  input: {
    readonly cells: readonly { readonly cycleDay: number; readonly membershipId: string }[];
    readonly cycleDays: number;
    readonly members: readonly { readonly membershipId: string }[];
  },
  context: z.RefinementCtx,
): void {
  const membershipIds = new Set(input.members.map((member) => member.membershipId));
  if (membershipIds.size !== input.members.length) {
    context.addIssue({
      code: 'custom',
      message: '模板成员不能重复。',
      path: ['members'],
    });
  }

  const cellKeys = new Set<string>();
  for (const [index, cell] of input.cells.entries()) {
    if (cell.cycleDay > input.cycleDays) {
      context.addIssue({
        code: 'custom',
        message: '模板单元格的周期日必须在模板周期天数内。',
        path: ['cells', index, 'cycleDay'],
      });
    }
    if (!membershipIds.has(cell.membershipId)) {
      context.addIssue({
        code: 'custom',
        message: '模板单元格的成员必须属于模板。',
        path: ['cells', index, 'membershipId'],
      });
    }
    const cellKey = `${cell.cycleDay}:${cell.membershipId}`;
    if (cellKeys.has(cellKey)) {
      context.addIssue({
        code: 'custom',
        message: '同一成员在同一天只能有一个模板单元格。',
        path: ['cells', index],
      });
    }
    cellKeys.add(cellKey);
  }
}

function validateExplicitManualApplyRange(
  input: {
    readonly endDate?: string | undefined;
    readonly startDate?: string | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (
    input.startDate !== undefined &&
    input.endDate !== undefined &&
    !isManualScheduleDateRangeWithinLimit(input.startDate, input.endDate)
  ) {
    context.addIssue({
      code: 'custom',
      message: `手动排班应用范围最多 ${MAX_MANUAL_DAYS} 天。`,
      path: ['endDate'],
    });
  }
}
