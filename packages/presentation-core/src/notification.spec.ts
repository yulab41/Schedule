import { describe, expect, it } from 'vitest';

import {
  canManageNotificationSettings,
  findNewUnreadNotifications,
  formatNotificationTime,
  formatReminderHours,
  getNotificationLabel,
  getNotificationTone,
  getReminderHoursMode,
  parseReminderHoursInput,
  resolveReminderHours,
} from './notification.js';

describe('shared notification presentation', () => {
  it('maps exact Web notification labels and semantic tones', () => {
    expect(getNotificationLabel('duty_adjustment_request_created')).toBe('加扣班申请');
    expect(getNotificationLabel('swap_request_cancelled')).toBe('换班已取消');
    expect(getNotificationLabel('schedule_published')).toBe('排班已发布');
    expect(getNotificationLabel('unknown')).toBe('通知');
    expect(getNotificationTone('leave_request_rejected')).toBe('danger');
    expect(getNotificationTone('approval_pending')).toBe('warning');
    expect(getNotificationTone('schedule_published')).toBe('success');
    expect(getNotificationTone('schedule_changed')).toBe('primary');
    expect(getNotificationTone('unknown')).toBe('default');
  });

  it('uses Web relative time and absolute fallback rules', () => {
    const now = new Date('2026-08-26T12:00:00.000Z');
    expect(formatNotificationTime('2026-08-26T11:59:30.000Z', now)).toBe('刚刚');
    expect(formatNotificationTime('2026-08-26T11:30:00.000Z', now)).toBe('30 分钟前');
    expect(formatNotificationTime('2026-08-26T10:00:00.000Z', now)).toBe('2 小时前');
    expect(formatNotificationTime('2026-08-24T12:00:00.000Z', now)).toBe('2 天前');
    expect(formatNotificationTime('invalid', now)).toBe('');
  });

  it('shares reminder parsing, display and three-state submission', () => {
    expect(parseReminderHoursInput('2，24、2')).toEqual([24, 2]);
    expect(formatReminderHours([48, 12])).toBe('48, 12');
    expect(getReminderHoursMode(null)).toBe('default');
    expect(getReminderHoursMode([])).toBe('off');
    expect(getReminderHoursMode([24, 2])).toBe('custom');
    expect(resolveReminderHours('default', '')).toBeNull();
    expect(resolveReminderHours('off', '')).toEqual([]);
    expect(resolveReminderHours('custom', '12, 48')).toEqual([48, 12]);
    expect(() => parseReminderHoursInput('0, 2')).toThrow(
      '请输入 1 到 5 个互不相同、1 到 720 之间的整数小时数。',
    );
  });

  it('uses one admin rule and finds only unknown unread records', () => {
    expect(canManageNotificationSettings({ role: 'member' })).toBe(false);
    expect(canManageNotificationSettings({ role: 'administrator' })).toBe(true);
    expect(canManageNotificationSettings({ isDeveloperAdmin: true, role: 'member' })).toBe(true);
    const values = [
      { id: 'known', isRead: false },
      { id: 'new', isRead: false },
      { id: 'read', isRead: true },
    ];
    expect(findNewUnreadNotifications(values, new Set(['known']))).toEqual([values[1]]);
  });
});
