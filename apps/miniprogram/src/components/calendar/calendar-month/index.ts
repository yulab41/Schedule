interface MonthPanEvent {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly state: number;
  readonly velocityX: number;
}

interface MonthPointerEvent {
  readonly deltaX: number;
  readonly deltaY: number;
}

interface CalendarSelectEvent {
  readonly detail: { readonly businessDate: string };
}

interface SelectorRect {
  readonly width: number;
}

interface CalendarMonthInstance {
  _commitMonthShift: (delta: -1 | 1) => void;
  _gestureX: MiniProgramSharedValue<number>;
  _translateX: MiniProgramSharedValue<number>;
  _viewportWidth: MiniProgramSharedValue<number>;
  applyAnimatedStyle(selector: string, updater: () => Record<string, string>): void;
  commitMonthShift(delta: -1 | 1): void;
  createSelectorQuery(): {
    select(selector: string): {
      boundingClientRect(callback: (rect: SelectorRect) => void): unknown;
    };
    exec(): void;
  };
  settleMonthPan(delta: -1 | 0 | 1): void;
  startProgrammaticShift(delta: -1 | 1): void;
  triggerEvent(name: string, detail?: unknown): void;
}

const { Easing, runOnJS, shared, timing } = wx.worklet;
const GESTURE_BEGIN = 1;
const GESTURE_ACTIVE = 2;
const GESTURE_END = 3;
const GESTURE_CANCELLED = 4;
const DISTANCE_THRESHOLD = 56;
const VELOCITY_THRESHOLD = 600;

Component({
  properties: {
    monthLabel: { type: String, value: '' },
    panels: { type: Array, value: [] },
  },
  lifetimes: {
    attached(this: CalendarMonthInstance): void {
      this._commitMonthShift = this.commitMonthShift.bind(this);
      this._gestureX = shared(0);
      this._translateX = shared(0);
      this._viewportWidth = shared(1);
    },
    ready(this: CalendarMonthInstance): void {
      this.applyAnimatedStyle('#calendar-slider-track', () => {
        'worklet';
        return { transform: `translateX(${this._translateX.value}px)` };
      });
      const query = this.createSelectorQuery();
      query.select('.calendar-motion-viewport').boundingClientRect((rect) => {
        this._viewportWidth.value = Math.max(1, rect.width);
      });
      query.exec();
    },
  },
  methods: {
    shouldRespondToMonthPan(pointerEvent: MonthPointerEvent): boolean {
      'worklet';
      return Math.abs(pointerEvent.deltaX) >= Math.abs(pointerEvent.deltaY);
    },
    handleMonthPan(this: CalendarMonthInstance, event: MonthPanEvent): void {
      'worklet';
      if (event.state === GESTURE_BEGIN) {
        this._gestureX.value = 0;
        return;
      }
      if (event.state === GESTURE_ACTIVE) {
        const dragLimit = this._viewportWidth.value * 0.96;
        const nextGestureX = this._gestureX.value + event.deltaX;
        this._gestureX.value = Math.max(-dragLimit, Math.min(dragLimit, nextGestureX));
        this._translateX.value = this._gestureX.value;
        return;
      }
      if (event.state !== GESTURE_END && event.state !== GESTURE_CANCELLED) return;
      const horizontalDistance = this._gestureX.value;
      const direction =
        event.state === GESTURE_CANCELLED
          ? 0
          : horizontalDistance <= -DISTANCE_THRESHOLD || event.velocityX <= -VELOCITY_THRESHOLD
            ? 1
            : horizontalDistance >= DISTANCE_THRESHOLD || event.velocityX >= VELOCITY_THRESHOLD
              ? -1
              : 0;
      this.settleMonthPan(direction);
    },
    settleMonthPan(this: CalendarMonthInstance, delta: -1 | 0 | 1): void {
      'worklet';
      const target = delta === 0 ? 0 : -delta * this._viewportWidth.value;
      const duration = delta === 0 ? 180 : 240;
      this._translateX.value = timing(
        target,
        { duration, easing: Easing.bezier(0.22, 1, 0.36, 1) },
        (finished) => {
          'worklet';
          if (!finished) return;
          this._gestureX.value = 0;
          this._translateX.value = 0;
          if (delta !== 0) runOnJS(this._commitMonthShift)(delta);
        },
      );
    },
    commitMonthShift(this: CalendarMonthInstance, delta: -1 | 1): void {
      this.triggerEvent('monthchange', { delta });
    },
    startProgrammaticShift(this: CalendarMonthInstance, delta: -1 | 1): void {
      const target = -delta * this._viewportWidth.value;
      this._translateX.value = timing(
        target,
        { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) },
        (finished) => {
          'worklet';
          if (!finished) return;
          this._translateX.value = 0;
          runOnJS(this._commitMonthShift)(delta);
        },
      );
    },
    handlePrevious(this: CalendarMonthInstance): void {
      this.startProgrammaticShift(-1);
    },
    handleNext(this: CalendarMonthInstance): void {
      this.startProgrammaticShift(1);
    },
    handleLocateToday(this: CalendarMonthInstance): void {
      this.triggerEvent('locatetoday');
    },
    handleCellSelect(this: CalendarMonthInstance, event: CalendarSelectEvent): void {
      this.triggerEvent('select', event.detail);
    },
  },
});
