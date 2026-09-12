import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const groupId = '11111111-1111-4111-8111-111111111111';
const otherGroupId = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  ClientCapabilityDisabledError: class ClientCapabilityDisabledError extends Error {},
  getGroup: vi.fn(),
  getMine: vi.fn(),
  listGroups: vi.fn(),
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  requestSubscriptions: vi.fn(),
  updateGroup: vi.fn(),
  updateMine: vi.fn(),
  requireClientCapability: vi.fn(),
  snapshot: vi.fn(),
  templates: vi.fn(),
  token: vi.fn(),
}));

vi.mock('../src/app/client-capability-store.ts', () => ({
  ClientCapabilityDisabledError: mocks.ClientCapabilityDisabledError,
  requireClientCapability: mocks.requireClientCapability,
  getClientCapabilitySnapshot: mocks.snapshot,
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
    markAllNotificationsRead: mocks.markAllNotificationsRead,
    markNotificationRead: mocks.markNotificationRead,
  }),
}));

vi.mock('../src/platform/wechat-notification-client.ts', () => ({
  loadWechatSubscriptionConfiguration: async () => {
    const ids = await mocks.templates();
    return {
      dutyReminder: ids[0] ?? null,
      business: ids[1] ?? null,
      swap: ids[2] ?? null,
      dutyAdjustment: ids[3] ?? null,
      leave: ids[4] ?? null,
    };
  },
}));
vi.mock('../src/platform/diagnostics-access.ts', () => ({ canUseDiagnostics: () => false }));

vi.mock('../src/platform/workbench-read.ts', () => ({
  createWorkbenchReadClient: () => ({ listGroups: mocks.listGroups }),
}));

vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatToken: () => mocks.token(),
  getWechatRequestAuthentication: () => undefined,
}));

vi.mock('../src/platform/wechat-subscription.ts', () => ({
  requestWechatSubscriptions: mocks.requestSubscriptions,
  WechatSubscriptionError: class extends Error {
    constructor(code) {
      super(`subscription error ${code}`);
      this.code = code;
    }
  },
}));

