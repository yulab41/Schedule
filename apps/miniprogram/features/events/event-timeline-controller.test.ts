import type { ScheduleEvent, ScheduleEventPage } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createEventTimelineController,
  type EventTimelineState,
} from './event-timeline-controller.js';
import type { CalendarAssignmentViewModel } from '../calendar/calendar-view-model.js';

const assignment = {
  actualMemberName: '值班医生',
  assignmentId: 'assignment-1',
  backgroundColor: '#123456',
  borderToken: 'color-border-strong',
  compactShiftLabel: '日',
  foregroundColor: '#FFFFFF',
  markers: [],
  memberName: '值班医生',
  phoneActions: [],
  plannedMemberName: '计划医生',
  roleId: 'role-1',
  roleName: '门诊',
  routeActionId: 'assignment:assignment-1',
  schedulePeriodId: 'period-1',
  shiftTypeAbbreviation: 'D',
  shiftTypeId: 'shift-1',
  shiftTypeName: '日班',
  slotPosition: 1,
  timeRange: '08:00–16:00',
} satisfies CalendarAssignmentViewModel;

function makeEvent(id: string, affectedShiftIds = [assignment.assignmentId]): ScheduleEvent {
  return {
    affectedMembershipIds: [],
    affectedShiftIds,
    eventStatus: 'completed',
    eventType: 'schedule_period_published',
    groupId: 'group-1',
    id,
    objectType: 'schedule_period',
    occurredAt: '2026-08-15T08:00:00+08:00',
    operationId: `operation-${id}`,
  };
}

function createDeferred<Value>() {
  let reject: ((reason?: unknown) => void) | undefined;
  let resolve: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    reject(reason: unknown): void {
      reject?.(reason);
    },
    resolve(value: Value): void {
      resolve?.(value);
    },
  };
}

function createHarness(
  listEvents: (groupId: string, cursor?: string, pageSize?: number) => Promise<ScheduleEventPage>,
) {
  const states: EventTimelineState[] = [];
  const publish = vi.fn((state: EventTimelineState) => states.push(state));
  return {
    controller: createEventTimelineController({ listEvents, publish }),
    publish,
    states,
  };
}

describe('event timeline controller', () => {
  it('single-flights one exact identity, filters client-side, and publishes display-only data', async () => {
    const listEvents = vi.fn(() =>
      Promise.resolve({
        events: [makeEvent('kept'), makeEvent('other', ['other-assignment'])],
        nextCursor: 'next',
      }),
    );
    const harness = createHarness(listEvents);

    const first = harness.controller.load('group-1', assignment);
    const second = harness.controller.load('group-1', assignment);
    expect(first).toBe(second);
    await first;

    expect(listEvents).toHaveBeenCalledTimes(1);
    expect(listEvents).toHaveBeenCalledWith('group-1', undefined, 100);
    expect(harness.states.at(-1)).toMatchObject({
      assignmentId: assignment.assignmentId,
      groupId: 'group-1',
      hasMore: true,
      items: [{ id: 'kept' }],
      status: 'ready',
    });
    expect(JSON.stringify(harness.states.at(-1))).not.toContain('objectType');
  });

  it('ignores stale completions across group and assignment identities', async () => {
    const firstResponse = createDeferred<ScheduleEventPage>();
    const secondResponse = createDeferred<ScheduleEventPage>();
    const listEvents = vi
      .fn<(groupId: string, cursor?: string, pageSize?: number) => Promise<ScheduleEventPage>>()
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise);
    const harness = createHarness(listEvents);
    const nextAssignment = { ...assignment, assignmentId: 'assignment-2' };

    const first = harness.controller.load('group-1', assignment);
    const second = harness.controller.load('group-2', nextAssignment);
    firstResponse.resolve({ events: [makeEvent('stale')], nextCursor: undefined });
    await first;
    expect(harness.states.at(-1)).toMatchObject({
      assignmentId: nextAssignment.assignmentId,
      groupId: 'group-2',
      status: 'loading',
    });

    secondResponse.resolve({
      events: [makeEvent('current', [nextAssignment.assignmentId])],
      nextCursor: undefined,
    });
    await second;
    expect(harness.states.at(-1)).toMatchObject({
      assignmentId: nextAssignment.assignmentId,
      groupId: 'group-2',
      items: [{ id: 'current' }],
      status: 'ready',
    });
  });

  it('handles failures without rejecting and resets the in-flight identity', async () => {
    const listEvents = vi
      .fn<(groupId: string, cursor?: string, pageSize?: number) => Promise<ScheduleEventPage>>()
      .mockRejectedValueOnce(new Error('events unavailable'))
      .mockResolvedValueOnce({ events: [], nextCursor: undefined });
    const harness = createHarness(listEvents);

    await expect(harness.controller.load('group-1', assignment)).resolves.toBeUndefined();
    expect(harness.states.at(-1)).toMatchObject({
      errorMessage: 'events unavailable',
      hasMore: false,
      items: [],
      status: 'error',
    });
    harness.controller.reset();
    await harness.controller.load('group-1', assignment);
    expect(listEvents).toHaveBeenCalledTimes(2);
  });
});
