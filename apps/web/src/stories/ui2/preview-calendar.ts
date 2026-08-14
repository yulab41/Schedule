export type PreviewHolidayKind = 'observance' | 'off-day' | 'workday';

export interface PreviewCalendarHoliday {
  readonly kind: PreviewHolidayKind;
  readonly label: string;
  readonly spanDays?: number;
}

export function isWeekendColumn(index: number): boolean {
  return index % 7 >= 5;
}

export function shouldTintHolidayCell(holiday: PreviewCalendarHoliday | undefined): boolean {
  return holiday?.kind === 'off-day' && (holiday.spanDays ?? 1) > 1;
}
