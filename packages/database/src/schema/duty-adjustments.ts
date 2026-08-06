import { sql } from 'drizzle-orm';
import {
  bigint,
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

export const dutyAdjustments = mysqlTable(
  'duty_adjustments',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    workflowSequence: bigint('workflow_sequence', { mode: 'number', unsigned: true })
      .default(0)
      .notNull(),
    coveredAssignmentId: char('covered_assignment_id', { length: 36 }).notNull(),
    overtimeMembershipId: char('overtime_membership_id', { length: 36 }).notNull(),
    deductedMembershipId: char('deducted_membership_id', { length: 36 }).notNull(),
    assignmentVersion: int('assignment_version', { unsigned: true }).notNull(),
    status: mysqlEnum('status', [
      'pending_target',
      'pending_approval',
      'completed',
      'rejected',
      'cancelled',
      'revoked',
    ])
      .default('pending_target')
      .notNull(),
    activeCoveredAssignmentId: varchar('active_covered_assignment_id', {
      length: 36,
    }).generatedAlwaysAs(
      sql`if(deleted_at is null and status in ('pending_target', 'pending_approval', 'completed'), covered_assignment_id, null)`,
      { mode: 'stored' },
    ),
    decidedAt: timestamp('decided_at', { fsp: 3 }),
    approverUserId: char('approver_user_id', { length: 36 }),
    reason: varchar('reason', { length: 1000 }),
    revocationReason: varchar('revocation_reason', { length: 1000 }),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('duty_adjustments_active_covered_assignment_unique').on(
      table.activeCoveredAssignmentId,
    ),
    index('duty_adjustments_group_status_idx').on(table.groupId, table.status),
    index('duty_adjustments_overtime_status_idx').on(table.overtimeMembershipId, table.status),
    index('duty_adjustments_deducted_status_idx').on(table.deductedMembershipId, table.status),
    index('duty_adjustments_covered_sequence_idx').on(
      table.coveredAssignmentId,
      table.workflowSequence,
    ),
  ],
);
