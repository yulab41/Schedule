import { z } from 'zod';

import type { JsonObject } from './errors.js';

const jsonObjectSchema = z.custom<JsonObject>(
  (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
);

export const notificationRecordSchema = z
  .object({
    body: z.string().min(1),
    createdAt: z.string(),
    groupId: z.string().optional(),
    id: z.string().min(1),
    isRead: z.boolean(),
    notificationType: z.string().min(1),
    objectId: z.string().optional(),
    objectType: z.string().optional(),
    payload: jsonObjectSchema.optional(),
    recipientUserId: z.string().min(1),
    scheduleEventId: z.string().optional(),
    shiftAssignmentId: z.string().optional(),
    title: z.string().min(1),
  })
  .strict();
export type NotificationRecord = z.infer<typeof notificationRecordSchema>;

export interface NotificationQuery {
  readonly cursor?: string;
  readonly groupId?: string;
  readonly pageSize?: number;
  readonly unreadOnly?: boolean;
}

export const notificationPageSchema = z
  .object({
    nextCursor: z.string().optional(),
    notifications: z.readonly(z.array(notificationRecordSchema)),
    unreadCount: z.number().int(),
  })
  .strict();
export type NotificationPage = z.infer<typeof notificationPageSchema>;

export const unreadCountResultSchema = z
  .object({
    unreadCount: z.number().int(),
  })
  .strict();

export const readAllResultSchema = z
  .object({
    count: z.number().int(),
  })
  .strict();

export const savedResultSchema = z
  .object({
    saved: z.boolean(),
  })
  .strict();

export const deletedResultSchema = z
  .object({
    deleted: z.boolean(),
  })
  .strict();

export const groupNotificationSettingsSchema = z
  .object({
    dutyReminderHours: z.readonly(z.array(z.number().int().min(1))),
    groupId: z.string().min(1),
  })
  .strict();
export type GroupNotificationSettings = z.infer<typeof groupNotificationSettingsSchema>;

export interface UpdateGroupNotificationSettingsInput {
  readonly dutyReminderHours: readonly number[];
}

export const memberNotificationPreferencesSchema = z
  .object({
    browserNotificationsEnabled: z.boolean(),
    dutyReminderHours: z.union([z.null(), z.readonly(z.array(z.number().int().min(1)))]),
    membershipId: z.string().min(1),
    wechatNotificationsEnabled: z.boolean().optional().default(true),
  })
  .strict();
export type MemberNotificationPreferences = z.infer<typeof memberNotificationPreferencesSchema>;

export interface UpdateMemberNotificationPreferencesInput {
  readonly browserNotificationsEnabled?: boolean;
  readonly dutyReminderHours?: readonly number[] | null;
  readonly wechatNotificationsEnabled?: boolean;
}

export interface WebPushSubscriptionInput {
  readonly endpoint: string;
  readonly keys: {
    readonly auth: string;
    readonly p256dh: string;
  };
}

export const pushConfigurationSchema = z
  .object({
    vapidPublicKey: z.union([z.null(), z.string()]),
  })
  .strict();
export type PushConfiguration = z.infer<typeof pushConfigurationSchema>;
