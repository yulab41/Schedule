import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../migrations/0046_wechat_identity_detachments.sql',
  import.meta.url,
);
const journal = readFileSync(
  new URL('../../../migrations/meta/_journal.json', import.meta.url),
  'utf8',
);
const schema = readFileSync(new URL('../src/schema/wechat.ts', import.meta.url), 'utf8');

describe('P3 WeChat identity detachment schema', () => {
  it('stores only a scoped subject hash and the preserved business user', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    expect(journal).toContain('0046_wechat_identity_detachments');
    expect(migration).toContain('CREATE TABLE `wechat_identity_detachments`');
    expect(migration).toContain('`subject_hash` CHAR(64) NOT NULL');
    expect(migration).toContain('`app_id` VARCHAR(64) NOT NULL');
    expect(migration).toContain('`user_id` CHAR(36) NOT NULL');
    expect(migration).toContain('UNIQUE KEY `wechat_identity_detachments_scope_unique`');
    expect(migration).not.toMatch(/`subject`\s/u);
    expect(migration).not.toContain('ON DELETE SET NULL');
  });

  it('keeps the Drizzle schema aligned without adding delete fields to users', () => {
    expect(schema).toContain('export const wechatIdentityDetachments = mysqlTable(');
    expect(schema).toContain("subjectHash: char('subject_hash', { length: 64 }).notNull()");
    expect(schema).toContain("appId: varchar('app_id', { length: 64 }).notNull()");
    expect(schema).toContain("uniqueIndex('wechat_identity_detachments_user_scope_unique')");
  });
});
