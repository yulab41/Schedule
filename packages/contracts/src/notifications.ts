import type { JsonObject } from './errors.js';

export interface NotificationRecord {
  readonly body: string;
  readonly createdAt: string;
  readonly groupId?: string;
  readonly id: string;
  readonly isRead: boolean;
  readonly notificationType: string;
  readonly objectId?: string;
  readonly objectType?: string;
  readonly payload?: JsonObject;
  readonly recipientUserId: string;
  readonly scheduleEventId?: string;
  readonly shiftAssignmentId?: string;
  readonly title: string;
}

export interface NotificationQuery {
  readonly cursor?: string;
  readonly groupId?: string;
  readonly pageSize?: number;
  readonly unreadOnly?: boolean;
}

export interface NotificationPage {
  readonly nextCursor?: string;
  readonly notifications: readonly NotificationRecord[];
  readonly unreadCount: number;
}

export interface GroupNotificationSettings {
  readonly dutyReminderHours: readonly number[];
  readonly groupId: string;
}

export interface UpdateGroupNotificationSettingsInput {
  readonly dutyReminderHours: readonly number[];
}

export interface MemberNotificationPreferences {
  readonly browserNotificationsEnabled: boolean;
  readonly dutyReminderHours: readonly number[] | null;
  readonly membershipId: string;
}

export interface UpdateMemberNotificationPreferencesInput {
  readonly browserNotificationsEnabled?: boolean;
  readonly dutyReminderHours?: readonly number[] | null;
}

export interface WebPushSubscriptionInput {
  readonly endpoint: string;
  readonly keys: {
    readonly auth: string;
    readonly p256dh: string;
  };
}

export interface PushConfiguration {
  readonly vapidPublicKey: string | null;
}
