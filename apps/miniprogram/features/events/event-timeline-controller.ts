import type { ScheduleEventPage, ScheduleEventQuery } from '@schedule/contracts';

import type { CalendarAssignmentViewModel } from '../calendar/calendar-view-model.js';
import { buildEventTimelineDisplay, type EventTimelineDisplayItem } from './event-description.js';

export interface EventTimelineState {
  readonly assignmentId?: string;
  readonly changeChainSummary?: string;
  readonly errorMessage?: string;
  readonly groupId?: string;
  readonly hasMore: boolean;
  readonly items: readonly EventTimelineDisplayItem[];
  readonly status: 'error' | 'idle' | 'loading' | 'ready';
}

export interface EventTimelineDependencies {
  readonly listEvents: (
    groupId: string,
    query: Omit<ScheduleEventQuery, 'groupId'>,
  ) => Promise<ScheduleEventPage>;
  readonly publish: (state: EventTimelineState) => void;
}

export interface EventTimelineController {
  load(groupId: string, assignment: CalendarAssignmentViewModel): Promise<void>;
  reset(): void;
}

interface EventTimelineKey {
  readonly assignmentId: string;
  readonly groupId: string;
}

interface InFlightTimeline {
  readonly key: EventTimelineKey;
  readonly promise: Promise<void>;
}

function isSameKey(first: EventTimelineKey, second: EventTimelineKey): boolean {
  return first.groupId === second.groupId && first.assignmentId === second.assignmentId;
}

export function createEventTimelineController(
  dependencies: EventTimelineDependencies,
): EventTimelineController {
  let active: (EventTimelineKey & { readonly generation: number }) | undefined;
  let generation = 0;
  let inFlight: InFlightTimeline | undefined;

  const isCurrent = (key: EventTimelineKey, currentGeneration: number): boolean =>
    active !== undefined && active.generation === currentGeneration && isSameKey(active, key);

  const publishFor = (
    key: EventTimelineKey,
    state: Omit<EventTimelineState, 'assignmentId' | 'groupId'>,
  ): void => {
    dependencies.publish({ ...state, assignmentId: key.assignmentId, groupId: key.groupId });
  };

  return {
    load(groupId, assignment): Promise<void> {
      const key = { assignmentId: assignment.assignmentId, groupId };
      if (inFlight !== undefined && isSameKey(inFlight.key, key)) return inFlight.promise;

      generation += 1;
      const currentGeneration = generation;
      active = { ...key, generation: currentGeneration };
      publishFor(key, { hasMore: false, items: [], status: 'loading' });

      const promise = Promise.resolve()
        .then(() =>
          dependencies.listEvents(groupId, {
            pageSize: 100,
            shiftId: assignment.assignmentId,
          }),
        )
        .then((page) => {
          if (!isCurrent(key, currentGeneration)) return;
          const display = buildEventTimelineDisplay(page.events, assignment);
          publishFor(key, {
            ...(display.changeChainSummary === undefined
              ? {}
              : { changeChainSummary: display.changeChainSummary }),
            hasMore: page.nextCursor !== undefined,
            items: display.items,
            status: 'ready',
          });
        })
        .catch((error: unknown) => {
          if (!isCurrent(key, currentGeneration)) return;
          publishFor(key, {
            ...(error instanceof Error ? { errorMessage: error.message } : {}),
            hasMore: false,
            items: [],
            status: 'error',
          });
        })
        .finally(() => {
          if (inFlight?.promise === promise) inFlight = undefined;
        });
      inFlight = { key, promise };
      return promise;
    },
    reset(): void {
      generation += 1;
      active = undefined;
      inFlight = undefined;
      dependencies.publish({ hasMore: false, items: [], status: 'idle' });
    },
  };
}
