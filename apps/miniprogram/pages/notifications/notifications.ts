import type { NotificationPage } from '@schedule/contracts';

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { formatNotificationTime, getNotificationLabel } from '../../utils/notification-logic.js';

interface NotificationRow {
  readonly body: string;
  readonly createdAt: string;
  readonly id: string;
  readonly isRead: boolean;
  readonly label: string;
  readonly title: string;
}

interface NotificationsPageData {
  readonly errorMessage: string;
  readonly loading: boolean;
  readonly nextCursor: string;
  readonly rows: readonly NotificationRow[];
  readonly unreadCount: number;
}

Page({
  data: {
    errorMessage: '',
    loading: false,
    nextCursor: '',
    rows: [],
    unreadCount: 0,
  } as NotificationsPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadNotifications();
  },

  async loadNotifications(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const [page, count] = await Promise.all([listNotifications(), getUnreadCount()]);
      this.applyPage(page);
      this.setData({ unreadCount: count.unreadCount });
      this.updateBadge(count.unreadCount);
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '通知加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyPage(page: NotificationPage): void {
    this.setData({
      nextCursor: page.nextCursor ?? '',
      rows: page.notifications.map((notification) => ({
        body: notification.body,
        createdAt: formatNotificationTime(notification.createdAt, new Date()),
        id: notification.id,
        isRead: notification.isRead,
        label: getNotificationLabel(notification.notificationType),
        title: notification.title,
      })),
    });
  },

  updateBadge(unreadCount: number): void {
    if (unreadCount > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: String(Math.min(unreadCount, 99)),
      });
    } else {
      wx.removeTabBarBadge({ index: 2 });
    }
  },

  async handleRead(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    if (typeof id !== 'string' || id.length === 0) {
      return;
    }
    try {
      await markNotificationRead(id);
      await this.loadNotifications();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '操作失败。') });
    }
  },

  async handleReadAll(): Promise<void> {
    try {
      await markAllNotificationsRead();
      await this.loadNotifications();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '操作失败。') });
    }
  },

  async handleLoadMore(): Promise<void> {
    if (this.data.nextCursor.length === 0 || this.data.loading) {
      return;
    }
    this.setData({ loading: true });
    try {
      const page = await listNotifications(this.data.nextCursor);
      this.setData({
        nextCursor: page.nextCursor ?? '',
        rows: [
          ...this.data.rows,
          ...page.notifications.map((notification) => ({
            body: notification.body,
            createdAt: formatNotificationTime(notification.createdAt, new Date()),
            id: notification.id,
            isRead: notification.isRead,
            label: getNotificationLabel(notification.notificationType),
            title: notification.title,
          })),
        ],
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '加载更多失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  openSettings() {
    wx.navigateTo({ url: '/pages/notifications/settings' });
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
