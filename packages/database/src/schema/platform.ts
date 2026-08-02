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

export const platformJobRuns = mysqlTable(
  'platform_job_runs',
  {
    id: char('id', { length: 36 }).primaryKey(),
    jobName: varchar('job_name', { length: 64 }).notNull(),
    status: mysqlEnum('status', ['running', 'completed', 'failed']).default('running').notNull(),
    summary: varchar('summary', { length: 500 }),
    startedAt: timestamp('started_at', { fsp: 3 }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { fsp: 3 }),
  },
  (table) => [index('platform_job_runs_name_started_idx').on(table.jobName, table.startedAt)],
);

export const backupArchives = mysqlTable(
  'backup_archives',
  {
    id: char('id', { length: 36 }).primaryKey(),
    backupKind: mysqlEnum('backup_kind', ['daily', 'monthly']).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    fileSize: int('file_size', { unsigned: true }).notNull(),
    sha256: char('sha256', { length: 64 }).notNull(),
    tableCount: int('table_count', { unsigned: true }).notNull(),
    rowCount: int('row_count', { unsigned: true }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
  },
  (table) => [
    uniqueIndex('backup_archives_storage_key_unique').on(table.storageKey),
    index('backup_archives_kind_created_idx').on(table.backupKind, table.createdAt),
  ],
);
