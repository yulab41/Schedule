import { sql } from 'drizzle-orm';
import {
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

const auditableColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at', { fsp: 3 }),
  version: int('version', { unsigned: true }).default(1).notNull(),
});

export const swapRequests = mysqlTable(
  'swap_requests',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    initiatorMembershipId: char('initiator_membership_id', { length: 36 }).notNull(),
    targetMembershipId: char('target_membership_id', { length: 36 }).notNull(),
    initiatorAssignmentId: char('initiator_assignment_id', { length: 36 }).notNull(),
    targetAssignmentId: char('target_assignment_id', { length: 36 }).notNull(),
    initiatorAssignmentVersion: int('initiator_assignment_version', {
      unsigned: true,
    }).notNull(),
    targetAssignmentVersion: int('target_assignment_version', {
      unsigned: true,
    }).notNull(),
    status: mysqlEnum('status', [
      'pending_target',
      'pending_approval',
      'completed',
      'rejected',
      'cancelled',
    ])
      .default('pending_target')
      .notNull(),
    activeInitiatorAssignmentId: varchar('active_initiator_assignment_id', {
      length: 36,
    }).generatedAlwaysAs(
      sql`if(deleted_at is null and status in ('pending_target', 'pending_approval'), initiator_assignment_id, null)`,
      { mode: 'stored' },
    ),
    activeTargetAssignmentId: varchar('active_target_assignment_id', {
      length: 36,
    }).generatedAlwaysAs(
      sql`if(deleted_at is null and status in ('pending_target', 'pending_approval'), target_assignment_id, null)`,
      { mode: 'stored' },
    ),
    decidedAt: timestamp('decided_at', { fsp: 3 }),
    approverUserId: char('approver_user_id', { length: 36 }),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('swap_requests_active_initiator_assignment_unique').on(
      table.activeInitiatorAssignmentId,
    ),
    uniqueIndex('swap_requests_active_target_assignment_unique').on(table.activeTargetAssignmentId),
    index('swap_requests_group_status_idx').on(table.groupId, table.status),
    index('swap_requests_initiator_status_idx').on(table.initiatorMembershipId, table.status),
    index('swap_requests_target_status_idx').on(table.targetMembershipId, table.status),
  ],
);
