export interface SchedulingConfig {
  readonly groupMembers: readonly SchedulingGroupMember[];
  readonly roles: readonly ScheduleRole[];
  readonly shiftTypes: readonly ShiftType[];
}

export interface SchedulingGroupMember {
  readonly membershipId: string;
  readonly realName: string;
}

export interface ScheduleRole {
  readonly id: string;
  readonly members: readonly ScheduleRoleMember[];
  readonly name: string;
  readonly rotationRule: RotationRule;
  readonly version: number;
}

export interface ScheduleRoleMember {
  readonly id: string;
  readonly membershipId: string;
  readonly position: number;
  readonly realName: string;
  readonly version: number;
}

export interface RotationRule {
  readonly currentPosition: number;
  readonly defaultShiftTypeId: string;
  readonly requiredMembersPerDay: number;
  readonly startDate?: string;
  readonly startingMemberScheduleRoleId?: string;
  readonly version: number;
}

export interface ShiftType {
  readonly abbreviation: string;
  readonly color: string;
  readonly configurationVersion: number;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly displayOrder: number;
  readonly endTime?: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime?: string;
  readonly textColor: string;
  readonly version: number;
}

export interface CreateScheduleRoleRequest {
  readonly name: string;
}

export interface ReplaceScheduleRoleMembersRequest {
  readonly membershipIds: readonly string[];
}

export interface ReorderRotationMembersRequest {
  readonly members: readonly RotationMemberPosition[];
}

export interface RotationMemberPosition {
  readonly position: number;
  readonly scheduleRoleMemberId: string;
}

export interface UpdateRotationRuleRequest {
  readonly currentPosition: number;
  readonly defaultShiftTypeId: string;
  readonly requiredMembersPerDay: number;
  readonly startDate?: string | null;
  readonly startingMemberScheduleRoleId?: string | null;
}

export interface ShiftTypeInput {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime?: string | null;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime?: string | null;
}

export type CreateShiftTypeRequest = ShiftTypeInput;
export type UpdateShiftTypeRequest = ShiftTypeInput;
