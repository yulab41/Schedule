import {
  char,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

export const exportJobs = mysqlTable(
  'export_jobs',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    requestedByUserId: char('requested_by_user_id', { length: 36 }).notNull(),
    exportType: mysqlEnum('export_type', ['schedule', 'statistics']).notNull(),
    periodType: mysqlEnum('period_type', ['month', 'year']).notNull(),
    period: varchar('period', { length: 7 }).notNull(),
    scheduleRoleId: char('schedule_role_id', { length: 36 }),
    membershipId: char('membership_id', { length: 36 }),
    status: mysqlEnum('status', ['pending', 'running', 'completed', 'failed'])
      .default('pending')
      .notNull(),
    fileContent: longtext('file_content'),
    rowCount: int('row_count', { unsigned: true }),
    error: varchar('error', { length: 500 }),
    expiresAt: timestamp('expires_at', { fsp: 3 }),
    downloadedAt: timestamp('downloaded_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { fsp: 3 }),
    completedAt: timestamp('completed_at', { fsp: 3 }),
  },
  (table) => [
    index('export_jobs_group_created_idx').on(table.groupId, table.createdAt),
    index('export_jobs_status_created_idx').on(table.status, table.createdAt),
  ],
);
