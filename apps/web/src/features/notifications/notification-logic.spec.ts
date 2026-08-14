import { describe, expect, it } from 'vitest';

import {
  findNewUnreadNotifications,
  formatNotificationTime,
  formatReminderHours,
  getGenericBrowserNotificationBody,
  getNotificationLabel,
  getNotificationTone,
  getNotificationTargetUrl,
  parseReminderHoursInput,
} from './notification-logic.js';

function notification(
  overrides: Partial<{
    readonly createdAt: string;
    readonly id: string;
    readonly isRead: boolean;
    readonly notificationType: string;
    readonly shiftAssignmentId?: string;
  }> = {},
) {
  return {
    body: '内容',
    createdAt: '2026-08-02T00:00:00.000Z',
    id: 'notification-1',
    isRead: false,
    notificationType: 'duty_reminder',
    recipientUserId: 'user-1',
    title: '值班提醒',
    ...overrides,
  };
}

describe('notification logic', () => {
  it('maps known notification types to Chinese labels', () => {
    expect(getNotificationLabel('duty_reminder')).toBe('值班提醒');
    expect(getNotificationLabel('approval_pending')).toBe('待审批');
    expect(getNotificationLabel('schedule_changed')).toBe('排班已调整');
    expect(getNotificationLabel('unknown_type')).toBe('通知');
  });

  it('uses workflow meaning rather than read state for notification tones', () => {
    expect(getNotificationTone('duty_reminder')).toBe('primary');
    expect(getNotificationTone('approval_pending')).toBe('warning');
    expect(getNotificationTone('leave_request_rejected')).toBe('danger');
    expect(getNotificationTone('schedule_published')).toBe('success');
    expect(getNotificationTone('unknown_type')).toBe('default');
  });

  it('formats relative times and falls back to an absolute time after a week', () => {
    const now = new Date('2026-08-02T12:00:00.000Z');
    expect(formatNotificationTime('2026-08-02T11:59:30.000Z', now)).toBe('刚刚');
    expect(formatNotificationTime('2026-08-02T11:00:00.000Z', now)).toBe('1 小时前');
    expect(formatNotificationTime('2026-08-01T12:00:00.000Z', now)).toBe('1 天前');
    expect(formatNotificationTime('2026-07-25T12:00:00.000Z', now)).toMatch(
      /^2026-07-25 \d{2}:\d{2}$/u,
    );
    expect(formatNotificationTime('not-a-date', now)).toBe('');
  });

  it('keeps the generic lock-screen body without names or reasons', () => {
    expect(getGenericBrowserNotificationBody()).toBe('排班信息有更新');
  });

  it('detects only unknown unread notifications', () => {
    const known = new Set(['known-id']);
    const notifications = [
      notification({ id: 'known-id' }),
      notification({ id: 'new-id' }),
      notification({ id: 'read-id', isRead: true }),
    ];

    expect(findNewUnreadNotifications(notifications, known).map((entry) => entry.id)).toEqual([
      'new-id',
    ]);
  });

  it('returns a stable target url for every notification', () => {
    expect(getNotificationTargetUrl(notification())).toBe('/');
    expect(getNotificationTargetUrl(notification({ shiftAssignmentId: 'shift-1' }))).toBe('/');
  });

  it('parses and formats reminder hours input', () => {
    expect(parseReminderHoursInput('2, 24, 2')).toEqual([24, 2]);
    expect(parseReminderHoursInput('12、48')).toEqual([48, 12]);
    expect(formatReminderHours([48, 12])).toBe('48, 12');
    expect(formatReminderHours(null)).toBe('');
    expect(formatReminderHours([])).toBe('');
    expect(() => parseReminderHoursInput('0, 25')).toThrow();
    expect(() => parseReminderHoursInput('1, 2, 3, 4, 5, 6')).toThrow();
  });
});
