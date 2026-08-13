import { ApiClientError } from '../../api/client.js';
import { createCalendarCache, type CalendarCachePort } from '../../store/calendar-cache.js';
import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createCalendarPageController,
  getCalendarFailureState,
  parseSelectorPickerIndex,
  type CalendarMonthSlotUpdate,
  type CalendarPageControllerDependencies,
} from './calendar-page-controller.js';
import type { CalendarMonthDataViewModel, CalendarMonthViewModel } from './calendar-view-model.js';

const calendar: CalendarReadModel = {
  assignments: [
    {
      businessDate: '2026-08-15',
      changeMarkers: ['swap'],
      endsAt: '2026-08-15T08:00:00+08:00',
      id: 'assignment-confirmed',
      plannedMemberName: '已确认成员',
      plannedMembershipId: 'confirmed',
      schedulePeriodId: 'period-1',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '门诊',
      shiftTypeAbbreviation: 'A',
      shiftTypeColor: '#123456',
      shiftTypeId: 'shift-1',
      shiftTypeName: '日班',
      shiftTypeTextColor: '#FFFFFF',
      slotPosition: 1,
      startsAt: '2026-08-15T06:00:00+08:00',
    },
    {
      actualMemberName: '未确认成员',
      actualMembershipId: 'unconfirmed',
      businessDate: '2026-08-15',
      changeMarkers: [],
      endsAt: '2026-08-15T10:00:00+08:00',
      id: 'assignment-unconfirmed',
      schedulePeriodId: 'period-2',
      scheduleRoleId: 'role-2',
      scheduleRoleName: '急诊',
      shiftTypeAbbreviation: 'B',
      shiftTypeColor: '#654321',
      shiftTypeId: 'shift-2',
      shiftTypeName: '夜班',
      shiftTypeTextColor: '#000000',
      slotPosition: 1,
      startsAt: '2026-08-15T08:00:00+08:00',
    },
  ],
  businessMonth: '2026-08',
  groupId: 'group-1',
  members: [
    {
      isConfirmed: true,
      membershipId: 'confirmed',
      mobilePhone: '13800000000',
      realName: '已确认成员',
    },
    {
      isConfirmed: false,
      membershipId: 'unconfirmed',
      mobilePhone: '13900000000',
      realName: '未确认成员',
    },
  ],
  roles: [
    { id: 'role-1', name: '门诊' },
    { id: 'role-2', name: '急诊' },
  ],
  shiftTypes: [
    {
      abbreviation: 'A',
      color: '#123456',
      crossesMidnight: false,
      id: 'shift-1',
      isAllDay: false,
      name: '日班',
      textColor: '#FFFFFF',
    },
    {
      abbreviation: 'B',
      color: '#654321',
      crossesMidnight: false,
      id: 'shift-2',
      isAllDay: false,
      name: '夜班',
      textColor: '#000000',
    },
  ],
};

const holidays: HolidayReadModel = { confirmed: true, dates: [], year: 2026 };

function getLastDataViewModel(
  published: readonly CalendarMonthViewModel[],
): CalendarMonthDataViewModel {
  const value = published.at(-1);
  if (
    value === undefined ||
    (value.status !== 'cached' && value.status !== 'ready' && value.status !== 'refreshing')
  ) {
    throw new Error('expected a calendar data view model');
  }
  return value;
}

function createDeferred<Value>() {
  let reject: ((error: unknown) => void) | undefined;
  let resolve: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    reject(error: unknown): void {
      reject?.(error);
    },
    resolve(value: Value): void {
      resolve?.(value);
    },
  };
}

function createSeptemberCalendar(): CalendarReadModel {
  return {
    ...calendar,
    assignments: calendar.assignments.map((assignment) => ({
      ...assignment,
      businessDate: '2026-09-15',
      endsAt: assignment.endsAt.replace('2026-08-15', '2026-09-15'),
      startsAt: assignment.startsAt.replace('2026-08-15', '2026-09-15'),
    })),
    businessMonth: '2026-09',
  };
}

