import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
describe('retired group code persistence', () => {
  it('removes the historical column and unique index in the current migration', () => {
    const schema = readFileSync(
      fileURLToPath(new URL('../src/schema/index.ts', import.meta.url)),
      'utf8',
    );
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          '../../../migrations/0063_account_short_phone_visitor_context.sql',
          import.meta.url,
        ),
      ),
      'utf8',
    );
    expect(schema).not.toContain("char('group_code'");
    expect(schema).not.toContain('groups_group_code_unique');
    expect(migration).toContain('DROP INDEX `groups_group_code_unique`');
    expect(migration).toContain('DROP COLUMN `group_code`');
  });
});
