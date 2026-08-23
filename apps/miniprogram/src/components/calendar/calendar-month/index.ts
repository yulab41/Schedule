interface MonthSwipeEvent {
  readonly detail: { readonly current: number };
}

interface CalendarSelectEvent {
  readonly detail: { readonly businessDate: string };
}

interface CalendarMonthInstance {
  _monthShiftPending: boolean;
  readonly data: {
    readonly locateAnimating: boolean;
    readonly stepMotion: string;
    readonly swiperCurrent: number;
    readonly swiperDuration: number;
  };
  startProgrammaticShift(delta: -1 | 1): void;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    gridHeight: { type: Number, value: 270 },
    monthLabel: { type: String, value: '' },
    panels: { type: Array, value: [] },
  },
  data: {
    locateAnimating: false,
    stepMotion: '',
    swiperCurrent: 1,
    swiperDuration: 240,
  },
  observers: {
    panels(this: CalendarMonthInstance): void {
      if (!this._monthShiftPending && this.data.swiperCurrent === 1) return;
      this.setData(
        {
          swiperCurrent: 1,
          swiperDuration: 0,
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
    handleMonthSwipe(this: CalendarMonthInstance, event: MonthSwipeEvent): void {
      const { current } = event.detail;
      if (current === 1 || this._monthShiftPending) return;
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
