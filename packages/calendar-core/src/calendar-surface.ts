import {
  formatChinaDateTime,
  getBusinessMonthsForWeek,
  getWeekDays,
  getWeekLabel,
} from './calendar-views.js';
import type { CalendarViewMode } from './calendar-view-mode.js';
import { createCalendarMonthStateViewModel } from './calendar-view-model.js';
import type {
  CalendarDayViewModel,
  CalendarMonthDataViewModel,
  CalendarMonthViewModel,
  CalendarPhoneActionViewModel,
  CalendarWeekViewModel,
} from './calendar-view-model.js';

export interface CalendarMonthSlotViewModel {
  readonly businessMonth: string;
  readonly viewModel: CalendarMonthViewModel;
}

export interface CalendarCacheNotice {
  readonly savedAtText: string;
  readonly stale: boolean;
}

interface CalendarDataSurfaceState {
  readonly emptyMessage: string;
  readonly isEmpty: boolean;
}

export type CalendarSurfaceViewModel =
  | (CalendarDataSurfaceState & {
      readonly kind: 'list';
      readonly days: readonly CalendarDayViewModel[];
      readonly monthLabel: string;
    })
  | (CalendarDataSurfaceState & {
      readonly kind: 'month';
      readonly month: CalendarMonthDataViewModel;
    })
  | (CalendarDataSurfaceState & {
      readonly kind: 'week';
      readonly week: CalendarWeekViewModel;
      readonly weekLabel: string;
      readonly weekStart: string;
    })
  | {
      readonly businessMonth: string;
      readonly kind: 'state';
      readonly message: string;
      readonly status: 'conflict' | 'error' | 'forbidden' | 'loading';
    };

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

function hasExplicitFilters(viewModel: CalendarMonthDataViewModel): boolean {
  return (
    viewModel.filters.selectedMembershipIds.length > 0 ||
    viewModel.filters.selectedRoleIds.length > 0 ||
    viewModel.filters.selectedShiftTypeIds.length > 0
  );
}

function getEmptyMessage(
  scope: 'month' | 'week',
  onlyChanges: boolean,
  hasFilters: boolean,
): string {
  if (hasFilters) return '当前筛选条件下暂无排班。';
  if (scope === 'week') {
    return onlyChanges ? '本周没有带变动标记的班次。' : '本周暂无已发布排班。';
  }
  return onlyChanges ? '本月没有带变动标记的班次。' : '本月暂无已发布排班。';
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
    return {
      emptyMessage: getEmptyMessage(
        'month',
        center.filters.onlyChanges,
        hasExplicitFilters(center),
      ),
      isEmpty: center.isMonthEmpty,
      kind: 'month',
      month: center,
    };
  }
  if (
    input.mode === 'list' &&
    (center?.status === 'cached' || center?.status === 'ready' || center?.status === 'refreshing')
  ) {
    const days = getDays(center).filter(({ assignments }) => assignments.length > 0);
    return {
      days,
      emptyMessage: getEmptyMessage(
        'month',
        center.filters.onlyChanges,
        hasExplicitFilters(center),
      ),
      isEmpty: days.length === 0,
      kind: 'list',
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
      const isEmpty = days.every(({ assignments }) => assignments.length === 0);
      const onlyChanges = sourceDays.some(({ filters }) => filters.onlyChanges);
      const hasFilters = sourceDays.some(hasExplicitFilters);
      return {
        emptyMessage: getEmptyMessage('week', onlyChanges, hasFilters),
        isEmpty,
        kind: 'week',
        week: { days, id: `week:${input.weekStart}` },
        weekLabel: getWeekLabel(input.weekStart),
        weekStart: input.weekStart,
      };
    }
    const unavailableMonth =
      requiredMonths.find((month) => {
        const status = input.monthSlots.find(({ businessMonth }) => businessMonth === month)
          ?.viewModel.status;
        return status === 'forbidden' || status === 'conflict' || status === 'error';
      }) ??
      requiredMonths.find((month) => findDataSlot(input.monthSlots, month) === undefined) ??
      input.businessMonth;
    const unavailable = input.monthSlots.find(
      ({ businessMonth }) => businessMonth === unavailableMonth,
    )?.viewModel;
    if (
      unavailable?.status === 'loading' ||
      unavailable?.status === 'conflict' ||
      unavailable?.status === 'error' ||
      unavailable?.status === 'forbidden'
    ) {
      return {
        businessMonth: unavailableMonth,
        kind: 'state',
        message: unavailable.message,
        status: unavailable.status,
      };
    }
    return {
      businessMonth: unavailableMonth,
      kind: 'state',
      message: '正在加载排班',
      status: 'loading',
    };
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

export function buildCalendarCacheNotice(
  slots: readonly CalendarMonthSlotViewModel[],
  requiredMonths: readonly string[],
): CalendarCacheNotice | undefined {
  let earliestSavedAt: string | undefined;
  let stale = false;
  for (const businessMonth of new Set(requiredMonths)) {
    const viewModel = slots.find((slot) => slot.businessMonth === businessMonth)?.viewModel;
    if (viewModel?.status !== 'cached' && viewModel?.status !== 'refreshing') continue;
    stale ||= viewModel.isStale === true;
    if (
      viewModel.cacheSavedAt !== undefined &&
      (earliestSavedAt === undefined || viewModel.cacheSavedAt < earliestSavedAt)
    ) {
      earliestSavedAt = viewModel.cacheSavedAt;
    }
  }
  if (earliestSavedAt === undefined) return undefined;
  return { savedAtText: formatChinaDateTime(earliestSavedAt), stale };
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
    ) {
      continue;
    }
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
