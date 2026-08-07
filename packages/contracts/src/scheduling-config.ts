import { z } from 'zod';

export const schedulingGroupMemberSchema = z
  .object({
    membershipId: z.string().min(1),
    realName: z.string().min(1),
  })
  .strict();
export type SchedulingGroupMember = z.infer<typeof schedulingGroupMemberSchema>;

export const scheduleRoleMemberSchema = z
  .object({
    id: z.string().min(1),
    membershipId: z.string().min(1),
    position: z.number().int().min(1),
    realName: z.string().min(1),
    version: z.number().int(),
  })
  .strict();
export type ScheduleRoleMember = z.infer<typeof scheduleRoleMemberSchema>;

export const rotationRuleSchema = z
  .object({
    currentPosition: z.number().int().min(1),
    defaultShiftTypeId: z.string().min(1),
    requiredMembersPerDay: z.number().int().min(1),
    startDate: z.string().optional(),
    startingMemberScheduleRoleId: z.string().optional(),
    version: z.number().int(),
  })
  .strict();
export type RotationRule = z.infer<typeof rotationRuleSchema>;

export const scheduleRoleSchema = z
  .object({
    id: z.string().min(1),
    members: z.readonly(z.array(scheduleRoleMemberSchema)),
    name: z.string().min(1),
    rotationRule: rotationRuleSchema,
    version: z.number().int(),
  })
  .strict();
export type ScheduleRole = z.infer<typeof scheduleRoleSchema>;

export const shiftTypeSchema = z
  .object({
    abbreviation: z.string().min(1),
    color: z.string().regex(/^#[\dA-F]{6}$/iu),
    configurationVersion: z.number().int(),
    countsTowardStatistics: z.boolean(),
    crossesMidnight: z.boolean(),
    displayOrder: z.number().int(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/u)
      .optional(),
    id: z.string().min(1),
    isAllDay: z.boolean(),
    isBuiltIn: z.boolean(),
    isEnabled: z.boolean(),
    name: z.string().min(1),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/u)
      .optional(),
    textColor: z.string().regex(/^#[\dA-F]{6}$/iu),
    version: z.number().int(),
  })
  .strict();
export type ShiftType = z.infer<typeof shiftTypeSchema>;

export const schedulingConfigSchema = z
  .object({
    groupMembers: z.readonly(z.array(schedulingGroupMemberSchema)),
    roles: z.readonly(z.array(scheduleRoleSchema)),
    rulesVersion: z.number().int().optional(),
    shiftTypes: z.readonly(z.array(shiftTypeSchema)),
  })
  .strict();
export type SchedulingConfig = z.infer<typeof schedulingConfigSchema> & {
  readonly rulesVersion: number;
};

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
