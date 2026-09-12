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
    realName: z.string().min(1),
    version: z.number().int(),
  })
  .strict();
export type ScheduleRoleMember = z.infer<typeof scheduleRoleMemberSchema>;

export const scheduleRoleSchema = z
  .object({
    id: z.string().min(1),
    members: z.readonly(z.array(scheduleRoleMemberSchema)),
    name: z.string().min(1),
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
  readonly expectedRulesVersion: number;
  readonly name: string;
  readonly operationId: string;
}

export interface ReplaceScheduleRoleMembersRequest {
  readonly expectedRoleVersion: number;
  readonly expectedRulesVersion: number;
  readonly membershipIds: readonly string[];
  readonly operationId: string;
}

export interface ScheduleRoleVersionMutationRequest {
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface UpdateScheduleRoleRequest extends ScheduleRoleVersionMutationRequest {
  readonly name: string;
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

export interface CreateShiftTypeRequest extends ShiftTypeInput {
  readonly expectedRulesVersion: number;
  readonly operationId: string;
}

export interface UpdateShiftTypeRequest extends ShiftTypeInput {
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface ShiftTypeVersionMutationRequest {
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly operationId: string;
}
