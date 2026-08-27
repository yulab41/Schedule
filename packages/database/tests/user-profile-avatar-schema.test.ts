import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { userProfileAvatars } from '../src/index.js';

describe('user profile avatar schema', () => {
  it('stores one bounded versioned binary avatar per user', () => {
    const table = getTableConfig(userProfileAvatars);
    expect(table.columns.map((column) => column.name).sort()).toEqual([
      'byte_length',
      'content',
      'content_type',
      'created_at',
      'sha256',
      'updated_at',
      'user_id',
      'version',
    ]);
    expect(table.primaryKeys).toHaveLength(0);
    expect(table.foreignKeys).toHaveLength(1);
    expect(table.columns.find((column) => column.name === 'content')?.getSQLType()).toBe(
      'mediumblob',
    );
  });

  it('ships migration 0052 with size, MIME and cascading ownership constraints', () => {
    const migrationPath = fileURLToPath(
      new URL('../../../migrations/0052_user_profile_avatars.sql', import.meta.url),
    );
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE `user_profile_avatars`');
    expect(migration).toContain('`content` MEDIUMBLOB NOT NULL');
    expect(migration).toContain('CHECK (`byte_length` BETWEEN 1 AND 1048576)');
    expect(migration).toContain(
      "CHECK (`content_type` IN ('image/jpeg', 'image/png', 'image/webp'))",
    );
    expect(migration).toContain(
      'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE',
    );
  });
});