function createCalendarForMonth(businessMonth: string, groupId = 'group-1'): CalendarReadModel {
  const businessDate = `${businessMonth}-15`;
  return {
    ...calendar,
    assignments: calendar.assignments.map((assignment) => ({
      ...assignment,
      businessDate,
      endsAt: assignment.endsAt.replace('2026-08-15', businessDate),
      startsAt: assignment.startsAt.replace('2026-08-15', businessDate),
    })),
    businessMonth,
    groupId,
  };
}

function createHoliday(year: number, date: string, holidayName: string): HolidayReadModel {
  return {
    confirmed: true,
    dates: [{ date, holidayName, isOffDay: true, isWorkday: false }],
    year,
  };
}

function getHolidayName(
  viewModel: CalendarMonthDataViewModel,
  businessDate: string,
): string | undefined {
  const day = viewModel.weeks
    .flatMap(({ days }) => days)
    .find((candidate) => candidate.kind === 'day' && candidate.businessDate === businessDate);
  return day?.kind === 'day' ? day.holiday?.holidayName : undefined;
}

function createHarness(overrides: Partial<CalendarPageControllerDependencies> = {}) {
  const getCalendar = vi.fn<(groupId: string, businessMonth: string) => Promise<CalendarReadModel>>(
    () => Promise.resolve(calendar),
  );
  const getHolidays = vi.fn<(year: number) => Promise<HolidayReadModel>>(() =>
    Promise.resolve(holidays),
  );
  const getLoggedInGuestCalendar = vi.fn(() => Promise.resolve({ calendar, groupName: '一病区' }));
  const getGuestHolidays = vi.fn<(year: number) => Promise<HolidayReadModel>>(() =>
    Promise.resolve(holidays),
  );
  const makePhoneCall = vi.fn();
  const published: CalendarMonthViewModel[] = [];
  const publish = vi.fn((viewModel: CalendarMonthViewModel) => {
    published.push(viewModel);
  });
  const setClipboardData = vi.fn();
  const dependencies: CalendarPageControllerDependencies = {
    getCalendar,
    getGuestHolidays,
    getHolidays,
    getLoggedInGuestCalendar,
    getToday: () => '2026-08-15',
    makePhoneCall,
    publish,
    setClipboardData,
    ...overrides,
  };
  return {
    controller: createCalendarPageController(dependencies),
    getCalendar: dependencies.getCalendar,
    getGuestHolidays: dependencies.getGuestHolidays,
    getHolidays: dependencies.getHolidays,
    getLoggedInGuestCalendar: dependencies.getLoggedInGuestCalendar,
    makePhoneCall,
    publish,
    published,
    setClipboardData,
  };
}

function createMemoryCache() {
  const values = new Map<string, unknown>();
  const calls = { reads: 0, writes: 0 };
  const port: CalendarCachePort = {
    getStorageSync(key) {
      calls.reads += 1;
      return values.get(key);
    },
    removeStorageSync(key) {
      values.delete(key);
    },
    setStorageSync(key, value) {
      calls.writes += 1;
      values.set(key, value);
    },
  };
  return { cache: createCalendarCache(port), calls, values };
}

