import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
      wechatNotificationsEnabled: true,
    });
    mocks.updateGroup.mockImplementation(async (_groupId, input) => ({ groupId, ...input }));
    mocks.updateMine.mockImplementation(async (_groupId, input) => ({
      browserNotificationsEnabled: false,
      dutyReminderHours: input.dutyReminderHours ?? null,
      membershipId: 'member-1',
      wechatNotificationKinds: {
        business: true,
        dutyAdjustment: true,
        dutyReminder: true,
        leave: true,
        swap: true,
        ...(input.wechatNotificationKinds ?? {}),
      },
      wechatNotificationsEnabled: input.wechatNotificationsEnabled ?? true,
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

  it('keeps five independent switches and requests only the toggled template', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data.wechatKindRows).toHaveLength(5);
    expect(page.data.wechatKindRows.every((row) => row.configured)).toBe(true);
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    for (const [kind, id] of [
      ['dutyReminder', 'duty'],
      ['business', 'business'],
      ['swap', 'swap'],
      ['dutyAdjustment', 'adjustment'],
      ['leave', 'leave'],
    ]) {
      mocks.requestSubscriptions.mockResolvedValue([
        { granted: true, status: 'accepted', templateId: id },
      ]);
      definition.methods.handleWechatKindToggle.call(page, {
        currentTarget: { dataset: { kind } },
        detail: { checked: true },
      });
      expect(mocks.requestSubscriptions).toHaveBeenLastCalledWith([id]);
      await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
      expect(mocks.updateMine).toHaveBeenLastCalledWith(groupId, {
        wechatNotificationKinds: {
          business: true,
          dutyAdjustment: true,
          dutyReminder: true,
          leave: true,
          swap: true,
        },
        wechatNotificationsEnabled: true,
      });
      const row = page.data.wechatKindRows.find((item) => item.kind === kind);
      expect(row).toMatchObject({ checked: true, statusLabel: '本次已授权 · 点此重新授权' });
    }
    expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(5);
  });

  it('disables a single kind without any WeChat request and keeps the others untouched', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'swap' } },
      detail: { checked: false },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, {
      wechatNotificationKinds: {
        business: true,
        dutyAdjustment: true,
        dutyReminder: true,
        leave: true,
        swap: false,
      },
    });
    expect(page.data.wechatKindRows.find((row) => row.kind === 'swap')).toMatchObject({
      checked: false,
      statusLabel: '已关闭',
    });
    expect(page.data.wechatKindRows.filter((row) => row.checked)).toHaveLength(4);
  });

  it('never requests an absent or unknown template and leaves the other switches available', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data.wechatKindRows.filter((row) => row.configured)).toHaveLength(1);
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'leave' } },
      detail: { checked: true },
    });
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: '__proto__' } },
      detail: { checked: true },
    });
    await flushPromises();
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    expect(mocks.updateMine).not.toHaveBeenCalled();
    expect(page.data.wechatKindBusy).toBe('');
    expect(page.data.wechatKindRows.find((row) => row.kind === 'leave')).toMatchObject({
      checked: false,
      statusLabel: '暂未配置',
    });
  });

  it('normalizes a legacy master-off state and enables only the toggled kind', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    mocks.getMine.mockResolvedValue({
      browserNotificationsEnabled: false,
      dutyReminderHours: null,
      membershipId: 'member-1',
      wechatNotificationKinds: {
        business: true,
        dutyAdjustment: true,
        dutyReminder: true,
        leave: true,
        swap: true,
      },
      wechatNotificationsEnabled: false,
    });
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    // 历史“总开关关闭”状态按全部关闭呈现，且页面不再有总开关。
    expect(page.data.wechatKindRows.every((row) => !row.checked)).toBe(true);
    expect(page.data).not.toHaveProperty('enabled');
    mocks.requestSubscriptions.mockResolvedValue([
      { granted: true, status: 'accepted', templateId: 'swap' },
    ]);
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'swap' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, {
      wechatNotificationKinds: {
        business: false,
        dutyAdjustment: false,
        dutyReminder: false,
        leave: false,
        swap: true,
      },
      wechatNotificationsEnabled: true,
    });
    expect(page.data.wechatKindRows.find((row) => row.kind === 'swap')).toMatchObject({
      checked: true,
      statusLabel: '本次已授权 · 点此重新授权',
    });
  });

  it('paints the clicked switch before the save resolves and rolls it back on failure', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business']);
    mocks.getMine.mockResolvedValue({
      browserNotificationsEnabled: false,
      dutyReminderHours: null,
      membershipId: 'member-1',
      wechatNotificationKinds: {
        business: false,
        dutyAdjustment: true,
        dutyReminder: true,
        leave: true,
        swap: true,
      },
      wechatNotificationsEnabled: true,
    });
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
      checked: false,
    });
    mocks.requestSubscriptions.mockResolvedValue([
      { granted: true, status: 'accepted', templateId: 'business' },
    ]);
    let failSave;
    mocks.updateMine.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failSave = reject;
        }),
    );
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'business' } },
      detail: { checked: true },
    });
    // 保存还没回来，开关已经按点击结果上屏。
    await vi.waitFor(() =>
      expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
        checked: true,
      }),
    );
    expect(page.data.wechatKindBusy).toBe('business');
    await vi.waitFor(() => expect(mocks.updateMine).toHaveBeenCalledTimes(1));
    failSave(new Error('保存失败'));
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
      checked: false,
    });
    expect(page.data.feedbackTone).toBe('error');
  });

  it('reuses the session grant so repeated open/close flips stay instant', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.requestSubscriptions.mockResolvedValue([
      { granted: true, status: 'accepted', templateId: 'business' },
    ]);
    const toggle = (checked) =>
      definition.methods.handleWechatKindToggle.call(page, {
        currentTarget: { dataset: { kind: 'business' } },
        detail: { checked },
      });
    toggle(true);
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    toggle(false);
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    toggle(true);
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    // 只有第一次打开申请了订阅授权，之后反复开关不再弹窗。
    expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(1);
    expect(mocks.updateMine).toHaveBeenCalledTimes(3);
    expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
      checked: true,
      statusLabel: '本次已授权 · 点此重新授权',
    });
  });

  it('forces a fresh grant from the row status without touching the preference', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.requestSubscriptions.mockResolvedValue([
      { granted: true, status: 'accepted', templateId: 'business' },
    ]);
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'business' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    const savesAfterToggle = mocks.updateMine.mock.calls.length;
    definition.methods.handleWechatKindReauthorize.call(page, {
      currentTarget: { dataset: { kind: 'business' } },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(2);
    expect(mocks.updateMine.mock.calls.length).toBe(savesAfterToggle);
    expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
      checked: true,
      statusLabel: '本次已授权 · 点此重新授权',
    });
  });

  it('keeps a kind switch retryable when saving its preference fails', async () => {
    mocks.templates.mockResolvedValue(['duty', 'business', 'swap', 'adjustment', 'leave']);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.requestSubscriptions.mockResolvedValue([
      { granted: true, status: 'accepted', templateId: 'business' },
    ]);
    mocks.updateMine.mockRejectedValueOnce(new Error('保存失败'));
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'business' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(page.data.feedbackTone).toBe('error');
    expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
      // 保存失败不改写接收偏好，开关回到服务端已保存的状态。
      checked: true,
    });
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'business' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(mocks.updateMine).toHaveBeenLastCalledWith(groupId, {
      wechatNotificationKinds: {
        business: true,
        dutyAdjustment: true,
        dutyReminder: true,
        leave: true,
        swap: true,
      },
      wechatNotificationsEnabled: true,
    });
    expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
      checked: true,
      statusLabel: '本次已授权 · 点此重新授权',
    });
  });

  it('discards an old grant and its row status after an account change on return', async () => {
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
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    definition.pageLifetimes.hide.call(page);
    mocks.token.mockReturnValue('new-account');
    definition.pageLifetimes.show.call(page);
    complete([{ granted: true, status: 'accepted', templateId: 'duty' }]);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    await flushPromises();
    expect(page.data.wechatKindBusy).toBe('');
    expect(page.data.wechatKindRows.every((row) => row.statusLabel !== '本次已授权')).toBe(true);
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

  it('keeps the read-all controls still while a single notification is being marked', async () => {
    mocks.listNotifications.mockResolvedValue({
      nextCursor: undefined,
      notifications: [notification('notice-1', false), notification('notice-2', false)],
      unreadCount: 2,
    });
    const definition = await definitionFor('notifications');
    const page = pageFor(definition, 'notifications', true);
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    let resolveRead;
    mocks.markNotificationRead.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    definition.methods.handleMarkRead.call(page, {
      currentTarget: { dataset: { id: 'notice-1' } },
    });
    await vi.waitFor(() => expect(page.data.actionBusyId).toBe('notice-1'));

    // 单条已读只占用它自己的忙碌标记；“全部已读”只在该控件自己的操作进行中改变呈现。
    const template = notificationsPanelTemplate();
    expect(template).toContain(
      "class=\"notification-sheet-read-all {{actionBusyId === 'all' ? 'is-disabled' : ''}}\"",
    );
    expect(template).not.toContain(
      "class=\"notification-sheet-read-all {{actionBusyId !== '' ? 'is-disabled' : ''}}\"",
    );
    const listReadAll = template.slice(
      template.indexOf('label="全部标为已读"'),
      template.indexOf('bindpress="handleMarkAllRead"'),
    );
    expect(listReadAll).toContain('disabled="{{actionBusyId === \'all\'}}"');
    expect(listReadAll).not.toContain('disabled="{{actionBusyId !== \'\'}}"');

    resolveRead({ ...notification('notice-1', false), isRead: true });
    await vi.waitFor(() => expect(page.data.actionBusyId).toBe(''));
    expect(page.data.notifications.find((item) => item.id === 'notice-1').isRead).toBe(true);
  });

  it('keeps press feedback on every notification control and only the busy row inactive', () => {
    const template = notificationsPanelTemplate();

    // 按压反馈只由手指触摸驱动，不再因为别的请求把整片可点区域关掉。
    expect(template).not.toContain('hover-class="{{actionBusyId');
    const listRowRead = template.slice(
      template.indexOf('label="已读"'),
      template.indexOf('bindpress="handleMarkRead"'),
    );
    // 只有正在保存的那一行变灰；其它行保持正常外观与按压反馈，重复点击仍由控制器守卫吞掉。
    expect(listRowRead).toContain('disabled="{{actionBusyId === item.id}}"');
    expect(listRowRead).toContain('loading="{{actionBusyId === item.id}}"');
    expect(listRowRead).not.toContain("actionBusyId !== ''");
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

  it('requests the approved duty reminder subscription only after an explicit switch', async () => {
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

    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));

    expect(mocks.requestSubscriptions).toHaveBeenCalledWith([
      'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
    ]);
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, {
      wechatNotificationKinds: {
        business: true,
        dutyAdjustment: true,
        dutyReminder: true,
        leave: true,
        swap: true,
      },
      wechatNotificationsEnabled: true,
    });
  });

  it('keeps the other kinds and the switch state when a requested template is rejected', async () => {
    mocks.templates.mockResolvedValueOnce(['duty', 'business']);
    mocks.requestSubscriptions.mockResolvedValue([
      { granted: false, status: 'rejected', templateId: 'business' },
    ]);
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'business' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(mocks.requestSubscriptions).toHaveBeenCalledWith(['business']);
    expect(mocks.updateMine).not.toHaveBeenCalled();
    expect(page.data.wechatKindRows.find((row) => row.kind === 'business')).toMatchObject({
      // 微信拒绝授权只影响本次订阅结果，接收偏好保持原状，可关闭后再开启重试。
      checked: true,
      statusLabel: '本次未授权',
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

  it('requests the kind subscription synchronously inside the switch tap', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.requestSubscriptions.mockResolvedValue([
      {
        granted: true,
        status: 'accepted',
        templateId: 'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
      },
    ]);
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(page.data.infoMessage).toBe('已开启值班提醒。');
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

  it('saves a kind authorization after native hide/show without replaying the old success capsule', async () => {
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
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    definition.pageLifetimes.hide.call(page);
    definition.pageLifetimes.show.call(page);
    resolveGrant([
      {
        granted: true,
        status: 'accepted',
        templateId: 'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
      },
    ]);
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(mocks.updateMine).toHaveBeenCalledWith(groupId, {
      wechatNotificationKinds: {
        business: true,
        dutyAdjustment: true,
        dutyReminder: true,
        leave: true,
        swap: true,
      },
      wechatNotificationsEnabled: true,
    });
    expect(page.data.infoMessage).toBe('');
  });

  it.each(['rejected', 'blocked', 'filtered'])(
    'does not save authorization for %s',
    async (status) => {
      const definition = await definitionFor('settings');
      const page = pageFor(definition, 'settings');
      definition.lifetimes.attached.call(page);
      await vi.waitFor(() => expect(page.data.state).toBe('ready'));
      mocks.requestSubscriptions.mockResolvedValue([
        {
          granted: false,
          status,
          templateId: 'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
        },
      ]);
      definition.methods.handleWechatKindToggle.call(page, {
        currentTarget: { dataset: { kind: 'dutyReminder' } },
        detail: { checked: true },
      });
      await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
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
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(page.data.showSubscriptionSettings).toBe(true);
    expect(globalThis.wx.openSetting).not.toHaveBeenCalled();
    definition.methods.handleOpenSubscriptionSettings.call(page);
    expect(globalThis.wx.openSetting).toHaveBeenCalledTimes(1);
  });

  it('does not request subscription when the capability was disabled after loading', async () => {
    const definition = await definitionFor('settings');
    const page = pageFor(definition, 'settings');
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    mocks.snapshot.mockReturnValue({ global: true, externalMessages: false });
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    await flushPromises();
    expect(mocks.requestSubscriptions).not.toHaveBeenCalled();
    expect(page.data.state).toBe('disabled');
    expect(page.data.wechatKindBusy).toBe('');
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
      definition.methods.handleWechatKindToggle.call(page, {
        currentTarget: { dataset: { kind: 'dutyReminder' } },
        detail: { checked: true },
      });
      definition.methods.handleWechatKindToggle.call(page, {
        currentTarget: { dataset: { kind: 'dutyReminder' } },
        detail: { checked: true },
      });
      expect(mocks.requestSubscriptions).toHaveBeenCalledTimes(1);
      if (change === 'detach') definition.lifetimes.detached.call(page);
      else {
        page.properties.groupId = otherGroupId;
        definition.observers.groupId.call(page);
      }
      resolveGrant([
        {
          granted: true,
          status: 'accepted',
          templateId: 'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
        },
      ]);
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
    mocks.requestSubscriptions.mockResolvedValue([
      {
        granted: false,
        status: 'rejected',
        templateId: 'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
      },
    ]);
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
    expect(mocks.updateMine).not.toHaveBeenCalled();
    mocks.requestSubscriptions.mockResolvedValue([
      {
        granted: true,
        status: 'accepted',
        templateId: 'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',
      },
    ]);
    mocks.updateMine.mockRejectedValue(new Error('保存失败'));
    definition.methods.handleWechatKindToggle.call(page, {
      currentTarget: { dataset: { kind: 'dutyReminder' } },
      detail: { checked: true },
    });
    await vi.waitFor(() => expect(page.data.wechatKindBusy).toBe(''));
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

function notificationsPanelTemplate() {
  return readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'src',
      'subpackages',
      'insights',
      'components',
      'notifications-panel',
      'index.wxml',
    ),
    'utf8',
  );
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
