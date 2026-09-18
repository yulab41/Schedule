import {
  CALENDAR_PERIOD_ARRIVAL_SETTLE_MS,
  CALENDAR_PERIOD_PROGRAMMATIC_FALLBACK_MS,
  CALENDAR_PERIOD_SCROLL_SETTLE_MS,
  CALENDAR_PERIOD_SWIPER_DURATION_MS,
  CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
  cancelCalendarPeriodShift,
  commitCalendarPeriodSwipe,
  createCalendarPeriodPaneId,
  finishCalendarPeriodShift,
  getAdjacentCalendarPeriodSlot,
  isCalendarPeriodSlot,
  measureCalendarPeriodPaneWidth,
  mergeCalendarPeriodScrollMetrics,
  nearestCalendarPeriodScrollSlot,
  prepareCalendarPeriodChange,
  requestCalendarPeriodShift,
  takeQueuedCalendarPeriodShift,
  type CalendarPeriodPagerState,
  type CalendarPeriodScrollDetail,
  type CalendarPeriodScrollMetrics,
  type CalendarPeriodSlot,
} from '../calendar-period-pager.js';
import { needsCurrentRuntimeSkyline3172UiCompatibility } from '../../../platform/runtime-ui-compatibility.js';

interface MonthSwipeEvent {
  readonly detail: { readonly current: number };
}

interface MonthScrollEvent {
  readonly detail: CalendarPeriodScrollDetail;
}

interface MonthChangeStartEvent {
  readonly detail: { readonly current: number };
}

interface CalendarSelectEvent {
  readonly detail: { readonly businessDate: string };
}

type MonthSlot = CalendarPeriodSlot;

