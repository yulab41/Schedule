import { sql } from 'drizzle-orm';
import {
  char,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  time,
  timestamp,
  tinyint,
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

export const schedulePeriods = mysqlTable(
  'schedule_periods',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    scheduleRoleId: char('schedule_role_id', { length: 36 }).notNull(),
    businessMonth: date('business_month', { mode: 'string' }).notNull(),
    revision: int('revision', { unsigned: true }).notNull(),
    status: mysqlEnum('status', [
      'draft',
      'pending_publication',
      'published',
      'withdrawn',
      'replaced',
      'past',
    ])
      .default('draft')
      .notNull(),
    rulesVersion: int('rules_version', { unsigned: true }).notNull(),
    publishedAt: timestamp('published_at', { fsp: 3 }),
    withdrawnAt: timestamp('withdrawn_at', { fsp: 3 }),
    replacedByPeriodId: char('replaced_by_period_id', { length: 36 }),
    currentPublishedKey: varchar('current_published_key', { length: 111 }).generatedAlwaysAs(
      sql`if(deleted_at is null and status = 'published', concat(group_id, ':', schedule_role_id, ':', business_month), null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('schedule_periods_revision_unique').on(
      table.groupId,
      table.scheduleRoleId,
      table.businessMonth,
      table.revision,
    ),
    uniqueIndex('schedule_periods_current_published_unique').on(table.currentPublishedKey),
    index('schedule_periods_group_month_status_idx').on(
      table.groupId,
      table.businessMonth,
      table.status,
    ),
    index('schedule_periods_role_month_idx').on(table.scheduleRoleId, table.businessMonth),
  ],
);

export const shiftAssignments = mysqlTable(
  'shift_assignments',
  {
    id: identifier(),
    schedulePeriodId: char('schedule_period_id', { length: 36 }).notNull(),
    businessDate: date('business_date', { mode: 'string' }).notNull(),
    slotPosition: int('slot_position', { unsigned: true }).notNull(),
    shiftTypeId: char('shift_type_id', { length: 36 }).notNull(),
    shiftTypeName: varchar('shift_type_name', { length: 100 }).notNull(),
    shiftTypeAbbreviation: varchar('shift_type_abbreviation', { length: 16 }).notNull(),
    shiftTypeColor: char('shift_type_color', { length: 7 }).notNull(),
    shiftTypeTextColor: char('shift_type_text_color', { length: 7 }).notNull(),
    shiftTypeConfigurationVersion: int('shift_type_configuration_version', {
      unsigned: true,
    }).notNull(),
    shiftStartTime: time('shift_start_time').notNull(),
    shiftEndTime: time('shift_end_time').notNull(),
    crossesMidnight: tinyint('crosses_midnight', { unsigned: true }).notNull(),
    isAllDay: tinyint('is_all_day', { unsigned: true }).notNull(),
    countsTowardStatistics: tinyint('counts_toward_statistics', { unsigned: true }).notNull(),
    startsAt: timestamp('starts_at', { fsp: 3 }).notNull(),
    endsAt: timestamp('ends_at', { fsp: 3 }).notNull(),
    plannedMembershipId: char('planned_membership_id', { length: 36 }),
    plannedMemberName: varchar('planned_member_name', { length: 100 }),
    actualMembershipId: char('actual_membership_id', { length: 36 }),
    actualMemberName: varchar('actual_member_name', { length: 100 }),
    backfillAt: timestamp('backfill_at', { fsp: 3 }),
    backfillOperatorUserId: char('backfill_operator_user_id', { length: 36 }),
    backfillReason: varchar('backfill_reason', { length: 1000 }),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('shift_assignments_slot_unique').on(
      table.schedulePeriodId,
      table.startsAt,
      table.slotPosition,
    ),
    index('shift_assignments_period_business_date_idx').on(
      table.schedulePeriodId,
      table.businessDate,
      table.slotPosition,
    ),
    index('shift_assignments_planned_member_date_idx').on(
      table.plannedMembershipId,
      table.businessDate,
    ),
    index('shift_assignments_actual_member_date_idx').on(
      table.actualMembershipId,
      table.businessDate,
    ),
  ],
);
