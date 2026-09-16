import {
  CALENDAR_PERIOD_SWIPER_DURATION_MS,
  CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
  cancelCalendarPeriodShift,
  commitCalendarPeriodSwipe,
  finishCalendarPeriodShift,
  isCalendarPeriodSlot,
  prepareCalendarPeriodChange,
  requestCalendarPeriodShift,
  takeQueuedCalendarPeriodShift,
  type CalendarPeriodPagerState,
  type CalendarPeriodSlot,
} from '../calendar-period-pager.js';
import { needsCurrentRuntimeSkyline3172UiCompatibility } from '../../../platform/runtime-ui-compatibility.js';

interface MonthSwipeEvent {
  readonly detail: { readonly current: number };
}

interface MonthChangeStartEvent {
  readonly detail: { readonly current: number };
}

interface CalendarSelectEvent {
  readonly detail: { readonly businessDate: string };
}

type MonthSlot = CalendarPeriodSlot;

interface CalendarMonthInstance {
  _monthActiveSlot: MonthSlot;
  _monthHeightTargetIndex: MonthSlot | undefined;
  _monthShiftPending: boolean;
  _queuedMonthDelta: number;
  readonly data: {
    readonly locateAnimating: boolean;
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
    skyline3172UiCompatibility: needsCurrentRuntimeSkyline3172UiCompatibility(),
    stepMotion: '',
    swiperCurrent: 1,
    swiperDuration: CALENDAR_PERIOD_SWIPER_DURATION_MS,
    swiperEasingFunction: CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
    viewportHeight: 270,
  },
  observers: {
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
    },
  },
  methods: {
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
        this.setData(
          {
            stepMotion: delta < 0 ? 'previous' : 'next',
            swiperCurrent: targetIndex,
            // The affected runtime replays a reversed circular slide for
            // programmatic paging, so it switches without the slide.
            swiperDuration: this.data.skyline3172UiCompatibility
              ? 0
              : CALENDAR_PERIOD_SWIPER_DURATION_MS,
            viewportHeight: targetHeight ?? this.data.panelHeights?.[targetIndex] ?? 270,
          },
          () => {
            // A zero-duration jump does not reliably report animationfinish, so
            // the already-applied shift is finished here instead of waiting.
            if (this.data.skyline3172UiCompatibility) finishMonthSwipeAt(this, targetIndex);
          },
        );
      });
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