interface CalendarMonthInstance {
  _compatGesture?: boolean;
  _compatGestureDelta?: -1 | 0 | 1 | undefined;
  _compatCommittedDelta?: -1 | 0 | 1 | undefined;
  _compatCleanupPanes?: readonly unknown[] | undefined;
  _compatCleanupTimer?: ReturnType<typeof setTimeout>;
  _compatPendingDelta?: -1 | 0 | 1 | undefined;
  _compatMetrics?: CalendarPeriodScrollMetrics | undefined;
  _compatRequestedDelta?: -1 | 0 | 1 | undefined;
  _compatTimer?: ReturnType<typeof setTimeout>;
  _monthActiveSlot: MonthSlot;
  _monthHeightTargetIndex: MonthSlot | undefined;
  _monthShiftPending: boolean;
  _queuedMonthDelta: number;
  createSelectorQuery?(): MiniProgramSelectorQuery;
  readonly data: {
    readonly locateAnimating: boolean;
    readonly compatPanes: readonly unknown[];
    readonly pagerAnimated: boolean;
    readonly pagerTarget: string;
    readonly paneStyle: string;
    readonly panelHeights?: readonly number[];
    readonly skyline3172UiCompatibility: boolean;
    readonly stepMotion: string;
    readonly swiperCurrent: number;
    readonly swiperDuration: number;
    readonly swiperEasingFunction: string;
    readonly viewportHeight: number;
  };
  continueQueuedShift(): void;
  finishPeriodShift(): void;
  readonly properties: {
    readonly gridHeight: number;
    readonly panels: readonly { readonly relative: number }[];
  };
  startProgrammaticShift(delta: -1 | 1, targetHeight?: number): void;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    shadow: { type: Boolean, value: true },
    compact: { type: Boolean, value: false },
    runtimePressedFeedbackCompatibility: { type: Boolean, value: false },
    gridHeight: { type: Number, value: 270 },
    monthLabel: { type: String, value: '' },
    panelHeights: { type: Array, value: [270, 270, 270] },
    panels: { type: Array, value: [] },
  },
  data: {
    locateAnimating: false,
    compatPanes: [] as readonly unknown[],
    pagerAnimated: false,
    pagerTarget: createCalendarPeriodPaneId('month-pane-', 1),
    paneStyle: '',
    skyline3172UiCompatibility: needsCurrentRuntimeSkyline3172UiCompatibility(),
    stepMotion: '',
    swiperCurrent: 1,
    swiperDuration: CALENDAR_PERIOD_SWIPER_DURATION_MS,
    swiperEasingFunction: CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
    viewportHeight: 270,
  },
  observers: {
    'panels, skyline3172UiCompatibility'(this: CalendarMonthInstance): void {
      syncCompatPanes(this);
    },
    gridHeight(this: CalendarMonthInstance, value: number): void {
      // A compat step owns the height for its whole duration: the swipe sets the
      // target height up front so the platform can transition it while the month
      // is still moving, and a second writer would restart that transition.
      if (
        this.data.skyline3172UiCompatibility &&
        (this._compatRequestedDelta !== undefined || this._compatCleanupPanes !== undefined)
      ) {
        return;
      }
      if (
        !this._monthShiftPending &&
        this._monthHeightTargetIndex === undefined &&
        value !== this.data.viewportHeight
      ) {
        this.setData({ viewportHeight: value });
      }
    },
  },
  lifetimes: {
    attached(this: CalendarMonthInstance): void {
      this._monthActiveSlot = 1;
      this._monthHeightTargetIndex = undefined;
      this._monthShiftPending = false;
      this._queuedMonthDelta = 0;
      measureCompatPanes(this);
    },
  },
  methods: {
    measurePanes(this: CalendarMonthInstance): void {
      measureCompatPanes(this);
    },
    handleMonthChangeStart(this: CalendarMonthInstance, event: MonthChangeStartEvent): void {
      const { current } = event.detail;
      const state = readMonthPagerState(this);
      if (!prepareCalendarPeriodChange(state, current)) return;
      writeMonthPagerState(this, state);
      const viewportHeight = this.data.panelHeights?.[current] ?? 270;
      if (viewportHeight !== this.data.viewportHeight) this.setData({ viewportHeight });
    },
    handleMonthSwipe(this: CalendarMonthInstance, event: MonthSwipeEvent): void {
      finishMonthSwipeAt(this, event.detail.current);
    },
    startProgrammaticShift(
      this: CalendarMonthInstance,
      delta: -1 | 1,
      targetHeight?: number,
    ): void {
      const state = readMonthPagerState(this);
      const request = requestCalendarPeriodShift(state, delta);
      writeMonthPagerState(this, state);
      if (!request.started) return;
      const targetIndex = request.targetSlot;
      this.setData({ stepMotion: '' }, () => {
        const next: Record<string, unknown> = {
          stepMotion: delta < 0 ? 'previous' : 'next',
          viewportHeight: targetHeight ?? this.data.panelHeights?.[targetIndex] ?? 270,
        };
        if (this.data.skyline3172UiCompatibility) {
          // The affected runtime cannot animate a programmatic swiper jump, so
          // the month slides one native panel and settles when the scroll stops.
          // The panes are laid out physically (previous | current | next), so the
          // slide always travels the way the month does.
          this._compatRequestedDelta = delta;
          // A step must never depend on a scroll event that may not arrive: the
          // native scroller only reports while it actually moves, so a step whose
          // scroll target did not change would never settle and the queue would
          // wedge. The arrival window still wins whenever the slide does report.
          scheduleCompatPagerSettle(this, CALENDAR_PERIOD_PROGRAMMATIC_FALLBACK_MS);
          // The height lands in its own update, before the scroll target is set:
          // the platform defers a height transition on a node that is already
          // running a smooth scroll, which reads as the height settling only
          // after the slide is home. Writing it first keeps the two in step.
          this.setData({ viewportHeight: next.viewportHeight }, () => {
            const startSlide = (): void => {
              this.setData({
                stepMotion: next.stepMotion,
                pagerAnimated: true,
                pagerTarget: createCalendarPeriodPaneId('month-pane-', delta < 0 ? 0 : 2),
              });
            };
            // Both leads go through the next frame: the height has to be rendering
            // before the scroll animation starts, and a scroller that is still
            // stranded on a side pane has to be home first, otherwise the step
            // re-issues a scroll target it already sits on and travels nowhere.
            const nextTick = (
              wx as unknown as { readonly nextTick?: (callback: () => void) => void }
            ).nextTick;
            const nextFrame = (action: () => void): void => {
              if (nextTick === undefined) action();
              else nextTick(action);
            };
            // A step that starts while the scroller is still on a side pane would
            // re-issue the same scroll target and travel nowhere, so it is sent
            // home first; a queued burst keeps animating one panel per step.
            if (compatPaneDelta(this) !== 0) {
              this.setData(
                { pagerAnimated: false, pagerTarget: createCalendarPeriodPaneId('month-pane-', 1) },
                () => nextFrame(startSlide),
              );
              return;
            }
            nextFrame(startSlide);
          });
          return;
        }
        this.setData({
          ...next,
          swiperCurrent: targetIndex,
          swiperDuration: CALENDAR_PERIOD_SWIPER_DURATION_MS,
        });
      });
    },
    handlePagerTouchStart(this: CalendarMonthInstance): void {
      this._compatGesture = true;
    },
    handlePagerScroll(this: CalendarMonthInstance, event: MonthScrollEvent): void {
      this._compatMetrics = mergeCalendarPeriodScrollMetrics(this._compatMetrics, event.detail);
      if (nearestCalendarPeriodScrollSlot(this._compatMetrics) === 1) {
        finishCompatPaneCleanup(this);
      }
      if (this._compatGesture === true) prepareCompatPagerTarget(this);
      // A programmatic step knows the pane it is travelling to, so it settles as
      // soon as the slide has arrived there instead of waiting out the longer
      // gesture window.
      const requested = this._compatRequestedDelta;
      if (requested !== undefined && requested === compatPaneDelta(this)) {
        scheduleCompatPagerSettle(this, CALENDAR_PERIOD_ARRIVAL_SETTLE_MS);
        return;
      }
      scheduleCompatPagerSettle(this);
    },
    handlePagerTouchEnd(this: CalendarMonthInstance): void {
      this._compatGesture = false;
      scheduleCompatPagerSettle(this);
    },
    finishPeriodShift(this: CalendarMonthInstance): void {
      const state = readMonthPagerState(this);
      const settled = finishCalendarPeriodShift(state);
      writeMonthPagerState(this, state);
      this.triggerEvent('monthsettled', { continues: settled.continues });
    },
    continueQueuedShift(this: CalendarMonthInstance): void {
      const state = readMonthPagerState(this);
      const delta = takeQueuedCalendarPeriodShift(state);
      writeMonthPagerState(this, state);
      if (delta === 0) return;
      this.startProgrammaticShift(delta);
    },
    handlePrevious(this: CalendarMonthInstance): void {
      this.startProgrammaticShift(-1);
    },
    handleNext(this: CalendarMonthInstance): void {
      this.startProgrammaticShift(1);
    },
    handleLocateToday(this: CalendarMonthInstance): void {
      this.setData({ locateAnimating: false }, () => {
        this.setData({ locateAnimating: true });
        this.triggerEvent('locatetoday');
      });
    },
    handleCellSelect(this: CalendarMonthInstance, event: CalendarSelectEvent): void {
      this.triggerEvent('select', event.detail);
    },
  },
});

