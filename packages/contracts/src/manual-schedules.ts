import type {
  ScheduleGenerationStatistics,
  ScheduleGenerationVacancy,
  ScheduleGenerationWarning,
  SchedulePeriodSummary,
  SchedulePreviewAssignment,
  SchedulePublishMode,
} from './schedules.js';

export interface ManualScheduleTemplateCellInput {
  readonly cycleDay: number;
  readonly membershipId: string;
  readonly shiftTypeId: string;
}

export interface ManualScheduleTemplateMember {
  readonly currentMemberScheduleRoleVersion: number;
  readonly isAvailable: boolean;
  readonly isStale: boolean;
  readonly membershipId: string;
  readonly memberScheduleRoleVersion: number;
  readonly realName: string;
}

export interface ManualScheduleTemplateCell {
  readonly cycleDay: number;
  readonly currentShiftTypeConfigurationVersion: number;
  readonly isShiftTypeEnabled: boolean;
  readonly isStale: boolean;
  readonly membershipId: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeConfigurationVersion: number;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly shiftTypeTextColor: string;
}

export interface ManualScheduleTemplate {
  readonly cells: readonly ManualScheduleTemplateCell[];
  readonly cycleDays: number;
  readonly groupId: string;
  readonly id: string;
  readonly members: readonly ManualScheduleTemplateMember[];
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly startDate: string;
  readonly version: number;
}

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

export interface ManualApplyConflict {
  readonly assignmentBusinessKeys: readonly string[];
  readonly code: 'MEMBER_LEAVE_OVERLAP' | 'MEMBER_TIME_OVERLAP';
  readonly memberName?: string;
  readonly membershipId: string;
}

export interface ManualApplyPreview {
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
}

export interface PreviewManualTemplateApplyRequest {
  readonly endDate?: string;
  readonly expectedRulesVersion: number;
}

export interface ApplyManualScheduleTemplateRequest {
  readonly acknowledgeBlockers?: boolean;
  readonly endDate?: string;
  readonly expectedRulesVersion: number;
  readonly operationId: string;
  readonly publishMode?: SchedulePublishMode;
}

export interface AppliedManualScheduleTemplateResult {
  readonly operationId: string;
  readonly periods: readonly SchedulePeriodSummary[];
  readonly preview: ManualApplyPreview;
  readonly publishMode: SchedulePublishMode;
  readonly status: 'draft' | 'published';
  readonly templateId: string;
  readonly templateVersion: number;
}
