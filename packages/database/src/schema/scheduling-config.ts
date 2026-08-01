import { sql } from 'drizzle-orm';
import {
  char,
  date,
  index,
  int,
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

export const scheduleRoles = mysqlTable(
  'schedule_roles',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    ...auditableColumns(),
  },
  (table) => [index('schedule_roles_group_active_idx').on(table.groupId, table.deletedAt)],
);

export const memberScheduleRoles = mysqlTable(
  'member_schedule_roles',
  {
    id: identifier(),
    scheduleRoleId: char('schedule_role_id', { length: 36 }).notNull(),
    membershipId: char('membership_id', { length: 36 }).notNull(),
    effectiveFrom: date('effective_from', { mode: 'string' }),
    effectiveTo: date('effective_to', { mode: 'string' }),
    activeMembershipId: char('active_membership_id', { length: 36 }).generatedAlwaysAs(
      sql`if(deleted_at is null, membership_id, null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('member_schedule_roles_active_member_unique').on(
      table.scheduleRoleId,
      table.activeMembershipId,
    ),
    index('member_schedule_roles_membership_active_idx').on(table.membershipId, table.deletedAt),
  ],
);

export const shiftTypes = mysqlTable(
  'shift_types',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    templateKey: varchar('template_key', { length: 32 }),
    name: varchar('name', { length: 100 }).notNull(),
    abbreviation: varchar('abbreviation', { length: 16 }).notNull(),
    displayOrder: int('display_order', { unsigned: true }).notNull(),
    startTime: time('start_time'),
    endTime: time('end_time'),
    crossesMidnight: tinyint('crosses_midnight', { unsigned: true }).default(0).notNull(),
    color: char('color', { length: 7 }).notNull(),
    textColor: char('text_color', { length: 7 }).notNull(),
    isAllDay: tinyint('is_all_day', { unsigned: true }).default(0).notNull(),
    isEnabled: tinyint('is_enabled', { unsigned: true }).default(0).notNull(),
    countsTowardStatistics: tinyint('counts_toward_statistics', { unsigned: true })
      .default(1)
      .notNull(),
    configurationVersion: int('configuration_version', { unsigned: true }).default(1).notNull(),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('shift_types_group_template_unique').on(table.groupId, table.templateKey),
    index('shift_types_group_active_order_idx').on(
      table.groupId,
      table.deletedAt,
      table.displayOrder,
    ),
  ],
);

export const rotationRules = mysqlTable(
  'rotation_rules',
  {
    id: identifier(),
    scheduleRoleId: char('schedule_role_id', { length: 36 }).notNull(),
    defaultShiftTypeId: char('default_shift_type_id', { length: 36 }).notNull(),
    requiredMembersPerDay: int('required_members_per_day', { unsigned: true }).default(1).notNull(),
    startDate: date('start_date', { mode: 'string' }),
    startingMemberScheduleRoleId: char('starting_member_schedule_role_id', { length: 36 }),
    currentPosition: int('current_position', { unsigned: true }).default(1).notNull(),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('rotation_rules_schedule_role_unique').on(table.scheduleRoleId),
    index('rotation_rules_default_shift_type_idx').on(table.defaultShiftTypeId),
  ],
);

export const rotationMembers = mysqlTable(
  'rotation_members',
  {
    id: identifier(),
    rotationRuleId: char('rotation_rule_id', { length: 36 }).notNull(),
    memberScheduleRoleId: char('member_schedule_role_id', { length: 36 }).notNull(),
    position: int('position', { unsigned: true }).notNull(),
    activeMemberScheduleRoleId: char('active_member_schedule_role_id', {
      length: 36,
    }).generatedAlwaysAs(sql`if(deleted_at is null, member_schedule_role_id, null)`, {
      mode: 'stored',
    }),
    activePosition: int('active_position', { unsigned: true }).generatedAlwaysAs(
      sql`if(deleted_at is null, position, null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('rotation_members_active_member_unique').on(
      table.rotationRuleId,
      table.activeMemberScheduleRoleId,
    ),
    uniqueIndex('rotation_members_active_position_unique').on(
      table.rotationRuleId,
      table.activePosition,
    ),
    index('rotation_members_member_schedule_role_idx').on(table.memberScheduleRoleId),
  ],
);
