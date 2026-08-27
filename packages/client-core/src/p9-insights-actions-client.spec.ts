import {
  notificationPageSchema,
  readAllResultSchema,
  scheduleExportJobSchema,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createP9InsightsActionsClient,
  notificationPageDecoder,
  p9InsightsActionsEndpoints,
  scheduleExportJobDecoder,
  unreadCountDecoder,
} from './p9-insights-actions-client.js';
import type { ClientTransport } from './endpoint.js';

const notification = {
  body: '排班已发布。',
  createdAt: '2026-08-26T08:00:00.000Z',
  groupId: 'group-1',
  id: 'notification-1',
  isRead: false,
  notificationType: 'schedule_published',
  recipientUserId: 'user-1',
  title: '排班已发布',
};

const notificationPage = { notifications: [notification], unreadCount: 1, nextCursor: 'cursor-1' };
const exportJob = {
  createdAt: '2026-08-26T08:00:00.000Z',
  exportType: 'statistics',
  groupId: 'group-1',
  id: 'export-1',
  period: '2026-08',
  periodType: 'month',
  status: 'pending',
} as const;

describe('P9 notification and export job client', () => {
  it('encodes notification filters, read actions, and export job paths', () => {
    expect(
      p9InsightsActionsEndpoints.listNotifications.path({
        cursor: 'cursor /一',
        groupId: 'group /一',
        pageSize: 20,
        unreadOnly: true,
      }),
    ).toBe(
      '/notifications?cursor=cursor%20%2F%E4%B8%80&groupId=group%20%2F%E4%B8%80&pageSize=20&unreadOnly=true',
    );
    expect(p9InsightsActionsEndpoints.markNotificationRead.path({ notificationId: 'id /一' })).toBe(
      '/notifications/id%20%2F%E4%B8%80/read',
    );
    expect(p9InsightsActionsEndpoints.unreadCount.path({})).toBe('/notifications/unread-count');
    expect(p9InsightsActionsEndpoints.unreadCount.path({ groupId: 'group /一' })).toBe(
      '/notifications/unread-count?groupId=group%20%2F%E4%B8%80',
    );
    expect(
      p9InsightsActionsEndpoints.getExportJob.path({ groupId: 'group-1', exportJobId: 'job-1' }),
    ).toBe('/groups/group-1/exports/job-1');
    expect(
      p9InsightsActionsEndpoints.createExportJob.body?.({
        groupId: 'group-1',
        input: { exportType: 'statistics', period: '2026-08' },
      }),
    ).toEqual({ exportType: 'statistics', period: '2026-08' });
  });

  it('decodes strict notification and export payloads', () => {
    expect(notificationPageDecoder.safeDecode(notificationPage).success).toBe(true);
    expect(unreadCountDecoder.safeDecode({ unreadCount: 1 }).success).toBe(true);
    expect(scheduleExportJobDecoder.safeDecode(exportJob).success).toBe(true);
    expect(notificationPageSchema.safeParse({ ...notificationPage, extra: true }).success).toBe(
      false,
    );
    expect(readAllResultSchema.safeParse({ count: 1, extra: true }).success).toBe(false);
    expect(scheduleExportJobSchema.safeParse({ ...exportJob, extra: true }).success).toBe(false);
  });

  it('delegates reads, read markers, and export jobs once', async () => {
    const request = vi.fn(async (endpoint) => {
      if (endpoint.id === 'insights.notifications-list') return notificationPage;
      if (endpoint.id === 'insights.notifications-unread-count') return { unreadCount: 1 };
      if (endpoint.id === 'insights.notifications-read-all') return { count: 1 };
      if (endpoint.id === 'insights.notification-read') return notification;
      return exportJob;
    });
    const client = createP9InsightsActionsClient({ request } as unknown as ClientTransport);
    await expect(client.listNotifications({ pageSize: 20 })).resolves.toEqual(notificationPage);
    await expect(client.unreadCount()).resolves.toEqual({ unreadCount: 1 });
    await expect(client.unreadCount('group-1')).resolves.toEqual({ unreadCount: 1 });
    await expect(client.markNotificationRead('notification-1')).resolves.toEqual(notification);
    await expect(client.markAllNotificationsRead('group-1')).resolves.toEqual({ count: 1 });
    await expect(
      client.createExportJob('group-1', { exportType: 'statistics', period: '2026-08' }),
    ).resolves.toEqual(exportJob);
    await expect(client.getExportJob('group-1', 'export-1')).resolves.toEqual(exportJob);
    expect(request).toHaveBeenCalledTimes(7);
    expect(request).toHaveBeenCalledWith(p9InsightsActionsEndpoints.unreadCount, {
      groupId: 'group-1',
    });
  });
});
