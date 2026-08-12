import type { NotificationPage, NotificationRecord } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createNotificationController } from './notification-controller.js';

const firstNotification: NotificationRecord = {
  body: '第一条通知',
  createdAt: '2026-08-12T01:00:00.000Z',
  id: 'notification-1',
  isRead: false,
  notificationType: 'duty_reminder',
  recipientUserId: 'user-1',
  title: '值班提醒',
};
const secondNotification: NotificationRecord = {
  ...firstNotification,
  id: 'notification-2',
  isRead: true,
  title: '第二条通知',
};

function page(
  notifications: readonly NotificationRecord[],
  nextCursor: string | undefined,
  unreadCount: number,
): NotificationPage {
  return { nextCursor, notifications, unreadCount };
}

describe('notification controller', () => {
  it('refreshes from an empty cursor, single-flights pagination, and never appends a repeated cursor', async () => {
    const listNotifications = vi
      .fn()
      .mockResolvedValueOnce(page([firstNotification], 'cursor-2', 1))
      .mockResolvedValueOnce(page([secondNotification], 'cursor-2', 1));
    const controller = createNotificationController({
      getUnreadCount: vi.fn(() => Promise.resolve({ unreadCount: 0 })),
      listNotifications,
      markAllNotificationsRead: vi.fn(() => Promise.resolve({ count: 0 })),
      markNotificationRead: vi.fn(() => Promise.resolve(firstNotification)),
    });

    controller.activate({ userId: 'user-1' });
    await controller.refresh();
    const firstMore = controller.loadMore();
    const repeatedMore = controller.loadMore();
    await Promise.all([firstMore, repeatedMore]);

    expect(listNotifications).toHaveBeenNthCalledWith(1, undefined, 30);
    expect(listNotifications).toHaveBeenNthCalledWith(2, 'cursor-2', 30);
    expect(listNotifications).toHaveBeenCalledTimes(2);
    expect(controller.state.notifications).toEqual([firstNotification, secondNotification]);
    expect(controller.state.nextCursor).toBeUndefined();
  });

  it('uses API-authoritative unread results for one and all read operations', async () => {
    const updated = { ...firstNotification, isRead: true };
    const getUnreadCount = vi.fn(() => Promise.resolve({ unreadCount: 0 }));
    const controller = createNotificationController({
      getUnreadCount,
      listNotifications: vi.fn(() => Promise.resolve(page([firstNotification], undefined, 1))),
      markAllNotificationsRead: vi.fn(() => Promise.resolve({ count: 1 })),
      markNotificationRead: vi.fn(() => Promise.resolve(updated)),
    });

    controller.activate({ userId: 'user-1' });
    await controller.refresh();
    await controller.markRead(firstNotification.id);
    expect(controller.state.notifications).toEqual([updated]);
    expect(controller.state.unreadCount).toBe(0);

    await controller.markAllRead();
    expect(controller.state.notifications).toEqual([updated]);
    expect(getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('does not publish an expired user context and retains visible items on a load error', async () => {
    let rejectFirstLoad: ((error: Error) => void) | undefined;
    const listNotifications = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<NotificationPage>((_resolve, reject) => {
            rejectFirstLoad = reject;
          }),
      )
      .mockResolvedValueOnce(page([firstNotification], 'cursor-2', 1))
      .mockRejectedValueOnce(new Error('网络异常'));
    const controller = createNotificationController({
      getUnreadCount: vi.fn(() => Promise.resolve({ unreadCount: 0 })),
      listNotifications,
      markAllNotificationsRead: vi.fn(() => Promise.resolve({ count: 0 })),
      markNotificationRead: vi.fn(() => Promise.resolve(firstNotification)),
    });

    controller.activate({ userId: 'user-1' });
    const staleRefresh = controller.refresh();
    controller.activate({ userId: 'user-2' });
    rejectFirstLoad?.(new Error('旧会话失败'));
    await staleRefresh;
    expect(controller.state.errorMessage).toBeUndefined();
    expect(controller.state.notifications).toEqual([]);

    await controller.refresh();
    expect(controller.state.notifications).toEqual([firstNotification]);

    await controller.loadMore();
    expect(controller.state.errorMessage).toBe('网络异常');
    expect(controller.state.isLoading).toBe(false);
    expect(controller.state.nextCursor).toBe('cursor-2');
    expect(controller.state.notifications).toEqual([firstNotification]);
  });
});
