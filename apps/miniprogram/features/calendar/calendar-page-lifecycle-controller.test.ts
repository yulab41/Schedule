import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../api/client.js';
import {
  createCalendarCache,
  type CalendarCache,
  type CalendarCachePort,
} from '../../store/calendar-cache.js';
import { getGoldenCalendar } from './calendar-golden-data.js';
import {
  createCalendarPageController,
  type CalendarContext,
  type CalendarMonthSlotUpdate,
  type CalendarPageControllerDependencies,
} from './calendar-page-controller.js';
import type { CalendarMonthDataViewModel } from './calendar-view-model.js';

const context: CalendarContext = {
  groupId: 'group-1',
  groupRole: 'member',
  groupVersion: 7,
  userId: 'user-1',
};

function createDeferred<Value>() {
  let rejectPromise: ((error: unknown) => void) | undefined;
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });
  return {
    promise,
    reject(error: unknown): void {
      rejectPromise?.(error);
    },
    resolve(value: Value): void {
      resolvePromise?.(value);
    },
  };
}

function holidaysFor(year: number): HolidayReadModel {
  return { confirmed: true, dates: [], year };
}

function isDataViewModel(
  update: CalendarMonthSlotUpdate | undefined,
): update is CalendarMonthSlotUpdate & { readonly viewModel: CalendarMonthDataViewModel } {
  return (
    update?.viewModel.status === 'cached' ||
    update?.viewModel.status === 'ready' ||
    update?.viewModel.status === 'refreshing'
  );
}

function createHarness(overrides: Partial<CalendarPageControllerDependencies> = {}) {
  const updates: CalendarMonthSlotUpdate[] = [];
  const getCalendar = vi.fn((_groupId: string, businessMonth: string) =>
    Promise.resolve(getGoldenCalendar(businessMonth)),
  );
  const dependencies: CalendarPageControllerDependencies = {
    getCalendar,
    getGuestHolidays: (year) => Promise.resolve(holidaysFor(year)),
    getHolidays: (year) => Promise.resolve(holidaysFor(year)),
    getLoggedInGuestCalendar: (groupId, businessMonth) =>
      Promise.resolve({ calendar: getGoldenCalendar(businessMonth), groupName: groupId }),
    getToday: () => '2026-08-15',
    makePhoneCall: () => undefined,
    publish: () => undefined,
    publishUpdate: (update) => updates.push(update),
    setClipboardData: () => undefined,
    ...overrides,
  };
  return {
    controller: createCalendarPageController(dependencies),
    getCalendar: dependencies.getCalendar,
    updates,
  };
}

