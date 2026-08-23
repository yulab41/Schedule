interface MonthSwipeEvent {
  readonly detail: { readonly current: number };
}

interface MonthChangeStartEvent {
  readonly detail: { readonly current: number };
}

interface CalendarSelectEvent {
  readonly detail: { readonly businessDate: string };
}

type MonthSlot = 0 | 1 | 2;

interface CalendarMonthInstance {
  _monthActiveSlot: MonthSlot;
  _monthHeightTargetIndex: MonthSlot | undefined;
  _monthShiftPending: boolean;
  _queuedMonthDelta: number;
  readonly data: {
    readonly locateAnimating: boolean;
    readonly panelHeights?: readonly number[];
    readonly stepMotion: string;
    readonly swiperCurrent: number;
    readonly swiperDuration: number;
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
    gridHeight: { type: Number, value: 270 },
    monthLabel: { type: String, value: '' },
    panelHeights: { type: Array, value: [270, 270, 270] },
    panels: { type: Array, value: [] },
  },
  data: {
    locateAnimating: false,
    stepMotion: '',
    swiperCurrent: 1,
    swiperDuration: 240,
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
      if (!isMonthSlot(current)) return;
      if (
        this._monthShiftPending ||
        this._monthHeightTargetIndex !== undefined ||
        current === this._monthActiveSlot
      ) {
        return;
      }
      this._monthHeightTargetIndex = current;
      const viewportHeight = this.data.panelHeights?.[current] ?? 270;
      if (viewportHeight !== this.data.viewportHeight) this.setData({ viewportHeight });
    },
    handleMonthSwipe(this: CalendarMonthInstance, event: MonthSwipeEvent): void {
      const { current } = event.detail;
      if (!isMonthSlot(current)) return;
      if (current === this._monthActiveSlot) {
        if (this._monthHeightTargetIndex === undefined) return;
        this._monthHeightTargetIndex = undefined;
        const viewportHeight = this.data.panelHeights?.[this._monthActiveSlot] ?? 270;
        if (viewportHeight !== this.data.viewportHeight) this.setData({ viewportHeight });
        return;
      }
      if (this._monthShiftPending) return;
      const delta = getMonthSlotDelta(this._monthActiveSlot, current);
      if (delta === 0) return;
      this._monthActiveSlot = current;
      this._monthShiftPending = true;
      this.setData({ swiperCurrent: current }, () => {
        this.triggerEvent('monthchange', { current, delta });
      });
    },
    startProgrammaticShift(
      this: CalendarMonthInstance,
      delta: -1 | 1,
      targetHeight?: number,
    ): void {
      if (this._monthShiftPending || this._monthHeightTargetIndex !== undefined) {
        this._queuedMonthDelta = clampMonthShiftQueue(this._queuedMonthDelta + delta);
        return;
      }
      const targetIndex = getAdjacentMonthSlot(this._monthActiveSlot, delta);
      this._monthHeightTargetIndex = targetIndex;
      this.setData({ stepMotion: '' }, () => {
        this.setData({
          stepMotion: delta < 0 ? 'previous' : 'next',
          swiperCurrent: targetIndex,
          swiperDuration: 240,
          viewportHeight: targetHeight ?? this.data.panelHeights?.[targetIndex] ?? 270,
        });
      });
    },
    finishPeriodShift(this: CalendarMonthInstance): void {
      this._monthHeightTargetIndex = undefined;
      this._monthShiftPending = false;
      this.triggerEvent('monthsettled', {
        continues: this._queuedMonthDelta !== 0,
      });
    },
    continueQueuedShift(this: CalendarMonthInstance): void {
      const queuedDelta = this._queuedMonthDelta;
      if (queuedDelta === 0) return;
      const delta: -1 | 1 = queuedDelta < 0 ? -1 : 1;
      this._queuedMonthDelta = queuedDelta - delta;
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

function clampMonthShiftQueue(value: number): number {
  return Math.max(-6, Math.min(6, value));
}

function isMonthSlot(value: number): value is MonthSlot {
  return value === 0 || value === 1 || value === 2;
}

function getAdjacentMonthSlot(activeSlot: MonthSlot, delta: -1 | 1): MonthSlot {
  return ((activeSlot + delta + 3) % 3) as MonthSlot;
}

function getMonthSlotDelta(activeSlot: MonthSlot, targetSlot: MonthSlot): -1 | 0 | 1 {
  if (getAdjacentMonthSlot(activeSlot, 1) === targetSlot) return 1;
  if (getAdjacentMonthSlot(activeSlot, -1) === targetSlot) return -1;
  return 0;
}
