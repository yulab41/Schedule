import { memberNotificationPreferencesSchema } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createNotificationPreferencesClient,
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

describe('P9 external message notification preference boundary', () => {
  it('keeps the group path encoded and both operations bearer protected', () => {
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
    expect(notificationPreferencesEndpoints.updateMine.method).toBe('PUT');
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
  });

  it('delegates read and update once while preserving response identity', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) =>
      endpoint.id.endsWith('update') ? preferences : preferences,
    );
    const client = createNotificationPreferencesClient({ request } as unknown as ClientTransport);
    await expect(client.getMine('group-1')).resolves.toBe(preferences);
    await expect(
      client.updateMine('group-1', {
        browserNotificationsEnabled: false,
        wechatNotificationsEnabled: true,
      }),
    ).resolves.toBe(preferences);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