describe('calendar foreground and lifecycle controller', () => {
  it('keeps the ready month visible while foreground revalidation fails', async () => {
    const refreshCalendar = createDeferred<CalendarReadModel>();
    const refreshHolidays = createDeferred<HolidayReadModel>();
    const harness = createHarness({
      getCalendar: vi
        .fn<(groupId: string, businessMonth: string) => Promise<CalendarReadModel>>()
        .mockResolvedValueOnce(getGoldenCalendar('2026-08'))
        .mockReturnValueOnce(refreshCalendar.promise),
      getHolidays: vi
        .fn<(year: number) => Promise<HolidayReadModel>>()
        .mockResolvedValueOnce(holidaysFor(2026))
        .mockReturnValueOnce(refreshHolidays.promise),
    });
    await harness.controller.loadMonths(context, ['2026-08']);
    harness.updates.length = 0;

    const refresh = harness.controller.loadMonths(context, ['2026-08'], true);

    const refreshing = harness.updates.at(-1);
    expect(refreshing?.viewModel.status).toBe('refreshing');
    expect(isDataViewModel(refreshing) ? refreshing.viewModel.assignmentCount : 0).toBeGreaterThan(
      0,
    );

    refreshCalendar.reject(new Error('foreground refresh unavailable'));
    refreshHolidays.resolve(holidaysFor(2026));
    await refresh;

    const retained = harness.updates.at(-1);
    expect(retained?.viewModel).toMatchObject({ isStale: true, status: 'cached' });
    expect(isDataViewModel(retained) ? retained.viewModel.assignmentCount : 0).toBeGreaterThan(0);
    expect(harness.updates.some(({ viewModel }) => viewModel.status === 'error')).toBe(false);
  });

  it.each([
    ['forbidden', new ApiClientError('FORBIDDEN', '权限已撤销', 'request-1', undefined, 403)],
    ['conflict', new ApiClientError('CONFLICT', '版本已变化', 'request-2', undefined, 409)],
  ] as const)(
    'does not expose stale assignments after a forced %s response',
    async (status, error) => {
      const values = new Map<string, unknown>();
      const removeStorageSync = vi.fn((key: string) => values.delete(key));
      const port: CalendarCachePort = {
        getStorageSync: (key) => values.get(key),
        removeStorageSync,
        setStorageSync: (key, value) => values.set(key, value),
      };
      const cache = createCalendarCache(port);
      const updates: CalendarMonthSlotUpdate[] = [];
      const harness = createHarness({
        cache,
        getCalendar: vi
          .fn<(groupId: string, businessMonth: string) => Promise<CalendarReadModel>>()
          .mockResolvedValueOnce(getGoldenCalendar('2026-08'))
          .mockRejectedValueOnce(error),
        publishUpdate: (update) => updates.push(update),
      });
      await harness.controller.loadMonths(context, ['2026-08']);

      await harness.controller.loadMonths(context, ['2026-08'], true);

      expect(updates.at(-1)?.viewModel).toMatchObject({ status });
      expect(harness.controller.getMonthViewModels(['2026-08'])).toEqual([]);
      expect(removeStorageSync).toHaveBeenCalled();
    },
  );

  it('does not let a stalled optional holiday request block the next foreground revalidation', async () => {
    const firstHolidays = createDeferred<HolidayReadModel>();
    const secondHolidays = createDeferred<HolidayReadModel>();
    const getCalendar = vi.fn((_groupId: string, businessMonth: string) =>
      Promise.resolve(getGoldenCalendar(businessMonth)),
    );
    const harness = createHarness({
      getCalendar,
      getHolidays: vi
        .fn<(year: number) => Promise<HolidayReadModel>>()
        .mockReturnValueOnce(firstHolidays.promise)
        .mockReturnValueOnce(secondHolidays.promise),
    });

    void harness.controller.loadMonths(context, ['2026-08'], true);
    await vi.waitFor(() => expect(harness.updates.at(-1)?.viewModel.status).toBe('ready'));
    expect(harness.updates.at(-1)?.viewModel.status).toBe('ready');

    const nextForeground = harness.controller.loadMonths(context, ['2026-08'], true);
    expect(getCalendar).toHaveBeenCalledTimes(2);

    secondHolidays.resolve(holidaysFor(2026));
    await nextForeground;
    const updateCount = harness.updates.length;
    firstHolidays.resolve(holidaysFor(2026));
    await firstHolidays.promise;
    await Promise.resolve();
    expect(harness.updates).toHaveLength(updateCount);
  });

  it('contains a late optional holiday enrichment failure after the calendar is ready', async () => {
    const pendingHolidays = createDeferred<HolidayReadModel>();
    let writeCount = 0;
    const cache: CalendarCache = {
      read: () => undefined,
      remove: () => undefined,
      removeForUser: () => undefined,
      removeForUserGroup: () => undefined,
      write: () => {
        writeCount += 1;
        if (writeCount === 2) throw new Error('late optional cache write failed');
      },
    };
    const harness = createHarness({
      cache,
      getHolidays: vi.fn(() => pendingHolidays.promise),
    });

    await harness.controller.loadMonths(context, ['2026-08'], true);
    expect(harness.updates.at(-1)?.viewModel.status).toBe('ready');

    pendingHolidays.resolve(holidaysFor(2026));
    await pendingHolidays.promise;
    await Promise.resolve();

    expect(writeCount).toBe(2);
    expect(harness.updates.at(-1)?.viewModel.status).toBe('ready');
  });

  it('evicts months outside the current page window and reloads them on re-entry', async () => {
    const harness = createHarness();
    await harness.controller.loadMonths(context, ['2026-07', '2026-08', '2026-09']);

    await harness.controller.loadMonths(context, ['2026-10', '2026-11', '2026-12']);

    expect(harness.controller.getMonthViewModels(['2026-07', '2026-08', '2026-09'])).toEqual([]);
    expect(harness.controller.getMonthViewModels(['2026-10', '2026-11', '2026-12'])).toHaveLength(
      3,
    );

    await harness.controller.loadMonths(context, ['2026-08']);
    expect(harness.getCalendar).toHaveBeenCalledTimes(7);
  });

  it('does not retain a previous account context for later reactivation', async () => {
    const harness = createHarness();
    await harness.controller.loadMonths(context, ['2026-08']);
    const otherContext = { ...context, groupId: 'group-2', userId: 'user-2' };

    harness.controller.activate(otherContext);
    harness.controller.activate(context);

    expect(harness.controller.getMonthViewModels(['2026-08'])).toEqual([]);
  });

  it('disposes pending slots so late calendar results cannot publish sensitive data', async () => {
    const pendingCalendar = createDeferred<CalendarReadModel>();
    const pendingHolidays = createDeferred<HolidayReadModel>();
    const harness = createHarness({
      getCalendar: vi.fn(() => pendingCalendar.promise),
      getHolidays: vi.fn(() => pendingHolidays.promise),
    });
    const loading = harness.controller.loadMonths(context, ['2026-08']);
    const updateCountBeforeDispose = harness.updates.length;

    harness.controller.dispose();
    pendingCalendar.resolve(getGoldenCalendar('2026-08'));
    pendingHolidays.resolve(holidaysFor(2026));
    await loading;

    expect(harness.updates).toHaveLength(updateCountBeforeDispose);
    expect(harness.controller.getMonthViewModels(['2026-08'])).toEqual([]);
  });
});