describe('notification parity controller', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.token.mockReturnValue('token');
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
      openSetting: vi.fn(),
    });
    mocks.requireClientCapability.mockResolvedValue(undefined);
    mocks.snapshot.mockReturnValue({ global: true, externalMessages: true });
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
      wechatNotificationsEnabled: input.wechatNotificationsEnabled ?? false,
    }));
    mocks.markAllNotificationsRead.mockResolvedValue({ count: 1 });
    mocks.markNotificationRead.mockImplementation(async (id) => ({
      ...notification(id, false),
      isRead: true,
    }));
    mocks.requestSubscriptions.mockResolvedValue([]);
    mocks.templates.mockResolvedValue(['Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('offers five independent choices and requests only the chosen template', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data.subscriptionChoices).toHaveLength(5);
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    for (const [kind, id] of [
      ['dutyReminder', 'duty'],
      ['business', 'business'],
      ['swap', 'swap'],
      ['dutyAdjustment', 'adjustment'],
      ['leave', 'leave'],
    ]) {
      mocks.requestSubscriptions.mockResolvedValue([{ status: 'accepted', templateId: id }]);
      definition.methods.handleSubscribe.call(page, { currentTarget: { dataset: { kind } } });
      expect(mocks.requestSubscriptions).toHaveBeenLastCalledWith([id]);
      await vi.waitFor(() => expect(page.data.busy).toBe(false));
    }
    expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(5);
  });

  it('uses one button for 3 then 2 templates, retaining partial grants on second-step rejection', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.requestSubscriptions.mockResolvedValueOnce([
      { templateId: 'duty', status: 'accepted' },
      { templateId: 'business', status: 'rejected' },
      { templateId: 'swap', status: 'accepted' },
    ]);
    definition.methods.handleSubscribe.call(page);
    expect(mocks.requestSubscriptions).toHaveBeenCalledWith(['duty', 'business', 'swap']);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.subscriptionButtonLabel).toBe('继续授权剩余2类');
    expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(1);
    mocks.requestSubscriptions.mockRejectedValueOnce(new Error('offline'));
    definition.methods.handleSubscribe.call(page);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.subscriptionButtonLabel).toBe('继续授权剩余2类');
    mocks.requestSubscriptions.mockResolvedValueOnce([
      { templateId: 'adjustment', status: 'rejected' },
      { templateId: 'leave', status: 'blocked' },
    ]);
    definition.methods.handleSubscribe.call(page);
    expect(mocks.requestSubscriptions).toHaveBeenLastCalledWith(['adjustment', 'leave']);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.enabled).toBe(true);
    expect(mocks.updateMine).toHaveBeenCalledTimes(1);
    expect(page.data.subscriptionButtonLabel).toBe('再次授权微信通知');
    expect(
      page.data.subscriptionResults.filter((item) => item.statusLabel === '本次已授权'),
    ).toHaveLength(2);
    definition.lifetimes.detached.call(page);
    expect(page.data.subscriptionResults).toEqual([]);
  });

  it('never requests an absent or unknown template and leaves the other choices available', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data.subscriptionChoices.filter((item) => item.configured)).toHaveLength(1);
    definition.methods.handleSubscribe.call(page, {
      currentTarget: { dataset: { kind: 'leave' } },
    });
    definition.methods.handleSubscribe.call(page, {
      currentTarget: { dataset: { kind: '__proto__' } },
    });
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    expect(mocks.updateMine).not.toHaveBeenCalled();
    expect(page.data.busy).toBe(false);
  });

  it('enables receiving without triggering a native consent prompt', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    definition.methods.handleToggle.call(page, { detail: { checked: true } });
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, { wechatNotificationsEnabled: true });
  });

  it('keeps the first authorization step retryable if saving its receiving preference fails', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.requestSubscriptions.mockResolvedValue([{ templateId: 'duty', status: 'accepted' }]);
    mocks.updateMine.mockRejectedValueOnce(new Error('保存失败'));
    definition.methods.handleSubscribe.call(page);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.subscriptionStep).toBe(0);
    expect(page.data.subscriptionButtonLabel).toBe('授权微信通知');
    definition.methods.handleSubscribe.call(page);
    expect(mocks.requestSubscriptions).toHaveBeenLastCalledWith(['duty', 'business', 'swap']);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.subscriptionStep).toBe(1);
  });

  it('resets two-step progress and discards an old grant after an account change on return', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    let complete;
    mocks.requestSubscriptions.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    definition.methods.handleSubscribe.call(page);
    definition.pageLifetimes.hide.call(page);
    mocks.token.mockReturnValue('new-account');
    definition.pageLifetimes.show.call(page);
    complete([{ templateId: 'duty', status: 'accepted' }]);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    await flushPromises();
    expect(page.data.subscriptionStep).toBe(0);
    expect(page.data.subscriptionResults).toEqual([]);
    expect(page.data.busy).toBe(false);
    expect(mocks.updateMine).not.toHaveBeenCalled();
  });

  it('uses a two-second error capsule and retains input on invalid settings', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    vi.useFakeTimers();
    page.setData({ myHoursMode: 'custom', myHoursInput: '' });
    definition.methods.handleSaveMyPreferences.call(page);
    await flushPromises();
    expect(page.data.feedbackTone).toBe('error');
    expect(page.data.infoMessage).not.toBe('');
    expect(page.data.errorMessage).toBe('');
    vi.advanceTimersByTime(2000);
    expect(page.data.infoMessage).toBe('');
  });

  it('keeps preferences available when subscription configuration fails', async () => {
    mocks.templates.mockRejectedValue(new Error('offline'));
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data.templateConfigured).toBe(false);
    expect(page.data.templateNotice).toContain('读取失败');
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

  it('emits current-group unread changes from the embedded sheet presentation', async () => {
    mocks.listNotifications.mockResolvedValue({
      nextCursor: undefined,
      notifications: [notification('notice-1', false), notification('notice-2', false)],
      unreadCount: 2,
    });
    const definition = await definitionFor('notifications');
    const page = pageFor(definition, 'notifications', true);

    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data.embedded).toBe(true);
    expect(page.triggerEvent).toHaveBeenLastCalledWith('unreadchanged', { unreadCount: 2 });

    definition.methods.handleMarkRead.call(page, {
      currentTarget: { dataset: { id: 'notice-1' } },
    });
    await vi.waitFor(() => expect(page.data.actionBusyId).toBe(''));
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('notice-1');
    expect(page.triggerEvent).toHaveBeenLastCalledWith('unreadchanged', { unreadCount: 1 });

    definition.methods.handleMarkAllRead.call(page);
    await vi.waitFor(() => expect(page.data.actionBusyId).toBe(''));
    expect(mocks.markAllNotificationsRead).toHaveBeenCalledWith(groupId);
    expect(page.triggerEvent).toHaveBeenLastCalledWith('unreadchanged', { unreadCount: 0 });
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

  it('requests the approved duty reminder subscription only after an explicit button', async () => {
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

    definition.methods.handleSubscribe.call(page);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));

    expect(mocks.requestSubscriptions).toHaveBeenCalledWith([
      'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
    ]);
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, {
      wechatNotificationsEnabled: true,
    });
  });

  it('preserves enabled receiving and other native choices when a separately requested template is rejected', async () => {
    mocks.templates.mockResolvedValueOnce(['duty', 'business']);
    mocks.requestSubscriptions.mockResolvedValue([{ status: 'rejected', templateId: 'business' }]);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.setData({ enabled: true });
    definition.methods.handleSubscribe.call(page, {
      currentTarget: { dataset: { kind: 'business' } },
    });
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(mocks.requestSubscriptions).toHaveBeenCalledWith(['business']);
    expect(mocks.updateMine).not.toHaveBeenCalled();
    expect(page.data.enabled).toBe(true);
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

  it('requests again synchronously when the persisted preference is already enabled', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.setData({ enabled: true });
    mocks.requestSubscriptions.mockResolvedValue([{ status: 'accepted' }]);
    definition.methods.handleSubscribe.call(page);
    expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.infoMessage).toBe('已完成本次微信订阅授权。');
  });

  it('uses a two-second capsule and replaces its lifetime for consecutive saves', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    vi.useFakeTimers();
    definition.methods.handleSaveMyPreferences.call(page);
    await flushPromises();
    expect(page.data.infoMessage).toBe('个人提醒设置已保存。');
    await vi.advanceTimersByTimeAsync(1500);
    definition.methods.handleSaveMyPreferences.call(page);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1500);
    expect(page.data.infoMessage).not.toBe('');
    await vi.advanceTimersByTimeAsync(500);
    expect(page.data.infoMessage).toBe('');
  });

  it('saves authorization after native hide/show without replaying the old success capsule', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    let resolveGrant;
    mocks.requestSubscriptions.mockReturnValue(
      new Promise((resolve) => {
        resolveGrant = resolve;
      }),
    );
    definition.methods.handleSubscribe.call(page);
    definition.pageLifetimes.hide.call(page);
    definition.pageLifetimes.show.call(page);
    resolveGrant([{ status: 'accepted' }]);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.enabled).toBe(true);
    expect(page.data.infoMessage).toBe('');
  });

  it.each(['rejected', 'blocked', 'filtered'])(
    'does not save authorization for %s',
    async (status) => {
      const definition = await definitionFor('settings');
      const page = pageFor(definition, 'settings');
      definition.lifetimes.attached.call(page);
      await vi.waitFor(() => expect(page.data.state).toBe('ready'));
      mocks.requestSubscriptions.mockResolvedValue([{ status }]);
      definition.methods.handleSubscribe.call(page);
      await vi.waitFor(() => expect(page.data.busy).toBe(false));
      expect(mocks.updateMine).not.toHaveBeenCalled();
      expect(page.data.feedbackTone).toBe('error');
      expect(page.data.infoMessage).not.toBe('');
      expect(page.data.errorMessage).toBe('');
    },
  );

  it('provides an explicit settings action for 20004 without automatically opening settings', async () => {
    const { WechatSubscriptionError } = await import('../src/platform/wechat-subscription.ts');
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.requestSubscriptions.mockRejectedValue(new WechatSubscriptionError(20004));
    definition.methods.handleSubscribe.call(page);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.showSubscriptionSettings).toBe(true);
    expect(globalThis.wx.openSetting).not.toHaveBeenCalled();
    definition.methods.handleOpenSubscriptionSettings.call(page);
    expect(globalThis.wx.openSetting).toHaveBeenCalledTimes(1);
  });

  it('closes an enabled preference without requesting a subscription', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.setData({ enabled: true });
    definition.methods.handleToggle.call(page, { detail: { checked: false } });
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, { wechatNotificationsEnabled: false });
  });

  it('does not request subscription when the capability was disabled after loading', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.snapshot.mockReturnValue({ global: true, externalMessages: false });
    definition.methods.handleSubscribe.call(page);
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    expect(page.data.state).toBe('disabled');
    expect(page.data.busy).toBe(false);
  });

  it.each(['detach', 'group'])(
    'deduplicates taps and discards a grant after %s changes',
    async (change) => {
      const definition = await definitionFor('settings');
      const page = pageFor(definition, 'settings');
      definition.lifetimes.attached.call(page);
      await vi.waitFor(() => expect(page.data.state).toBe('ready'));
      let resolveGrant;
      mocks.requestSubscriptions.mockReturnValue(
        new Promise((resolve) => {
          resolveGrant = resolve;
        }),
      );
      definition.methods.handleSubscribe.call(page);
      definition.methods.handleSubscribe.call(page);
      expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(1);
      if (change === 'detach') definition.lifetimes.detached.call(page);
      else {
        page.properties.groupId = otherGroupId;
        definition.observers.groupId.call(page);
      }
      resolveGrant([{ status: 'accepted' }]);
      await flushPromises();
      expect(mocks.updateMine).not.toHaveBeenCalled();
      expect(page.data.infoMessage).toBe('');
    },
  );

  it('keeps the persisted preference on reject and never reports success on API failure', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.setData({ enabled: true });
    mocks.requestSubscriptions.mockResolvedValue([{ status: 'rejected' }]);
    definition.methods.handleSubscribe.call(page);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.enabled).toBe(true);
    expect(mocks.updateMine).not.toHaveBeenCalled();
    mocks.requestSubscriptions.mockResolvedValue([{ status: 'accepted' }]);
    mocks.updateMine.mockRejectedValue(new Error('保存失败'));
    definition.methods.handleSubscribe.call(page);
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.feedbackTone).toBe('error');
    expect(page.data.infoMessage).toBe('保存失败');
    expect(page.data.errorMessage).toBe('');
  });

  it('ignores a settings failure after detach and handles unavailable native settings safely', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.setData({ showSubscriptionSettings: true });
    globalThis.wx.openSetting.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    definition.methods.handleOpenSubscriptionSettings.call(page);
    expect(page.data.infoMessage).toContain('右上角');
    expect(page.data.feedbackTone).toBe('error');
    page.setData({ errorMessage: '' });
    definition.methods.handleOpenSubscriptionSettings.call(page);
    const callback = globalThis.wx.openSetting.mock.calls[1][0].fail;
    definition.lifetimes.detached.call(page);
    callback();
    expect(page.data.errorMessage).toBe('');
  });

  it.each(['notification-settings', 'notifications'])(
    'bridges %s direct Page hide/show and expiry',
    async (route) => {
      let pageDefinition;
      vi.stubGlobal('Page', (value) => {
        pageDefinition = value;
      });
      mocks.listNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
      await import(`../src/subpackages/insights/pages/${route}/index.ts`);
      const page = {
        data: { ...pageDefinition.data },
        setData(patch) {
          Object.assign(this.data, patch);
        },
      };
      pageDefinition.onLoad.call(page, { groupId });
      await flushPromises();
      page.setData({ infoMessage: '旧提示' });
      pageDefinition.onHide.call(page);
      pageDefinition.onShow.call(page);
      expect(page.data.infoMessage).toBe('');
      pageDefinition.onUnload.call(page);
    },
  );
});

async function definitionFor(mode) {
  const module =
    await import('../src/subpackages/insights/components/notifications-panel/controller.ts');
  return module.createNotificationsPanelControllerDefinition(mode === 'settings');
}

function pageFor(definition, mode, embedded = false) {
  return {
    data: { ...definition.data },
    properties: { embedded, groupId, mode },
    setData(patch, callback) {
      this.data = { ...this.data, ...patch };
      callback?.();
    },
    triggerEvent: vi.fn(),
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
