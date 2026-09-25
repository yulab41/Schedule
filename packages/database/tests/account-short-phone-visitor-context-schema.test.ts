import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { users, visitorAccessLogs } from '../src/index.js';

const migrationUrl = new URL(
  '../../../migrations/0063_account_short_phone_visitor_context.sql',
  import.meta.url,
);
const journalUrl = new URL('../../../migrations/meta/_journal.json', import.meta.url);

describe('account short phone and visitor context schema', () => {
  it('migrates the most recently updated short phone with a stable id tie-breaker', async () => {
    const migration = await readFile(fileURLToPath(migrationUrl), 'utf8');

    expect(migration).toContain('ADD COLUMN `short_phone` varchar(32) NULL');
    expect(migration).toContain(
      'ROW_NUMBER() OVER (PARTITION BY m.user_id ORDER BY c.updated_at DESC, c.id ASC)',
    );
    expect(migration).toContain('SET c.version = c.version +');
    expect(migration).toContain(
      'c.is_confirmed = IF(c.short_phone <=> u.short_phone, c.is_confirmed, 0)',
    );
    expect(migration).toContain('DROP COLUMN `short_phone`');
    expect(migration).toContain('DROP TABLE `invite_tokens`');
    expect(migration).toContain('DROP TABLE `group_code_attempts`');
  });

  it('adds bounded visitor identity and versioned client context columns', async () => {
    const [migration, journal] = await Promise.all([
      readFile(fileURLToPath(migrationUrl), 'utf8'),
      readFile(fileURLToPath(journalUrl), 'utf8'),
    ]);

    expect(journal).toContain('0063_account_short_phone_visitor_context');
    expect(migration).toContain('ADD COLUMN `wechat_openid` varchar(64) NULL');
    expect(migration).toContain('ADD COLUMN `client_context` json NULL');
    expect(migration).toContain('ADD COLUMN `client_context_version` tinyint unsigned NULL');
  });

  it('models the new account and visitor fields in Drizzle', () => {
    expect(getTableConfig(users).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['short_phone', 'short_phone_updated_at']),
    );
    expect(getTableConfig(visitorAccessLogs).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['wechat_openid', 'client_context', 'client_context_version']),
    );
  });
});
