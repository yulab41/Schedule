export type SchedulePublishMode = 'draft' | 'published';

export interface GenerateSchedulePreviewRequest {
  readonly businessMonth: string;
  readonly publishMode?: SchedulePublishMode;
  readonly rulesVersion: number;
  readonly scheduleRoleIds: readonly string[];
}

export interface SaveGeneratedScheduleRequest extends GenerateSchedulePreviewRequest {
  readonly acknowledgeBlockers?: boolean;
  readonly operationId: string;
}

export interface PublishSchedulePeriodRequest {
  readonly acknowledgeBlockers?: boolean;
  readonly expectedVersion: number;
  readonly operationId: string;
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

export interface ScheduleGenerationPreview {
  readonly assignments: readonly SchedulePreviewAssignment[];
  readonly businessMonth: string;
  readonly continuousDutyWarnings: readonly ScheduleGenerationWarning[];
  readonly hardConflicts: readonly ScheduleGenerationConflict[];
  readonly rulesVersion: number;
  readonly scheduleRoleIds: readonly string[];
  readonly statistics: ScheduleGenerationStatistics;
  readonly vacancies: readonly ScheduleGenerationVacancy[];
}

export interface SchedulePeriodSummary {
  readonly businessMonth: string;
  readonly id: string;
  readonly revision: number;
  readonly rulesVersion: number;
  readonly scheduleRoleId: string;
  readonly status: string;
  readonly version: number;
}

export interface ScheduleDraftSummary extends SchedulePeriodSummary {
  readonly scheduleRoleName: string;
}

export interface SavedScheduleGeneration {
  readonly operationId: string;
  readonly periods: readonly SchedulePeriodSummary[];
  readonly preview: ScheduleGenerationPreview;
  readonly publishMode: SchedulePublishMode;
  readonly status: 'draft' | 'published';
}

export interface GroupSchedulePublishMode {
  readonly publishMode: SchedulePublishMode;
}

export interface UpdateGroupSchedulePublishModeRequest {
  readonly publishMode: SchedulePublishMode;
}

export interface PublishSchedulePeriodResult {
  readonly period: SchedulePeriodSummary;
  readonly preview: ScheduleGenerationPreview;
}
