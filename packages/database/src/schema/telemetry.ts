import { sql } from 'drizzle-orm';
import {
  char,
  check,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const miniprogramTelemetryEvents = mysqlTable(
  'miniprogram_telemetry_events',
  {
    id: char('id', { length: 36 }).primaryKey(),
    clientVersion: varchar('client_version', { length: 64 }).notNull(),
    page: mysqlEnum('page', [
      'app',
      'identity',
      'workbench',
      'manual-matrix',
      'manual-schedule',
      'backfill',
      'group-settings',
      'unknown',
    ]).notNull(),
    deviceTier: mysqlEnum('device_tier', ['low', 'medium', 'high', 'unknown']).notNull(),
    errorCode: mysqlEnum('error_code', [
      'AUTHENTICATION_REQUIRED',
      'CLIENT_CAPABILITY_DISABLED',
      'CLIENT_VERSION_UNSUPPORTED',
      'INVALID_RESPONSE',
      'MINI_RUNTIME_ERROR',
      'NETWORK_ERROR',
      'TIMEOUT',
      'UNKNOWN',
    ]),
    networkType: mysqlEnum('network_type', [
      'none',
      'wifi',
      '2g',
      '3g',
      '4g',
      '5g',
      'unknown',
    ]).notNull(),
    performanceMetric: mysqlEnum('performance_metric', [
      'core-ready',
      'foreground-ready',
      'maximum-matrix-render',
      'tap-feedback',
    ]),
    performanceDurationMs: int('performance_duration_ms', { unsigned: true }),
    stackFingerprint: char('stack_fingerprint', { length: 64 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index('miniprogram_telemetry_created_idx').on(table.createdAt, table.id),
    index('miniprogram_telemetry_version_page_idx').on(
      table.clientVersion,
      table.page,
      table.createdAt,
    ),
    index('miniprogram_telemetry_error_fingerprint_idx').on(
      table.errorCode,
      table.stackFingerprint,
      table.createdAt,
    ),
    check(
      'miniprogram_telemetry_error_or_performance_check',
      sql`${table.errorCode} IS NOT NULL OR ${table.performanceMetric} IS NOT NULL`,
    ),
    check(
      'miniprogram_telemetry_performance_pair_check',
      sql`(${table.performanceMetric} IS NULL) = (${table.performanceDurationMs} IS NULL)`,
    ),
    check(
      'miniprogram_telemetry_stack_requires_error_check',
      sql`${table.stackFingerprint} IS NULL OR ${table.errorCode} IS NOT NULL`,
    ),
  ],
);
