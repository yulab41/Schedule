import {
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  tinyint,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

const auditableColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at', { fsp: 3 }),
  version: int('version', { unsigned: true }).default(1).notNull(),
});

export const leaveRequests = mysqlTable(
  'leave_requests',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    membershipId: char('membership_id', { length: 36 }).notNull(),
    leaveType: mysqlEnum('leave_type', [
      'training',
      'rotation',
      'sick',
      'maternity',
      'other',
    ]).notNull(),
    startsAt: timestamp('starts_at', { fsp: 3 }).notNull(),
    endsAt: timestamp('ends_at', { fsp: 3 }).notNull(),
    isAllDay: tinyint('is_all_day', { unsigned: true }).default(0).notNull(),
    reason: varchar('reason', { length: 1000 }).notNull(),
    status: mysqlEnum('status', ['pending', 'approved', 'rejected']).default('pending').notNull(),
    reflowStrategy: mysqlEnum('reflow_strategy', ['keep-original-order', 'shift-forward'])
      .default('keep-original-order')
      .notNull(),
    decidedAt: timestamp('decided_at', { fsp: 3 }),
    approverUserId: char('approver_user_id', { length: 36 }),
    ...auditableColumns(),
  },
  (table) => [
    index('leave_requests_group_status_idx').on(table.groupId, table.status),
    index('leave_requests_membership_status_idx').on(table.membershipId, table.status),
  ],
);
