import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../../../migrations/0045_wechat_link_tokens.sql', import.meta.url);
const journal = readFileSync(
  new URL('../../../migrations/meta/_journal.json', import.meta.url),
  'utf8',
);
const schema = readFileSync(new URL('../src/schema/wechat.ts', import.meta.url), 'utf8');

describe('P3 WeChat link token schema', () => {
  it('stores only a unique token hash with bounded single-use state', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    expect(journal).toContain('0045_wechat_link_tokens');
    expect(migration).toContain('CREATE TABLE `wechat_link_tokens`');
    expect(migration).toContain('`token_hash` CHAR(64) NOT NULL');
    expect(migration).toContain("`status` ENUM('pending', 'consumed') NOT NULL DEFAULT 'pending'");
    expect(migration).toContain('`expires_at` TIMESTAMP(3) NOT NULL');
    expect(migration).toContain('`consumed_at` TIMESTAMP(3) NULL');
    expect(migration).toContain('UNIQUE KEY `wechat_link_tokens_token_hash_unique`');
    expect(migration).not.toMatch(/`token`\s/u);
  });

  it('keeps identity lookup fields separate from the returned token', () => {
    expect(schema).toContain('export const wechatLinkTokens = mysqlTable(');
    expect(schema).toContain("tokenHash: char('token_hash', { length: 64 }).notNull()");
    expect(schema).toContain("appId: varchar('app_id', { length: 64 }).notNull()");
    expect(schema).toContain("subject: varchar('subject', { length: 128 }).notNull()");
    expect(schema).toContain("existingUserId: char('existing_user_id', { length: 36 })");
  });
});
