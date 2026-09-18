import { describe, expect, it, vi } from 'vitest';

import {
  CALENDAR_PERIOD_ARRIVAL_SETTLE_MS,
  CALENDAR_PERIOD_PROGRAMMATIC_FALLBACK_MS,
  CALENDAR_PERIOD_SCROLL_SETTLE_MS,
  CALENDAR_PERIOD_SWIPER_DURATION_MS,
  CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
  cancelCalendarPeriodShift,
  commitCalendarPeriodSwipe,
  createCalendarPeriodPaneId,
  createCalendarPeriodPagerState,
  finishCalendarPeriodShift,
  getAdjacentCalendarPeriodSlot,
  getCalendarPeriodSlotDelta,
  mapCalendarPeriodRing,
  measureCalendarPeriodPaneWidth,
  mergeCalendarPeriodScrollMetrics,
  nearestCalendarPeriodScrollSlot,
  prepareCalendarPeriodChange,
  requestCalendarPeriodShift,
  takeQueuedCalendarPeriodShift,
} from '../src/components/calendar/calendar-period-pager.ts';

describe('shared calendar period pager', () => {
  it('settles a native period scroll on the pane it actually reached', () => {
    expect(CALENDAR_PERIOD_SCROLL_SETTLE_MS).toBe(140);
    // A programmatic step knows its destination, so it may settle as soon as the
    // slide arrives; a gesture keeps the longer window for momentum gaps.
    expect(CALENDAR_PERIOD_ARRIVAL_SETTLE_MS).toBeGreaterThan(0);
    expect(CALENDAR_PERIOD_ARRIVAL_SETTLE_MS).toBeLessThan(CALENDAR_PERIOD_SCROLL_SETTLE_MS);
    // A programmatic step is settled by this bound even if the scroller reports no
    // scroll event at all, so the arrow queue can never wedge the calendar.
    expect(CALENDAR_PERIOD_PROGRAMMATIC_FALLBACK_MS).toBeGreaterThan(
      CALENDAR_PERIOD_SCROLL_SETTLE_MS,
    );
    const first = mergeCalendarPeriodScrollMetrics(undefined, {
      scrollLeft: 4536,
      scrollWidth: 13608,
    });
    expect(first).toEqual({ left: 4536, width: 4536 });
    expect(nearestCalendarPeriodScrollSlot(first)).toBe(1);
    // The ratio is unit-agnostic, so a later event only needs one axis.
    const snapped = mergeCalendarPeriodScrollMetrics(first, { scrollLeft: 0 });
    expect(snapped).toEqual({ left: 0, width: 4536 });
    expect(nearestCalendarPeriodScrollSlot(snapped)).toBe(0);
    expect(nearestCalendarPeriodScrollSlot(undefined)).toBeUndefined();
    expect(mergeCalendarPeriodScrollMetrics(undefined, {})).toBeUndefined();
    expect(createCalendarPeriodPaneId('date-pane-', 2)).toBe('date-pane-2');
  });

  it('measures the native pane width instead of trusting percentages', () => {
    vi.stubGlobal('wx', {});
    const applied = [];
    const host = (rects) => ({
      createSelectorQuery: () => ({
        select: () => ({ boundingClientRect: () => ({ exec: (cb) => cb(rects) }) }),
      }),
    });
    measureCalendarPeriodPaneWidth(host([{ width: 320.6 }]), '.pane', (width) =>
      applied.push(width),
    );
    expect(applied).toEqual([321]);
    // A missing or degenerate rect must not collapse the panes to zero.
    measureCalendarPeriodPaneWidth(host([null]), '.pane', (width) => applied.push(width));
    measureCalendarPeriodPaneWidth(host([{ width: 0 }]), '.pane', (width) => applied.push(width));
    expect(applied).toEqual([321]);
    // Without the runtime query API the helper stays inert.
    measureCalendarPeriodPaneWidth({}, '.pane', (width) => applied.push(width));
    expect(applied).toEqual([321]);
    vi.unstubAllGlobals();
  });

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