// The native scroller pages by position, not by ring slot, so the affected
// runtime keeps its three panes in a fixed physical order (previous | current |
// next) and is re-centred on the middle pane after every committed step.
function syncCompatPanes(instance: CalendarMonthInstance): void {
  if (!instance.data.skyline3172UiCompatibility) return;
  const panels = instance.properties.panels as readonly { readonly relative: number }[];
  const byRelative = new Map(panels.map((panel) => [panel.relative, panel]));
  const ordered = [-1, 0, 1].map((relative, index) => byRelative.get(relative) ?? panels[index]);
  // The pane the user is actually looking at keeps its month through the commit
  // and the jump home, so no frame can ever show a neighbouring month's cells:
  // a step right leaves the right pane on the new month, a step left the left one.
  const delta = instance._compatCommittedDelta ?? instance._compatPendingDelta ?? 0;
  instance._compatCommittedDelta = undefined;
  const cleanupPending = instance._compatCleanupPanes !== undefined;
  const panes =
    delta === 1
      ? [ordered[0], ordered[1], ordered[1]]
      : delta === -1
        ? [ordered[1], ordered[1], ordered[2]]
        : ordered;
  // The clean ring is swapped in only once the scroll has actually landed home,
  // so the pane the user can still see never changes month underneath them.
  if (delta !== 0) {
    instance._compatCleanupPanes = ordered;
    instance._compatPendingDelta = delta;
    // A missing scroll event must not wedge the ring on a side pane: the host
    // height stays parked for as long as a settle is pending, and a wedged ring
    // would leave the next step with an unchanged scroll target (no slide at all).
    scheduleCompatPaneCleanup(instance);
  }
  instance.setData({ compatPanes: panes }, () => {
    if (cleanupPending) return;
    if (instance._compatRequestedDelta !== undefined) return;
    recenterCompatPanes(instance);
  });
}

