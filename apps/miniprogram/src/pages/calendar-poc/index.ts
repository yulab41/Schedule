import { createCalendarPocViewModel } from '../../testing/fixtures/calendar-poc.js';
import { buildInfo } from '../../platform/build-info.js';

interface MonthChangeEvent {
  readonly detail: { readonly delta: -1 | 1 };
}

interface CalendarDateSelectEvent {
  readonly detail: { readonly businessDate: string };
}

interface CalendarPocPageInstance {
  readonly data: {
    readonly monthOffset: number;
  };
  setData(patch: Record<string, unknown>): void;
}

function createPageData(
  monthOffset: number,
  selectedBusinessDate?: string,
): Record<string, unknown> {
  return {
    ...createCalendarPocViewModel(monthOffset, selectedBusinessDate),
    buildLabel: buildInfo.buildLabel,
  };
}

Page({
  data: createPageData(0),
  handleMonthChange(this: CalendarPocPageInstance, event: MonthChangeEvent): void {
    const nextOffset = this.data.monthOffset + event.detail.delta;
    this.setData(createPageData(nextOffset));
  },
  handleDateSelect(this: CalendarPocPageInstance, event: CalendarDateSelectEvent): void {
    this.setData(createPageData(this.data.monthOffset, event.detail.businessDate));
  },
  handleLocateToday(this: CalendarPocPageInstance): void {
    this.setData(createPageData(0, '2026-10-14'));
  },
});
