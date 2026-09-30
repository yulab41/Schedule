import {
  bigint,
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { users } from './index.js';
export const accountActivitySummaries = mysqlTable('account_activity_summaries', {
  userId: char('user_id', { length: 36 })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { fsp: 3 }).notNull(),
  day: char('day', { length: 10 }).notNull(),
  todayLoginCount: int('today_login_count', { unsigned: true }).default(0).notNull(),
  todayOpenCount: int('today_open_count', { unsigned: true }).default(0).notNull(),
  totalOpenCount: bigint('total_open_count', { mode: 'number', unsigned: true })
    .default(0)
    .notNull(),
  lastLoginAt: timestamp('last_login_at', { fsp: 3 }),
  lastLoginMethod: mysqlEnum('last_login_method', [
    'password',
    'wechat_manual',
    'wechat_auto',
    'wechat_binding',
    'wechat_unspecified',
  ]),
  lastOpenedAt: timestamp('last_opened_at', { fsp: 3 }),
});
export const accountOpenReceipts = mysqlTable(
  'account_open_receipts',
  {
    userId: char('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: char('event_id', { length: 36 }).notNull(),
    openedAt: timestamp('opened_at', { fsp: 3 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.eventId] }),
    index('account_open_receipts_opened_idx').on(table.openedAt),
  ],
);
