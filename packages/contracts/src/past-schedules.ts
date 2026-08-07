import { z } from 'zod';

export const pastSchedulePeriodSchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/u),
    id: z.string().min(1),
    periodStatus: z.enum(['past', 'published']),
    revision: z.number().int(),
    scheduleRoleId: z.string().min(1),
    scheduleRoleName: z.string().min(1),
    version: z.number().int(),
  })
  .strict();
export type PastSchedulePeriod = z.infer<typeof pastSchedulePeriodSchema>;
export const pastSchedulePeriodListSchema = z.array(pastSchedulePeriodSchema);

export const pastScheduleAssignmentSchema = z
  .object({
    actualMemberId: z.string().optional(),
    actualMemberName: z.string().optional(),
    assignmentId: z.string().min(1),
    backfillAt: z.string().optional(),
    backfillReason: z.string().optional(),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    plannedMemberId: z.string().optional(),
    plannedMemberName: z.string().optional(),
    shiftTypeAbbreviation: z.string(),
    shiftTypeId: z.string().min(1),
    shiftTypeName: z.string(),
    slotPosition: z.number().int(),
  })
  .strict();
export type PastScheduleAssignment = z.infer<typeof pastScheduleAssignmentSchema>;
export const pastScheduleAssignmentListSchema = z.array(pastScheduleAssignmentSchema);

export interface UpdatePastScheduleAssignmentInput {
  readonly actualMembershipId?: string;
  readonly reason?: string;
  readonly shiftTypeId?: string;
}

export interface CreatePastScheduleAssignmentInput {
  readonly actualMembershipId: string;
  readonly businessDate: string;
  readonly reason?: string;
  readonly scheduleRoleId: string;
  readonly shiftTypeId: string;
}

export const updatePastScheduleAssignmentResultSchema = z
  .object({
    assignment: pastScheduleAssignmentSchema,
    eventId: z.string().min(1).optional(),
  })
  .strict();
export type UpdatePastScheduleAssignmentResult = z.infer<
  typeof updatePastScheduleAssignmentResultSchema
>;

export const pastScheduleBackfillRecordSchema = z
  .object({
    actualMemberName: z.string().optional(),
    assignmentId: z.string().min(1),
    backfilledAt: z.string().min(1),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    operatorName: z.string(),
    reason: z.string().optional(),
    shiftTypeAbbreviation: z.string(),
    shiftTypeName: z.string(),
  })
  .strict();
export type PastScheduleBackfillRecord = z.infer<typeof pastScheduleBackfillRecordSchema>;
export const pastScheduleBackfillRecordListSchema = z.array(pastScheduleBackfillRecordSchema);
