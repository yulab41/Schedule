import {
  ClientCoreError,
  type NotificationPreferencesClient,
  type P9InsightsActionsClient,
} from '@schedule/client-core';
import type { NotificationRecord } from '@schedule/contracts';
import {
  canManageNotificationSettings,
  formatNotificationTime,
  formatReminderHours,
  getNotificationLabel,
  getNotificationTone,
  getReminderHoursMode,
  parseReminderHoursInput,
  resolveReminderHours,
  type NotificationTone,
  type ReminderHoursMode,
} from '@schedule/presentation-core';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import {
  createRuntimeNotificationPreferencesClient,
  createRuntimeP9InsightsActionsClient,
} from '../../../../platform/client-core-calendar.js';
import { requestWechatSubscriptions } from '../../../../platform/wechat-subscription.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { createWorkbenchReadClient } from '../../../../platform/workbench-read.js';

type NotificationState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';

interface NotificationCard {
  readonly body: string;
  readonly createdAtLabel: string;
  readonly id: string;
  readonly isRead: boolean;
  readonly title: string;
  readonly typeLabel: string;
  readonly typeTone: NotificationTone;
}

interface NotificationsPageData {
  readonly actionBusyId: string;
  readonly busy: boolean;
  readonly canManageGroupSettings: boolean;
  readonly enabled: boolean;
  readonly errorMessage: string;
  readonly groupId: string;
  readonly groupHoursInput: string;
  readonly groupSettingsBusy: boolean;
  readonly infoMessage: string;
  readonly largeText: boolean;
  readonly loadingMore: boolean;
  readonly mode: 'notifications' | 'settings';
  readonly myHoursInput: string;
  readonly myHoursMode: ReminderHoursMode;
  readonly mySettingsBusy: boolean;
  readonly nextCursor: string;
  readonly notifications: readonly NotificationCard[];
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly state: NotificationState;
  readonly templateConfigured: boolean;
  readonly unreadCount: number;
  readonly unreadCountLabel: string;
  readonly viewportClass: string;
}

interface NotificationsPageInstance {
  readonly data: NotificationsPageData;
  readonly properties: { readonly groupId: string; readonly mode: 'notifications' | 'settings' };
  _actionsClient: P9InsightsActionsClient;
  _preferencesClient: NotificationPreferencesClient;
  _loadedGroupId: string;
  _nextCursor: string | undefined;
  _requestSerial: number;
  setData(patch: Partial<NotificationsPageData>, callback?: () => void): void;
}

const actionsClient = createRuntimeP9InsightsActionsClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const preferencesClient = createRuntimeNotificationPreferencesClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const workbenchClient = createWorkbenchReadClient();
// Template IDs are supplied only after the WeChat account template is approved.
const SUBSCRIPTION_TEMPLATE_IDS: readonly string[] = [];

