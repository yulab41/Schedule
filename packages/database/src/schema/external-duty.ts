import { date, char, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const externalDutyChecks = mysqlTable('external_duty_checks', {
  businessDate: date('business_date', { mode: 'string' }).primaryKey(),
  groupId: char('group_id', { length: 36 }).notNull(),
  remoteName: varchar('remote_name', { length: 100 }).notNull(),
  localName: varchar('local_name', { length: 100 }),
  assignmentId: char('assignment_id', { length: 36 }),
  changeSource: mysqlEnum('change_source', ['initial', 'remote', 'local', 'both']).notNull(),
  status: mysqlEnum('status', ['aligned', 'pending', 'processing', 'blocked']).notNull(),
  blockReason: varchar('block_reason', { length: 255 }),
  fingerprint: char('fingerprint', { length: 64 }).notNull(),
  observedAt: timestamp('observed_at', { fsp: 3 }).notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});
