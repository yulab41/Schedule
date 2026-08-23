interface MonthSwipeEvent {
  readonly detail: { readonly current: number };
}

interface MonthTransitionEvent {
  readonly detail: { readonly dx: number };
}

interface CalendarSelectEvent {
  readonly detail: { readonly businessDate: string };
}

interface CalendarMonthInstance {
  _monthShiftPending: boolean;
  readonly data: {
    readonly locateAnimating: boolean;
    readonly panelHeights?: readonly number[];
    readonly stepMotion: string;
    readonly swiperCurrent: number;
    readonly swiperDuration: number;
    readonly viewportHeight?: number;
  };
  startProgrammaticShift(delta: -1 | 1): void;
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
      if (!this._monthShiftPending) this.setData({ viewportHeight: value });
    },
    panels(this: CalendarMonthInstance): void {
      if (!this._monthShiftPending && this.data.swiperCurrent === 1) return;
      this.setData(
        {
          swiperCurrent: 1,
          swiperDuration: 0,
          viewportHeight: this.data.panelHeights?.[1] ?? 270,
        },
        () => {
          this.setData({ swiperDuration: 240 }, () => {
            this._monthShiftPending = false;
          });
        },
      );
    },
  },
  lifetimes: {
    attached(this: CalendarMonthInstance): void {
      this._monthShiftPending = false;
    },
  },
  methods: {
    handleMonthTransition(this: CalendarMonthInstance, event: MonthTransitionEvent): void {
      if (
        this._monthShiftPending ||
        this.data.swiperDuration === 0 ||
        this.data.swiperCurrent !== 1
      ) {
        return;
      }
      const { dx } = event.detail;
      const targetIndex = dx < 0 ? 2 : dx > 0 ? 0 : 1;
      const viewportHeight =
        this.data.panelHeights?.[targetIndex] ?? this.data.viewportHeight ?? 270;
      if (viewportHeight !== this.data.viewportHeight) this.setData({ viewportHeight });
    },
    handleMonthSwipe(this: CalendarMonthInstance, event: MonthSwipeEvent): void {
      const { current } = event.detail;
      if (current === 1) {
        const viewportHeight = this.data.panelHeights?.[1] ?? 270;
        if (viewportHeight !== this.data.viewportHeight) this.setData({ viewportHeight });
        return;
      }
      if (this._monthShiftPending) return;
      this._monthShiftPending = true;
      this.triggerEvent('monthchange', { delta: current === 0 ? -1 : 1 });
    },
    startProgrammaticShift(this: CalendarMonthInstance, delta: -1 | 1): void {
      if (this._monthShiftPending) return;
      this.setData({ stepMotion: '' }, () => {
        this.setData({
          stepMotion: delta < 0 ? 'previous' : 'next',
          swiperCurrent: delta === -1 ? 0 : 2,
          swiperDuration: 240,
          viewportHeight: this.data.panelHeights?.[delta === -1 ? 0 : 2] ?? 270,
        });
      });
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
