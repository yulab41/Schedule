import type { ScheduleEvent } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildEventTimelineItems,
  extractEventChanges,
  formatEventTime,
  getEventMarker,
  getEventRelationLabel,
  getEventTypeLabel,
} from './event-timeline.js';

function event(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    affectedMembershipIds: ['membership-a'],
    affectedShiftIds: ['assignment-1'],
    eventStatus: 'completed',
    eventType: 'swap_completed',
    groupId: 'group-1',
    id: 'event-1',
    objectType: 'swap_request',
    occurredAt: '2026-08-02T00:00:00.000Z',
    operationId: 'operation-1',
    ...overrides,
  };
}

describe('event timeline logic', () => {
  it('labels known and unknown event types and maps calendar markers', () => {
    expect(getEventTypeLabel('swap_completed')).toBe('换班已生效');
    expect(getEventTypeLabel('unknown_type')).toBe('unknown type');
    expect(getEventMarker('duty_adjustment_completed')).toBe('overtime');
    expect(getEventMarker('leave_cover_completed')).toBe('leave-cover');
    expect(getEventMarker('swap_request_created')).toBeUndefined();
  });

  it('formats event times in China Standard Time and relation labels', () => {
    expect(formatEventTime('2026-08-01T16:30:00.000Z')).toBe('2026-08-02 00:30');
    expect(getEventRelationLabel(event())).toBe('原始事件');
    expect(getEventRelationLabel(event({ parentEventId: 'event-0' }))).toBe('更正/撤销');
  });

  it('extracts before/after person, status, and reason changes while skipping ids and nested data', () => {
    const changes = extractEventChanges(
      event({
        afterData: {
          actualMemberId: 'membership-b',
          actualMemberName: 'B Doctor',
          status: 'completed',
          summary: { nested: true },
        },
        beforeData: {
          actualMemberId: 'membership-a',
          actualMemberName: 'A Doctor',
          status: 'pending_approval',
        },
      }),
    );

    expect(changes).toEqual([
      { after: 'B Doctor', before: 'A Doctor', label: '实际人员' },
      { after: 'completed', before: 'pending_approval', label: '状态' },
    ]);
  });

  it('builds a chronologically ordered timeline with correction and marker flags', () => {
    const correction = event({
      eventType: 'duty_adjustment_revoked',
      id: 'event-2',
      occurredAt: '2026-08-02T01:00:00.000Z',
      parentEventId: 'event-1',
    });
    const items = buildEventTimelineItems([correction, event()]);

    expect(items.map((item) => item.event.id)).toEqual(['event-1', 'event-2']);
    expect(items[0]).toMatchObject({ isCorrection: false, marker: 'swap' });
    expect(items[1]).toMatchObject({ isCorrection: true });
  });
});
