import type {
  GroupNotificationSettings,
  MemberNotificationPreferences,
  UpdateGroupNotificationSettingsInput,
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

interface UpdateGroupSettingsInput extends GroupInput {
  readonly input: UpdateGroupNotificationSettingsInput;
}

export const groupNotificationSettingsDecoder: CompactDecoder<GroupNotificationSettings> = {
  safeDecode(value): CompactDecodeResult<GroupNotificationSettings> {
    if (!isRecord(value)) return { success: false };
    if (Object.keys(value).sort().join('|') !== 'dutyReminderHours|groupId') {
      return { success: false };
    }
    if (typeof value.groupId !== 'string' || value.groupId.length === 0) return { success: false };
    if (
      !Array.isArray(value.dutyReminderHours) ||
      value.dutyReminderHours.length === 0 ||
      value.dutyReminderHours.length > 5 ||
      value.dutyReminderHours.some(
        (hour) => typeof hour !== 'number' || !Number.isInteger(hour) || hour < 1 || hour > 720,
      )
    ) {
      return { success: false };
    }
    return { data: value as unknown as GroupNotificationSettings, success: true };
  },
};

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
        value.dutyReminderHours.length > 5 ||
        new Set(value.dutyReminderHours).size !== value.dutyReminderHours.length ||
        value.dutyReminderHours.some(
          (hour) => typeof hour !== 'number' || !Number.isInteger(hour) || hour < 1 || hour > 720,
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
    return {
      data: {
        ...value,
        wechatNotificationsEnabled: value.wechatNotificationsEnabled ?? true,
      } as MemberNotificationPreferences,
      success: true,
    };
  },
};

export const notificationPreferencesEndpoints = {
  getGroup: defineClientEndpoint<GroupInput, GroupNotificationSettings>({
    auth: 'bearer',
    decoder: groupNotificationSettingsDecoder,
    id: 'external-messages.notification-settings-group',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/notification-settings`,
  }),
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
  updateGroup: defineClientEndpoint<UpdateGroupSettingsInput, GroupNotificationSettings>({
    auth: 'bearer',
    body: ({ input }) => input,
    decoder: groupNotificationSettingsDecoder,
    id: 'external-messages.notification-settings-group-update',
    method: 'PUT',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/notification-settings`,
  }),
} as const;

export interface NotificationPreferencesClient {
  getGroup(groupId: string): Promise<GroupNotificationSettings>;
  getMine(groupId: string): Promise<MemberNotificationPreferences>;
  updateMine(
    groupId: string,
    input: UpdateMemberNotificationPreferencesInput,
  ): Promise<MemberNotificationPreferences>;
  updateGroup(
    groupId: string,
    input: UpdateGroupNotificationSettingsInput,
  ): Promise<GroupNotificationSettings>;
}

export function createNotificationPreferencesClient(
  transport: ClientTransport,
): NotificationPreferencesClient {
  return {
    getGroup(groupId) {
      return transport.request(notificationPreferencesEndpoints.getGroup, { groupId });
    },
    getMine(groupId) {
      return transport.request(notificationPreferencesEndpoints.getMine, { groupId });
    },
    updateMine(groupId, input) {
      return transport.request(notificationPreferencesEndpoints.updateMine, { groupId, input });
    },
    updateGroup(groupId, input) {
      return transport.request(notificationPreferencesEndpoints.updateGroup, { groupId, input });
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
