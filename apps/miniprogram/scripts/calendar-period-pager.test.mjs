import { describe, expect, it } from 'vitest';

import {
  CALENDAR_PERIOD_SWIPER_DURATION_MS,
  CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
  cancelCalendarPeriodShift,
  commitCalendarPeriodSwipe,
  createCalendarPeriodPagerState,
  finishCalendarPeriodShift,
  getAdjacentCalendarPeriodSlot,
  getCalendarPeriodSlotDelta,
  mapCalendarPeriodRing,
  prepareCalendarPeriodChange,
  requestCalendarPeriodShift,
  takeQueuedCalendarPeriodShift,
} from '../src/components/calendar/calendar-period-pager.ts';

describe('shared calendar period pager', () => {
  it('centralizes the native animation contract', () => {
    expect(CALENDAR_PERIOD_SWIPER_DURATION_MS).toBe(240);
    expect(CALENDAR_PERIOD_SWIPER_EASING_FUNCTION).toBe('easeOutCubic');
  });

  it('locks one native change and commits it once on animation finish', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe(true);
    expect(prepareCalendarPeriodChange(state, 0)).toBe(false);
    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
    expect(commitCalendarPeriodSwipe(state, 2)).toBeUndefined();
    expect(state.activeSlot).toBe(2);
    expect(state.shiftPending).toBe(true);
    expect(finishCalendarPeriodShift(state)).toEqual({ continues: false });
    expect(state.targetSlot).toBeUndefined();
    expect(state.shiftPending).toBe(false);
  });

  it('clears a native bounce without committing its target', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe(true);
    cancelCalendarPeriodShift(state);

    expect(state).toMatchObject({
      activeSlot: 1,
      shiftPending: false,
      targetSlot: undefined,
    });
    expect(commitCalendarPeriodSwipe(state, 2)).toBeUndefined();
  });

  it('queues rapid programmatic shifts and drains one month after each settle', () => {
    const state = createCalendarPeriodPagerState();

    expect(requestCalendarPeriodShift(state, 1)).toEqual({ started: true, targetSlot: 2 });
    expect(requestCalendarPeriodShift(state, 1)).toEqual({ started: false, queued: true });
    expect(state.queuedDelta).toBe(1);

    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
    expect(finishCalendarPeriodShift(state)).toEqual({ continues: true });
    expect(takeQueuedCalendarPeriodShift(state)).toBe(1);
    expect(state.queuedDelta).toBe(0);
    expect(requestCalendarPeriodShift(state, 1)).toEqual({ started: true, targetSlot: 0 });
  });

  it('uses one circular slot mapping for the home calendar and date picker', () => {
    expect(getAdjacentCalendarPeriodSlot(1, -1)).toBe(0);
    expect(getAdjacentCalendarPeriodSlot(1, 1)).toBe(2);
    expect(getCalendarPeriodSlotDelta(2, 0)).toBe(1);

    const logicalPanels = [
      { key: '2026-08', relative: -1 },
      { key: '2026-09', relative: 0 },
      { key: '2026-10', relative: 1 },
    ];
    const ring = mapCalendarPeriodRing(logicalPanels, 2);

    expect(ring.map((panel) => panel.key)).toEqual(['2026-10', '2026-08', '2026-09']);
    expect(ring.map((panel) => panel.slot)).toEqual([0, 1, 2]);
  });
});
