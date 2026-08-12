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

const multiRoleConfig = {
  ...config,
  roles: [
    config.roles[0],
    {
      ...config.roles[0],
      id: 'role-2',
      members: Array.from({ length: 6 }, (_, index) => ({
        id: `role-2-member-${index + 1}`,
        membershipId: `member-${index + 2}`,
        position: index + 1,
        realName: `成员${index + 2}`,
        version: 1,
      })),
      name: '一线',
    },
  ],
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
    expect(controller.state.config?.roles[0]?.id).toBe('role-1');
    expect(controller.state.draft).toBeUndefined();
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
    expect(controller.state.config).toBeDefined();
    expect(controller.state.draft).toBeUndefined();
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

  it('lets the page select six role members, date, and cycle without issuing a write', async () => {
    const createManualScheduleTemplate = vi.fn();
    const updateManualScheduleTemplate = vi.fn();
    const deleteManualScheduleTemplate = vi.fn();
    const applyManualScheduleTemplate = vi.fn();
    const getHolidays = vi
      .fn()
      .mockImplementation((year: number) =>
        Promise.resolve({ confirmed: true, dates: [], year } as HolidayReadModel),
      );
    const controller = createManualScheduleController({
      applyManualScheduleTemplate,
      createManualScheduleTemplate,
      createOperationId: vi.fn().mockReturnValue('operation-1'),
      deleteManualScheduleTemplate,
      getHolidays,
      getSchedulingConfig: vi.fn().mockResolvedValue(multiRoleConfig),
      invalidateCalendarMonth: vi.fn(),
      listManualScheduleTemplates: vi.fn().mockResolvedValue([]),
      listScheduleDrafts: vi.fn().mockResolvedValue([]),
      listSchedulePeriodHistory: vi.fn().mockResolvedValue([] as SchedulePeriodHistoryItem[]),
      previewManualTemplateApply: vi.fn(),
      previewScheduleChange: vi.fn(),
      publishScheduleDraftBatch: vi.fn(),
      publish: vi.fn(),
      updateManualScheduleTemplate,
      withdrawSchedulePeriod: vi.fn(),
    });
    controller.activate({
      groupId: 'group-a',
      groupRole: 'owner',
      groupVersion: 1,
      userId: 'user-1',
    });
    await controller.load();

    expect(controller.state.draft).toBeUndefined();
    controller.selectScheduleRole('role-2');
    controller.setMembershipIds(
      multiRoleConfig.roles[1]?.members.map(({ membershipId }) => membershipId) ?? [],
    );
    controller.setStartDate('2026-12-20');
    controller.setCycleDays(30);
    await controller.refreshHolidays();
    await controller.load();

    expect(controller.state.draft).toMatchObject({
      cycleDays: 30,
      membershipIds: ['member-2', 'member-3', 'member-4', 'member-5', 'member-6', 'member-7'],
      scheduleRoleId: 'role-2',
      startDate: '2026-12-20',
    });
    expect(getHolidays).toHaveBeenCalledWith(2026);
    expect(getHolidays).toHaveBeenCalledWith(2027);
    expect(createManualScheduleTemplate).not.toHaveBeenCalled();
    expect(updateManualScheduleTemplate).not.toHaveBeenCalled();
    expect(deleteManualScheduleTemplate).not.toHaveBeenCalled();
    expect(applyManualScheduleTemplate).not.toHaveBeenCalled();

    controller.startNewTemplate();
    expect(controller.state.draft).toBeUndefined();
    expect(controller.state.selectedTemplateId).toBeUndefined();
  });

  it('adopts the authoritative template returned by create before a later update', async () => {
    const savedTemplate = {
      cells: [],
      cycleDays: 7,
      groupId: 'group-a',
      id: 'template-created',
      members: [
        {
          isStale: false,
          membershipId: 'member-1',
          realName: '张医生',
        },
      ],
      scheduleRoleId: 'role-1',
      scheduleRoleName: '医生',
      startDate: '2026-08-12',
      version: 1,
    } as const;
    const createManualScheduleTemplate = vi.fn().mockResolvedValue(savedTemplate);
    const updateManualScheduleTemplate = vi
      .fn()
      .mockResolvedValue({ ...savedTemplate, version: 2 });
    const listManualScheduleTemplates = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([savedTemplate]);
    const controller = createManualScheduleController({
      applyManualScheduleTemplate: vi.fn(),
      createManualScheduleTemplate,
      createOperationId: vi.fn().mockReturnValue('operation-1'),
      deleteManualScheduleTemplate: vi.fn(),
      getHolidays: vi
        .fn()
        .mockResolvedValue({ confirmed: true, dates: [], year: 2026 } as HolidayReadModel),
      getSchedulingConfig: vi.fn().mockResolvedValue(config),
      invalidateCalendarMonth: vi.fn(),
      listManualScheduleTemplates,
      listScheduleDrafts: vi.fn().mockResolvedValue([]),
      listSchedulePeriodHistory: vi.fn().mockResolvedValue([] as SchedulePeriodHistoryItem[]),
      previewManualTemplateApply: vi.fn(),
      previewScheduleChange: vi.fn(),
      publishScheduleDraftBatch: vi.fn(),
      publish: vi.fn(),
      updateManualScheduleTemplate,
      withdrawSchedulePeriod: vi.fn(),
    });
    controller.activate({
      groupId: 'group-a',
      groupRole: 'owner',
      groupVersion: 1,
      userId: 'user-1',
    });
    await controller.load();
    controller.selectScheduleRole('role-1');
    controller.setMembershipIds(['member-1']);

    await controller.save();
    expect(controller.state.selectedTemplateId).toBe('template-created');
    expect(controller.state.draft).toMatchObject({
      membershipIds: ['member-1'],
      scheduleRoleId: 'role-1',
      startDate: '2026-08-12',
    });
    expect(createManualScheduleTemplate).toHaveBeenCalledTimes(1);

    await controller.save();
    expect(createManualScheduleTemplate).toHaveBeenCalledTimes(1);
    expect(updateManualScheduleTemplate).toHaveBeenCalledTimes(1);
  });
});
