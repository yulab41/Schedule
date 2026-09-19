export type CalendarPeriodSlot = 0 | 1 | 2;
export type CalendarPeriodRelative = -1 | 0 | 1;

export const CALENDAR_PERIOD_SWIPER_DURATION_MS = 240;
export const CALENDAR_PERIOD_SWIPER_EASING_FUNCTION = 'easeOutCubic';
export interface CalendarPeriodPagerState {
  /** Ring slot that currently renders the logical current period. */
  activeSlot: CalendarPeriodSlot;
  /**
   * Latest slot the native swiper reported through its change event. It may lead
   * `activeSlot` while a period patch is still being applied.
   */
  swiperSlot: CalendarPeriodSlot;
  /**
   * Signed period steps the native swiper has moved since the last commit or
   * adopt. Rapid swipes produce one change event per index transition, so the
   * accumulated steps keep every gesture even when the animation finishes
   * arrive interleaved and the ring can only show one step at a time.
   */
  steps: number;
  targetSlot: CalendarPeriodSlot | undefined;
  shiftPending: boolean;
  queuedDelta: number;
}

export interface CalendarPeriodCommit {
  readonly current: CalendarPeriodSlot;
  readonly delta: number;
}

export function createCalendarPeriodPagerState(
  activeSlot: CalendarPeriodSlot = 1,
): CalendarPeriodPagerState {
  return {
    activeSlot,
    queuedDelta: 0,
    shiftPending: false,
    steps: 0,
    swiperSlot: activeSlot,
    targetSlot: undefined,
  };
}

export function isCalendarPeriodSlot(value: number): value is CalendarPeriodSlot {
  return value === 0 || value === 1 || value === 2;
}

export function getAdjacentCalendarPeriodSlot(
  activeSlot: CalendarPeriodSlot,
  delta: -1 | 1,
): CalendarPeriodSlot {
  return ((activeSlot + delta + 3) % 3) as CalendarPeriodSlot;
}

export function getCalendarPeriodSlotDelta(
  activeSlot: CalendarPeriodSlot,
  targetSlot: CalendarPeriodSlot,
): -1 | 0 | 1 {
  if (getAdjacentCalendarPeriodSlot(activeSlot, 1) === targetSlot) return 1;
  if (getAdjacentCalendarPeriodSlot(activeSlot, -1) === targetSlot) return -1;
  return 0;
}

export type CalendarPeriodPrepareResult = 'ignored' | 'locked' | 'tracked';

/**
 * Records the slot the native swiper reported through its change event and
 * accumulates the signed step it represents.
 *
 * `locked` engages the height transition as well. `tracked` only remembers the
 * reported slot, which is what a swipe that arrives during an in-flight period
 * patch needs: its animation finish must still be able to queue the step instead
 * of being discarded as a replay. Nothing is recorded when the swiper did not
 * move, so stale/replayed events cannot move the ring.
 */
export function prepareCalendarPeriodChange(
  state: CalendarPeriodPagerState,
  targetSlot: number,
): CalendarPeriodPrepareResult {
  if (!isCalendarPeriodSlot(targetSlot) || targetSlot === state.swiperSlot) return 'ignored';
  const step = getCalendarPeriodSlotDelta(state.swiperSlot, targetSlot);
  if (step === 0) return 'ignored';
  state.swiperSlot = targetSlot;
  state.steps = clampCalendarPeriodQueue(state.steps + step);
  const lockable = !state.shiftPending && state.targetSlot === undefined;
  if (lockable) state.targetSlot = targetSlot;
  return lockable ? 'locked' : 'tracked';
}

export function requestCalendarPeriodShift(
  state: CalendarPeriodPagerState,
  delta: -1 | 1,
):
  | { readonly started: true; readonly targetSlot: CalendarPeriodSlot }
  | {
      readonly queued: true;
      readonly started: false;
    } {
  if (state.shiftPending || state.targetSlot !== undefined || state.steps !== 0) {
    state.queuedDelta = clampCalendarPeriodQueue(state.queuedDelta + delta);
    return { queued: true, started: false };
  }
  const targetSlot = getAdjacentCalendarPeriodSlot(state.activeSlot, delta);
  state.targetSlot = targetSlot;
  return { started: true, targetSlot };
}

