import { randomUUID } from 'node:crypto';

import type { ScheduleEventWriteInput } from '@schedule/contracts';
import { scheduleEvents, type DatabaseTransaction } from '@schedule/database';

import {
  recordCalendarChange,
  resolvePeriodBusinessMonth,
} from '../calendar/calendar-change-log.js';

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

    // Every schedule-affecting workflow (publish, swap, leave cover, overtime,
    // manual edit, backfill) appends an event inside its own transaction, so
    // this is the single choke point that keeps the calendar change ledger in
    // step with the calendar tables.
    await recordCalendarChange(transaction, input.groupId, {
      businessMonth: await resolvePeriodBusinessMonth(
        transaction,
        input.groupId,
        input.schedulePeriodId,
      ),
      kind: isScheduleLifecycleEvent(input.eventType) ? 'schedule' : 'event',
    });

    return eventId;
  }
}

function isScheduleLifecycleEvent(eventType: string): boolean {
  return eventType.startsWith('schedule_period_') || eventType.startsWith('assignment_');
}
