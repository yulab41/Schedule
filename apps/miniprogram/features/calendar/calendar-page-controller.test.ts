import { ApiClientError } from '../../api/client.js';
import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createCalendarPageController,
  getCalendarFailureState,
  parseSelectorPickerIndex,
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
