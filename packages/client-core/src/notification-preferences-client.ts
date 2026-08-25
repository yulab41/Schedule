import type {
  MemberNotificationPreferences,
  UpdateMemberNotificationPreferencesInput,
} from '@schedule/contracts';

import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import type { CompactDecodeResult, CompactDecoder } from './json-decoder.js';

interface GroupInput {
  readonly groupId: string;
}

interface UpdatePreferencesInput extends GroupInput {
  readonly input: UpdateMemberNotificationPreferencesInput;
}

/**
 * The contract has one nullable union (`dutyReminderHours`) which is intentionally
 * kept out of the generated compact-schema subset. Keep this hand-written decoder
 * strict at the response boundary instead of widening the shared schema language.
 */
export const memberNotificationPreferencesDecoder: CompactDecoder<MemberNotificationPreferences> = {
  safeDecode(value): CompactDecodeResult<MemberNotificationPreferences> {
    if (!isRecord(value)) return { success: false };
    const keys = Object.keys(value).sort();
    if (
      keys.join('|') !==
        'browserNotificationsEnabled|dutyReminderHours|membershipId|wechatNotificationsEnabled' &&
      keys.join('|') !== 'browserNotificationsEnabled|dutyReminderHours|membershipId'
    ) {
      return { success: false };
    }
    if (typeof value.browserNotificationsEnabled !== 'boolean') return { success: false };
    if (typeof value.membershipId !== 'string' || value.membershipId.length === 0) {
      return { success: false };
    }
    if (
      value.dutyReminderHours !== null &&
      (!Array.isArray(value.dutyReminderHours) ||
        value.dutyReminderHours.some(
          (hour) => typeof hour !== 'number' || !Number.isInteger(hour) || hour < 1,
        ))
    ) {
      return { success: false };
    }
    if (
      value.wechatNotificationsEnabled !== undefined &&
      typeof value.wechatNotificationsEnabled !== 'boolean'
    ) {
      return { success: false };
    }
    return { data: value as MemberNotificationPreferences, success: true };
  },
};

export const notificationPreferencesEndpoints = {
  getMine: defineClientEndpoint<GroupInput, MemberNotificationPreferences>({
    auth: 'bearer',
    decoder: memberNotificationPreferencesDecoder,
    id: 'external-messages.notification-preferences-mine',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/notification-preferences/mine`,
  }),
  updateMine: defineClientEndpoint<UpdatePreferencesInput, MemberNotificationPreferences>({
    auth: 'bearer',
    body: ({ input }) => input,
    decoder: memberNotificationPreferencesDecoder,
    id: 'external-messages.notification-preferences-mine-update',
    method: 'PUT',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/notification-preferences/mine`,
  }),
} as const;

export interface NotificationPreferencesClient {
  getMine(groupId: string): Promise<MemberNotificationPreferences>;
  updateMine(
    groupId: string,
    input: UpdateMemberNotificationPreferencesInput,
  ): Promise<MemberNotificationPreferences>;
}

export function createNotificationPreferencesClient(
  transport: ClientTransport,
): NotificationPreferencesClient {
  return {
    getMine(groupId) {
      return transport.request(notificationPreferencesEndpoints.getMine, { groupId });
    },
    updateMine(groupId, input) {
      return transport.request(notificationPreferencesEndpoints.updateMine, { groupId, input });
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
