import {
  char,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

const auditableColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

export const notifications = mysqlTable(
  'notifications',
  {
    id: identifier(),
    recipientUserId: char('recipient_user_id', { length: 36 }).notNull(),
    groupId: char('group_id', { length: 36 }),
    notificationType: varchar('notification_type', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: varchar('body', { length: 500 }).notNull(),
    objectType: varchar('object_type', { length: 64 }),
    objectId: char('object_id', { length: 36 }),
    scheduleEventId: char('schedule_event_id', { length: 36 }),
    shiftAssignmentId: char('shift_assignment_id', { length: 36 }),
    payload: json('payload').$type<Record<string, unknown>>(),
    isRead: tinyint('is_read', { unsigned: true }).default(0).notNull(),
    readAt: timestamp('read_at', { fsp: 3 }),
    listHiddenAt: timestamp('list_hidden_at', { fsp: 3 }),
    ...auditableColumns(),
  },
  (table) => [
    index('notifications_list_visible_idx').on(
      table.recipientUserId,
      table.listHiddenAt,
      table.createdAt,
      table.id,
    ),
    index('notifications_unread_visible_idx').on(
      table.recipientUserId,
      table.listHiddenAt,
      table.isRead,
      table.createdAt,
    ),
    index('notifications_expiry_idx').on(table.listHiddenAt, table.createdAt),
    index('notifications_recipient_created_idx').on(
      table.recipientUserId,
      table.createdAt,
      table.id,
    ),
    index('notifications_recipient_unread_idx').on(
      table.recipientUserId,
      table.isRead,
      table.createdAt,
    ),
    index('notifications_group_idx').on(table.groupId),
    index('notifications_event_idx').on(table.scheduleEventId),
  ],
);

export const notificationDeliveries = mysqlTable(
  'notification_deliveries',
  {
    id: identifier(),
    notificationId: char('notification_id', { length: 36 })
      .notNull()
      .references(() => notifications.id),
    channel: mysqlEnum('channel', ['browser', 'wechat']).default('browser').notNull(),
    status: mysqlEnum('status', ['pending', 'sent', 'failed', 'skipped'])
      .default('pending')
      .notNull(),
    attempts: int('attempts', { unsigned: true }).default(0).notNull(),
    maxAttempts: int('max_attempts', { unsigned: true }).default(3).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { fsp: 3 }),
    lastError: varchar('last_error', { length: 500 }),
    sentAt: timestamp('sent_at', { fsp: 3 }),
    externalMessageId: varchar('external_message_id', { length: 64 }),
    claimToken: char('claim_token', { length: 36 }),
    claimedUntil: timestamp('claimed_until', { fsp: 3 }),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('notification_deliveries_notification_channel_unique').on(
      table.notificationId,
      table.channel,
    ),
    index('notification_deliveries_retry_idx').on(table.status, table.nextAttemptAt),
  ],
);

export const notificationSettings = mysqlTable('notification_settings', {
  groupId: char('group_id', { length: 36 }).primaryKey(),
  dutyReminderHours: json('duty_reminder_hours').$type<number[]>().notNull(),
  version: int('version', { unsigned: true }).default(1).notNull(),
  ...auditableColumns(),
});

export interface StoredWechatNotificationKinds {
  readonly business?: boolean;
  readonly dutyAdjustment?: boolean;
  readonly dutyReminder?: boolean;
  readonly leave?: boolean;
  readonly swap?: boolean;
}

export const notificationPreferences = mysqlTable(
  'notification_preferences',
  {
    id: identifier(),
    membershipId: char('membership_id', { length: 36 }).notNull(),
    dutyReminderHours: json('duty_reminder_hours').$type<number[]>(),
    browserNotificationsEnabled: tinyint('browser_notifications_enabled', {
      unsigned: true,
    })
      .default(1)
      .notNull(),
    wechatNotificationsEnabled: tinyint('wechat_notifications_enabled', {
      unsigned: true,
    })
      .default(1)
      .notNull(),
    // NULL 表示全部类型都接收；写入后按类型覆盖。
    wechatNotificationKinds: json(
      'wechat_notification_kinds',
    ).$type<StoredWechatNotificationKinds>(),
    version: int('version', { unsigned: true }).default(1).notNull(),
    ...auditableColumns(),
  },
  (table) => [uniqueIndex('notification_preferences_membership_unique').on(table.membershipId)],
);

export const webPushSubscriptions = mysqlTable(
  'web_push_subscriptions',
  {
    id: identifier(),
    userId: char('user_id', { length: 36 }).notNull(),
    endpoint: varchar('endpoint', { length: 1000 }).notNull(),
    p256dh: varchar('p256dh', { length: 256 }).notNull(),
    auth: varchar('auth', { length: 256 }).notNull(),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('web_push_subscriptions_user_endpoint_unique').on(table.userId, table.endpoint),
  ],
);

export const notificationBatches = mysqlTable(
  'notification_batches',
  {
    id: identifier(),
    batchKey: varchar('batch_key', { length: 191 }).notNull(),
    jobType: varchar('job_type', { length: 64 }).notNull(),
    processedAt: timestamp('processed_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('notification_batches_batch_key_unique').on(table.batchKey)],
);
