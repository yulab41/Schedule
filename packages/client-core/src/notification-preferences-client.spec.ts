import { memberNotificationPreferencesSchema } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createNotificationPreferencesClient,
  groupNotificationSettingsDecoder,
  memberNotificationPreferencesDecoder,
  notificationPreferencesEndpoints,
} from './notification-preferences-client.js';
import type { ClientTransport } from './endpoint.js';

const preferences = {
  browserNotificationsEnabled: true,
  dutyReminderHours: [24, 2],
  membershipId: 'membership-1',
  wechatNotificationsEnabled: true,
};
const groupSettings = {
  dutyReminderHours: [48, 12],
  groupId: 'group-1',
};

describe('P9 external message notification preference boundary', () => {
  it('keeps the group path encoded and both operations bearer protected', () => {
    expect(notificationPreferencesEndpoints.getGroup.path({ groupId: 'group /一' })).toBe(
      '/groups/group%20%2F%E4%B8%80/notification-settings',
    );
    expect(
      notificationPreferencesEndpoints.updateGroup.path({
        groupId: 'group /一',
        input: { dutyReminderHours: [24, 2] },
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/notification-settings');
    expect(notificationPreferencesEndpoints.getMine.path({ groupId: 'group /一' })).toBe(
      '/groups/group%20%2F%E4%B8%80/notification-preferences/mine',
    );
    expect(
      notificationPreferencesEndpoints.updateMine.path({
        groupId: 'group /一',
        input: { wechatNotificationsEnabled: true },
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/notification-preferences/mine');
    expect(
      Object.values(notificationPreferencesEndpoints).every(
        (endpoint) => endpoint.auth === 'bearer',
      ),
    ).toBe(true);
    expect(notificationPreferencesEndpoints.getMine.method).toBe('GET');
    expect(notificationPreferencesEndpoints.getGroup.method).toBe('GET');
    expect(notificationPreferencesEndpoints.updateMine.method).toBe('PUT');
    expect(notificationPreferencesEndpoints.updateGroup.method).toBe('PUT');
  });

  it('matches the Web contract and rejects extras or malformed preference values', () => {
    expect(memberNotificationPreferencesSchema.safeParse(preferences).success).toBe(true);
    expect(memberNotificationPreferencesDecoder.safeDecode(preferences).success).toBe(true);
    expect(
      memberNotificationPreferencesDecoder.safeDecode({ ...preferences, extra: true }).success,
    ).toBe(false);
    expect(
      memberNotificationPreferencesDecoder.safeDecode({ ...preferences, dutyReminderHours: [0] })
        .success,
    ).toBe(false);
    expect(
      memberNotificationPreferencesDecoder.safeDecode({
        ...preferences,
        dutyReminderHours: [24, 24],
      }).success,
    ).toBe(false);
    expect(groupNotificationSettingsDecoder.safeDecode(groupSettings).success).toBe(true);
    expect(
      groupNotificationSettingsDecoder.safeDecode({ ...groupSettings, dutyReminderHours: [0] })
        .success,
    ).toBe(false);
  });

  it('preserves the Web legacy default when the WeChat flag is absent', () => {
    expect(
      memberNotificationPreferencesDecoder.safeDecode({
        browserNotificationsEnabled: true,
        dutyReminderHours: null,
        membershipId: 'membership-1',
      }),
    ).toEqual({
      data: {
        browserNotificationsEnabled: true,
        dutyReminderHours: null,
        membershipId: 'membership-1',
        wechatNotificationsEnabled: true,
      },
      success: true,
    });
  });

  it('delegates read and update once while preserving response identity', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) =>
      endpoint.id.includes('group') ? groupSettings : preferences,
    );
    const client = createNotificationPreferencesClient({ request } as unknown as ClientTransport);
    await expect(client.getGroup('group-1')).resolves.toBe(groupSettings);
    await expect(client.getMine('group-1')).resolves.toBe(preferences);
    await expect(
      client.updateGroup('group-1', {
        dutyReminderHours: [48, 12],
      }),
    ).resolves.toBe(groupSettings);
    await expect(
      client.updateMine('group-1', {
        browserNotificationsEnabled: false,
        wechatNotificationsEnabled: true,
      }),
    ).resolves.toBe(preferences);
    expect(request).toHaveBeenCalledTimes(4);
  });
});
