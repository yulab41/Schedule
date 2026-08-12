import type {
  CalendarReadModel,
  GroupRole,
  GuestCalendarReadModel,
  HolidayReadModel,
} from '@schedule/contracts';

import { ApiClientError } from '../../api/client.js';
import type {
  CalendarCache,
  CalendarCacheIdentity,
  CalendarCacheRecord,
} from '../../store/calendar-cache.js';
import { buildCalendarCacheKey, isCalendarCacheFresh } from '../../store/calendar-cache.js';
import type { CalendarAssignmentFilters } from './calendar-logic.js';
import { parseBusinessMonth } from './calendar-logic.js';
import {
  buildCalendarMonthViewModel,
  createCalendarMonthStateViewModel,
  type CalendarMonthDataViewModel,
  type CalendarMonthViewModel,
} from './calendar-view-model.js';

export type CalendarFailureStatus = 'conflict' | 'error' | 'forbidden';

export interface CalendarContext {
  readonly groupId: string;
  readonly groupRole: GroupRole;
  readonly groupVersion: number;
  readonly userId: string;
}

export interface CalendarLegacyLoadTarget {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly groupRole: GroupRole;
}

export interface CalendarLoadTarget extends CalendarContext {
  readonly businessMonth: string;
}

export interface CalendarMonthSlotUpdate {
  readonly businessMonth: string;
  readonly context: CalendarContext;
  readonly viewModel: CalendarMonthViewModel;
}

export interface CalendarPageControllerDependencies {
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getLoggedInGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
  getToday(): string;
  makePhoneCall(options: { readonly phoneNumber: string }): void;
  publish:
    ((viewModel: CalendarMonthViewModel) => void) | ((update: CalendarMonthSlotUpdate) => void);
  publishUpdate?(update: CalendarMonthSlotUpdate): void;
  cache?: CalendarCache;
  setClipboardData(options: { readonly data: string }): void;
}

export interface CalendarPageController {
  activate(context: CalendarContext): void;
  getMonthViewModels(months: readonly string[]): readonly CalendarMonthDataViewModel[];
  invalidate(context: CalendarContext, businessMonths: readonly string[]): void;
  load(target: CalendarLoadTarget | CalendarLegacyLoadTarget, force?: boolean): Promise<void>;
  loadMonths(context: CalendarContext, months: readonly string[], force?: boolean): Promise<void>;
  performPhoneAction(actionId: string): boolean;
  setFilters(filters: CalendarAssignmentFilters): void;
}

interface Slot {
  readonly identity: CalendarCacheIdentity;
  calendar?: CalendarReadModel;
  holidays?: HolidayReadModel;
  generation: number;
  inFlight?: Promise<void>;
  cachedSnapshot?: CalendarCacheRecord;
  viewModel?: CalendarMonthViewModel;
}

const fallbackCache: CalendarCache = {
  read: () => undefined,
  remove: () => undefined,
  removeForUser: () => undefined,
  removeForUserGroup: () => undefined,
  write: () => undefined,
};