function compatPaneDelta(instance: CalendarMonthInstance): -1 | 0 | 1 {
  const pane = nearestCalendarPeriodScrollSlot(instance._compatMetrics);
  if (pane === undefined || pane === 1) return 0;
  return pane === 0 ? -1 : 1;
}

function measureCompatPanes(instance: CalendarMonthInstance): void {
  if (!instance.data.skyline3172UiCompatibility) return;
  measureCalendarPeriodPaneWidth(instance, '.calendar-motion-viewport.is-compat', (width) => {
    const paneStyle = `width:${width}px`;
    if (instance.data.paneStyle !== paneStyle) instance.setData({ paneStyle });
  });
}

// A gesture swipe has no queued target, so the panel the native scroll settled
// on is prepared here — the same preparation the swiper gets from its change
// event — and the grid height follows it.
function prepareCompatPagerTarget(instance: CalendarMonthInstance): void {
  const delta = compatPaneDelta(instance);
  if (delta !== instance._compatGestureDelta && delta !== 0) {
    // Height follows the swipe instead of trailing it: the platform transitions it
    // while the finger is still moving, so it lands together with the month.
    const current = readMonthPagerState(instance);
    const targetSlot = getAdjacentCalendarPeriodSlot(current.activeSlot, delta);
    const viewportHeight = instance.data.panelHeights?.[targetSlot] ?? 270;
    if (viewportHeight !== instance.data.viewportHeight) instance.setData({ viewportHeight });
  }
  instance._compatGestureDelta = delta;
  if (delta === 0) return;
  const state = readMonthPagerState(instance);
  const slot = getAdjacentCalendarPeriodSlot(state.activeSlot, delta);
  prepareCalendarPeriodChange(state, slot);
  writeMonthPagerState(instance, state);
}

// Re-centring is a `setData` of the scroll target only; doing it while a drag is
// still reporting would fight the finger and re-render on every frame.
function recenterCompatPanes(instance: CalendarMonthInstance): void {
  const width = instance._compatMetrics?.width;
  if (width !== undefined) instance._compatMetrics = { left: width, width };
  instance.setData({
    pagerAnimated: false,
    pagerTarget: createCalendarPeriodPaneId('month-pane-', 1),
  });
  scheduleCompatPaneCleanup(instance);
}

function clearCompatPaneCleanup(instance: CalendarMonthInstance): void {
  if (instance._compatCleanupTimer !== undefined) {
    clearTimeout(instance._compatCleanupTimer);
    instance._compatCleanupTimer = undefined;
  }
}

function scheduleCompatPaneCleanup(instance: CalendarMonthInstance): void {
  if (!instance.data.skyline3172UiCompatibility) return;
  if (instance._compatCleanupPanes === undefined) return;
  clearCompatPaneCleanup(instance);
  instance._compatCleanupTimer = setTimeout(() => {
    instance._compatCleanupTimer = undefined;
    finishCompatPaneCleanup(instance);
  }, CALENDAR_PERIOD_SCROLL_SETTLE_MS);
}

