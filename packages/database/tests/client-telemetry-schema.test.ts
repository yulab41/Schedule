import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { miniprogramTelemetryEvents } from '../src/index.js';

describe('Mini Program telemetry schema', () => {
  it('contains only the frozen anonymous columns and retention indexes', () => {
    const table = getTableConfig(miniprogramTelemetryEvents);
    expect(table.columns.map((column) => column.name).sort()).toEqual([
      'client_version',
      'created_at',
      'device_tier',
      'error_code',
      'id',
      'network_type',
      'page',
      'performance_duration_ms',
      'performance_metric',
      'stack_fingerprint',
    ]);
    expect(table.foreignKeys).toEqual([]);
    expect(table.indexes.map((index) => index.config.name).sort()).toEqual([
      'miniprogram_telemetry_created_idx',
      'miniprogram_telemetry_error_fingerprint_idx',
      'miniprogram_telemetry_version_page_idx',
    ]);
  });

  it('ships migration 0051 with the same anonymous table constraints', () => {
    const migrationPath = fileURLToPath(
      new URL('../../../migrations/0051_miniprogram_telemetry.sql', import.meta.url),
    );
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE `miniprogram_telemetry_events`');
    for (const column of [
      'id',
      'client_version',
      'page',
      'device_tier',
      'error_code',
      'network_type',
      'performance_metric',
      'performance_duration_ms',
      'stack_fingerprint',
      'created_at',
    ]) {
      expect(migration).toContain(`\`${column}\``);
    }
    for (const index of [
      'miniprogram_telemetry_created_idx',
      'miniprogram_telemetry_version_page_idx',
      'miniprogram_telemetry_error_fingerprint_idx',
    ]) {
      expect(migration).toContain(`\`${index}\``);
    }
    for (const constraint of [
      'miniprogram_telemetry_error_or_performance_check',
      'miniprogram_telemetry_performance_pair_check',
      'miniprogram_telemetry_stack_requires_error_check',
    ]) {
      expect(migration).toContain(`\`${constraint}\``);
    }
    expect(migration).toContain(
      'CHECK (`error_code` IS NOT NULL OR `performance_metric` IS NOT NULL)',
    );
    expect(migration).toContain(
      'CHECK ((`performance_metric` IS NULL) = (`performance_duration_ms` IS NULL))',
    );
    expect(migration).toContain('CHECK (`stack_fingerprint` IS NULL OR `error_code` IS NOT NULL)');
    expect(migration).not.toMatch(/FOREIGN KEY|user_id|group_id|mobile|token|metadata|JSON/iu);
  });
});
