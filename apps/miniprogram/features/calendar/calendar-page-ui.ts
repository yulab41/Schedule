import { parseBusinessDate, parseBusinessMonth } from './calendar-logic.js';
import type { CalendarMonthSlotViewModel } from './calendar-surface.js';
import {
  buildCalendarCacheNotice,
  type CalendarCacheNotice,
  mergeCalendarFilterViewModels,
  type CalendarFilterOption,
  type CalendarFilterViewModel,
} from '@schedule/calendar-core';

export { buildCalendarCacheNotice } from '@schedule/calendar-core';

export function getCalendarCacheNoticeData(
  slots: readonly CalendarMonthSlotViewModel[],
  requiredMonths: readonly string[],
): CalendarCacheNotice | null {
  return buildCalendarCacheNotice(slots, requiredMonths) ?? null;
}

export function buildCalendarSurfaceFilters(
  slots: readonly CalendarMonthSlotViewModel[],
  requiredMonths: readonly string[],
): CalendarFilterViewModel | undefined {
  if (requiredMonths.length === 0) return undefined;
  const filters: CalendarFilterViewModel[] = [];
  for (let monthIndex = 0; monthIndex < requiredMonths.length; monthIndex += 1) {
    const requiredMonth = requiredMonths[monthIndex]!;
    let matchingSlot: CalendarMonthSlotViewModel | undefined;
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const candidate = slots[slotIndex]!;
      if (candidate.businessMonth === requiredMonth) {
        matchingSlot = candidate;
        break;
      }
    }
    const viewModel = matchingSlot?.viewModel;
    if (
      viewModel === undefined ||
      (viewModel.status !== 'cached' &&
        viewModel.status !== 'ready' &&
        viewModel.status !== 'refreshing')
    )
      return undefined;
    filters.push(viewModel.filters);
  }
  return mergeCalendarFilterViewModels(filters);
}

export function getCalendarFilterSummary(
  kindLabel: string,
  options: readonly CalendarFilterOption[],
  selectedIds: readonly string[],
): string {
  const selected = new Set(selectedIds);
  const selectedOptions = options.filter(({ id }) => selected.has(id));
  if (selectedIds.length === 0) return `全部${kindLabel}`;
  if (selectedOptions.length === 0) return `${kindLabel} ${selectedIds.length}`;
  if (selectedOptions.length === 1) return selectedOptions[0]!.label;
  return `${kindLabel} ${selectedOptions.length}`;
}

export function parseCalendarMonthPickerValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const businessMonth = /^\d{4}-\d{2}$/u.test(value)
    ? value
    : /^\d{4}-\d{2}-\d{2}$/u.test(value)
      ? value.slice(0, 7)
      : undefined;
  if (businessMonth === undefined) return undefined;
  try {
    parseBusinessMonth(businessMonth);
    if (value.length === 10) parseBusinessDate(value);
    return businessMonth;
  } catch {
    return undefined;
  }
}
