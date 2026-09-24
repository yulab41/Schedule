import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { shiftAssignments } from '../src/index.js';

describe('active shift slot uniqueness', () => {
  it('migrates the unique key to ignore soft-deleted assignments', async () => {
    const [migration, journal] = await Promise.all([
      readFile(
        fileURLToPath(new URL('../../../migrations/0064_active_shift_slot.sql', import.meta.url)),
        'utf8',
      ),
      readFile(
        fileURLToPath(new URL('../../../migrations/meta/_journal.json', import.meta.url)),
        'utf8',
      ),
    ]);
    expect(journal).toContain('0064_active_shift_slot');
    expect(migration).toContain('if(`deleted_at` is null, `slot_position`, null)');
    expect(migration).toContain('(`schedule_period_id`, `starts_at`, `active_slot_position`)');
    expect(getTableConfig(shiftAssignments).columns.map((column) => column.name)).toContain(
      'active_slot_position',
    );
  });
});