describe('calendar page controller', () => {
  it('classifies forbidden before conflict using code or status', () => {
    expect(
      getCalendarFailureState(new ApiClientError('FORBIDDEN', 'denied', 'req', undefined, 403)),
    ).toBe('forbidden');
    expect(
      getCalendarFailureState(
        new ApiClientError('OTHER', 'denied by status', 'req', undefined, 403),
      ),
    ).toBe('forbidden');
    expect(
      getCalendarFailureState(
        new ApiClientError('FORBIDDEN', 'denied by code', 'req', undefined, 500),
      ),
    ).toBe('forbidden');
    expect(
      getCalendarFailureState(
        new ApiClientError('FORBIDDEN', 'forbidden wins', 'req', undefined, 409),
      ),
    ).toBe('forbidden');
    expect(
      getCalendarFailureState(
        new ApiClientError('CONFLICT', 'forbidden status wins', 'req', undefined, 403),
      ),
    ).toBe('forbidden');
    expect(
      getCalendarFailureState(new ApiClientError('CONFLICT', 'changed', 'req', undefined, 409)),
    ).toBe('conflict');
    expect(
      getCalendarFailureState(
        new ApiClientError('OTHER', 'changed by status', 'req', undefined, 409),
      ),
    ).toBe('conflict');
    expect(getCalendarFailureState(new Error('offline'))).toBe('error');
  });

  it('single-flights and caches one protected owner/member load', async () => {
    const harness = createHarness();
    const target = { businessMonth: '2026-08', groupId: 'group-1', groupRole: 'owner' } as const;
    const first = harness.controller.load(target);
    const second = harness.controller.load(target);
    expect(first).toBe(second);
    await first;
    await harness.controller.load(target);
    expect(harness.getCalendar).toHaveBeenCalledTimes(1);
    expect(harness.getCalendar).toHaveBeenCalledWith('group-1', '2026-08');
    expect(harness.getHolidays).toHaveBeenCalledTimes(1);
    expect(harness.getHolidays).toHaveBeenCalledWith(2026);
    expect(harness.getLoggedInGuestCalendar).not.toHaveBeenCalled();
    expect(harness.getGuestHolidays).not.toHaveBeenCalled();
  });

  it('uses only guest calendar and holiday endpoints for a guest', async () => {
    const harness = createHarness();
    await harness.controller.load({
      businessMonth: '2026-08',
      groupId: 'guest-group',
      groupRole: 'guest',
    });
    expect(harness.getLoggedInGuestCalendar).toHaveBeenCalledWith('guest-group', '2026-08');
    expect(harness.getGuestHolidays).toHaveBeenCalledWith(2026);
    expect(harness.getCalendar).not.toHaveBeenCalled();
    expect(harness.getHolidays).not.toHaveBeenCalled();
  });

  it('runs one additional endpoint pair for a forced same-key retry', async () => {
    const harness = createHarness();
    const target = { businessMonth: '2026-08', groupId: 'group-1', groupRole: 'member' } as const;
    await harness.controller.load(target);
    const firstRetry = harness.controller.load(target, true);
    const secondRetry = harness.controller.load(target, true);
    expect(firstRetry).toBe(secondRetry);
    await firstRetry;
    expect(harness.getCalendar).toHaveBeenCalledTimes(2);
    expect(harness.getHolidays).toHaveBeenCalledTimes(2);
  });

  it('rebuilds copied filters locally and exposes only verified phone effects', async () => {
    const harness = createHarness();
    await harness.controller.load({
      businessMonth: '2026-08',
      groupId: 'group-1',
      groupRole: 'member',
    });
    const sourceAssignments = calendar.assignments.map(({ id }) => id);
    harness.controller.setFilters({ roleIds: ['role-1'], onlyChanges: true });
    expect(harness.getCalendar).toHaveBeenCalledTimes(1);
    expect(harness.getHolidays).toHaveBeenCalledTimes(1);
    expect(calendar.assignments.map(({ id }) => id)).toEqual(sourceAssignments);
    expect(getLastDataViewModel(harness.published).filters.selectedRoleIndex).toBe(1);

    harness.controller.setFilters({});
    const actions = getLastDataViewModel(harness.published)
      .weeks.flatMap(({ days }) => days)
      .flatMap((day) => (day.kind === 'day' ? day.assignments : []))
      .flatMap(({ phoneActions }) => phoneActions);
    const dial = actions.find(({ kind }) => kind === 'dial');
    const copy = actions.find(({ kind }) => kind === 'copy');
    if (dial === undefined || copy === undefined) throw new Error('phone fixture incomplete');
    expect(harness.controller.performPhoneAction(dial.actionId)).toBe(true);
    expect(harness.controller.performPhoneAction(copy.actionId)).toBe(true);
    expect(harness.controller.performPhoneAction('unknown')).toBe(false);
    expect(harness.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: dial.number });
    expect(harness.setClipboardData).toHaveBeenCalledWith({ data: copy.number });
  });

  it('invalidates old actions and keeps the original failure message', async () => {
    let rejectCalendar: ((error: Error) => void) | undefined;
    const harness = createHarness({
      getCalendar: vi
        .fn()
        .mockResolvedValueOnce(calendar)
        .mockImplementationOnce(
          () =>
            new Promise<CalendarReadModel>((_resolve, reject) => {
              rejectCalendar = reject;
            }),
        ),
    });
    await harness.controller.load({
      businessMonth: '2026-08',
      groupId: 'group-1',
      groupRole: 'member',
    });
    const oldAction = getLastDataViewModel(harness.published)
      .weeks.flatMap(({ days }) => days)
      .flatMap((day) => (day.kind === 'day' ? day.assignments : []))[0]?.phoneActions[0];
    if (oldAction === undefined) throw new Error('phone fixture incomplete');
    const nextLoad = harness.controller.load({
      businessMonth: '2026-09',
      groupId: 'group-1',
      groupRole: 'member',
    });
    expect(harness.controller.performPhoneAction(oldAction.actionId)).toBe(false);
    rejectCalendar?.(new Error('september unavailable'));
    await nextLoad;
    expect(harness.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'september unavailable', status: 'error' }),
    );
  });

  it('clears its slot after a synchronous endpoint failure so the same target can retry', async () => {
    const getCalendar = vi
      .fn<(groupId: string, businessMonth: string) => Promise<CalendarReadModel>>()
      .mockImplementationOnce(() => {
        throw new Error('synchronous calendar failure');
      })
      .mockResolvedValueOnce(calendar);
    const harness = createHarness({ getCalendar });
    const target = { businessMonth: '2026-08', groupId: 'group-1', groupRole: 'member' } as const;

    await harness.controller.load(target);
    expect(harness.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'synchronous calendar failure', status: 'error' }),
    );
    await harness.controller.load(target);

    expect(getCalendar).toHaveBeenCalledTimes(2);
    expect(getLastDataViewModel(harness.published).status).toBe('ready');
  });

  it('keeps a newer in-flight month when an older request finishes later', async () => {
    const augustCalendar = createDeferred<CalendarReadModel>();
    const augustHolidays = createDeferred<HolidayReadModel>();
    const septemberCalendar = createDeferred<CalendarReadModel>();
    const septemberHolidays = createDeferred<HolidayReadModel>();
    const harness = createHarness({
      getCalendar: vi
        .fn<(groupId: string, businessMonth: string) => Promise<CalendarReadModel>>()
        .mockReturnValueOnce(augustCalendar.promise)
        .mockReturnValueOnce(septemberCalendar.promise),
      getHolidays: vi
        .fn<(year: number) => Promise<HolidayReadModel>>()
        .mockReturnValueOnce(augustHolidays.promise)
        .mockReturnValueOnce(septemberHolidays.promise),
    });
    const augustTarget = {
      businessMonth: '2026-08',
      groupId: 'group-1',
      groupRole: 'member',
    } as const;
    const septemberTarget = { ...augustTarget, businessMonth: '2026-09' } as const;

    const augustLoad = harness.controller.load(augustTarget);
    const septemberLoad = harness.controller.load(septemberTarget);
    augustCalendar.resolve(calendar);
    augustHolidays.resolve(holidays);
    await augustLoad;

    expect(harness.controller.load(septemberTarget)).toBe(septemberLoad);
    septemberCalendar.resolve(createSeptemberCalendar());
    septemberHolidays.resolve(holidays);
    await septemberLoad;

    expect(getLastDataViewModel(harness.published).businessMonth).toBe('2026-09');
  });

  it('does not return a cached month while another context is loading', async () => {
    const septemberCalendar = createDeferred<CalendarReadModel>();
    const septemberHolidays = createDeferred<HolidayReadModel>();
    const refreshedAugustCalendar = createDeferred<CalendarReadModel>();
    const refreshedAugustHolidays = createDeferred<HolidayReadModel>();
    const harness = createHarness({
      getCalendar: vi
        .fn<(groupId: string, businessMonth: string) => Promise<CalendarReadModel>>()
        .mockResolvedValueOnce(calendar)
        .mockReturnValueOnce(septemberCalendar.promise)
        .mockReturnValueOnce(refreshedAugustCalendar.promise),
      getHolidays: vi
        .fn<(year: number) => Promise<HolidayReadModel>>()
        .mockResolvedValueOnce(holidays)
        .mockReturnValueOnce(septemberHolidays.promise)
        .mockReturnValueOnce(refreshedAugustHolidays.promise),
    });
    const augustTarget = {
      businessMonth: '2026-08',
      groupId: 'group-1',
      groupRole: 'member',
    } as const;
    const septemberTarget = { ...augustTarget, businessMonth: '2026-09' } as const;

    await harness.controller.load(augustTarget);
    const septemberLoad = harness.controller.load(septemberTarget);
    const augustReload = harness.controller.load(augustTarget);

    expect(harness.getCalendar).toHaveBeenCalledTimes(3);
    refreshedAugustCalendar.resolve(calendar);
    refreshedAugustHolidays.resolve(holidays);
    await augustReload;
    septemberCalendar.resolve(createSeptemberCalendar());
    septemberHolidays.resolve(holidays);
    await septemberLoad;
  });

  it('loads three month slots with one holiday request per year', async () => {
    const memory = createMemoryCache();
    const updates: CalendarMonthSlotUpdate[] = [];
    const harness = createHarness({
      cache: memory.cache,
      publishUpdate: (update) => updates.push(update),
    });
    const context = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };
    await harness.controller.loadMonths(context, ['2026-07', '2026-08', '2026-09']);
    expect(harness.getCalendar).toHaveBeenCalledTimes(3);
    expect(harness.getHolidays).toHaveBeenCalledTimes(1);
    expect(updates.filter(({ viewModel }) => viewModel.status === 'ready')).toHaveLength(3);
    expect(memory.calls.writes).toBe(6);
  });

  it('reloads an evicted slot when it re-enters a newly mounted page window', async () => {
    const updates: CalendarMonthSlotUpdate[] = [];
    const harness = createHarness({ publishUpdate: (update) => updates.push(update) });
    const context = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };

    await harness.controller.loadMonths(context, ['2026-08', '2026-09']);
    updates.length = 0;
    await harness.controller.loadMonths(context, ['2026-09']);
    updates.length = 0;

    await harness.controller.loadMonths(context, ['2026-08']);

    expect(updates[0]).toMatchObject({
      businessMonth: '2026-08',
      viewModel: { status: 'loading' },
    });
    expect(updates.at(-1)).toMatchObject({
      businessMonth: '2026-08',
      viewModel: { status: 'ready' },
    });
    expect(harness.getCalendar).toHaveBeenCalledTimes(3);
    expect(harness.getHolidays).toHaveBeenCalledTimes(2);
  });

  it('drops one invalidated ready slot so the next onShow load must fetch it again', async () => {
    const updates: CalendarMonthSlotUpdate[] = [];
    const harness = createHarness({ publishUpdate: (update) => updates.push(update) });
    const context = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };

    await harness.controller.loadMonths(context, ['2026-08', '2026-09']);
    harness.controller.invalidate(context, ['2026-08']);
    updates.length = 0;
    await harness.controller.loadMonths(context, ['2026-08', '2026-09']);

    expect(harness.getCalendar).toHaveBeenCalledTimes(3);
    expect(updates).toContainEqual(
      expect.objectContaining({
        businessMonth: '2026-08',
        viewModel: expect.objectContaining({ status: 'ready' }),
      }),
    );

    harness.controller.invalidate({ ...context, userId: 'other-user' }, ['2026-09']);
    await harness.controller.loadMonths(context, ['2026-08', '2026-09']);
    expect(harness.getCalendar).toHaveBeenCalledTimes(3);
  });

  it('publishes a cached snapshot before refresh and keeps it on failure', async () => {
    const memory = createMemoryCache();
    const context = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };
    const first = createHarness({ cache: memory.cache });
    await first.controller.loadMonths(context, ['2026-08']);
    const writes = memory.calls.writes;
    const updates: CalendarMonthSlotUpdate[] = [];
    const second = createHarness({
      cache: memory.cache,
      getCalendar: vi.fn(() => Promise.reject(new Error('offline'))),
      getHolidays: vi.fn(() => Promise.reject(new Error('offline'))),
      publishUpdate: (update) => updates.push(update),
    });
    await second.controller.loadMonths(context, ['2026-08']);
    expect(updates[0]?.viewModel.status).toBe('cached');
    expect(updates.at(-1)?.viewModel).toMatchObject({ isStale: true, status: 'cached' });
    expect(updates.some(({ viewModel }) => viewModel.status === 'error')).toBe(false);
    expect(memory.calls.writes).toBe(writes);
  });

  it('publishes a successful schedule without waiting for holidays and remains ready when holidays fail', async () => {
    const calendarResponse = createDeferred<CalendarReadModel>();
    const holidayResponse = createDeferred<HolidayReadModel>();
    const updates: CalendarMonthSlotUpdate[] = [];
    const harness = createHarness({
      getCalendar: vi.fn(() => calendarResponse.promise),
      getHolidays: vi.fn(() => holidayResponse.promise),
      publishUpdate: (update) => updates.push(update),
    });
    const context = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };

    const loading = harness.controller.loadMonths(context, ['2026-08']);
    calendarResponse.resolve(calendar);
    await calendarResponse.promise;
    await Promise.resolve();

    const readyBeforeHolidays = updates.at(-1)?.viewModel;
    expect(readyBeforeHolidays?.status).toBe('ready');
    if (readyBeforeHolidays?.status !== 'ready') throw new Error('expected ready calendar');
    expect(getHolidayName(readyBeforeHolidays, '2026-08-15')).toBeUndefined();

    holidayResponse.reject(new Error('holiday service unavailable'));
    await loading;

    expect(updates.at(-1)?.viewModel.status).toBe('ready');
    expect(updates.some(({ viewModel }) => viewModel.status === 'error')).toBe(false);
  });

  it('preserves the last valid holidays when a forced holiday refresh fails', async () => {
    const previousHolidays = createHoliday(2026, '2026-08-15', '旧节日');
    const updates: CalendarMonthSlotUpdate[] = [];
    const harness = createHarness({
      getCalendar: vi.fn(() => Promise.resolve(calendar)),
      getHolidays: vi
        .fn<(year: number) => Promise<HolidayReadModel>>()
        .mockResolvedValueOnce(previousHolidays)
        .mockRejectedValueOnce(new Error('holiday refresh failed')),
      publishUpdate: (update) => updates.push(update),
    });
    const context = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };

    await harness.controller.loadMonths(context, ['2026-08']);
    await harness.controller.loadMonths(context, ['2026-08'], true);

    const latest = updates.at(-1)?.viewModel;
    expect(latest?.status).toBe('ready');
    if (latest?.status !== 'ready') throw new Error('expected ready calendar');
    expect(getHolidayName(latest, '2026-08-15')).toBe('旧节日');
  });

  it('starts a new holiday request after invalidation and drops the old generation when it finishes late', async () => {
    const oldCalendar = createDeferred<CalendarReadModel>();
    const oldHolidays = createDeferred<HolidayReadModel>();
    const nextCalendar = createDeferred<CalendarReadModel>();
    const nextHolidays = createDeferred<HolidayReadModel>();
    const updates: CalendarMonthSlotUpdate[] = [];
    const harness = createHarness({
      getCalendar: vi
        .fn<(groupId: string, businessMonth: string) => Promise<CalendarReadModel>>()
        .mockReturnValueOnce(oldCalendar.promise)
        .mockReturnValueOnce(nextCalendar.promise),
      getHolidays: vi
        .fn<(year: number) => Promise<HolidayReadModel>>()
        .mockReturnValueOnce(oldHolidays.promise)
        .mockReturnValueOnce(nextHolidays.promise),
      publishUpdate: (update) => updates.push(update),
    });
    const context = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };

    const staleLoad = harness.controller.loadMonths(context, ['2026-08']);
    harness.controller.invalidate(context, ['2026-08']);
    const currentLoad = harness.controller.loadMonths(context, ['2026-08'], true);

    expect(harness.getHolidays).toHaveBeenCalledTimes(2);
    nextCalendar.resolve(calendar);
    nextHolidays.resolve(createHoliday(2026, '2026-08-15', '新节日'));
    await currentLoad;

    const current = updates.at(-1)?.viewModel;
    expect(current?.status).toBe('ready');
    if (current?.status !== 'ready') throw new Error('expected ready calendar');
    expect(getHolidayName(current, '2026-08-15')).toBe('新节日');
    const updateCount = updates.length;

    oldCalendar.resolve(calendar);
    oldHolidays.resolve(createHoliday(2026, '2026-08-15', '陈旧节日'));
    await staleLoad;

    expect(updates).toHaveLength(updateCount);
    const afterStale = updates.at(-1)?.viewModel;
    if (afterStale?.status !== 'ready') throw new Error('expected ready calendar');
    expect(getHolidayName(afterStale, '2026-08-15')).toBe('新节日');
  });

  it('does not publish an old context and year after the next context is ready', async () => {
    const oldCalendar = createDeferred<CalendarReadModel>();
    const oldHolidays = createDeferred<HolidayReadModel>();
    const nextCalendar = createDeferred<CalendarReadModel>();
    const nextHolidays = createDeferred<HolidayReadModel>();
    const updates: CalendarMonthSlotUpdate[] = [];
    const harness = createHarness({
      getCalendar: vi.fn((_groupId: string, businessMonth: string) =>
        businessMonth === '2026-12' ? oldCalendar.promise : nextCalendar.promise,
      ),
      getHolidays: vi.fn((year: number) =>
        year === 2026 ? oldHolidays.promise : nextHolidays.promise,
      ),
      publishUpdate: (update) => updates.push(update),
    });
    const oldContext = {
      groupId: 'group-1',
      groupRole: 'member' as const,
      groupVersion: 7,
      userId: 'user-1',
    };
    const nextContext = {
      groupId: 'group-2',
      groupRole: 'member' as const,
      groupVersion: 3,
      userId: 'user-1',
    };

    const staleLoad = harness.controller.loadMonths(oldContext, ['2026-12']);
    const currentLoad = harness.controller.loadMonths(nextContext, ['2027-01']);
    nextCalendar.resolve(createCalendarForMonth('2027-01', 'group-2'));
    nextHolidays.resolve(createHoliday(2027, '2027-01-15', '新年节日'));
    await currentLoad;

    const current = updates.at(-1);
    expect(current).toMatchObject({
      businessMonth: '2027-01',
      context: nextContext,
      viewModel: { status: 'ready' },
    });
    if (current?.viewModel.status !== 'ready') throw new Error('expected ready calendar');
    expect(getHolidayName(current.viewModel, '2027-01-15')).toBe('新年节日');
    const updateCount = updates.length;

    oldCalendar.resolve(createCalendarForMonth('2026-12'));
    oldHolidays.resolve(createHoliday(2026, '2026-12-15', '陈旧节日'));
    await staleLoad;

    expect(updates).toHaveLength(updateCount);
    expect(updates.at(-1)?.context).toMatchObject(nextContext);
  });

  it.each([
    ['0', 3, 0],
    ['1', 3, 1],
    ['', 3, undefined],
    [1, 3, undefined],
    ['-1', 3, undefined],
    ['1.5', 3, undefined],
    ['3', 3, undefined],
    ['0', 0, undefined],
    ['0', 1.5, undefined],
    [[1], 3, undefined],
  ] as const)('narrows selector picker value %j', (value, optionCount, expected) => {
    expect(parseSelectorPickerIndex(value, optionCount)).toBe(expected);
  });
});
