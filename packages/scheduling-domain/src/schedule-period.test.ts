import { describe, expect, it } from 'vitest';

import {
  assertSchedulePeriodTransition,
  canTransitionSchedulePeriod,
  type SchedulePeriodStatus,
} from './schedule-period.js';

describe('schedule period state transitions', () => {
  it('allows a draft to be submitted or published and a published period to be replaced', () => {
    expect(canTransitionSchedulePeriod('draft', 'pending_publication')).toBe(true);
    expect(canTransitionSchedulePeriod('draft', 'published')).toBe(true);
    expect(canTransitionSchedulePeriod('published', 'replaced')).toBe(true);
    expect(() => assertSchedulePeriodTransition('pending_publication', 'published')).not.toThrow();
  });

  it.each([
    ['published', 'draft'],
    ['withdrawn', 'published'],
    ['replaced', 'published'],
  ] as const satisfies readonly (readonly [SchedulePeriodStatus, SchedulePeriodStatus])[])(
    'rejects %s to %s',
    (from, to) => {
      expect(canTransitionSchedulePeriod(from, to)).toBe(false);
      expect(() => assertSchedulePeriodTransition(from, to)).toThrow('cannot transition');
    },
  );
});
