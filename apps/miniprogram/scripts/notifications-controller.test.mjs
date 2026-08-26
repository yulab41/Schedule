import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const otherGroupId = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  getGroup: vi.fn(),
  getMine: vi.fn(),
  listGroups: vi.fn(),
  listNotifications: vi.fn(),
  requestSubscriptions: vi.fn(),
  updateGroup: vi.fn(),
  updateMine: vi.fn(),
  requireClientCapability: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: mocks.ClientCapabilityDisabledError,
  requireClientCapability: mocks.requireClientCapability,
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
  requestWechatSubscriptions: mocks.requestSubscriptions,
}));

describe('notification parity controller', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
    });
    mocks.requireClientCapability.mockResolvedValue(undefined);
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
    mocks.requestSubscriptions.mockResolvedValue([]);
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

  it('does not commit a pending notification response after detaching', async () => {
    let resolveNotifications;
    mocks.listNotifications.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNotifications = resolve;
        }),
    );
    const definition = await definitionFor('notifications');
    const page = pageFor(definition, 'notifications');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(mocks.listNotifications).toHaveBeenCalledTimes(1));
    definition.lifetimes.detached.call(page);
    resolveNotifications({ nextCursor: undefined, notifications: [], unreadCount: 0 });
    await flushPromises();

    expect(page.data.state).toBe('loading');
    expect(page.data.notifications).toEqual([]);
  });

  it('ignores a stale load-more response after switching groups', async () => {
    mocks.listNotifications.mockResolvedValueOnce({
      nextCursor: 'cursor-1',
      notifications: [notification('first', false)],
      unreadCount: 1,
    });
    const definition = await definitionFor('notifications');
    const page = pageFor(definition, 'notifications');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    let resolveLoadMore;
    mocks.listNotifications.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLoadMore = resolve;
        }),
    );
    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(page.data.loadingMore).toBe(true));
    mocks.listNotifications.mockResolvedValueOnce({
      nextCursor: undefined,
      notifications: [notification('new-group', true)],
      unreadCount: 0,
    });
    page.properties.groupId = otherGroupId;
    definition.observers.groupId.call(page);
    await vi.waitFor(() => expect(page.data.groupId).toBe(otherGroupId));
    resolveLoadMore({
      nextCursor: undefined,
      notifications: [notification('stale', false)],
      unreadCount: 99,
    });
    await flushPromises();

    expect(page.data.notifications.map((item) => item.id)).not.toContain('stale');
  });

  it('requests the approved duty reminder subscription only after an explicit toggle', async () => {
    mocks.requestSubscriptions.mockResolvedValue([
      {
        granted: true,
        status: 'accepted',
        templateId: 'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
      },
    ]);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');

    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();

    definition.methods.handleToggle.call(page, { detail: { checked: true } });
    await vi.waitFor(() => expect(page.data.busy).toBe(false));

    expect(mocks.requestSubscriptions).toHaveBeenCalledWith([
      'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
    ]);
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, {
      wechatNotificationsEnabled: true,
    });
  });

  it('marks the page as large text when the system font setting requests it', async () => {
    globalThis.wx.getWindowInfo = () => ({
      fontSizeSetting: 20,
      statusBarHeight: 24,
      windowHeight: 844,
      windowWidth: 390,
    });
    mocks.listNotifications.mockResolvedValueOnce({
      nextCursor: undefined,
      notifications: [notification('large-text', false)],
      unreadCount: 0,
    });
    const definition = await definitionFor('notifications');
    const page = pageFor(definition, 'notifications');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data.largeText).toBe(true);
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

function notification(id, isRead) {
  return {
    body: id,
    createdAt: new Date().toISOString(),
    id,
    isRead,
    notificationType: 'schedule_period_published',
    recipientUserId: 'user-1',
    title: id,
  };
}

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}
