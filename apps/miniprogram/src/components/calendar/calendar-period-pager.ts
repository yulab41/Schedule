export type CalendarPeriodSlot = 0 | 1 | 2;
export type CalendarPeriodRelative = -1 | 0 | 1;

export const CALENDAR_PERIOD_SWIPER_DURATION_MS = 240;
export const CALENDAR_PERIOD_SWIPER_EASING_FUNCTION = 'easeOutCubic';
export const CALENDAR_PERIOD_HEIGHT_TRANSITION = 'cubic-bezier(0.33, 1, 0.68, 1)';

export interface CalendarPeriodPagerState {
  activeSlot: CalendarPeriodSlot;
  targetSlot: CalendarPeriodSlot | undefined;
  shiftPending: boolean;
  queuedDelta: number;
}

export function createCalendarPeriodPagerState(
  activeSlot: CalendarPeriodSlot = 1,
): CalendarPeriodPagerState {
  return {
    activeSlot,
    queuedDelta: 0,
    shiftPending: false,
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

export function prepareCalendarPeriodChange(
  state: CalendarPeriodPagerState,
  targetSlot: number,
): boolean {
  if (
    !isCalendarPeriodSlot(targetSlot) ||
    state.shiftPending ||
    state.targetSlot !== undefined ||
    targetSlot === state.activeSlot
  ) {
    return false;
  }
  const delta = getCalendarPeriodSlotDelta(state.activeSlot, targetSlot);
  if (delta === 0) return false;
  state.targetSlot = targetSlot;
  return true;
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
  if (state.shiftPending || state.targetSlot !== undefined) {
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
): { readonly current: CalendarPeriodSlot; readonly delta: -1 | 1 } | undefined {
  if (!isCalendarPeriodSlot(current) || state.shiftPending || state.targetSlot !== current) {
    return undefined;
  }
  const delta = getCalendarPeriodSlotDelta(state.activeSlot, current);
  if (delta === 0) return undefined;
  state.activeSlot = current;
  state.shiftPending = true;
  return { current, delta };
}

export function cancelCalendarPeriodShift(state: CalendarPeriodPagerState): void {
  state.targetSlot = undefined;
  state.shiftPending = false;
}

export function finishCalendarPeriodShift(state: CalendarPeriodPagerState): {
  readonly continues: boolean;
} {
  state.targetSlot = undefined;
  state.shiftPending = false;
  return { continues: state.queuedDelta !== 0 };
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
