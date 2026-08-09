import type {
  CalendarReadModel,
  GroupRole,
  GuestCalendarReadModel,
  HolidayReadModel,
} from '@schedule/contracts';

import { ApiClientError } from '../../api/client.js';
import type { CalendarAssignmentFilters } from './calendar-logic.js';
import { parseBusinessMonth } from './calendar-logic.js';
import {
  buildCalendarMonthViewModel,
  createCalendarMonthStateViewModel,
  type CalendarDataStatus,
  type CalendarMonthViewModel,
} from './calendar-view-model.js';

export type CalendarFailureStatus = 'conflict' | 'error' | 'forbidden';

export interface CalendarLoadTarget {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly groupRole: GroupRole;
}

export interface CalendarPageControllerDependencies {
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getLoggedInGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  getToday(): string;
  makePhoneCall(options: { readonly phoneNumber: string }): void;
  publish(viewModel: CalendarMonthViewModel): void;
  setClipboardData(options: { readonly data: string }): void;
}

export interface CalendarPageController {
  load(target: CalendarLoadTarget, force?: boolean): Promise<void>;
  performPhoneAction(actionId: string): boolean;
  setFilters(filters: CalendarAssignmentFilters): void;
}

interface InFlightLoad {
  readonly key: string;
  readonly promise: Promise<void>;
}

function isDataViewModel(
  value: CalendarMonthViewModel | undefined,
): value is Extract<CalendarMonthViewModel, { readonly status: CalendarDataStatus }> {
  return value?.status === 'cached' || value?.status === 'ready' || value?.status === 'refreshing';
}

function copyFilters(filters: CalendarAssignmentFilters): CalendarAssignmentFilters {
  return {
    membershipIds: filters.membershipIds === undefined ? undefined : [...filters.membershipIds],
    onlyChanges: filters.onlyChanges === true,
    roleIds: filters.roleIds === undefined ? undefined : [...filters.roleIds],
    shiftTypeIds: filters.shiftTypeIds === undefined ? undefined : [...filters.shiftTypeIds],
  };
}

export function getCalendarFailureState(error: unknown): CalendarFailureStatus {
  if (error instanceof ApiClientError) {
    if (error.code === 'FORBIDDEN' || error.status === 403) {
      return 'forbidden';
    }
    if (error.code === 'CONFLICT' || error.status === 409) {
      return 'conflict';
    }
  }
  return 'error';
}

export function parseSelectorPickerIndex(value: unknown, optionCount: number): number | undefined {
  if (!Number.isInteger(optionCount) || optionCount <= 0 || typeof value !== 'string') {
    return undefined;
  }
  if (!/^(0|[1-9]\d*)$/u.test(value)) {
    return undefined;
  }
  const index = Number(value);
  return index >= 0 && index < optionCount ? index : undefined;
}

export function createCalendarPageController(
  dependencies: CalendarPageControllerDependencies,
): CalendarPageController {
  let filters: CalendarAssignmentFilters = {};
  let latestCalendar: CalendarReadModel | undefined;
  let latestHolidays: HolidayReadModel | undefined;
  let latestViewModel: CalendarMonthViewModel | undefined;
  let currentContextKey: string | undefined;
  let lastSuccessfulKey: string | undefined;
  let requestGeneration = 0;
  let inFlight: InFlightLoad | undefined;

  const publish = (viewModel: CalendarMonthViewModel): void => {
    latestViewModel = viewModel;
    dependencies.publish(viewModel);
  };

  const isCurrent = (generation: number, key: string): boolean =>
    requestGeneration === generation && currentContextKey === key;

  const rebuild = (): void => {
    if (
      latestCalendar === undefined ||
      latestHolidays === undefined ||
      currentContextKey === undefined
    ) {
      return;
    }
    publish(
      buildCalendarMonthViewModel({
        calendar: latestCalendar,
        filters,
        holidays: latestHolidays,
        status: 'ready',
        today: dependencies.getToday(),
      }),
    );
  };

  return {
    load(target, force = false): Promise<void> {
      const key = `${target.groupId}:${target.groupRole}:${target.businessMonth}`;
      if (inFlight?.key === key) {
        return inFlight.promise;
      }

      const isNewContext = key !== currentContextKey;
      if (isNewContext) {
        currentContextKey = key;
        filters = {};
      }
      if (
        force !== true &&
        key === lastSuccessfulKey &&
        key === currentContextKey &&
        latestCalendar !== undefined &&
        latestHolidays !== undefined &&
        isDataViewModel(latestViewModel)
      ) {
        return Promise.resolve();
      }

      requestGeneration += 1;
      const generation = requestGeneration;
      lastSuccessfulKey = undefined;
      latestCalendar = undefined;
      latestHolidays = undefined;
      try {
        publish(createCalendarMonthStateViewModel(target.businessMonth, 'loading'));
      } catch (error) {
        const message = error instanceof Error ? error.message : undefined;
        publish({
          businessMonth: target.businessMonth,
          message: message ?? 'Failed to initialize the calendar month.',
          monthLabel: target.businessMonth,
          status: getCalendarFailureState(error),
        });
        return Promise.resolve();
      }

      let response: Promise<{
        readonly calendar: CalendarReadModel;
        readonly holidays: HolidayReadModel;
      }>;
      try {
        const { year } = parseBusinessMonth(target.businessMonth);
        response =
          target.groupRole === 'guest'
            ? Promise.all([
                dependencies.getLoggedInGuestCalendar(target.groupId, target.businessMonth),
                dependencies.getGuestHolidays(year),
              ]).then(([guestCalendar, holidays]) => ({
                calendar: guestCalendar.calendar,
                holidays,
              }))
            : Promise.all([
                dependencies.getCalendar(target.groupId, target.businessMonth),
                dependencies.getHolidays(year),
              ]).then(([calendar, holidays]) => ({ calendar, holidays }));
      } catch (error) {
        response = Promise.reject(error);
      }
      const promise = response
        .then(({ calendar, holidays }) => {
          if (!isCurrent(generation, key)) {
            return;
          }
          latestCalendar = calendar;
          latestHolidays = holidays;
          const viewModel = buildCalendarMonthViewModel({
            calendar,
            filters,
            holidays,
            status: 'ready',
            today: dependencies.getToday(),
          });
          publish(viewModel);
          lastSuccessfulKey = key;
        })
        .catch((error: unknown) => {
          if (!isCurrent(generation, key)) {
            return;
          }
          const message = error instanceof Error ? error.message : undefined;
          publish(
            createCalendarMonthStateViewModel(
              target.businessMonth,
              getCalendarFailureState(error),
              message,
            ),
          );
        })
        .finally(() => {
          if (inFlight?.promise === promise) {
            inFlight = undefined;
          }
        });
      inFlight = { key, promise };
      return promise;
    },

    performPhoneAction(actionId): boolean {
      if (actionId.length === 0 || !isDataViewModel(latestViewModel)) {
        return false;
      }
      const action = latestViewModel.weeks
        .flatMap(({ days }) => days)
        .flatMap((day) => (day.kind === 'day' ? day.assignments : []))
        .flatMap(({ phoneActions }) => phoneActions)
        .find((phoneAction) => phoneAction.actionId === actionId);
      if (action === undefined) {
        return false;
      }
      if (action.kind === 'dial') {
        dependencies.makePhoneCall({ phoneNumber: action.number });
      } else {
        dependencies.setClipboardData({ data: action.number });
      }
      return true;
    },

    setFilters(nextFilters): void {
      filters = copyFilters(nextFilters);
      rebuild();
    },
  };
}
