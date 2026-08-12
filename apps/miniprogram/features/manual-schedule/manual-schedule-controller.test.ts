import type {
  HolidayReadModel,
  SchedulePeriodHistoryItem,
  SchedulingConfig,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createManualScheduleController } from './manual-schedule-controller.js';

const config = {
  groupMembers: [],
  roles: [
    {
      id: 'role-1',
      members: [
        {
          id: 'role-member-1',
          membershipId: 'member-1',
          position: 1,
          realName: '张医生',
          version: 1,
        },
      ],
      name: '医生',
      rotationRule: {
        currentPosition: 1,
        defaultShiftTypeId: 'day',
        requiredMembersPerDay: 1,
        version: 1,
      },
      version: 1,
    },
  ],
  rulesVersion: 1,
  shiftTypes: [],
} as unknown as SchedulingConfig;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('manual schedule controller', () => {
  it('shares one load flight and ignores an old group completion', async () => {
    const first = deferred<SchedulingConfig>();
    const getSchedulingConfig = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(config);
    const controller = createManualScheduleController({
      createManualScheduleTemplate: vi.fn(),
      deleteManualScheduleTemplate: vi.fn(),
      getHolidays: vi
        .fn()
        .mockResolvedValue({ confirmed: true, dates: [], year: 2026 } as HolidayReadModel),
      getSchedulingConfig,
      listManualScheduleTemplates: vi.fn().mockResolvedValue([]),
      listSchedulePeriodHistory: vi.fn().mockResolvedValue([] as SchedulePeriodHistoryItem[]),
      publish: vi.fn(),
      updateManualScheduleTemplate: vi.fn(),
    });
    controller.activate({
      groupId: 'group-a',
      groupRole: 'owner',
      groupVersion: 1,
      userId: 'user-1',
    });
    const a = controller.load();
    expect(controller.load()).toBe(a);
    controller.activate({
      groupId: 'group-b',
      groupRole: 'owner',
      groupVersion: 1,
      userId: 'user-1',
    });
    const b = controller.load();
    first.resolve(config);
    await Promise.all([a, b]);
    expect(controller.state.context?.groupId).toBe('group-b');
    expect(controller.state.draft?.scheduleRoleId).toBe('role-1');
    expect(getSchedulingConfig).toHaveBeenCalledTimes(2);
  });

  it('releases a load flight when an injected wrapper throws synchronously', async () => {
    const getSchedulingConfig = vi
      .fn<() => Promise<SchedulingConfig>>()
      .mockImplementationOnce(() => {
        throw new Error('offline');
      })
      .mockResolvedValue(config);
    const controller = createManualScheduleController({
      createManualScheduleTemplate: vi.fn(),
      deleteManualScheduleTemplate: vi.fn(),
      getHolidays: vi
        .fn()
        .mockResolvedValue({ confirmed: true, dates: [], year: 2026 } as HolidayReadModel),
      getSchedulingConfig,
      listManualScheduleTemplates: vi.fn().mockResolvedValue([]),
      listSchedulePeriodHistory: vi.fn().mockResolvedValue([] as SchedulePeriodHistoryItem[]),
      publish: vi.fn(),
      updateManualScheduleTemplate: vi.fn(),
    });
    controller.activate({
      groupId: 'group-a',
      groupRole: 'owner',
      groupVersion: 1,
      userId: 'user-1',
    });
    await controller.load();
    await controller.load();
    expect(getSchedulingConfig).toHaveBeenCalledTimes(2);
    expect(controller.state.draft).toBeDefined();
  });
});
