import type { HolidayReadModel } from '@schedule/contracts';

import { ApiClientError } from '../../api/client.js';
import { getGoldenCalendar } from '../calendar/calendar-golden-data.js';
import { describe, expect, it, vi } from 'vitest';

import {
  createVisitorCalendarController,
  parseVisitorScene,
  type VisitorCalendarControllerDependencies,
} from './visitor-calendar-controller.js';

const visitorKey = 'a'.repeat(32);
const businessMonth = '2026-08';

function createDependencies(overrides: Partial<VisitorCalendarControllerDependencies> = {}) {
  return {
    getGuestCalendar: vi.fn(async () => ({
      calendar: { ...getGoldenCalendar(businessMonth), groupId: 'group-1' },
      groupName: '公开排班组',
    })),
    getGuestHolidays: vi.fn(async (year: number) => ({
      confirmed: true,
      dates: [
        {
          date: `${year}-08-15`,
          holidayName: 'visitor-holiday',
          isOffDay: true,
          isWorkday: false,
        },
      ],
      year,
    })),
    getToday: () => '2026-08-12',
    resolveGuestGroup: vi.fn(async () => ({ groupId: 'group-1', groupName: '公开排班组' })),
    ...overrides,
  } satisfies VisitorCalendarControllerDependencies;
}