// Swapping the clean ring in is only safe once the scroller is home, because the
// pane the user is looking at must keep its month through the swap. A step that
// is still in flight owns the scroller, and a re-centre that was skipped while a
// settle was pending leaves it on a side pane; both cases are retried instead of
// swapping. When the swap does happen the host height is applied as well, because
// its observer stays parked for as long as a settle is pending.
function finishCompatPaneCleanup(instance: CalendarMonthInstance): void {
  const cleanup = instance._compatCleanupPanes;
  if (cleanup === undefined) return;
  if (instance._compatRequestedDelta !== undefined || instance._compatGesture === true) {
    scheduleCompatPaneCleanup(instance);
    return;
  }
  if (compatPaneDelta(instance) !== 0) {
    recenterCompatPanes(instance);
    return;
  }
  clearCompatPaneCleanup(instance);
  instance._compatCleanupPanes = undefined;
  instance._compatPendingDelta = undefined;
  instance.setData({ compatPanes: cleanup }, () => {
    const gridHeight = instance.properties.gridHeight;
    if (gridHeight !== undefined && gridHeight !== instance.data.viewportHeight) {
      instance.setData({ viewportHeight: gridHeight });
    }
  });
}

function clearCompatPagerSettle(instance: CalendarMonthInstance): void {
  if (instance._compatTimer !== undefined) {
    clearTimeout(instance._compatTimer);
    instance._compatTimer = undefined;
  }
}

function scheduleCompatPagerSettle(
  instance: CalendarMonthInstance,
  delay = CALENDAR_PERIOD_SCROLL_SETTLE_MS,
): void {
  clearCompatPagerSettle(instance);
  instance._compatTimer = setTimeout(() => {
    instance._compatTimer = undefined;
    settleCompatPagerScroll(instance);
  }, delay);
}

function settleCompatPagerScroll(instance: CalendarMonthInstance): void {
  if (!instance.data.skyline3172UiCompatibility) return;
  const requested = instance._compatRequestedDelta;
  instance._compatRequestedDelta = undefined;
  prepareCompatPagerTarget(instance);
  const delta = requested ?? instance._compatGestureDelta ?? compatPaneDelta(instance);
  instance._compatGestureDelta = undefined;
  if (delta === 0) {
    recenterCompatPanes(instance);
    return;
  }
  const state = readMonthPagerState(instance);
  const slot = getAdjacentCalendarPeriodSlot(state.activeSlot, delta);
  if (state.targetSlot !== slot) {
    // A previous step is still loading: queue this one so a fast series of
    // swipes keeps stepping as soon as the content arrives, then re-centre so
    // the scroll is never stranded on a side pane.
    requestCalendarPeriodShift(state, delta);
    writeMonthPagerState(instance, state);
    recenterCompatPanes(instance);
    return;
  }
  instance._compatCommittedDelta = delta;
  finishMonthSwipeAt(instance, slot);
}

function readMonthPagerState(instance: CalendarMonthInstance): CalendarPeriodPagerState {
  return {
    activeSlot: instance._monthActiveSlot ?? 1,
    queuedDelta: instance._queuedMonthDelta ?? 0,
    shiftPending: instance._monthShiftPending ?? false,
    targetSlot: instance._monthHeightTargetIndex,
  };
}

function finishMonthSwipeAt(instance: CalendarMonthInstance, current: number): void {
  const state = readMonthPagerState(instance);
  if (!isCalendarPeriodSlot(current)) return;
  if (current === state.activeSlot) {
    if (state.targetSlot === undefined) return;
    cancelCalendarPeriodShift(state);
    writeMonthPagerState(instance, state);
    const viewportHeight = instance.data.panelHeights?.[state.activeSlot] ?? 270;
    if (viewportHeight !== instance.data.viewportHeight) instance.setData({ viewportHeight });
    return;
  }
  const committed = commitCalendarPeriodSwipe(state, current);
  if (committed === undefined) return;
  writeMonthPagerState(instance, state);
  instance.setData({ swiperCurrent: current }, () => {
    instance.triggerEvent('monthchange', committed);
  });
}

function writeMonthPagerState(
  instance: CalendarMonthInstance,
  state: CalendarPeriodPagerState,
): void {
  instance._monthActiveSlot = state.activeSlot;
  instance._monthHeightTargetIndex = state.targetSlot;
  instance._monthShiftPending = state.shiftPending;
  instance._queuedMonthDelta = state.queuedDelta;
}
