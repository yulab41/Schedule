import { z } from 'zod';

import type { JsonObject } from './errors.js';

const jsonObjectSchema = z.custom<JsonObject>(
  (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
);

export const scheduleEventSchema = z
  .object({
    affectedMembershipIds: z.readonly(z.array(z.string())),
    affectedShiftIds: z.readonly(z.array(z.string())),
    afterData: jsonObjectSchema.optional(),
    approverUserId: z.string().optional(),
    beforeData: jsonObjectSchema.optional(),
    eventStatus: z.string(),
    eventType: z.string().min(1),
    groupId: z.string().min(1),
    id: z.string().min(1),
    initiatedByUserId: z.string().optional(),
    objectId: z.string().optional(),
    objectType: z.string(),
    occurredAt: z.string(),
    operationId: z.string(),
    operatorUserId: z.string().optional(),
    parentEventId: z.string().optional(),
    reason: z.string().optional(),
    schedulePeriodId: z.string().optional(),
    statisticsDelta: jsonObjectSchema.optional(),
  })
  .passthrough();
export type ScheduleEvent = z.infer<typeof scheduleEventSchema>;

export const scheduleEventPageSchema = z
  .object({
    events: z.readonly(z.array(scheduleEventSchema)),
    nextCursor: z.string().optional(),
  })
  .passthrough();
export type ScheduleEventPage = z.infer<typeof scheduleEventPageSchema>;

export const scheduleEventDetailSchema = z
  .object({
    event: scheduleEventSchema,
    relatedEvents: z.readonly(z.array(scheduleEventSchema)),
  })
  .passthrough();
export type ScheduleEventDetail = z.infer<typeof scheduleEventDetailSchema>;

export interface ScheduleEventWriteInput {
  readonly affectedMembershipIds?: readonly string[];
  readonly affectedShiftIds?: readonly string[];
  readonly afterData?: JsonObject;
  readonly approverUserId?: string;
  readonly beforeData?: JsonObject;
  readonly eventStatus: string;
  readonly eventType: string;
  readonly groupId: string;
  readonly initiatedByUserId?: string;
  readonly objectId?: string;
  readonly objectType: string;
  readonly occurredAt?: Date;
  readonly operationId: string;
  readonly operatorUserId?: string;
  readonly parentEventId?: string;
  readonly reason?: string;
  readonly schedulePeriodId?: string;
  readonly statisticsDelta?: JsonObject;
}

export interface ScheduleEventQuery {
  readonly cursor?: string;
  readonly eventTypes?: readonly string[];
  readonly from?: string;
  readonly groupId: string;
  readonly membershipId?: string;
  readonly operatorUserId?: string;
  readonly pageSize?: number;
  readonly scheduleRoleId?: string;
  readonly shiftId?: string;
  readonly to?: string;
}

export interface AuditLogWriteInput {
  readonly action: string;
  readonly actorUserId?: string;
  readonly groupId?: string;
  readonly metadata: JsonObject;
  readonly operationId: string;
  readonly outcome: string;
  readonly requestId?: string;
  readonly targetId?: string;
  readonly targetType?: string;
}
