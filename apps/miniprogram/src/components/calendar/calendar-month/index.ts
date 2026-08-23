interface MonthSwipeEvent {
  readonly detail: { readonly current: number };
}

interface MonthChangeStartEvent {
  readonly detail: { readonly current: number };
}

interface CalendarSelectEvent {
  readonly detail: { readonly businessDate: string };
}

interface CalendarMonthInstance {
  _monthHeightTargetIndex: 0 | 2 | undefined;
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
      this._monthHeightTargetIndex = undefined;
      this._monthShiftPending = false;
      this._queuedMonthDelta = 0;
    },
  },
  methods: {
    handleMonthChangeStart(this: CalendarMonthInstance, event: MonthChangeStartEvent): void {
      const { current } = event.detail;
      if (
        this._monthShiftPending ||
        this._monthHeightTargetIndex !== undefined ||
        (current !== 0 && current !== 2)
      ) {
        return;
      }
      this._monthHeightTargetIndex = current;
      const viewportHeight = this.data.panelHeights?.[current] ?? 270;
      if (viewportHeight !== this.data.viewportHeight) this.setData({ viewportHeight });
    },
    handleMonthSwipe(this: CalendarMonthInstance, event: MonthSwipeEvent): void {
      const { current } = event.detail;
      if (current === 1) {
        if (this._monthHeightTargetIndex === undefined) return;
        this._monthHeightTargetIndex = undefined;
        const viewportHeight = this.data.panelHeights?.[1] ?? 270;
        if (viewportHeight !== this.data.viewportHeight) this.setData({ viewportHeight });
        return;
      }
      if (this._monthShiftPending) return;
      this._monthShiftPending = true;
      this.triggerEvent('monthchange', { delta: current === 0 ? -1 : 1 });
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
      const targetIndex = delta === -1 ? 0 : 2;
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
      this.setData(
        {
          swiperCurrent: 1,
          swiperDuration: 0,
          viewportHeight: this.data.panelHeights?.[1] ?? 270,
        },
        () => {
          this.setData({ swiperDuration: 240 }, () => {
            this._monthHeightTargetIndex = undefined;
            this._monthShiftPending = false;
            this.triggerEvent('monthrecentered', { continues: this._queuedMonthDelta !== 0 });
          });
        },
      );
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
