import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const mocks = vi.hoisted(() => ({
  getGroup: vi.fn(),
  getMine: vi.fn(),
  listGroups: vi.fn(),
  listNotifications: vi.fn(),
  updateGroup: vi.fn(),
  updateMine: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  requireClientCapability: vi.fn(async () => undefined),
}));

vi.mock('../src/platform/client-core-calendar.ts', () => ({
  createRuntimeNotificationPreferencesClient: () => ({
    getGroup: mocks.getGroup,
    getMine: mocks.getMine,
    updateGroup: mocks.updateGroup,
    updateMine: mocks.updateMine,
  }),
  createRuntimeP9InsightsActionsClient: () => ({
    listNotifications: mocks.listNotifications,
    markAllNotificationsRead: vi.fn(),
    markNotificationRead: vi.fn(),
  }),
}));

vi.mock('../src/platform/workbench-read.ts', () => ({
  createWorkbenchReadClient: () => ({ listGroups: mocks.listGroups }),
}));

vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatToken: () => 'token',
  getWechatRequestAuthentication: () => undefined,
}));

vi.mock('../src/platform/wechat-subscription.ts', () => ({
  requestWechatSubscriptions: vi.fn(async () => []),
}));

describe('notification parity controller', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
    });
    mocks.listGroups.mockResolvedValue([
      { id: groupId, isDeveloperAdmin: false, name: '测试群组', role: 'administrator' },
    ]);
    mocks.getGroup.mockResolvedValue({ dutyReminderHours: [24, 2], groupId });
    mocks.getMine.mockResolvedValue({
      browserNotificationsEnabled: false,
      dutyReminderHours: null,
      membershipId: 'member-1',
      wechatNotificationsEnabled: false,
    });
    mocks.updateGroup.mockImplementation(async (_groupId, input) => ({ groupId, ...input }));
    mocks.updateMine.mockImplementation(async (_groupId, input) => ({
      browserNotificationsEnabled: false,
      dutyReminderHours: input.dutyReminderHours ?? null,
      membershipId: 'member-1',
      wechatNotificationsEnabled: false,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and saves Web-equivalent group and personal reminder settings', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');

    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data).toMatchObject({
      canManageGroupSettings: true,
      groupHoursInput: '24, 2',
      myHoursInput: '',
      myHoursMode: 'default',
    });

    definition.methods.handleGroupHoursInput.call(page, { detail: { value: '12、48' } });
    definition.methods.handleSaveGroupSettings.call(page);
    await vi.waitFor(() => expect(page.data.groupSettingsBusy).toBe(false));
    expect(mocks.updateGroup).toHaveBeenCalledWith(groupId, { dutyReminderHours: [48, 12] });

    definition.methods.handleReminderMode.call(page, {
      currentTarget: { dataset: { mode: 'custom' } },
    });
    definition.methods.handleMyHoursInput.call(page, { detail: { value: '6, 24' } });
    definition.methods.handleSaveMyPreferences.call(page);
    await vi.waitFor(() => expect(page.data.mySettingsBusy).toBe(false));
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, { dutyReminderHours: [24, 6] });
  });

  it('maps exact labels, tones, relative time and Web page size', async () => {
    mocks.listNotifications.mockResolvedValue({
      nextCursor: undefined,
      notifications: [
        {
          body: '需要处理',
          createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
          id: 'notice-1',
          isRead: false,
          notificationType: 'duty_adjustment_request_rejected',
          recipientUserId: 'user-1',
          title: '加扣班申请已驳回',
        },
      ],
      unreadCount: 1,
    });
    const definition = await definitionFor('notifications');
    const page = pageFor(definition, 'notifications');

    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(mocks.listNotifications).toHaveBeenCalledWith({ groupId, pageSize: 30 });
    expect(page.data.notifications[0]).toMatchObject({
      createdAtLabel: '30 分钟前',
      typeLabel: '加扣班已驳回',
      typeTone: 'danger',
    });
  });
});

async function definitionFor(mode) {
  const module =
    await import('../src/subpackages/insights/components/notifications-panel/controller.ts');
  return module.createNotificationsPanelControllerDefinition(mode === 'settings');
}

function pageFor(definition, mode) {
  return {
    data: { ...definition.data },
    properties: { groupId, mode },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
}
