import {
  char,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  smallint,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

export const holidayCalendarVersions = mysqlTable(
  'holiday_calendar_versions',
  {
    id: identifier(),
    year: smallint('year', { unsigned: true }).notNull(),
    version: int('version', { unsigned: true }).notNull(),
    status: mysqlEnum('status', ['draft', 'confirmed']).default('draft').notNull(),
    createdByUserId: char('created_by_user_id', { length: 36 }),
    confirmedAt: timestamp('confirmed_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
  },
  (table) => [
    uniqueIndex('holiday_calendar_versions_year_version_unique').on(table.year, table.version),
    index('holiday_calendar_versions_year_status_idx').on(
      table.year,
      table.status,
      table.deletedAt,
    ),
  ],
);

export const holidayDates = mysqlTable(
  'holiday_dates',
  {
    id: identifier(),
    calendarVersionId: char('calendar_version_id', { length: 36 }).notNull(),
    calendarDate: date('calendar_date', { mode: 'string' }).notNull(),
    holidayName: varchar('holiday_name', { length: 100 }).notNull(),
    isOffDay: tinyint('is_off_day', { unsigned: true }).default(0).notNull(),
    isWorkday: tinyint('is_workday', { unsigned: true }).default(0).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('holiday_dates_version_date_unique').on(
      table.calendarVersionId,
      table.calendarDate,
    ),
    index('holiday_dates_date_idx').on(table.calendarDate),
  ],
);
