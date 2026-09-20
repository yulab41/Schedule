import { describe, expect, it } from 'vitest';

import { CALENDAR_CHANGE_RETENTION, needsResync } from './calendar-change-log.js';

function entry(seq: number) {
  return {
    changedAt: '2026-09-15T00:00:00.000Z',
    kind: 'schedule' as const,
    seq,
  };
}

describe('calendar change cursor decisions', () => {
  it('treats a missing cursor as "nothing recorded yet"', () => {
    expect(needsResync(0, [], 0)).toBe(false);
    expect(needsResync(0, [entry(1)], 1)).toBe(true);
  });

  it('accepts a contiguous delta as current', () => {
    expect(needsResync(4, [entry(5), entry(6)], 6)).toBe(false);
    expect(needsResync(6, [], 6)).toBe(false);
  });

  it('rejects a cursor from a different history', () => {
    expect(needsResync(9, [], 6)).toBe(true);
  });

  it('asks for a resync when retention dropped earlier changes', () => {
    expect(needsResync(1, [entry(7), entry(8)], 8)).toBe(true);
    expect(needsResync(6, [entry(7), entry(8)], 8)).toBe(false);
  });

  it('asks for a resync when the delta hits the retention cap', () => {
    const capped = Array.from({ length: CALENDAR_CHANGE_RETENTION }, (_, index) =>
      entry(index + 2),
    );
    expect(needsResync(1, capped, CALENDAR_CHANGE_RETENTION + 1)).toBe(true);
  });

  it('does not advance over missing, gapped or incomplete retained changes', () => {
    expect(needsResync(1, [], 8)).toBe(true);
    expect(needsResync(1, [entry(2), entry(4)], 4)).toBe(true);
    expect(needsResync(1, [entry(2)], 4)).toBe(true);
  });
});
