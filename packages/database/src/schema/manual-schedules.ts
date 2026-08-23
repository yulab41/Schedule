import { sql } from 'drizzle-orm';
import {
  char,
  check,
  date,
  index,
  int,
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

export const manualScheduleTemplates = mysqlTable(
  'manual_schedule_templates',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    scheduleRoleId: char('schedule_role_id', { length: 36 }).notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    cycleDays: int('cycle_days', { unsigned: true }).notNull(),
    ...auditableColumns(),
  },
  (table) => [
    check(
      'manual_schedule_templates_cycle_days_check',
      sql`${table.deletedAt} is not null or ${table.cycleDays} between 1 and 30`,
    ),
    index('manual_schedule_templates_group_active_idx').on(table.groupId, table.deletedAt),
    index('manual_schedule_templates_role_idx').on(table.scheduleRoleId),
  ],
);

export const manualScheduleTemplateMembers = mysqlTable(
  'manual_schedule_template_members',
  {
    id: identifier(),
    templateId: char('template_id', { length: 36 }).notNull(),
    membershipId: char('membership_id', { length: 36 }).notNull(),
    memberScheduleRoleVersion: int('member_schedule_role_version', {
      unsigned: true,
    }).notNull(),
    activeMembershipId: char('active_membership_id', { length: 36 }).generatedAlwaysAs(
      sql`if(deleted_at is null, membership_id, null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('manual_schedule_template_members_active_unique').on(
      table.templateId,
      table.activeMembershipId,
    ),
    index('manual_schedule_template_members_template_idx').on(table.templateId),
    index('manual_schedule_template_members_membership_idx').on(table.membershipId),
  ],
);

export const manualScheduleCells = mysqlTable(
  'manual_schedule_cells',
  {
    id: identifier(),
    templateId: char('template_id', { length: 36 }).notNull(),
    cycleDay: int('cycle_day', { unsigned: true }).notNull(),
    membershipId: char('membership_id', { length: 36 }).notNull(),
    shiftTypeId: char('shift_type_id', { length: 36 }).notNull(),
    shiftTypeConfigurationVersion: int('shift_type_configuration_version', {
      unsigned: true,
    }).notNull(),
    activeCellKey: varchar('active_cell_key', { length: 80 }).generatedAlwaysAs(
      sql`if(deleted_at is null, concat(template_id, ':', cycle_day, ':', membership_id), null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    check(
      'manual_schedule_cells_cycle_day_check',
      sql`${table.deletedAt} is not null or ${table.cycleDay} between 1 and 30`,
    ),
    uniqueIndex('manual_schedule_cells_active_cell_unique').on(table.activeCellKey),
    index('manual_schedule_cells_template_idx').on(table.templateId),
  ],
);
