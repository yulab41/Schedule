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
    expect(controller.state).toMatchObject({
      businessMonth,
      groupName: '公开排班组',
      status: 'ready',
    });
    expect(controller.state.viewModel?.weeks).toHaveLength(6);
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
});
