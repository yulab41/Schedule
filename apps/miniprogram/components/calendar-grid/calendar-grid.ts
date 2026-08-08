Component({
  properties: {
    weeks: {
      type: Array,
      value: [] as {
        readonly cells: readonly {
          readonly assignments: readonly {
            readonly abbreviation: string;
            readonly color: string;
            readonly id: string;
            readonly markers: readonly string[];
            readonly textColor: string;
          }[];
          readonly businessDate: string;
          readonly dayNumber: string;
          readonly holidayLabel: string;
          readonly isToday: boolean;
          readonly isWeekend: boolean;
          readonly memberName: string;
        }[];
      }[],
    },
  },
  methods: {
    onCellTap(event: WechatMiniprogram.TouchEvent) {
      const businessDate = event.currentTarget.dataset.date;
      if (typeof businessDate === 'string' && businessDate.length > 0) {
        this.triggerEvent('celltap', { businessDate });
      }
    },
  },
});
