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
});
