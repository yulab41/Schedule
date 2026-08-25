import {
  ClientCoreError,
  type NotificationPreferencesClient,
  type P9InsightsActionsClient,
} from '@schedule/client-core';
import type { NotificationRecord } from '@schedule/contracts';
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

type NotificationState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';

interface NotificationCard {
  readonly body: string;
  readonly createdAtLabel: string;
  readonly id: string;
  readonly isRead: boolean;
  readonly title: string;
  readonly typeLabel: string;
}

interface NotificationsPageData {
  readonly actionBusyId: string;
  readonly busy: boolean;
  readonly enabled: boolean;
  readonly errorMessage: string;
  readonly groupId: string;
  readonly infoMessage: string;
  readonly loadingMore: boolean;
  readonly mode: 'notifications' | 'settings';
  readonly nextCursor: string;
  readonly notifications: readonly NotificationCard[];
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly state: NotificationState;
  readonly templateConfigured: boolean;
  readonly unreadCountLabel: string;
  readonly viewportClass: string;
}

interface NotificationsPageInstance {
  readonly data: NotificationsPageData;
  readonly properties: { readonly groupId: string; readonly mode: 'notifications' | 'settings' };
  readonly _actionsClient: P9InsightsActionsClient;
  readonly _preferencesClient: NotificationPreferencesClient;
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
// Template IDs are supplied only after the WeChat account template is approved.
const SUBSCRIPTION_TEMPLATE_IDS: readonly string[] = [];

export function createNotificationsPanelControllerDefinition() {
  return {
    data: {
      actionBusyId: '',
      busy: false,
      enabled: false,
      errorMessage: '',
      groupId: '',
      infoMessage: '',
      loadingMore: false,
      mode: 'notifications' as const,
      nextCursor: '',
      notifications: [],
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      state: 'loading' as NotificationState,
      templateConfigured: SUBSCRIPTION_TEMPLATE_IDS.length > 0,
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
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        startLoad(this);
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

async function loadNotifications(page: NotificationsPageInstance): Promise<void> {
  const groupId = page.data.groupId;
  if (groupId.length === 0) {
    page.setData({ errorMessage: '当前群组信息缺失，请返回工作台后重试。', state: 'error' });
    return;
  }
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  page._nextCursor = undefined;
  page.setData({ errorMessage: '', loadingMore: false, nextCursor: '', state: 'loading' });
  try {
    await requireClientCapability('insights');
    const result = await page._actionsClient.listNotifications({ groupId, pageSize: 20 });
    if (requestSerial !== page._requestSerial) return;
    page._nextCursor = result.nextCursor;
    const notifications = result.notifications.map(toNotificationCard);
    page.setData({
      nextCursor: result.nextCursor ?? '',
      notifications,
      state: notifications.length === 0 ? 'empty' : 'ready',
      unreadCountLabel: `${result.unreadCount} 未读`,
    });
  } catch (error) {
    if (requestSerial !== page._requestSerial) return;
    page.setData({
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '通知暂时无法加载，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'error',
    });
  }
}

function startLoad(page: NotificationsPageInstance): void {
  const groupId = page.properties.groupId;
  if (groupId.length === 0 || groupId === page._loadedGroupId) return;
  page._loadedGroupId = groupId;
  page.setData({ groupId, mode: page.properties.mode });
  void (page.properties.mode === 'settings' ? loadPreferences(page) : loadNotifications(page));
}

async function loadPreferences(page: NotificationsPageInstance): Promise<void> {
  if (page.data.groupId.length === 0) {
    page.setData({ errorMessage: '当前群组信息缺失，请返回工作台后重试。', state: 'error' });
    return;
  }
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  page.setData({ busy: false, errorMessage: '', infoMessage: '', state: 'loading' });
  try {
    await requireClientCapability('externalMessages');
    const preferences = await page._preferencesClient.getMine(page.data.groupId);
    if (requestSerial !== page._requestSerial) return;
    page.setData({ enabled: preferences.wechatNotificationsEnabled !== false, state: 'ready' });
  } catch (error) {
    if (requestSerial !== page._requestSerial) return;
    page.setData({
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '通知设置暂时无法加载，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'error',
    });
  }
}

async function toggleSubscription(
  page: NotificationsPageInstance,
  checked: boolean,
): Promise<void> {
  if (page.data.busy || page.data.state !== 'ready') return;
  page.setData({ busy: true, errorMessage: '', infoMessage: '' });
  try {
    await requireClientCapability('externalMessages');
    let enabled = checked;
    if (checked) {
      if (SUBSCRIPTION_TEMPLATE_IDS.length === 0) {
        page.setData({ busy: false, errorMessage: '微信订阅模板尚未配置，暂时无法开启。' });
        return;
      }
      const grants = await requestWechatSubscriptions(SUBSCRIPTION_TEMPLATE_IDS);
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
    const preferences = await page._preferencesClient.updateMine(page.data.groupId, {
      wechatNotificationsEnabled: enabled,
    });
    page.setData({
      busy: false,
      enabled: preferences.wechatNotificationsEnabled !== false,
      infoMessage: enabled ? '微信值班提醒已开启。' : '微信值班提醒已关闭，应用内通知仍可用。',
    });
  } catch (error) {
    page.setData({
      busy: false,
      errorMessage: toUserMessage(error, '通知设置暂时无法保存，请稍后重试。'),
    });
  }
}

async function loadMore(page: NotificationsPageInstance): Promise<void> {
  const cursor = page._nextCursor;
  if (cursor === undefined || page.data.loadingMore) return;
  page.setData({ loadingMore: true, errorMessage: '' });
  try {
    await requireClientCapability('insights');
    const result = await page._actionsClient.listNotifications({
      groupId: page.data.groupId,
      cursor,
      pageSize: 20,
    });
    page._nextCursor = result.nextCursor;
    const notifications = [
      ...page.data.notifications,
      ...result.notifications.map(toNotificationCard),
    ];
    page.setData({
      loadingMore: false,
      nextCursor: result.nextCursor ?? '',
      notifications,
      unreadCountLabel: `${result.unreadCount} 未读`,
    });
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '更多通知暂时无法加载，请重试。'),
      loadingMore: false,
    });
  }
}

async function markRead(page: NotificationsPageInstance, id: string): Promise<void> {
  if (page.data.actionBusyId.length > 0) return;
  page.setData({ actionBusyId: id, errorMessage: '' });
  try {
    await requireClientCapability('insights');
    await page._actionsClient.markNotificationRead(id);
    page.setData({
      actionBusyId: '',
      notifications: page.data.notifications.map((item) =>
        item.id === id ? { ...item, isRead: true } : item,
      ),
    });
  } catch (error) {
    page.setData({
      actionBusyId: '',
      errorMessage: toUserMessage(error, '通知状态暂时无法更新，请重试。'),
    });
  }
}

async function markAllRead(page: NotificationsPageInstance): Promise<void> {
  if (page.data.actionBusyId === 'all') return;
  page.setData({ actionBusyId: 'all', errorMessage: '' });
  try {
    await requireClientCapability('insights');
    await page._actionsClient.markAllNotificationsRead(page.data.groupId);
    page.setData({
      actionBusyId: '',
      notifications: page.data.notifications.map((item) => ({ ...item, isRead: true })),
      unreadCountLabel: '0 未读',
    });
  } catch (error) {
    page.setData({
      actionBusyId: '',
      errorMessage: toUserMessage(error, '通知状态暂时无法更新，请重试。'),
    });
  }
}

function toNotificationCard(notification: NotificationRecord): NotificationCard {
  return {
    body: notification.body,
    createdAtLabel: formatDateTime(notification.createdAt),
    id: notification.id,
    isRead: notification.isRead,
    title: notification.title,
    typeLabel: notificationTypeLabel(notification.notificationType),
  };
}

function notificationTypeLabel(value: string): string {
  if (value.includes('approval')) return '审批提醒';
  if (value.includes('swap')) return '换班提醒';
  if (value.includes('duty')) return '值班提醒';
  if (value.includes('vacancy')) return '缺口提醒';
  return '排班提醒';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '时间未知';
  const china = new Date(date.valueOf() + 8 * 60 * 60 * 1000);
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${china.getUTCMonth() + 1}月${china.getUTCDate()}日 ${pad(china.getUTCHours())}:${pad(china.getUTCMinutes())}`;
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