export function commitCalendarPeriodSwipe(
  state: CalendarPeriodPagerState,
  current: number,
): CalendarPeriodCommit | undefined {
  if (!isCalendarPeriodSlot(current)) return undefined;
  state.targetSlot = undefined;
  // Nothing has moved since the last commit/adopt: this is a replayed or
  // cancelled animation finish, so it must not move the ring.
  if (state.steps === 0) return undefined;
  // The previous period patch is still in flight: keep the accumulated steps and
  // let the settle adopt them instead of dropping them.
  if (state.shiftPending) return undefined;
  const delta = state.steps;
  state.steps = 0;
  state.activeSlot = state.swiperSlot;
  state.shiftPending = true;
  return { current: state.activeSlot, delta };
}

export function cancelCalendarPeriodShift(state: CalendarPeriodPagerState): void {
  // Only the prepared height transition is cancelled here; an in-flight month
  // patch keeps `shiftPending` until the page reports it has applied the data.
  state.targetSlot = undefined;
}

export type CalendarPeriodSettle =
  | { readonly adopt: CalendarPeriodCommit; readonly continues: false }
  | { readonly adopt: undefined; readonly continues: boolean };

export function finishCalendarPeriodShift(state: CalendarPeriodPagerState): CalendarPeriodSettle {
  state.targetSlot = undefined;
  state.shiftPending = false;
  if (state.steps !== 0) {
    // The user kept swiping while the previous patch was applying; adopt every
    // accumulated step in one commit instead of leaving the ring behind.
    const delta = state.steps;
    state.steps = 0;
    state.activeSlot = state.swiperSlot;
    state.shiftPending = true;
    return { adopt: { current: state.activeSlot, delta }, continues: false };
  }
  return { adopt: undefined, continues: state.queuedDelta !== 0 };
}

export function takeQueuedCalendarPeriodShift(state: CalendarPeriodPagerState): -1 | 0 | 1 {
  if (state.queuedDelta === 0) return 0;
  const delta: -1 | 1 = state.queuedDelta < 0 ? -1 : 1;
  state.queuedDelta -= delta;
  return delta;
}

export function mapCalendarPeriodRing<T extends { readonly relative: CalendarPeriodRelative }>(
  logicalPanels: readonly T[],
  activeSlot: CalendarPeriodSlot,
): readonly (T & { readonly slot: CalendarPeriodSlot })[] {
  const panelByRelative = new Map<CalendarPeriodRelative, T>(
    logicalPanels.map((panel) => [panel.relative, panel]),
  );
  const currentPanel = panelByRelative.get(0);
  const nextPanel = panelByRelative.get(1);
  const previousPanel = panelByRelative.get(-1);
  if (currentPanel === undefined || nextPanel === undefined || previousPanel === undefined) {
    return logicalPanels.map((panel, slot) => ({
      ...panel,
      slot: Math.min(2, slot) as CalendarPeriodSlot,
    }));
  }
  const nextSlot = getAdjacentCalendarPeriodSlot(activeSlot, 1);
  const previousSlot = getAdjacentCalendarPeriodSlot(activeSlot, -1);
  const ring = new Array<T & { readonly slot: CalendarPeriodSlot }>(3);
  ring[activeSlot] = { ...currentPanel, slot: activeSlot };
  ring[nextSlot] = { ...nextPanel, slot: nextSlot };
  ring[previousSlot] = { ...previousPanel, slot: previousSlot };
  return ring;
}

export function placeCalendarPeriodTarget<
  T extends { readonly relative: CalendarPeriodRelative; readonly slot: CalendarPeriodSlot },
>(ring: readonly T[], activeSlot: CalendarPeriodSlot, delta: -1 | 1, target: T): readonly T[] {
  const targetSlot = getAdjacentCalendarPeriodSlot(activeSlot, delta);
  return ring.map((panel) =>
    panel.slot === targetSlot ? { ...target, relative: delta, slot: targetSlot } : panel,
  );
}

function clampCalendarPeriodQueue(value: number): number {
  return Math.max(-6, Math.min(6, value));
}
