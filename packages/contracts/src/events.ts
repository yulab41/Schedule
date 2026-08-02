import type { JsonObject } from './errors.js';

export interface ScheduleEvent {
  readonly affectedMembershipIds: readonly string[];
  readonly affectedShiftIds: readonly string[];
  readonly afterData?: JsonObject;
  readonly approverUserId?: string;
  readonly beforeData?: JsonObject;
  readonly eventStatus: string;
  readonly eventType: string;
  readonly groupId: string;
  readonly id: string;
  readonly initiatedByUserId?: string;
  readonly objectId?: string;
  readonly objectType: string;
  readonly occurredAt: string;
  readonly operationId: string;
  readonly operatorUserId?: string;
  readonly parentEventId?: string;
  readonly reason?: string;
  readonly schedulePeriodId?: string;
  readonly statisticsDelta?: JsonObject;
}

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

export interface ScheduleEventPage {
  readonly events: readonly ScheduleEvent[];
  readonly nextCursor?: string;
}

export interface ScheduleEventDetail {
  readonly event: ScheduleEvent;
  readonly relatedEvents: readonly ScheduleEvent[];
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
