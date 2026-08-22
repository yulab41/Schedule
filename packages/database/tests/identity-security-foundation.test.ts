import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { userAuthIdentities, userPasswordCredentials, users } from '../src/index.js';

const migrationUrl = new URL(
  '../../../migrations/0044_identity_security_foundation.sql',
  import.meta.url,
);
const journal = readFileSync(
  new URL('../../../migrations/meta/_journal.json', import.meta.url),
  'utf8',
);
const schemaIndex = readFileSync(new URL('../src/schema/index.ts', import.meta.url), 'utf8');
const wechatSchema = readFileSync(new URL('../src/schema/wechat.ts', import.meta.url), 'utf8');

describe('P3 identity security foundation', () => {
  it('registers an additive migration with fail-closed preflight guards', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    expect(journal).toContain('0044_identity_security_foundation');
    expect(migration).toContain('`auth_version` INT UNSIGNED NOT NULL DEFAULT 1');
    expect(migration).toContain('`app_id` VARCHAR(64) NULL');
    expect(migration).toContain('CREATE TABLE `wechat_union_accounts`');
    expect(migration).toContain('`password_hash` VARCHAR(255) NULL');
    expect(migration).toContain('CREATE TEMPORARY TABLE `_identity_foundation_validation`');
    expect(migration).toContain(
      'CONSTRAINT `identity_foundation_preflight_check` CHECK (`ok` = 1)',
    );
    expect(migration).not.toContain('DROP COLUMN `union_id`');
    expect(migration).not.toContain('DROP INDEX `user_auth_identities_union_id_unique`');
  });

  it('limits the legacy locator backfill to active users with an existing password credential', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    expect(migration).toContain('INNER JOIN `user_password_credentials`');
    expect(migration).toContain("SET `users`.`cloudbase_uid` = CONCAT('password_', `users`.`id`)");
    expect(migration).toContain('`users`.`cloudbase_uid` IS NULL');
    expect(migration).toContain("`users`.`status` = 'active'");
    expect(migration).toContain('`users`.`deleted_at` IS NULL');
    expect(migration).not.toContain('UPDATE `user_password_credentials`');
  });

  it('defines one UnionID per business user without tightening the transitional identity yet', () => {
    expect(wechatSchema).toContain('export const wechatUnionAccounts = mysqlTable(');
    expect(wechatSchema).toContain("'wechat_union_accounts'");
    expect(wechatSchema).toContain("uniqueIndex('wechat_union_accounts_union_id_unique')");
    expect(wechatSchema).toContain("uniqueIndex('wechat_union_accounts_user_id_unique')");
    expect(wechatSchema).toContain("appId: varchar('app_id', { length: 64 })");
    expect(wechatSchema).toContain("index('user_auth_identities_provider_app_subject_idx')");
    expect(wechatSchema).toContain("unionId: varchar('union_id', { length: 128 })");
  });

  it('keeps Drizzle nullability and version defaults aligned with the migration', () => {
    expect(users).toHaveProperty('authVersion');
    expect(userAuthIdentities).toHaveProperty('appId');
    expect(userPasswordCredentials.passwordHash.notNull).toBe(false);
    expect(schemaIndex).toContain(
      "authVersion: int('auth_version', { unsigned: true }).default(1).notNull()",
    );
  });
});
