interface CalendarCellInstance {
  readonly properties: {
    readonly businessDate: string;
    readonly isCurrentMonth: boolean;
    readonly disabled: boolean;
  };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    duties: { type: Array, value: [] },
    disabled: { type: Boolean, value: false },
    ariaLabel: { type: String, value: '' },
    businessDate: { type: String, value: '' },
    day: { type: String, value: '' },
    holiday: { type: String, value: '' },
    isBottomLeft: { type: Boolean, value: false },
    isBottomRight: { type: Boolean, value: false },
    isCurrentMonth: { type: Boolean, value: true },
    isHoliday: { type: Boolean, value: false },
    isSelected: { type: Boolean, value: false },
    isToday: { type: Boolean, value: false },
    isWeekend: { type: Boolean, value: false },
    marker: { type: String, value: '' },
    person: { type: String, value: '' },
  },
  methods: {
    handleSelect(this: CalendarCellInstance): void {
      if (!this.properties.isCurrentMonth || this.properties.disabled) return;
      this.triggerEvent('select', { businessDate: this.properties.businessDate });
    },
  },
});
