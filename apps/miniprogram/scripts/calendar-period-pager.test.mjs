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

    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
    expect(commitCalendarPeriodSwipe(state, 2)).toBeUndefined();
    expect(state.activeSlot).toBe(2);
    expect(state.steps).toBe(0);
    expect(state.swiperSlot).toBe(2);
    expect(state.shiftPending).toBe(true);
    expect(finishCalendarPeriodShift(state)).toEqual({ adopt: undefined, continues: false });
    expect(state.targetSlot).toBeUndefined();
    expect(state.shiftPending).toBe(false);
  });

  it('ignores a replayed animation finish that no native change reported', () => {
    const state = createCalendarPeriodPagerState();

    expect(commitCalendarPeriodSwipe(state, 2)).toBeUndefined();
    expect(state).toMatchObject({
      activeSlot: 1,
      shiftPending: false,
      steps: 0,
      swiperSlot: 1,
      targetSlot: undefined,
    });
  });

  it('accumulates one signed step for every native change report', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(prepareCalendarPeriodChange(state, 0)).toBe('tracked');
    expect(prepareCalendarPeriodChange(state, 1)).toBe('tracked');
    expect(state.swiperSlot).toBe(1);
    expect(state.steps).toBe(3);
    expect(commitCalendarPeriodSwipe(state, 1)).toEqual({ current: 1, delta: 3 });
  });

  it('keeps five rapid forward swipes advancing five months', () => {
    const state = createCalendarPeriodPagerState();

    // 150ms between swipes with a 240ms animation: changes and finishes
    // interleave, so the ring can only show one step at a time.
    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
    expect(prepareCalendarPeriodChange(state, 0)).toBe('tracked');
    expect(prepareCalendarPeriodChange(state, 1)).toBe('tracked');
    // The previous month patch is still applying, so this finish is queued.
    expect(commitCalendarPeriodSwipe(state, 0)).toBeUndefined();
    expect(state.steps).toBe(2);
    expect(prepareCalendarPeriodChange(state, 2)).toBe('tracked');
    expect(commitCalendarPeriodSwipe(state, 1)).toBeUndefined();
    expect(prepareCalendarPeriodChange(state, 0)).toBe('tracked');
    expect(commitCalendarPeriodSwipe(state, 2)).toBeUndefined();
    expect(state.swiperSlot).toBe(0);
    expect(state.steps).toBe(4);

    // The settle adopts every queued step instead of dropping them.
    expect(finishCalendarPeriodShift(state)).toEqual({
      adopt: { current: 0, delta: 4 },
      continues: false,
    });
    expect(state.activeSlot).toBe(0);
    expect(state.steps).toBe(0);
    expect(finishCalendarPeriodShift(state)).toEqual({ adopt: undefined, continues: false });
  });

  it('clamps accumulated steps instead of overflowing the queue', () => {
    const state = createCalendarPeriodPagerState();

    // Keep walking forward in ring order: 1 -> 2 -> 0 -> 1 ...
    let slot = 1;
    for (let index = 0; index < 20; index += 1) {
      slot = (slot + 1) % 3;
      prepareCalendarPeriodChange(state, slot);
    }
    expect(Math.abs(state.steps)).toBeLessThanOrEqual(6);
  });

  it('tracks a later native report without a fresh prepare', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(prepareCalendarPeriodChange(state, 0)).toBe('tracked');
    expect(state.swiperSlot).toBe(0);
    expect(state.steps).toBe(2);
    expect(commitCalendarPeriodSwipe(state, 0)).toEqual({ current: 0, delta: 2 });
  });

  it('cancels a swipe that returns to its origin', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(state.steps).toBe(1);
    expect(prepareCalendarPeriodChange(state, 1)).toBe('tracked');

    expect(state).toMatchObject({
      activeSlot: 1,
      shiftPending: false,
      steps: 0,
      swiperSlot: 1,
    });
    expect(commitCalendarPeriodSwipe(state, 1)).toBeUndefined();
    expect(state.targetSlot).toBeUndefined();
  });

  it('clears only the prepared height target without discarding recorded movement', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(state.targetSlot).toBe(2);
    cancelCalendarPeriodShift(state);
    expect(state.targetSlot).toBeUndefined();
    expect(state.steps).toBe(1);
    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
  });

  it('queues rapid programmatic shifts and drains one month after each settle', () => {
    const state = createCalendarPeriodPagerState();

    expect(requestCalendarPeriodShift(state, 1)).toEqual({ started: true, targetSlot: 2 });
    expect(requestCalendarPeriodShift(state, 1)).toEqual({ started: false, queued: true });
    expect(state.queuedDelta).toBe(1);

    // The native swiper reports the prepared target before its animation ends.
    expect(prepareCalendarPeriodChange(state, 2)).toBe('tracked');
    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
    expect(finishCalendarPeriodShift(state)).toEqual({ adopt: undefined, continues: true });
    expect(takeQueuedCalendarPeriodShift(state)).toBe(1);
    expect(state.queuedDelta).toBe(0);
    expect(requestCalendarPeriodShift(state, 1)).toEqual({ started: true, targetSlot: 0 });
  });

  it('adopts native swipes that land while the previous month patch is still applying', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
    expect(state.shiftPending).toBe(true);

    // The user keeps swiping forward before the page has applied month `+1`.
    // The steps must be queued instead of dropped, which would leave the ring
    // anchor behind the visible slot and later report a backward month.
    expect(prepareCalendarPeriodChange(state, 0)).toBe('tracked');
    expect(commitCalendarPeriodSwipe(state, 0)).toBeUndefined();
    expect(state.swiperSlot).toBe(0);
    expect(state.steps).toBe(1);
    expect(prepareCalendarPeriodChange(state, 1)).toBe('tracked');
    expect(commitCalendarPeriodSwipe(state, 1)).toBeUndefined();
    expect(state.swiperSlot).toBe(1);
    expect(state.steps).toBe(2);

    expect(finishCalendarPeriodShift(state)).toEqual({
      adopt: { current: 1, delta: 2 },
      continues: false,
    });
    expect(state.activeSlot).toBe(1);
    expect(state.steps).toBe(0);
    expect(state.shiftPending).toBe(true);

    expect(finishCalendarPeriodShift(state)).toEqual({ adopt: undefined, continues: false });
    expect(state.shiftPending).toBe(false);
  });

  it('reports a forward step for every forward swipe even right after a settle', () => {
    const state = createCalendarPeriodPagerState();

    expect(prepareCalendarPeriodChange(state, 2)).toBe('locked');
    expect(commitCalendarPeriodSwipe(state, 2)).toEqual({ current: 2, delta: 1 });
    expect(finishCalendarPeriodShift(state)).toEqual({ adopt: undefined, continues: false });
    expect(prepareCalendarPeriodChange(state, 0)).toBe('locked');
    expect(commitCalendarPeriodSwipe(state, 0)).toEqual({ current: 0, delta: 1 });
    expect(finishCalendarPeriodShift(state)).toEqual({ adopt: undefined, continues: false });
    expect(prepareCalendarPeriodChange(state, 1)).toBe('locked');
    expect(commitCalendarPeriodSwipe(state, 1)).toEqual({ current: 1, delta: 1 });
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
