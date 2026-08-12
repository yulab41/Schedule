import type { NotificationRecord } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { getNotificationCardViewModel } from './notification-logic.js';

const notification: NotificationRecord = {
  body: '李医生将在 2 小时后值班。',
  createdAt: '2026-08-12T01:00:00.000Z',
  id: 'notification-1',
  isRead: false,
  notificationType: 'duty_reminder',
  recipientUserId: 'user-1',
  title: '值班提醒',
};

describe('miniprogram notification display logic', () => {
  it('uses stable copy for known notification types', () => {
    expect(
      getNotificationCardViewModel(notification, new Date('2026-08-12T01:30:00.000Z')),
    ).toMatchObject({
      label: '值班提醒',
      summary: '李医生将在 2 小时后值班。',
      time: '30 分钟前',
    });
  });

  it('renders unknown notification types as a safe generic notification without payload routing', () => {
    const unknown = getNotificationCardViewModel(
      {
        ...notification,
        notificationType: 'future_unsafe_notification',
        objectId: 'private-object-id',
        payload: { arbitrary: { nested: 'untrusted' } },
      },
      new Date('2026-08-12T01:30:00.000Z'),
    );

    expect(unknown).toEqual({
      id: 'notification-1',
      isRead: false,
      label: '通知',
      summary: '李医生将在 2 小时后值班。',
      time: '30 分钟前',
      title: '值班提醒',
    });
  });
});
