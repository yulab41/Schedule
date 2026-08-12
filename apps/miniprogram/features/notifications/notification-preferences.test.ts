import type { MemberNotificationPreferences } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createNotificationPreferencesController } from './notification-preferences.js';

const preferences: MemberNotificationPreferences = {
  browserNotificationsEnabled: true,
  dutyReminderHours: null,
  membershipId: 'membership-1',
  wechatNotificationsEnabled: true,
};

describe('notification preferences controller', () => {
  it('keeps default, disabled, and custom reminder hours distinct and never writes browser fields', async () => {
    const updateMyNotificationPreferences = vi.fn(() =>
      Promise.resolve({
        ...preferences,
        dutyReminderHours: [24, 2],
        wechatNotificationsEnabled: false,
      }),
    );
    const controller = createNotificationPreferencesController({
      getMyNotificationPreferences: vi.fn(() => Promise.resolve(preferences)),
      updateMyNotificationPreferences,
    });

    controller.activate({ groupId: 'group-1', userId: 'user-1' });
    await controller.load();
    expect(controller.state.reminderMode).toBe('default');

    controller.setReminderMode('disabled');
    controller.setWechatNotificationsEnabled(false);
    await controller.save();
    expect(updateMyNotificationPreferences).toHaveBeenLastCalledWith('group-1', {
      dutyReminderHours: [],
      wechatNotificationsEnabled: false,
    });

    controller.setReminderMode('custom');
    controller.setReminderHoursInput('24, 2');
    await controller.save();
    expect(updateMyNotificationPreferences).toHaveBeenLastCalledWith('group-1', {
      dutyReminderHours: [24, 2],
      wechatNotificationsEnabled: false,
    });
    expect(controller.state.reminderMode).toBe('custom');
  });

  it('rejects invalid custom hours before calling the API', async () => {
    const updateMyNotificationPreferences = vi.fn();
    const controller = createNotificationPreferencesController({
      getMyNotificationPreferences: vi.fn(() => Promise.resolve(preferences)),
      updateMyNotificationPreferences,
    });

    controller.activate({ groupId: 'group-1', userId: 'user-1' });
    await controller.load();
    controller.setReminderMode('custom');
    controller.setReminderHoursInput('0, 24, 24, 999');

    await expect(controller.save()).rejects.toThrow('1 到 720');
    expect(updateMyNotificationPreferences).not.toHaveBeenCalled();
  });
});
