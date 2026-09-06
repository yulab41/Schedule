import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { groups } from '../src/index.js';
describe('retired group code persistence', () => {
  it('preserves a nullable historical field without a default generator', () => {
    expect(groups.groupCode.notNull).toBe(false);
    expect(groups.groupCode.hasDefault).toBe(false);
    expect(groups.groupCode.getSQLType()).toBe('char(4)');
    const migration = readFileSync(
      fileURLToPath(new URL('../../../migrations/0054_retire_group_code.sql', import.meta.url)),
      'utf8',
    );
    expect(migration.trim()).toBe(
      'ALTER TABLE `groups` MODIFY COLUMN `group_code` char(4) NULL DEFAULT NULL;',
    );
  });
});
