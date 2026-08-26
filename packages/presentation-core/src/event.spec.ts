import { describe, expect, it } from 'vitest';

import {
  buildEventDateGroups,
  buildEventNarrative,
  formatEventTime,
  getEventImpactCount,
  getEventStatusLabel,
  getEventTone,
  getEventTypeLabel,
} from './event.js';

function event(overrides: Record<string, unknown> = {}) {
  return {
    affectedMembershipIds: ['member-1'],
    affectedShiftIds: ['shift-1'],
    eventStatus: 'completed',
    eventType: 'schedule_period_published',
    id: 'event-1',
    objectType: 'schedule_period',
    occurredAt: '2026-08-25T16:30:00.000Z',
    ...overrides,
  };
}

describe('shared event presentation', () => {
  it('uses the complete Web labels, statuses, tones, time and privacy-safe impact count', () => {
    expect(getEventTypeLabel('schedule_period_published')).toBe('排班已发布');
    expect(getEventTypeLabel('unknown')).toBe('排班变更');
    expect(getEventStatusLabel('completed')).toBe('已完成');
    expect(getEventTone('duty_adjustment_completed')).toBe('adjustment');
    expect(getEventTone('swap_completed')).toBe('swap');
    expect(formatEventTime('2026-08-25T16:30:00.000Z')).toBe('2026-08-26 00:30');
    expect(getEventImpactCount(event())).toBe(2);
  });

  it('groups newest events by China Standard Time date and keeps Web narratives', () => {
    const groups = buildEventDateGroups([
      event({ id: 'morning', occurredAt: '2026-08-26T01:00:00.000Z' }),
      event({ id: 'night', occurredAt: '2026-08-25T18:00:00.000Z' }),
      event({ id: 'previous', occurredAt: '2026-08-25T15:00:00.000Z' }),
    ]);
    expect(groups.map((group) => [group.businessDate, group.label])).toEqual([
      ['2026-08-26', '8月26日 周三'],
      ['2026-08-25', '8月25日 周二'],
    ]);
    expect(groups[0]?.events.map((item) => item.id)).toEqual(['morning', 'night']);
    expect(buildEventNarrative(event())).toBe('排班已发布。');
  });
});
