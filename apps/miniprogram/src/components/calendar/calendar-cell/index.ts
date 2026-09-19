interface CalendarCellInstance {
  readonly data: { readonly dayText: string; readonly weekend: boolean };
  readonly properties: {
    readonly businessDate: string;
    readonly isCurrentMonth: boolean;
    readonly disabled: boolean;
  };
  setData(patch: Record<string, unknown>): void;
  triggerEvent(name: string, detail?: unknown): void;
}

/**
 * The month grid only carries the date; the weekday-derived presentation lives
 * here so a ring patch does not have to ship two redundant fields per cell.
 */
function isWeekendBusinessDate(businessDate: string): boolean {
  if (businessDate.length !== 10) return false;
  const weekday = new Date(`${businessDate}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

Component({
  data: { dayText: '', weekend: false },
  observers: {
    businessDate(this: CalendarCellInstance, value: string): void {
      const dayText = value.slice(8);
      const weekend = isWeekendBusinessDate(value);
      if (dayText === this.data.dayText && weekend === this.data.weekend) return;
      this.setData({ dayText, weekend });
    },
  },
  properties: {
    extraPersonCount: { type: Number, value: 0 },
    shiftAbbreviation: { type: String, value: '' },
    shiftBadgeStyle: { type: String, value: '' },
    compact: { type: Boolean, value: false },
    duties: { type: Array, value: [] },
    disabled: { type: Boolean, value: false },
    ariaLabel: { type: String, value: '' },
    businessDate: { type: String, value: '' },
    holiday: { type: String, value: '' },
    isBottomLeft: { type: Boolean, value: false },
    isBottomRight: { type: Boolean, value: false },
    isCurrentMonth: { type: Boolean, value: true },
    isHoliday: { type: Boolean, value: false },
    isPast: { type: Boolean, value: false },
    isWorkday: { type: Boolean, value: false },
    isSelected: { type: Boolean, value: false },
    isToday: { type: Boolean, value: false },
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