export function createNotificationsPanelControllerDefinition() {
  return {
    data: {
      actionBusyId: '',
      busy: false,
      canManageGroupSettings: false,
      enabled: false,
      errorMessage: '',
      groupId: '',
      groupHoursInput: '',
      groupSettingsBusy: false,
      infoMessage: '',
      largeText: false,
      loadingMore: false,
      mode: 'notifications' as const,
      myHoursInput: '',
      myHoursMode: 'default' as ReminderHoursMode,
      mySettingsBusy: false,
      nextCursor: '',
      notifications: [],
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      state: 'loading' as NotificationState,
      templateConfigured: SUBSCRIPTION_TEMPLATE_IDS.length > 0,
      unreadCount: 0,
      unreadCountLabel: '0 未读',
      viewportClass: '',
    } satisfies NotificationsPageData,
    properties: {
      groupId: { type: String, value: '' },
      mode: { type: String, value: 'notifications' },
    },
    _actionsClient: actionsClient,
    _preferencesClient: preferencesClient,
    _loadedGroupId: '',
    _nextCursor: undefined,
    _requestSerial: 0,
    observers: {
      groupId(this: NotificationsPageInstance): void {
        startLoad(this);
      },
    },
    lifetimes: {
      attached(this: NotificationsPageInstance): void {
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        this.setData({
          pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
          shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
          largeText:
            ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ??
              16) >= 20,
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        startLoad(this);
      },
      detached(this: NotificationsPageInstance): void {
        initializeRuntimeState(this);
        invalidateNotificationRequests(this);
        this._loadedGroupId = '';
        this._nextCursor = undefined;
      },
    },
    methods: {
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleRetry(this: NotificationsPageInstance): void {
        void (this.properties.mode === 'settings'
          ? loadPreferences(this)
          : loadNotifications(this));
      },
      handleLoadMore(this: NotificationsPageInstance): void {
        void loadMore(this);
      },
      handleMarkRead(this: NotificationsPageInstance, event: TapEvent): void {
        const id = event.currentTarget.dataset.id;
        if (id !== undefined) void markRead(this, id);
      },
      handleMarkAllRead(this: NotificationsPageInstance): void {
        void markAllRead(this);
      },
      handleGroupHoursInput(this: NotificationsPageInstance, event: ValueEvent): void {
        this.setData({ groupHoursInput: event.detail.value, errorMessage: '' });
      },
      handleMyHoursInput(this: NotificationsPageInstance, event: ValueEvent): void {
        this.setData({ myHoursInput: event.detail.value, errorMessage: '' });
      },
      handleReminderMode(this: NotificationsPageInstance, event: TapEvent): void {
        const mode = event.currentTarget.dataset.mode;
        if (mode === 'default' || mode === 'custom' || mode === 'off') {
          this.setData({ myHoursMode: mode, errorMessage: '' });
        }
      },
      handleSaveGroupSettings(this: NotificationsPageInstance): void {
        void saveGroupSettings(this);
      },
      handleSaveMyPreferences(this: NotificationsPageInstance): void {
        void saveMyPreferences(this);
      },
      handleToggle(
        this: NotificationsPageInstance,
        event: { readonly detail: { readonly checked: boolean } },
      ): void {
        void toggleSubscription(this, event.detail.checked);
      },
    },
  };
}

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

interface ValueEvent {
  readonly detail: { readonly value: string };
}

async function loadNotifications(page: NotificationsPageInstance): Promise<void> {
  initializeRuntimeState(page);
  const groupId = page.data.groupId;
  if (groupId.length === 0) {
    setMissingGroupError(page);
    return;
  }
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  page._nextCursor = undefined;
  page.setData({
    ...emptyNotificationsDataPatch(),
    errorMessage: '',
    state: 'loading',
  });
  try {
    await requireClientCapability('insights');
    const result = await page._actionsClient.listNotifications({ groupId, pageSize: 30 });
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    page._nextCursor = result.nextCursor;
    const notifications = result.notifications.map(toNotificationCard);
    page.setData({
      nextCursor: result.nextCursor ?? '',
      notifications,
      state: notifications.length === 0 ? 'empty' : 'ready',
      unreadCount: result.unreadCount,
      unreadCountLabel: `${result.unreadCount} 未读`,
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '通知暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

function startLoad(page: NotificationsPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  if (groupId.length === 0) {
    setMissingGroupError(page);
    return;
  }
  if (groupId === page._loadedGroupId) return;
  page._loadedGroupId = groupId;
  invalidateNotificationRequests(page);
  page._nextCursor = undefined;
  page.setData({
    ...emptyNotificationsDataPatch(),
    errorMessage: '',
    groupId,
    mode: page.properties.mode,
    state: 'loading',
  });
  void (page.properties.mode === 'settings' ? loadPreferences(page) : loadNotifications(page));
}

async function loadPreferences(page: NotificationsPageInstance): Promise<void> {
  initializeRuntimeState(page);
  const groupId = page.data.groupId;
  if (groupId.length === 0) {
    setMissingGroupError(page);
    return;
  }
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  page._nextCursor = undefined;
  page.setData({
    ...emptyNotificationsDataPatch(),
    errorMessage: '',
    infoMessage: '',
    state: 'loading',
  });
  try {
    await requireClientCapability('externalMessages');
    const groups = await workbenchClient.listGroups();
    const group = groups.find((candidate) => candidate.id === groupId);
    if (group === undefined) throw new Error('当前群组信息缺失，请返回工作台后重试。');
    const canManageGroupSettings = canManageNotificationSettings(group);
    const [preferences, groupSettings] = await Promise.all([
      page._preferencesClient.getMine(groupId),
      canManageGroupSettings
        ? page._preferencesClient.getGroup(groupId)
        : Promise.resolve(undefined),
    ]);
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    page.setData({
      canManageGroupSettings,
      enabled: preferences.wechatNotificationsEnabled !== false,
      groupHoursInput: formatReminderHours(groupSettings?.dutyReminderHours ?? null),
      myHoursInput: formatReminderHours(preferences.dutyReminderHours),
      myHoursMode: getReminderHoursMode(preferences.dutyReminderHours),
      state: 'ready',
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '通知设置暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

async function saveGroupSettings(page: NotificationsPageInstance): Promise<void> {
  if (
    !page.data.canManageGroupSettings ||
    page.data.groupSettingsBusy ||
    page.data.state !== 'ready'
  ) {
    return;
  }
  initializeRuntimeState(page);
  const requestSerial = page._requestSerial;
  const groupId = page.data.groupId;
  page.setData({ errorMessage: '', groupSettingsBusy: true, infoMessage: '' });
  try {
    await requireClientCapability('externalMessages');
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    const dutyReminderHours = parseReminderHoursInput(page.data.groupHoursInput);
    const settings = await page._preferencesClient.updateGroup(groupId, {
      dutyReminderHours,
    });
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    page.setData({
      groupHoursInput: formatReminderHours(settings.dutyReminderHours),
      infoMessage: '群组提醒时间已保存。',
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({ errorMessage: toUserMessage(error, '通知设置暂时无法保存，请稍后重试。') });
  } finally {
    if (isNotificationRequestCurrent(page, requestSerial, groupId)) {
      page.setData({ groupSettingsBusy: false });
    }
  }
}

async function saveMyPreferences(page: NotificationsPageInstance): Promise<void> {
  if (page.data.mySettingsBusy || page.data.state !== 'ready') return;
  initializeRuntimeState(page);
  const requestSerial = page._requestSerial;
  const groupId = page.data.groupId;
  page.setData({ errorMessage: '', infoMessage: '', mySettingsBusy: true });
  try {
    await requireClientCapability('externalMessages');
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    const dutyReminderHours = resolveReminderHours(page.data.myHoursMode, page.data.myHoursInput);
    const preferences = await page._preferencesClient.updateMine(groupId, {
      dutyReminderHours,
    });
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    page.setData({
      infoMessage: '个人提醒设置已保存。',
      myHoursInput: formatReminderHours(preferences.dutyReminderHours),
      myHoursMode: getReminderHoursMode(preferences.dutyReminderHours),
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({ errorMessage: toUserMessage(error, '通知设置暂时无法保存，请稍后重试。') });
  } finally {
    if (isNotificationRequestCurrent(page, requestSerial, groupId)) {
      page.setData({ mySettingsBusy: false });
    }
  }
}

function initializeRuntimeState(page: NotificationsPageInstance): void {
  // WeChat drops undocumented private keys from Component config. Restore the
  // clients and request guards on the live instance before any async work.
  page._actionsClient = actionsClient;
  page._preferencesClient = preferencesClient;
  if (typeof page._loadedGroupId !== 'string') page._loadedGroupId = '';
  if (!Number.isFinite(page._requestSerial)) page._requestSerial = 0;
  if (typeof page._nextCursor !== 'string') page._nextCursor = undefined;
}

function invalidateNotificationRequests(page: NotificationsPageInstance): void {
  page._requestSerial += 1;
}

function isNotificationRequestCurrent(
  page: NotificationsPageInstance,
  requestSerial: number,
  groupId: string,
): boolean {
  return requestSerial === page._requestSerial && groupId === page.data.groupId;
}

function emptyNotificationsDataPatch(): Pick<
  NotificationsPageData,
  | 'actionBusyId'
  | 'busy'
  | 'canManageGroupSettings'
  | 'enabled'
  | 'groupHoursInput'
  | 'groupSettingsBusy'
  | 'infoMessage'
  | 'loadingMore'
  | 'myHoursInput'
  | 'myHoursMode'
  | 'mySettingsBusy'
  | 'nextCursor'
  | 'notifications'
  | 'unreadCount'
  | 'unreadCountLabel'
> {
  return {
    actionBusyId: '',
    busy: false,
    canManageGroupSettings: false,
    enabled: false,
    groupHoursInput: '',
    groupSettingsBusy: false,
    infoMessage: '',
    loadingMore: false,
    myHoursInput: '',
    myHoursMode: 'default',
    mySettingsBusy: false,
    nextCursor: '',
    notifications: [],
    unreadCount: 0,
    unreadCountLabel: '0 未读',
  };
}

function setMissingGroupError(page: NotificationsPageInstance): void {
  invalidateNotificationRequests(page);
  page._loadedGroupId = '';
  page._nextCursor = undefined;
  page.setData({
    ...emptyNotificationsDataPatch(),
    errorMessage: '当前群组信息缺失，请返回工作台后重试。',
    groupId: '',
    mode: page.properties.mode,
    state: 'error',
  });
}

function setNotificationsDisabled(page: NotificationsPageInstance, message: string): void {
  invalidateNotificationRequests(page);
  page._nextCursor = undefined;
  page.setData({
    ...emptyNotificationsDataPatch(),
    errorMessage: message,
    state: 'disabled',
  });
}

async function toggleSubscription(
  page: NotificationsPageInstance,
  checked: boolean,
): Promise<void> {
  if (page.data.busy || page.data.state !== 'ready') return;
  initializeRuntimeState(page);
  const requestSerial = page._requestSerial;
  const groupId = page.data.groupId;
  page.setData({ busy: true, errorMessage: '', infoMessage: '' });
  try {
    await requireClientCapability('externalMessages');
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    let enabled = checked;
    if (checked) {
      if (SUBSCRIPTION_TEMPLATE_IDS.length === 0) {
        if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
        page.setData({ busy: false, errorMessage: '微信订阅模板尚未配置，暂时无法开启。' });
        return;
      }
      const grants = await requestWechatSubscriptions(SUBSCRIPTION_TEMPLATE_IDS);
      if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
      enabled = grants.length > 0 && grants.every((grant) => grant.status === 'accepted');
      if (!enabled) {
        const blocked = grants.some((grant) => grant.status === 'blocked');
        page.setData({
          busy: false,
          enabled: false,
          infoMessage: blocked
            ? '微信订阅已被系统封禁，未开启提醒。'
            : '未获得微信订阅授权，未开启提醒。',
        });
        return;
      }
    }
    const preferences = await page._preferencesClient.updateMine(groupId, {
      wechatNotificationsEnabled: enabled,
    });
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    page.setData({
      busy: false,
      enabled: preferences.wechatNotificationsEnabled !== false,
      infoMessage: enabled ? '微信值班提醒已开启。' : '微信值班提醒已关闭，应用内通知仍可用。',
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({
      busy: false,
      errorMessage: toUserMessage(error, '通知设置暂时无法保存，请稍后重试。'),
    });
  }
}

async function loadMore(page: NotificationsPageInstance): Promise<void> {
  initializeRuntimeState(page);
  const cursor = page._nextCursor;
  const groupId = page.data.groupId;
  if (cursor === undefined || page.data.loadingMore || groupId.length === 0) return;
  const requestSerial = page._requestSerial;
  page.setData({ loadingMore: true, errorMessage: '' });
  try {
    await requireClientCapability('insights');
    const result = await page._actionsClient.listNotifications({
      groupId,
      cursor,
      pageSize: 30,
    });
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    page._nextCursor = result.nextCursor;
    const notifications = [
      ...page.data.notifications,
      ...result.notifications.map(toNotificationCard),
    ];
    page.setData({
      loadingMore: false,
      nextCursor: result.nextCursor ?? '',
      notifications,
      unreadCount: result.unreadCount,
      unreadCountLabel: `${result.unreadCount} 未读`,
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '更多通知暂时无法加载，请重试。'),
      loadingMore: false,
    });
  }
}

async function markRead(page: NotificationsPageInstance, id: string): Promise<void> {
  if (page.data.actionBusyId.length > 0) return;
  initializeRuntimeState(page);
  const requestSerial = page._requestSerial;
  const groupId = page.data.groupId;
  page.setData({ actionBusyId: id, errorMessage: '' });
  try {
    await requireClientCapability('insights');
    await page._actionsClient.markNotificationRead(id);
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    const wasUnread = page.data.notifications.some((item) => item.id === id && !item.isRead);
    const unreadCount = wasUnread ? Math.max(0, page.data.unreadCount - 1) : page.data.unreadCount;
    page.setData({
      actionBusyId: '',
      notifications: page.data.notifications.map((item) =>
        item.id === id ? { ...item, isRead: true } : item,
      ),
      unreadCount,
      unreadCountLabel: `${unreadCount} 未读`,
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({
      actionBusyId: '',
      errorMessage: toUserMessage(error, '通知状态暂时无法更新，请重试。'),
    });
  }
}

async function markAllRead(page: NotificationsPageInstance): Promise<void> {
  if (page.data.actionBusyId === 'all') return;
  initializeRuntimeState(page);
  const requestSerial = page._requestSerial;
  const groupId = page.data.groupId;
  page.setData({ actionBusyId: 'all', errorMessage: '' });
  try {
    await requireClientCapability('insights');
    await page._actionsClient.markAllNotificationsRead(groupId);
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    page.setData({
      actionBusyId: '',
      notifications: page.data.notifications.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
      unreadCountLabel: '0 未读',
    });
  } catch (error) {
    if (!isNotificationRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setNotificationsDisabled(page, error.message);
      return;
    }
    page.setData({
      actionBusyId: '',
      errorMessage: toUserMessage(error, '通知状态暂时无法更新，请重试。'),
    });
  }
}

function toNotificationCard(notification: NotificationRecord): NotificationCard {
  return {
    body: notification.body,
    createdAtLabel: formatNotificationTime(notification.createdAt, new Date()),
    id: notification.id,
    isRead: notification.isRead,
    title: notification.title,
    typeLabel: getNotificationLabel(notification.notificationType),
    typeTone: getNotificationTone(notification.notificationType),
  };
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
