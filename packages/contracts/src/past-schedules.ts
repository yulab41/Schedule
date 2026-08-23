import { z } from 'zod';

import { isValidManualScheduleDate } from './manual-schedule-limits.js';
import { MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS } from './past-schedule-limits.js';

export { MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS };

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

const pastScheduleUuidSchema = z.string().uuid();
const pastScheduleBusinessDateSchema = z
  .string()
  .refine(isValidManualScheduleDate, '日期必须使用有效的 YYYY-MM-DD 格式。');

export const pastScheduleBackfillBatchItemSchema = z
  .object({
    actualMembershipId: pastScheduleUuidSchema,
    businessDate: pastScheduleBusinessDateSchema,
    scheduleRoleId: pastScheduleUuidSchema,
    shiftTypeId: pastScheduleUuidSchema,
  })
  .strict();
export type PastScheduleBackfillBatchItem = z.infer<typeof pastScheduleBackfillBatchItemSchema>;

export const pastScheduleBackfillBatchRequestSchema = z
  .object({
    items: z
      .array(pastScheduleBackfillBatchItemSchema)
      .min(1)
      .max(MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS),
    operationId: pastScheduleUuidSchema.optional(),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const seenBusinessKeys = new Set<string>();
    for (const [index, item] of request.items.entries()) {
      const businessKey = `${item.scheduleRoleId}|${item.businessDate}`;
      if (seenBusinessKeys.has(businessKey)) {
        context.addIssue({
          code: 'custom',
          message: '同一批次不能重复补录相同岗位和业务日期。',
          path: ['items', index],
        });
      }
      seenBusinessKeys.add(businessKey);
    }
  });
export type PastScheduleBackfillBatchRequest = z.infer<
  typeof pastScheduleBackfillBatchRequestSchema
>;

export const pastScheduleBackfillBatchResultSchema = z
  .object({
    assignments: z.array(pastScheduleAssignmentSchema),
    eventIds: z.array(z.string().min(1)),
  })
  .strict();
export type PastScheduleBackfillBatchResult = z.infer<typeof pastScheduleBackfillBatchResultSchema>;

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
