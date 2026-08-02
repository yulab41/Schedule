import {
  char,
  date,
  index,
  int,
  json,
  mysqlTable,
  timestamp,
  tinyint,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

export const statisticsSnapshots = mysqlTable(
  'statistics_snapshots',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    businessMonth: date('business_month', { mode: 'string' }).notNull(),
    payload: json('payload').$type<Record<string, unknown>>().notNull(),
    triggeredByEventId: char('triggered_by_event_id', { length: 36 }),
    computedAt: timestamp('computed_at', { fsp: 3 }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
    version: int('version', { unsigned: true }).default(1).notNull(),
  },
  (table) => [
    uniqueIndex('statistics_snapshots_group_month_unique').on(table.groupId, table.businessMonth),
    index('statistics_snapshots_month_idx').on(table.businessMonth),
  ],
);

export const statisticsRecalcChecks = mysqlTable(
  'statistics_recalc_checks',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    businessMonth: date('business_month', { mode: 'string' }).notNull(),
    snapshotVersion: int('snapshot_version', { unsigned: true }).notNull(),
    recomputedPayload: json('recomputed_payload').$type<Record<string, unknown>>().notNull(),
    matched: tinyint('matched', { unsigned: true }).default(0).notNull(),
    mismatchSummary: json('mismatch_summary').$type<readonly string[]>().notNull(),
    checkedAt: timestamp('checked_at', { fsp: 3 }).defaultNow().notNull(),
    checkedByUserId: char('checked_by_user_id', { length: 36 }),
  },
  (table) => [
    index('statistics_recalc_checks_group_month_idx').on(table.groupId, table.businessMonth),
  ],
);