function isDataViewModel(
  value: CalendarMonthViewModel | undefined,
): value is CalendarMonthDataViewModel {
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

function sameContext(left: CalendarContext | undefined, right: CalendarContext): boolean {
  return (
    left?.groupId === right.groupId &&
    left.groupRole === right.groupRole &&
    left.groupVersion === right.groupVersion &&
    left.userId === right.userId
  );
}

function contextKey(context: CalendarContext): string {
  return `${context.userId}:${context.groupId}:${context.groupRole}:${context.groupVersion}`;
}

function identityFor(context: CalendarContext, businessMonth: string): CalendarCacheIdentity {
  return { ...context, businessMonth };
}

function slotKey(identity: CalendarCacheIdentity): string {
  return buildCalendarCacheKey(identity);
}

function isCurrentData(
  value: CalendarMonthViewModel | undefined,
): value is CalendarMonthDataViewModel {
  return isDataViewModel(value);
}

export function getCalendarFailureState(error: unknown): CalendarFailureStatus {
  if (error instanceof ApiClientError) {
    if (error.code === 'FORBIDDEN' || error.status === 403) return 'forbidden';
    if (error.code === 'CONFLICT' || error.status === 409) return 'conflict';
  }
  return 'error';
}

export function parseSelectorPickerIndex(value: unknown, optionCount: number): number | undefined {
  if (!Number.isInteger(optionCount) || optionCount <= 0 || typeof value !== 'string')
    return undefined;
  if (!/^(0|[1-9]\d*)$/u.test(value)) return undefined;
  const index = Number(value);
  return index >= 0 && index < optionCount ? index : undefined;
}

export function createCalendarPageController(
  dependencies: CalendarPageControllerDependencies,
): CalendarPageController {
  const cache = dependencies.cache ?? fallbackCache;
  const modernPublishing =
    dependencies.cache !== undefined || dependencies.publishUpdate !== undefined;
  const slots = new Map<string, Slot>();
  const holidayFlights = new Map<string, Promise<HolidayReadModel>>();
  let activeContext: CalendarContext | undefined;
  let visibleMonths: readonly string[] = [];
  let filters: CalendarAssignmentFilters = {};

  const emit = (
    context: CalendarContext,
    businessMonth: string,
    viewModel: CalendarMonthViewModel,
  ) => {
    const identity = identityFor(context, businessMonth);
    const slot = slots.get(slotKey(identity));
    if (slot !== undefined) slot.viewModel = viewModel;
    const update = { businessMonth, context, viewModel } satisfies CalendarMonthSlotUpdate;
    if (dependencies.publishUpdate !== undefined) {
      dependencies.publishUpdate(update);
    } else if (modernPublishing) {
      (dependencies.publish as (value: CalendarMonthSlotUpdate) => void)(update);
    } else {
      (dependencies.publish as (value: CalendarMonthViewModel) => void)(viewModel);
    }
  };

  const holidayFor = (
    context: CalendarContext,
    year: number,
    deduplicate = true,
  ): Promise<HolidayReadModel> => {
    if (!deduplicate) {
      return context.groupRole === 'guest'
        ? dependencies.getGuestHolidays(year)
        : dependencies.getHolidays(year);
    }
    const key = `${contextKey(context)}:${year}`;
    const existing = holidayFlights.get(key);
    if (existing !== undefined) return existing;
    const promise = (
      context.groupRole === 'guest'
        ? dependencies.getGuestHolidays(year)
        : dependencies.getHolidays(year)
    ).finally(() => {
      if (holidayFlights.get(key) === promise) holidayFlights.delete(key);
    });
    holidayFlights.set(key, promise);
    return promise;
  };

  const publishState = (
    target: CalendarContext & { readonly businessMonth: string },
    status: 'loading' | CalendarFailureStatus,
    message?: string,
  ) => {
    emit(
      target,
      target.businessMonth,
      status === 'loading'
        ? createCalendarMonthStateViewModel(target.businessMonth, status)
        : createCalendarMonthStateViewModel(target.businessMonth, status, message),
    );
  };

  const loadOne = (
    target: CalendarLoadTarget,
    force: boolean,
    deduplicateHolidays = true,
  ): Promise<void> => {
    const identity = identityFor(target, target.businessMonth);
    const key = slotKey(identity);
    let slot = slots.get(key);
    if (slot === undefined) {
      slot = { generation: 0, identity };
      slots.set(key, slot);
    }
    if (slot.inFlight !== undefined) return slot.inFlight;
    if (
      !force &&
      isCurrentData(slot.viewModel) &&
      slot.calendar !== undefined &&
      slot.holidays !== undefined
    ) {
      emit(target, target.businessMonth, slot.viewModel);
      return Promise.resolve();
    }

    if (slot.calendar === undefined || slot.holidays === undefined || force) {
      slot.cachedSnapshot = undefined;
      const record = cache.read(identity);
      if (record !== undefined) {
        slot.cachedSnapshot = record;
        slot.calendar = record.calendar;
        slot.holidays = record.holidays;
        emit(
          target,
          target.businessMonth,
          buildCalendarMonthViewModel({
            calendar: record.calendar,
            filters,
            holidays: record.holidays,
            isStale: !isCalendarCacheFresh(record),
            cacheSavedAt: record.savedAt,
            status: 'cached',
            today: dependencies.getToday(),
          }),
        );
      } else {
        publishState(target, 'loading');
      }
    }

    slot.generation += 1;
    const generation = slot.generation;
    const year = parseBusinessMonth(target.businessMonth).year;
    let response: Promise<{
      readonly calendar: CalendarReadModel;
      readonly holidays: HolidayReadModel;
    }>;
    try {
      const calendarPromise =
        target.groupRole === 'guest'
          ? dependencies
              .getLoggedInGuestCalendar(target.groupId, target.businessMonth)
              .then(({ calendar }) => calendar)
          : dependencies.getCalendar(target.groupId, target.businessMonth);
      response = Promise.all([calendarPromise, holidayFor(target, year, deduplicateHolidays)]).then(
        ([calendar, holidays]) => ({ calendar, holidays }),
      );
    } catch (error) {
      response = Promise.reject(error);
    }
    const request = response
      .then(({ calendar, holidays }) => {
        const current = slots.get(key);
        if (
          current !== slot ||
          current.generation !== generation ||
          !sameContext(activeContext, target)
        )
          return;
        slot.calendar = calendar;
        slot.holidays = holidays;
        const viewModel = buildCalendarMonthViewModel({
          calendar,
          filters,
          holidays,
          status: 'ready',
          today: dependencies.getToday(),
        });
        emit(target, target.businessMonth, viewModel);
        cache.write(identity, calendar, holidays);
      })
      .catch((error: unknown) => {
        const current = slots.get(key);
        if (
          current !== slot ||
          current.generation !== generation ||
          !sameContext(activeContext, target)
        )
          return;
        if (slot.cachedSnapshot !== undefined && isCurrentData(slot.viewModel)) {
          emit(
            target,
            target.businessMonth,
            buildCalendarMonthViewModel({
              calendar: slot.cachedSnapshot.calendar,
              filters,
              holidays: slot.cachedSnapshot.holidays,
              isStale: true,
              cacheSavedAt: slot.cachedSnapshot.savedAt,
              status: 'cached',
              today: dependencies.getToday(),
            }),
          );
          return;
        }
        const message = error instanceof Error ? error.message : undefined;
        publishState(target, getCalendarFailureState(error), message);
      })
      .finally(() => {
        if (slot?.inFlight === request) slot.inFlight = undefined;
      });
    slot.inFlight = request;
    return request;
  };

  const controller: CalendarPageController = {
    activate(context) {
      if (!sameContext(activeContext, context)) {
        activeContext = { ...context };
        filters = {};
        visibleMonths = [];
      }
    },
    getMonthViewModels(months) {
      if (activeContext === undefined) return [];
      const result: CalendarMonthDataViewModel[] = [];
      for (const month of months) {
        const slot = slots.get(slotKey(identityFor(activeContext, month)));
        if (slot !== undefined && isCurrentData(slot.viewModel)) result.push(slot.viewModel);
      }
      return result;
    },
    invalidate(context, businessMonths) {
      for (const businessMonth of new Set(businessMonths)) {
        const key = slotKey(identityFor(context, businessMonth));
        const slot = slots.get(key);
        if (slot === undefined) continue;
        slot.generation += 1;
        slot.cachedSnapshot = undefined;
        slot.calendar = undefined;
        slot.inFlight = undefined;
        slot.viewModel = undefined;
      }
    },
    load(target: CalendarLoadTarget | CalendarLegacyLoadTarget, force = false) {
      const wasDifferentMonth =
        visibleMonths.length !== 1 || visibleMonths[0] !== target.businessMonth;
      const normalizedTarget = {
        ...target,
        groupVersion:
          'groupVersion' in target &&
          Number.isInteger(target.groupVersion) &&
          target.groupVersion > 0
            ? target.groupVersion
            : 1,
        userId:
          'userId' in target && typeof target.userId === 'string' && target.userId.length > 0
            ? target.userId
            : 'legacy-user',
      } as CalendarLoadTarget;
      controller.activate(normalizedTarget);
      visibleMonths = [normalizedTarget.businessMonth];
      return loadOne(normalizedTarget, force || wasDifferentMonth, false);
    },
    loadMonths(context, months, force = false) {
      controller.activate(context);
      const unique = [...new Set(months)];
      unique.forEach((month) => parseBusinessMonth(month));
      visibleMonths = unique;
      return Promise.all(
        unique.map((businessMonth) => loadOne({ ...context, businessMonth }, force)),
      ).then(() => undefined);
    },
    performPhoneAction(actionId) {
      if (actionId.length === 0 || activeContext === undefined) return false;
      for (const month of visibleMonths) {
        const slot = slots.get(slotKey(identityFor(activeContext, month)));
        if (!isCurrentData(slot?.viewModel)) continue;
        for (const day of slot.viewModel.weeks.flatMap(({ days }) => days)) {
          if (day.kind !== 'day') continue;
          for (const assignment of day.assignments) {
            const action = assignment.phoneActions.find(
              (candidate) => candidate.actionId === actionId,
            );
            if (action === undefined) continue;
            if (action.kind === 'dial') dependencies.makePhoneCall({ phoneNumber: action.number });
            else dependencies.setClipboardData({ data: action.number });
            return true;
          }
        }
      }
      return false;
    },
    setFilters(nextFilters) {
      filters = copyFilters(nextFilters);
      if (activeContext === undefined) return;
      for (const month of visibleMonths) {
        const slot = slots.get(slotKey(identityFor(activeContext, month)));
        if (
          slot?.calendar === undefined ||
          slot.holidays === undefined ||
          !isCurrentData(slot.viewModel)
        )
          continue;
        emit(
          activeContext,
          month,
          buildCalendarMonthViewModel({
            calendar: slot.calendar,
            filters,
            holidays: slot.holidays,
            ...(slot.viewModel.status === 'cached'
              ? { cacheSavedAt: slot.viewModel.cacheSavedAt, isStale: slot.viewModel.isStale }
              : {}),
            status: slot.viewModel.status,
            today: dependencies.getToday(),
          }),
        );
      }
    },
  };
  return controller;
}
