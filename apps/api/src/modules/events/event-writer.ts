import { randomUUID } from 'node:crypto';

import type { ScheduleEventWriteInput } from '@schedule/contracts';
import { scheduleEvents, type DatabaseTransaction } from '@schedule/database';

export class EventWriter {
  public async append(
    transaction: DatabaseTransaction,
    input: ScheduleEventWriteInput,
  ): Promise<string> {
    const eventId = randomUUID();

    await transaction.insert(scheduleEvents).values({
      affectedMembershipIds: [...(input.affectedMembershipIds ?? [])],
      affectedShiftIds: [...(input.affectedShiftIds ?? [])],
      afterData: input.afterData ?? null,
      approverUserId: input.approverUserId ?? null,
      beforeData: input.beforeData ?? null,
      eventStatus: input.eventStatus,
      eventType: input.eventType,
      groupId: input.groupId,
      id: eventId,
      initiatedByUserId: input.initiatedByUserId ?? null,
      objectId: input.objectId ?? null,
      objectType: input.objectType,
      operationId: input.operationId,
      ...(input.occurredAt === undefined ? {} : { occurredAt: input.occurredAt }),
      operatorUserId: input.operatorUserId ?? null,
      parentEventId: input.parentEventId ?? null,
      reason: input.reason ?? null,
      schedulePeriodId: input.schedulePeriodId ?? null,
      statisticsDelta: input.statisticsDelta ?? null,
    });

    return eventId;
  }
}