describe('visitor calendar controller', () => {
  it('accepts a legal scene after exactly one decode and fetches only the resolved public group calendar', async () => {
    const dependencies = createDependencies();
    const controller = createVisitorCalendarController(dependencies);

    await controller.activate(visitorKey);

    expect(dependencies.resolveGuestGroup).toHaveBeenCalledWith(visitorKey);
    expect(dependencies.getGuestCalendar).toHaveBeenCalledWith(
      'group-1',
      visitorKey,
      businessMonth,
    );
    expect(dependencies.getGuestHolidays).toHaveBeenCalledWith(2026);
    expect(controller.state).toMatchObject({
      businessMonth,
      groupName: '公开排班组',
      status: 'ready',
    });
    expect(controller.state.viewModel?.weeks).toHaveLength(6);
    expect(
      controller.state.viewModel?.weeks
        .flatMap((week) => week.days)
        .find((day) => day.kind === 'day' && day.businessDate === '2026-08-15'),
    ).toMatchObject({ holiday: { holidayName: 'visitor-holiday' } });
    expect(
      controller.state.viewModel?.weeks
        .flatMap((week) => week.days)
        .flatMap((day) => (day.kind === 'day' ? day.assignments : []))
        .flatMap((assignment) => assignment.markers),
    ).toEqual([]);
    expect(parseVisitorScene('%2561'.padEnd(34, '1'))).toBeUndefined();
  });

  it('changes months without resolving again or persisting the visitor key', async () => {
    const dependencies = createDependencies();
    const controller = createVisitorCalendarController(dependencies);
    await controller.activate(visitorKey);

    await controller.changeMonth(1);

    expect(dependencies.resolveGuestGroup).toHaveBeenCalledTimes(1);
    expect(dependencies.getGuestCalendar).toHaveBeenLastCalledWith(
      'group-1',
      visitorKey,
      '2026-09',
    );
    expect(controller.state.businessMonth).toBe('2026-09');
  });

  it('maps malformed, revoked, rate-limited, and network visitor failures to safe messages', async () => {
    const malformed = createVisitorCalendarController(createDependencies());
    await malformed.activate(undefined);
    expect(malformed.state.errorMessage).toContain('小程序码');

    const revoked = createVisitorCalendarController(
      createDependencies({
        resolveGuestGroup: vi.fn(() =>
          Promise.reject(new ApiClientError('NOT_FOUND', 'internal', undefined, undefined, 404)),
        ),
      }),
    );
    await revoked.activate(visitorKey);
    expect(revoked.state.errorMessage).toContain('失效');

    const throttled = createVisitorCalendarController(
      createDependencies({
        resolveGuestGroup: vi.fn(() =>
          Promise.reject(new ApiClientError('RATE_LIMITED', 'internal', undefined, undefined, 429)),
        ),
      }),
    );
    await throttled.activate(visitorKey);
    expect(throttled.state.errorMessage).toContain('频繁');

    const unavailable = createVisitorCalendarController(
      createDependencies({
        resolveGuestGroup: vi.fn(() => Promise.reject(new Error('socket reset'))),
      }),
    );
    await unavailable.activate(visitorKey);
    expect(unavailable.state.errorMessage).not.toContain('socket reset');
  });

  it('ignores a previous scene request after a newer activation', async () => {
    let resolveFirst!: (value: { groupId: string; groupName: string }) => void;
    const dependencies = createDependencies({
      resolveGuestGroup: vi
        .fn<VisitorCalendarControllerDependencies['resolveGuestGroup']>()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockResolvedValueOnce({ groupId: 'group-2', groupName: '新公开排班组' }),
      getGuestCalendar: vi.fn(async (groupId: string) => ({
        calendar: { ...getGoldenCalendar(businessMonth), groupId },
        groupName: '新公开排班组',
      })),
    });
    const controller = createVisitorCalendarController(dependencies);
    const first = controller.activate(visitorKey);
    const second = controller.activate('b'.repeat(32));
    resolveFirst({ groupId: 'group-1', groupName: '旧公开排班组' });
    await Promise.all([first, second]);

    expect(controller.state.groupName).toBe('新公开排班组');
  });

  it('publishes the calendar without waiting for public holidays and keeps it ready when holidays fail', async () => {
    let resolveHoliday!: (value: HolidayReadModel) => void;
    const pending = createDependencies({
      getGuestHolidays: vi.fn(
        () =>
          new Promise<HolidayReadModel>((resolve) => {
            resolveHoliday = resolve;
          }),
      ),
    });
    const pendingController = createVisitorCalendarController(pending);

    await pendingController.activate(visitorKey);

    expect(pendingController.state.status).toBe('ready');
    expect(pendingController.state.viewModel?.weeks).toHaveLength(6);

    resolveHoliday({ confirmed: true, dates: [], year: 2026 });
    await Promise.resolve();

    const rejectedController = createVisitorCalendarController(
      createDependencies({
        getGuestHolidays: vi.fn(() => Promise.reject(new Error('holiday unavailable'))),
      }),
    );
    await rejectedController.activate(visitorKey);
    await Promise.resolve();

    expect(rejectedController.state.status).toBe('ready');
    expect(rejectedController.state.errorMessage).toBeUndefined();
  });

  it('contains an optional late holiday publish failure after the calendar is already ready', async () => {
    const dependencies = createDependencies({
      publish: vi.fn<NonNullable<VisitorCalendarControllerDependencies['publish']>>((state) => {
        const hasHoliday = state.viewModel?.weeks
          .flatMap((week) => week.days)
          .some((day) => day.kind === 'day' && day.holiday !== undefined);
        if (hasHoliday) throw new Error('page already gone');
      }),
    });
    const controller = createVisitorCalendarController(dependencies);

    await controller.activate(visitorKey);
    await Promise.resolve();

    expect(controller.state.status).toBe('ready');
    expect(dependencies.publish).toHaveBeenCalled();
  });

  it('ignores a late public holiday response after navigating across years', async () => {
    let resolve2026!: (value: HolidayReadModel) => void;
    let resolve2027!: (value: HolidayReadModel) => void;
    const dependencies = createDependencies({
      getGuestCalendar: vi.fn(async (groupId: string, _visitorKey: string, month: string) => ({
        calendar: { ...getGoldenCalendar(month), groupId },
        groupName: 'public-group',
      })),
      getGuestHolidays: vi.fn(
        (year: number) =>
          new Promise<HolidayReadModel>((resolve) => {
            if (year === 2026) resolve2026 = resolve;
            else resolve2027 = resolve;
          }),
      ),
      getToday: () => '2026-12-15',
    });
    const controller = createVisitorCalendarController(dependencies);

    await controller.activate(visitorKey);
    await controller.changeMonth(1);
    expect(controller.state.businessMonth).toBe('2027-01');

    resolve2026({
      confirmed: true,
      dates: [
        {
          date: '2026-12-31',
          holidayName: 'old-year-holiday',
          isOffDay: true,
          isWorkday: false,
        },
      ],
      year: 2026,
    });
    await Promise.resolve();

    expect(controller.state.businessMonth).toBe('2027-01');
    expect(
      controller.state.viewModel?.weeks
        .flatMap((week) => week.days)
        .some((day) => day.kind === 'day' && day.holiday?.holidayName === 'old-year-holiday'),
    ).toBe(false);

    resolve2027({
      confirmed: true,
      dates: [
        {
          date: '2027-01-01',
          holidayName: 'new-year-holiday',
          isOffDay: true,
          isWorkday: false,
        },
      ],
      year: 2027,
    });
    await Promise.resolve();

    expect(
      controller.state.viewModel?.weeks
        .flatMap((week) => week.days)
        .find((day) => day.kind === 'day' && day.businessDate === '2027-01-01'),
    ).toMatchObject({ holiday: { holidayName: 'new-year-holiday' } });
  });
});
