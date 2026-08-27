import type { NotificationRecord } from '@schedule/contracts';

import { createP7WorkflowFixtureFetch } from './p7-workflow-parity-fixtures.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const recipientUserId = '22222222-2222-4222-8222-222222222221';

const notificationFixtures: readonly NotificationRecord[] = [
  {
    body: '您在 2026-08-28 的全天班值班将在 24 小时后开始。',
    createdAt: '2026-08-27T00:00:00.000Z',
    groupId,
    id: 'notification-duty-reminder',
    isRead: false,
    notificationType: 'duty_reminder',
    recipientUserId,
    title: '值班提醒',
  },
  {
    body: '成员取消了请假申请。',
    createdAt: '2026-08-25T08:00:00.000Z',
    groupId,
    id: 'notification-leave-cancelled',
    isRead: true,
    notificationType: 'leave_request_cancelled',
    recipientUserId,
    title: '请假申请已取消',
  },
  {
    body: '换班已撤销，双方实际班次已恢复。',
    createdAt: '2026-08-25T07:30:00.000Z',
    groupId,
    id: 'notification-swap-cancelled',
    isRead: true,
    notificationType: 'swap_request_cancelled',
    recipientUserId,
    title: '换班已撤销',
  },
  {
    body: '换班已完成，您的班次已更新。',
    createdAt: '2026-08-25T07:00:00.000Z',
    groupId,
    id: 'notification-schedule-changed',
    isRead: true,
    notificationType: 'schedule_changed',
    recipientUserId,
    title: '换班已完成',
  },
  {
    body: '新的请假申请需要您审批。',
    createdAt: '2026-08-25T06:30:00.000Z',
    groupId,
    id: 'notification-approval-pending',
    isRead: true,
    notificationType: 'approval_pending',
    recipientUserId,
    title: '新的请假申请待审批',
  },
];

export function createNotificationSheetFixtureFetch(): typeof globalThis.fetch {
  const baseFetch = createP7WorkflowFixtureFetch({
    role: 'member',
    surface: 'list',
    workflow: 'leave',
  });
  const readIds = new Set(
    notificationFixtures.filter((entry) => entry.isRead).map((entry) => entry.id),
  );

  return async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(
      request?.url ?? String(input),
      typeof window === 'undefined' ? 'http://storybook.local' : window.location.origin,
    );
    const path = url.pathname.replace(/^\/api/u, '');
    const method = String(init?.method ?? request?.method ?? 'GET').toUpperCase();

    if (path === '/notifications/unread-count' && method === 'GET') {
      return json({ unreadCount: unreadCount(readIds) });
    }
    if (path === '/notifications' && method === 'GET') {
      return json({
        notifications: notificationFixtures.map((entry) => ({
          ...entry,
          isRead: readIds.has(entry.id),
        })),
        unreadCount: unreadCount(readIds),
      });
    }
    const notificationMatch = /^\/notifications\/([^/]+)\/read$/u.exec(path);
    if (notificationMatch !== null && method === 'POST') {
      const id = decodeURIComponent(notificationMatch[1] ?? '');
      const notification = notificationFixtures.find((entry) => entry.id === id);
      if (notification === undefined) return json({ error: { code: 'NOT_FOUND' } }, 404);
      readIds.add(id);
      return json({ ...notification, isRead: true });
    }
    if (path === '/notifications/read-all' && method === 'POST') {
      const count = unreadCount(readIds);
      for (const notification of notificationFixtures) readIds.add(notification.id);
      return json({ count });
    }
    return baseFetch(input, init);
  };
}

function unreadCount(readIds: ReadonlySet<string>): number {
  return notificationFixtures.filter((entry) => !readIds.has(entry.id)).length;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}
