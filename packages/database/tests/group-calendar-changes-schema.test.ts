import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { scheduleEvents, schedulePeriods, shiftAssignments } from '../src/schema/index.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));

function columnNames(): readonly string[] {
  return getTableConfig(scheduleEvents).columns.map((column) => column.name);
}

describe('group calendar change ledger schema', () => {
  it('keeps one monotonic cursor per group and cascades on group deletion', () => {
    const migration = readFileSync(`${root}/migrations/0062_group_calendar_changes.sql`, 'utf8');
    expect(migration).toContain(
      'ADD COLUMN `calendar_revision` bigint unsigned NOT NULL DEFAULT 0',
    );
    expect(migration).toContain('CREATE TABLE `group_calendar_changes`');
    expect(migration).toContain(
      'UNIQUE KEY `group_calendar_changes_group_seq_unique` (`group_id`, `seq`)',
    );
    expect(migration).toContain('KEY `group_calendar_changes_group_changed_at_idx`');
    expect(migration).toContain(
      'FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE',
    );
    expect(migration).toContain("`kind` enum('schedule', 'event', 'config', 'member') NOT NULL");
  });

  it('ships a rollback that removes both the ledger and the cursor column', () => {
    const rollback = readFileSync(
      `${root}/migrations/rollback/0062_group_calendar_changes.sql`,
      'utf8',
    );
    expect(rollback).toContain('DROP TABLE IF EXISTS `group_calendar_changes`');
    expect(rollback).toContain('DROP COLUMN `calendar_revision`');
  });

  /**
   * The calendar divergence probe compares the newest write per table. The
   * first production attempt assumed every table had `updated_at`; events do
   * not, and the probe threw. Pin the shapes the probe relies on.
   */
  it('keeps the auditable columns the divergence probe reads', () => {
    for (const table of [schedulePeriods, shiftAssignments]) {
      const names = getTableConfig(table).columns.map((column) => column.name);
      expect(names).toContain('updated_at');
      expect(names).toContain('deleted_at');
    }
    expect(columnNames()).toContain('occurred_at');
    expect(columnNames()).not.toContain('updated_at');
    expect(columnNames()).not.toContain('deleted_at');
  });
});
