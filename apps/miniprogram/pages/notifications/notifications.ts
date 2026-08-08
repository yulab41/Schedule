import type { NotificationRecord } from '@schedule/contracts';

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/endpoints.js';

interface NotificationRow {
  readonly body: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isRead: boolean;
  readonly timeLabel: string;
  readonly title: string;
}

interface NotificationsPageData {
  readonly errorMessage: string;
  readonly loading: boolean;
  readonly nextCursor: string | undefined;
  readonly notifications: readonly NotificationRow[];
  readonly unreadCount: number;
}

Page({
  data: {
    errorMessage: '',
    loading: false,
    nextCursor: undefined,
    notifications: [],
    unreadCount: 0,
  } as NotificationsPageData,

  onShow() {
    if (this.data.notifications.length === 0) {
      void this.loadMore();
    } else {
      void this.refreshUnread();
    }
  },

  async loadMore(): Promise<void> {
    if (this.data.loading) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const page = await listNotifications(this.data.nextCursor);
      this.setData({
        nextCursor: page.nextCursor,
        notifications: [
          ...this.data.notifications,
          ...page.notifications.map((notification) => buildNotificationRow(notification)),
        ],
        unreadCount: page.unreadCount,
      });
      this.updateBadge(page.unreadCount);
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '通知加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async refreshUnread(): Promise<void> {
    try {
      const result = await getUnreadCount();
      this.setData({ unreadCount: result.unreadCount });
      this.updateBadge(result.unreadCount);
    } catch {
      // The badge refreshes on the next page load.
    }
  },

  async handleNotificationTap(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    if (typeof id !== 'string') {
      return;
    }
    const notification = this.data.notifications.find((item) => item.id === id);
    if (notification === undefined || notification.isRead) {
      return;
    }
    try {
      const updated = await markNotificationRead(id);
      this.setData({
        notifications: this.data.notifications.map((item) =>
          item.id === id ? buildNotificationRow(updated) : item,
        ),
        unreadCount: Math.max(0, this.data.unreadCount - 1),
      });
      this.updateBadge(this.data.unreadCount);
    } catch {
      // Keep the unread state; it will refresh on the next page load.
    }
  },

  async handleMarkAllRead(): Promise<void> {
    if (this.data.loading) {
      return;
    }
    this.setData({ loading: true });
    try {
      await markAllNotificationsRead();
      this.setData({
        notifications: this.data.notifications.map((item) => ({ ...item, isRead: true })),
        unreadCount: 0,
      });
      this.updateBadge(0);
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '操作失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  openSettings(): void {
    wx.navigateTo({ url: '/pages/notification-settings/notification-settings' });
  },

  updateBadge(unreadCount: number): void {
    if (unreadCount > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: unreadCount > 99 ? '99+' : String(unreadCount),
      });
    } else {
      wx.removeTabBarBadge({ index: 2 });
    }
  },
});

function buildNotificationRow(notification: NotificationRecord): NotificationRow {
  return {
    body: notification.body,
    createdAt: notification.createdAt,
    id: notification.id,
    isRead: notification.isRead,
    timeLabel: formatNotificationTime(notification.createdAt),
    title: notification.title,
  };
}

function formatNotificationTime(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.valueOf())) {
    return '';
  }
  const elapsedMinutes = Math.floor((Date.now() - created.valueOf()) / 60_000);
  if (elapsedMinutes < 1) {
    return '刚刚';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} 分钟前`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} 小时前`;
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays} 天前`;
  }
  return `${String(created.getFullYear()).padStart(4, '0')}-${String(
    created.getMonth() + 1,
  ).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
}
