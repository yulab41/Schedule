import {
  CALENDAR_PERIOD_ARRIVAL_SETTLE_MS,
  CALENDAR_PERIOD_HEIGHT_TRANSITION,
  CALENDAR_PERIOD_SLIDE_SETTLE_MS,
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
  _compatPaneWidth?: number;
  _compatSlideActive?: boolean | undefined;
  _compatSlideResetPending?: boolean | undefined;
  _compatTimer?: ReturnType<typeof setTimeout>;
  _monthActiveSlot: MonthSlot;
  _monthHeightTargetIndex: MonthSlot | undefined;
  _monthShiftPending: boolean;
  _queuedMonthDelta: number;
  createSelectorQuery?(): MiniProgramSelectorQuery;
  readonly data: {
    readonly locateAnimating: boolean;
    readonly compatPanes: readonly unknown[];
    readonly cellWidthStyle: string;
    readonly pagerAnimated: boolean;
    readonly pagerTarget: string;
    readonly paneStyle: string;
    readonly trackStyle: string;
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
    cellWidthStyle: '',
    locateAnimating: false,
    compatPanes: [] as readonly unknown[],
    pagerAnimated: false,
    pagerTarget: createCalendarPeriodPaneId('month-pane-', 1),
    paneStyle: '',
    skyline3172UiCompatibility: needsCurrentRuntimeSkyline3172UiCompatibility(),
    stepMotion: '',
    trackStyle: '',
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
          // The affected runtime cannot animate a programmatic swiper jump, and a
          // native smooth scroll holds the surrounding layout until it lands (the
          // calendar height visibly follows only after the slide). The month
          // therefore slides as a CSS transition on the pager track, sharing one
          // duration and easing with the height transition, exactly like the
          // 3.17.3 swiper jump: both animations start in the same frame and land
          // together, and no platform scroll animation is involved.
          this._compatRequestedDelta = delta;
          this._compatSlideActive = true;
          const width = this._compatPaneWidth ?? 0;
          const shiftBy = delta < 0 ? width : -width;
          const startSlide = (): void => {
            // A finger can land inside the lead frame: the touch handler settles the
            // step and clears the flag, so nothing must move the track afterwards.
            if (this._compatSlideActive !== true) return;
            this.setData({
              stepMotion: next.stepMotion,
              trackStyle: createCompatTrackStyle(shiftBy, true),
            });
            scheduleCompatPagerSettle(this, CALENDAR_PERIOD_SLIDE_SETTLE_MS);
          };
          const nextTick = (wx as unknown as { readonly nextTick?: (callback: () => void) => void })
            .nextTick;
          const nextFrame = (action: () => void): void => {
            if (nextTick === undefined) action();
            else nextTick(action);
          };
          // The height goes out one frame ahead: re-laying the calendar out costs a
          // frame or two on the device, so starting it first makes both transitions
          // land together. A scroller that is still stranded on a side pane (a
          // re-centre that was skipped) is sent home in the same lead, otherwise the
          // shifted track would sit out of view.
          const leadHeight = (): void => {
            const patch: Record<string, unknown> = { viewportHeight: next.viewportHeight };
            if (compatPaneDelta(this) !== 0) {
              patch.pagerAnimated = false;
              patch.pagerTarget = createCalendarPeriodPaneId('month-pane-', 1);
            }
            this.setData(patch, () => nextFrame(startSlide));
          };
          nextFrame(leadHeight);
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
      // A finger landing mid-slide takes over: snap the track (no motion) so the
      // drag and the pending commit both work from the middle pane.
      if (this._compatSlideActive === true) {
        this._compatSlideActive = false;
        this.setData({ trackStyle: '' });
        clearCompatPagerSettle(this);
        settleCompatPagerScroll(this);
      }
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
  const slideReset = instance._compatSlideResetPending === true;
  instance._compatSlideResetPending = undefined;
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
    if (slideReset) {
      // The programmatic step slid the track rather than the scroller. The pane the
      // user is looking at keeps the new month (same as the middle pane) and is
      // already painted, so the track can snap home now; the clean ring follows
      // through the regular clean-up once the scroller reports home.
      instance._compatSlideActive = false;
      const nextTick = (wx as unknown as { readonly nextTick?: (callback: () => void) => void })
        .nextTick;
      const snapHome = (): void =>
        instance.setData({ trackStyle: '' }, () => {
          applyCompatGridHeight(instance);
        });
      if (nextTick === undefined) snapHome();
      else nextTick(snapHome);
    }
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
    instance._compatPaneWidth = width;
    const paneStyle = `width:${width}px`;
    if (instance.data.paneStyle !== paneStyle) instance.setData({ paneStyle });
    // The affected runtime cannot resolve the cells' percentage width chain inside
    // the native scroller either: a re-layout (for example a height change during a
    // swipe) re-resolves it and the cells visibly jitter. The cell width is handed
    // over as an explicit pixel value for the same reason as the pane width.
    const cellWidth = Math.round((width / 7) * 100) / 100;
    const cellWidthStyle = `width:${cellWidth}px;`;
    if (instance.data.cellWidthStyle !== cellWidthStyle) instance.setData({ cellWidthStyle });
  });
}

// The track carries the programmatic slide as a transform so the height can
// transition in the same frame; `motion: false` is the instant snap home.
function createCompatTrackStyle(shift: number, motion: boolean): string {
  if (!motion && shift === 0) return '';
  const transform = `transform:translateX(${shift}px)`;
  return motion
    ? `${transform};transition:transform ${CALENDAR_PERIOD_SWIPER_DURATION_MS}ms ${CALENDAR_PERIOD_HEIGHT_TRANSITION}`
    : `${transform};transition:none`;
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
    applyCompatGridHeight(instance);
  });
}

// A compat step owns the height while it runs, so the observer stays parked and the
// host value can be missed; the settled ring applies it once the step is over.
function applyCompatGridHeight(instance: CalendarMonthInstance): void {
  const gridHeight = instance.properties.gridHeight;
  if (gridHeight !== undefined && gridHeight !== instance.data.viewportHeight) {
    instance.setData({ viewportHeight: gridHeight });
  }
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
  // A programmatic step slid the track instead of the scroller, so the commit has to
  // snap the track home once the rotated panes are painted.
  instance._compatSlideResetPending = requested !== undefined;
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
