import type {
  CalendarDayViewModel,
  CalendarMonthDataViewModel,
  CalendarMonthViewModel,
  CalendarPhoneActionViewModel,
  CalendarWeekViewModel,
} from './calendar-view-model.js';
import { createCalendarMonthStateViewModel } from './calendar-view-model.js';
import { getWeekDays, getWeekLabel, getBusinessMonthsForWeek } from './calendar-views.js';
import type { CalendarViewMode } from './calendar-view-mode.js';

export interface CalendarMonthSlotViewModel {
  readonly businessMonth: string;
  readonly viewModel: CalendarMonthViewModel;
}

export function recenterCalendarMonthSlots(
  currentSlots: readonly CalendarMonthSlotViewModel[],
  businessMonths: readonly [string, string, string],
): readonly [CalendarMonthSlotViewModel, CalendarMonthSlotViewModel, CalendarMonthSlotViewModel] {
  return businessMonths.map(
    (businessMonth) =>
      currentSlots.find((slot) => slot.businessMonth === businessMonth) ?? {
        businessMonth,
        viewModel: createCalendarMonthStateViewModel(businessMonth, 'loading'),
      },
  ) as [CalendarMonthSlotViewModel, CalendarMonthSlotViewModel, CalendarMonthSlotViewModel];
}

export type CalendarSurfaceViewModel =
  | {
      readonly kind: 'list';
      readonly days: readonly CalendarDayViewModel[];
      readonly monthLabel: string;
    }
  | { readonly kind: 'month'; readonly month: CalendarMonthDataViewModel }
  | {
      readonly kind: 'week';
      readonly week: CalendarWeekViewModel;
      readonly weekLabel: string;
      readonly weekStart: string;
    }
  | {
      readonly businessMonth: string;
      readonly kind: 'state';
      readonly message: string;
      readonly status: 'conflict' | 'error' | 'forbidden' | 'loading';
    };

function findDataSlot(
  slots: readonly CalendarMonthSlotViewModel[],
  month: string,
): CalendarMonthDataViewModel | undefined {
  const viewModel = slots.find(({ businessMonth }) => businessMonth === month)?.viewModel;
  return viewModel?.status === 'cached' ||
    viewModel?.status === 'ready' ||
    viewModel?.status === 'refreshing'
    ? viewModel
    : undefined;
}

function getDays(viewModel: CalendarMonthDataViewModel): readonly CalendarDayViewModel[] {
  return viewModel.weeks
    .flatMap(({ days }) => days)
    .filter((day): day is CalendarDayViewModel => day.kind === 'day');
}

export function buildCalendarSurfaceViewModel(input: {
  readonly businessMonth: string;
  readonly mode: CalendarViewMode;
  readonly monthSlots: readonly CalendarMonthSlotViewModel[];
  readonly weekStart: string;
}): CalendarSurfaceViewModel {
  const center = input.monthSlots.find(
    ({ businessMonth }) => businessMonth === input.businessMonth,
  )?.viewModel;
  if (
    input.mode === 'month' &&
    (center?.status === 'cached' || center?.status === 'ready' || center?.status === 'refreshing')
  ) {
    return { kind: 'month', month: center };
  }
  if (
    input.mode === 'list' &&
    (center?.status === 'cached' || center?.status === 'ready' || center?.status === 'refreshing')
  ) {
    return {
      kind: 'list',
      days: getDays(center).filter(({ assignments }) => assignments.length > 0),
      monthLabel: center.monthLabel,
    };
  }
  if (input.mode === 'week') {
    const requiredMonths = getBusinessMonthsForWeek(input.weekStart);
    const sourceDays = requiredMonths.map((month) => findDataSlot(input.monthSlots, month));
    if (sourceDays.every((value): value is CalendarMonthDataViewModel => value !== undefined)) {
      const sourceByDate = new Map(
        sourceDays.flatMap(getDays).map((day) => [day.businessDate, day]),
      );
      const days = getWeekDays(input.weekStart).map((businessDate) => {
        const day = sourceByDate.get(businessDate);
        if (day === undefined) {
          throw new Error(`Week source is missing ${businessDate}.`);
        }
        return day;
      });
      return {
        kind: 'week',
        week: { days, id: `week:${input.weekStart}` },
        weekLabel: getWeekLabel(input.weekStart),
        weekStart: input.weekStart,
      };
    }
    const missing =
      requiredMonths.find((month) => findDataSlot(input.monthSlots, month) === undefined) ??
      input.businessMonth;
    return { businessMonth: missing, kind: 'state', message: '正在加载排班', status: 'loading' };
  }
  if (
    center?.status === 'loading' ||
    center?.status === 'conflict' ||
    center?.status === 'error' ||
    center?.status === 'forbidden'
  ) {
    return {
      businessMonth: input.businessMonth,
      kind: 'state',
      message: center.message,
      status: center.status,
    };
  }
  return {
    businessMonth: input.businessMonth,
    kind: 'state',
    message: '正在加载排班',
    status: 'loading',
  };
}

export function findCalendarPhoneAction(
  slots: readonly CalendarMonthSlotViewModel[],
  actionId: string,
): CalendarPhoneActionViewModel | undefined {
  const seenAssignments = new Set<string>();
  for (const slot of slots) {
    if (
      slot.viewModel.status !== 'cached' &&
      slot.viewModel.status !== 'ready' &&
      slot.viewModel.status !== 'refreshing'
    )
      continue;
    for (const day of getDays(slot.viewModel)) {
      for (const assignment of day.assignments) {
        if (seenAssignments.has(assignment.assignmentId)) continue;
        seenAssignments.add(assignment.assignmentId);
        const action = assignment.phoneActions.find((candidate) => candidate.actionId === actionId);
        if (action !== undefined) return action;
      }
    }
  }
  return undefined;
}
