import {
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
  readonly properties: { readonly panels: readonly { readonly relative: number }[] };
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
          next.pagerAnimated = true;
          next.pagerTarget = createCalendarPeriodPaneId('month-pane-', delta < 0 ? 0 : 2);
          this.setData(next);
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
      if (this._compatGesture === true) prepareCompatPagerTarget(this);
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
  instance.setData({
    compatPanes: ordered,
    pagerAnimated: false,
    pagerTarget: createCalendarPeriodPaneId('month-pane-', 1),
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
}

function clearCompatPagerSettle(instance: CalendarMonthInstance): void {
  if (instance._compatTimer !== undefined) {
    clearTimeout(instance._compatTimer);
    instance._compatTimer = undefined;
  }
}

function scheduleCompatPagerSettle(instance: CalendarMonthInstance): void {
  clearCompatPagerSettle(instance);
  instance._compatTimer = setTimeout(() => {
    instance._compatTimer = undefined;
    settleCompatPagerScroll(instance);
  }, CALENDAR_PERIOD_SCROLL_SETTLE_MS);
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
  const viewportHeight = instance.data.panelHeights?.[slot] ?? 270;
  if (viewportHeight !== instance.data.viewportHeight) instance.setData({ viewportHeight });
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
