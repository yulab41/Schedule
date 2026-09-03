import { calendarPreferencesSchema } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  calendarPreferencesDecoder,
  calendarPreferencesEndpoints,
  createCalendarPreferencesClient,
} from './calendar-preferences-client.js';
import type { ClientTransport } from './endpoint.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const shiftTypeId = '33333333-3333-4333-8333-333333333333';

const preferences = {
  canManageGroupDefaults: false,
  effectiveMonthShiftTypeId: shiftTypeId,
  effectiveView: 'month',
  groupDefaultMonthShiftTypeId: shiftTypeId,
  groupDefaultView: 'month',
  groupId,
  memberDefaultMonthShiftTypeId: null,
  memberDefaultView: null,
  membershipId,
} as const;

describe('calendar preferences client boundary', () => {
  it('encodes all paths and keeps the three operations bearer protected', () => {
    expect(calendarPreferencesEndpoints.get.path({ groupId: 'group /一' })).toBe(
      '/groups/group%20%2F%E4%B8%80/calendar-preferences',
    );
    expect(
      calendarPreferencesEndpoints.updateGroupDefaults.path({
        groupId: 'group /一',
        input: { defaultMonthShiftTypeId: null, defaultView: 'week' },
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/calendar-settings');
    expect(
      calendarPreferencesEndpoints.updateMine.path({
        groupId: 'group /一',
        input: { defaultMonthShiftTypeId: null, defaultView: null },
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/calendar-preferences/mine');
    expect(
      Object.values(calendarPreferencesEndpoints).every((endpoint) => endpoint.auth === 'bearer'),
    ).toBe(true);
    expect(calendarPreferencesEndpoints.get.method).toBe('GET');
    expect(calendarPreferencesEndpoints.updateGroupDefaults.method).toBe('PUT');
    expect(calendarPreferencesEndpoints.updateMine.method).toBe('PUT');
  });

  it('matches the contract and rejects extras, malformed UUIDs, views, and nullable fields', () => {
    expect(calendarPreferencesSchema.safeParse(preferences).success).toBe(true);
    expect(calendarPreferencesDecoder.safeDecode(preferences)).toEqual({
      data: preferences,
      success: true,
    });
    for (const invalid of [
      { ...preferences, extra: true },
      { ...preferences, groupId: 'group-1' },
      { ...preferences, effectiveView: 'agenda' },
      { ...preferences, memberDefaultView: undefined },
      { ...preferences, memberDefaultMonthShiftTypeId: 'shift-1' },
    ]) {
      expect(calendarPreferencesDecoder.safeDecode(invalid).success).toBe(false);
    }
  });

  it('delegates each request once and preserves body null semantics and response identity', async () => {
    const request = vi.fn(async () => preferences);
    const client = createCalendarPreferencesClient({ request } as unknown as ClientTransport);

    await expect(client.get(groupId)).resolves.toBe(preferences);
    await expect(
      client.updateGroupDefaults(groupId, {
        defaultMonthShiftTypeId: null,
        defaultView: 'list',
      }),
    ).resolves.toBe(preferences);
    await expect(
      client.updateMine(groupId, {
        defaultMonthShiftTypeId: null,
        defaultView: null,
      }),
    ).resolves.toBe(preferences);

    expect(request).toHaveBeenCalledTimes(3);
    expect(
      calendarPreferencesEndpoints.updateMine.body?.({
        groupId,
        input: { defaultMonthShiftTypeId: null, defaultView: null },
      }),
    ).toEqual({ defaultMonthShiftTypeId: null, defaultView: null });
  });
});
