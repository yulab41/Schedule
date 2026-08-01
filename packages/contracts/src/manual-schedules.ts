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
