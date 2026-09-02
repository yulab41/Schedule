import type { CalendarDutyAssignment, ScheduleEvent } from '@schedule/contracts';
import {
  buildChangeChainSummary,
  buildEventNarrative,
  buildEventTimelineItems,
  extractEventChanges,
  formatEventTime,
  getEventTone,
  getEventTypeLabel,
  type EventChangeItem,
  type EventTone,
} from '@schedule/presentation-core/event';

export interface ShiftEventChange {
  readonly label: string;
  readonly valueLabel: string;
}

export interface ShiftEventCard {
  readonly changes: readonly ShiftEventChange[];
  readonly eventTone: EventTone;
  readonly eventTypeLabel: string;
  readonly id: string;
  readonly markerLabel: string;
  readonly narrative: string;
  readonly occurredAtLabel: string;
  readonly reason: string;
}

export function createShiftEventCards(
  events: readonly ScheduleEvent[],
  assignment: CalendarDutyAssignment,
): readonly ShiftEventCard[] {
  const initiatedAtBySwapRequest = createInitiatedAtBySwapRequest(events);
  return buildEventTimelineItems(events).map(({ event, marker }) => {
    const initiatedAt =
      event.objectId === undefined ? undefined : initiatedAtBySwapRequest.get(event.objectId);
    const narrative = buildEventNarrative(event, assignment, {
      ...(initiatedAt === undefined ? {} : { initiatedAt }),
    });
    return {
      changes: narrative === undefined ? toShiftEventChanges(extractEventChanges(event)) : [],
      eventTone: getEventTone(event.eventType),
      eventTypeLabel: getEventTypeLabel(event.eventType),
      id: event.id,
      markerLabel: getMarkerLabel(marker),
      narrative: narrative ?? '',
      occurredAtLabel: formatEventTime(event.occurredAt),
      reason: event.reason ?? '',
    } satisfies ShiftEventCard;
  });
}

export function getShiftEventChangeChain(
  events: readonly ScheduleEvent[],
  assignmentId: string,
): string | undefined {
  return buildChangeChainSummary(events, assignmentId);
}

function createInitiatedAtBySwapRequest(
  events: readonly ScheduleEvent[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const event of events) {
    if (
      event.objectType === 'swap_request' &&
      event.eventType === 'swap_request_created' &&
      event.objectId !== undefined &&
      !result.has(event.objectId)
    ) {
      result.set(event.objectId, event.occurredAt);
    }
  }
  return result;
}

function toShiftEventChanges(changes: readonly EventChangeItem[]): readonly ShiftEventChange[] {
  return changes.map((change) => ({
    label: change.label,
    valueLabel: `${change.before ?? '未设置'} → ${change.after ?? '未设置'}`,
  }));
}

function getMarkerLabel(marker: string | undefined): string {
  switch (marker) {
    case 'leave-cover':
      return '请假替班';
    case 'overtime':
      return '加扣班';
    case 'swap':
      return '换班';
    default:
      return '';
  }
}
