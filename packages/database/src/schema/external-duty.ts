import {
  date,
  char,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  tinyint,
  varchar,
} from 'drizzle-orm/mysql-core';

export const externalDutyChecks = mysqlTable('external_duty_checks', {
  businessDate: date('business_date', { mode: 'string' }).primaryKey(),
  groupId: char('group_id', { length: 36 }).notNull(),
  remoteName: varchar('remote_name', { length: 100 }).notNull(),
  baselineName: varchar('baseline_name', { length: 100 }),
  localName: varchar('local_name', { length: 100 }),
  schedulePeriodId: char('schedule_period_id', { length: 36 }),
  assignmentId: char('assignment_id', { length: 36 }),
  assignmentVersion: int('assignment_version', { unsigned: true }),
  isInScope: tinyint('is_in_scope', { unsigned: true }).default(1).notNull(),
  changeSource: mysqlEnum('change_source', ['initial', 'remote', 'local', 'both']).notNull(),
  status: mysqlEnum('status', ['aligned', 'pending', 'processing', 'blocked']).notNull(),
  blockReason: varchar('block_reason', { length: 255 }),
  fingerprint: char('fingerprint', { length: 64 }).notNull(),
  observedAt: timestamp('observed_at', { fsp: 3 }).notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

export const externalDutyActions = mysqlTable('external_duty_actions', {
  id: char('id', { length: 36 }).primaryKey(),
  businessDate: date('business_date', { mode: 'string' }).notNull(),
  groupId: char('group_id', { length: 36 }).notNull(),
  schedulePeriodId: char('schedule_period_id', { length: 36 }).notNull(),
  assignmentId: char('assignment_id', { length: 36 }).notNull(),
  side: mysqlEnum('side', ['external', 'local']).notNull(),
  baselineName: varchar('baseline_name', { length: 100 }).notNull(),
  beforeName: varchar('before_name', { length: 100 }),
  afterName: varchar('after_name', { length: 100 }),
  workflowKind: mysqlEnum('workflow_kind', ['duty', 'swap']),
  workflowId: char('workflow_id', { length: 36 }),
  status: mysqlEnum('status', ['applying', 'applied', 'reverting', 'reverted'])
    .default('applied')
    .notNull(),
  actorUserId: char('actor_user_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  revertedAt: timestamp('reverted_at', { fsp: 3 }),
});
