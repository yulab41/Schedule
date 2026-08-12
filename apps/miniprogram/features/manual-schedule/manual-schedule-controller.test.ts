import type {
  HolidayReadModel,
  SchedulePeriodHistoryItem,
  SchedulingConfig,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../api/client.js';
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
      applyManualScheduleTemplate: vi.fn(),
      createManualScheduleTemplate: vi.fn(),
      createOperationId: vi.fn().mockReturnValue('operation-1'),
      deleteManualScheduleTemplate: vi.fn(),
      getHolidays: vi
        .fn()
        .mockResolvedValue({ confirmed: true, dates: [], year: 2026 } as HolidayReadModel),
      getSchedulingConfig,
      invalidateCalendarMonth: vi.fn(),
      listManualScheduleTemplates: vi.fn().mockResolvedValue([]),
      listScheduleDrafts: vi.fn().mockResolvedValue([]),
      listSchedulePeriodHistory: vi.fn().mockResolvedValue([] as SchedulePeriodHistoryItem[]),
      previewManualTemplateApply: vi.fn(),
      previewScheduleChange: vi.fn(),
      publishScheduleDraftBatch: vi.fn(),
      publish: vi.fn(),
      updateManualScheduleTemplate: vi.fn(),
      withdrawSchedulePeriod: vi.fn(),
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
      applyManualScheduleTemplate: vi.fn(),
      createManualScheduleTemplate: vi.fn(),
      createOperationId: vi.fn().mockReturnValue('operation-1'),
      deleteManualScheduleTemplate: vi.fn(),
      getHolidays: vi
        .fn()
        .mockResolvedValue({ confirmed: true, dates: [], year: 2026 } as HolidayReadModel),
      getSchedulingConfig,
      invalidateCalendarMonth: vi.fn(),
      listManualScheduleTemplates: vi.fn().mockResolvedValue([]),
      listScheduleDrafts: vi.fn().mockResolvedValue([]),
      listSchedulePeriodHistory: vi.fn().mockResolvedValue([] as SchedulePeriodHistoryItem[]),
      previewManualTemplateApply: vi.fn(),
      previewScheduleChange: vi.fn(),
      publishScheduleDraftBatch: vi.fn(),
      publish: vi.fn(),
      updateManualScheduleTemplate: vi.fn(),
      withdrawSchedulePeriod: vi.fn(),
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

  it('invalidates only successful applied months and discards a conflicted preview', async () => {
    const template = {
      cells: [],
      cycleDays: 7,
      groupId: 'group-a',
      id: 'template-1',
      members: [],
      scheduleRoleId: 'role-1',
      scheduleRoleName: '医生',
      startDate: '2026-08-12',
      version: 2,
    } as const;
    const invalidateCalendarMonth = vi.fn();
    const applyManualScheduleTemplate = vi
      .fn()
      .mockResolvedValueOnce({
        periods: [
          {
            businessMonth: '2026-08-01',
            id: 'period-1',
            revision: 1,
            rulesVersion: 1,
            scheduleRoleId: 'role-1',
            status: 'draft',
            version: 1,
          },
        ],
      })
      .mockRejectedValueOnce(
        new ApiClientError('VERSION_CONFLICT', '模板已更新', 'request-1', {}, 409),
      );
    const controller = createManualScheduleController({
      applyManualScheduleTemplate,
      createManualScheduleTemplate: vi.fn(),
      createOperationId: vi.fn().mockReturnValue('operation-1'),
      deleteManualScheduleTemplate: vi.fn(),
      getHolidays: vi
        .fn()
        .mockResolvedValue({ confirmed: true, dates: [], year: 2026 } as HolidayReadModel),
      getSchedulingConfig: vi.fn().mockResolvedValue(config),
      invalidateCalendarMonth,
      listManualScheduleTemplates: vi.fn().mockResolvedValue([template]),
      listScheduleDrafts: vi.fn().mockResolvedValue([]),
      listSchedulePeriodHistory: vi.fn().mockResolvedValue([] as SchedulePeriodHistoryItem[]),
      previewManualTemplateApply: vi.fn().mockResolvedValue({
        assignments: [],
        applyEndDate: '2026-08-18',
        applyStartDate: '2026-08-12',
        conflicts: [],
        continuousDutyWarnings: [],
        cycleDays: 7,
        rulesVersion: 1,
        scheduleRoleId: 'role-1',
        scheduleRoleName: '医生',
        statistics: {},
        templateId: 'template-1',
        templateVersion: 2,
        vacancies: [],
      }),
      previewScheduleChange: vi.fn(),
      publishScheduleDraftBatch: vi.fn(),
      publish: vi.fn(),
      updateManualScheduleTemplate: vi.fn(),
      withdrawSchedulePeriod: vi.fn(),
    });
    controller.activate({
      groupId: 'group-a',
      groupRole: 'owner',
      groupVersion: 3,
      userId: 'user-1',
    });
    await controller.load();
    controller.chooseTemplate('template-1');
    await controller.previewApply('2026-08-12');
    await controller.applyPreview();
    expect(invalidateCalendarMonth).toHaveBeenCalledWith({
      businessMonth: '2026-08',
      groupId: 'group-a',
      groupRole: 'owner',
      groupVersion: 3,
      userId: 'user-1',
    });
    await controller.previewApply('2026-08-12');
    await controller.applyPreview();
    expect(controller.state.preview).toBeUndefined();
    expect(controller.state.conflict?.message).toBe('模板已更新');
  });
});
