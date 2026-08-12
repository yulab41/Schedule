import {
  getMyNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateMyNotificationPreferences,
} from '../../api/endpoints.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { createNotificationController } from '../../features/notifications/notification-controller.js';
import { getNotificationCardViewModel } from '../../features/notifications/notification-logic.js';
import { activateNotificationsPage } from '../../features/notifications/notification-page-runtime.js';
import { createNotificationPreferencesController } from '../../features/notifications/notification-preferences.js';
import { requestDutyReminderSubscription } from '../../features/notifications/wechat-subscription-adapter.js';
import { sessionStore } from '../../store/session.js';
import { appConfig } from '../../config/index.js';

const notificationController = createNotificationController({
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
});
const notificationPreferencesController = createNotificationPreferencesController({
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
});

let preferencesAvailable = false;

interface NotificationPageData {
  readonly errorMessage: string;
  readonly hasLoaded: boolean;
  readonly isLoading: boolean;
  readonly isMarkingAllRead: boolean;
  readonly isSavingPreferences: boolean;
  readonly nextCursor: string;
  readonly notifications: ReturnType<typeof getNotificationCardViewModel>[];
  readonly preferencesAvailable: boolean;
  readonly reminderHoursInput: string;
  readonly reminderMode: 'custom' | 'default' | 'disabled';
  readonly subscriptionMessage: string;
  readonly unreadCount: number;
  readonly wechatNotificationsEnabled: boolean;
}

interface NotificationPageMethods {
  handleLoadMore(): Promise<void>;
  handleMarkAllRead(): Promise<void>;
  handleNotificationTap(event: {
    readonly currentTarget: { readonly dataset: { readonly id?: unknown } };
  }): Promise<void>;
  handleReminderHoursInput(event: { readonly detail: { readonly value?: unknown } }): void;
  handleReminderMode(event: {
    readonly currentTarget: { readonly dataset: { readonly mode?: unknown } };
  }): void;
  handleRetry(): Promise<void>;
  handleSavePreferences(): Promise<void>;
  handleSubscribe(): Promise<void>;
  handleWechatEnabledChange(event: { readonly detail: { readonly value?: unknown } }): void;
  loadNotifications(): Promise<void>;
  loadPreferences(): Promise<void>;
  sync(): void;
}

function notificationPageData(): NotificationPageData {
  const notifications = notificationController.state;
  const preferences = notificationPreferencesController.state;
  return {
    errorMessage: notifications.errorMessage ?? preferences.errorMessage ?? '',
    hasLoaded: notifications.hasLoaded,
    isLoading: notifications.isLoading,
    isMarkingAllRead: notifications.isMarkingAllRead,
    isSavingPreferences: preferences.isSaving,
    nextCursor: notifications.nextCursor ?? '',
    notifications: notifications.notifications.map((notification) =>
      getNotificationCardViewModel(notification),
    ),
    preferencesAvailable,
    reminderHoursInput: preferences.reminderHoursInput,
    reminderMode: preferences.reminderMode,
    subscriptionMessage: '',
    unreadCount: notifications.unreadCount,
    wechatNotificationsEnabled: preferences.wechatNotificationsEnabled,
  };
}

Page<NotificationPageData, NotificationPageMethods>({
  data: notificationPageData(),
  onShow(): void {
    const state = sessionStore.state;
    if (state.status !== 'authenticated') {
      navigateForCurrentSession();
      return;
    }
    const allowed = activateNotificationsPage(
      state,
      {
        hideTabBar: () => wx.hideTabBar({}),
        reLaunch: (options) => wx.reLaunch(options),
        showTabBar: () => wx.showTabBar({}),
        switchTab: (options) => wx.switchTab(options),
      },
      (context) => {
        notificationController.activate({ userId: context.userId });
        preferencesAvailable = context.groupId !== undefined;
        const groupId = context.groupId;
        if (groupId !== undefined) {
          notificationPreferencesController.activate({ groupId, userId: context.userId });
          void this.loadPreferences();
        }
        void this.loadNotifications();
      },
    );
    if (!allowed) return;
    this.sync();
  },
  async handleLoadMore(): Promise<void> {
    const operation = notificationController.loadMore();
    this.sync();
    await operation;
    this.sync();
  },
  async handleMarkAllRead(): Promise<void> {
    const operation = notificationController.markAllRead();
    this.sync();
    await operation;
    this.sync();
  },
  async handleNotificationTap(event): Promise<void> {
    const id = event.currentTarget.dataset.id;
    if (typeof id !== 'string' || id.length === 0) return;
    const operation = notificationController.markRead(id);
    this.sync();
    await operation;
    this.sync();
  },
  handleReminderHoursInput(event): void {
    notificationPreferencesController.setReminderHoursInput(
      typeof event.detail.value === 'string' ? event.detail.value : '',
    );
    this.sync();
  },
  handleReminderMode(event): void {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'custom' && mode !== 'default' && mode !== 'disabled') return;
    notificationPreferencesController.setReminderMode(mode);
    this.sync();
  },
  async handleRetry(): Promise<void> {
    const operation = notificationController.retry();
    this.sync();
    await operation;
    this.sync();
  },
  async handleSavePreferences(): Promise<void> {
    try {
      const operation = notificationPreferencesController.save();
      this.sync();
      await operation;
    } catch {
      // The controller retains the validation or API message for the page.
    }
    this.sync();
  },
  async handleSubscribe(): Promise<void> {
    const requestSubscribeMessage = (
      wx as unknown as {
        requestSubscribeMessage?: (options: {
          readonly fail?: (error: unknown) => void;
          readonly success: (result: Readonly<Record<string, 'accept' | 'ban' | 'reject'>>) => void;
          readonly tmplIds: readonly string[];
        }) => void;
      }
    ).requestSubscribeMessage;
    const result = await requestDutyReminderSubscription(
      {
        requestSubscribeMessage:
          requestSubscribeMessage === undefined ? undefined : requestSubscribeMessage.bind(wx),
      },
      appConfig.templateIds.dutyReminder,
    );
    this.setData({ subscriptionMessage: result.message });
  },
  handleWechatEnabledChange(event): void {
    notificationPreferencesController.setWechatNotificationsEnabled(event.detail.value === true);
    this.sync();
  },
  async loadNotifications(): Promise<void> {
    const operation = notificationController.refresh();
    this.sync();
    await operation;
    this.sync();
  },
  async loadPreferences(): Promise<void> {
    const operation = notificationPreferencesController.load();
    this.sync();
    await operation;
    this.sync();
  },
  sync(): void {
    const next = notificationPageData();
    this.setData({
      ...next,
      subscriptionMessage: this.data.subscriptionMessage,
    });
  },
});
