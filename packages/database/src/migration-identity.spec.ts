import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { directoryCandidateMigrationIdentity } from './migration-identity.js';

describe('directory candidate migration identity', () => {
  it('matches the exact journal entry and SQL hash for migration 0053', async () => {
    const migrationsDirectory = fileURLToPath(new URL('../../../migrations/', import.meta.url));
    const journal = JSON.parse(
      await readFile(`${migrationsDirectory}meta/_journal.json`, 'utf8'),
    ) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find(
      (candidate) => candidate.tag === directoryCandidateMigrationIdentity.tag,
    );
    const sql = await readFile(
      `${migrationsDirectory}${directoryCandidateMigrationIdentity.tag}.sql`,
      'utf8',
    );

    expect(entry).toEqual({
      breakpoints: true,
      idx: 52,
      tag: directoryCandidateMigrationIdentity.tag,
      version: '7',
      when: directoryCandidateMigrationIdentity.createdAt,
    });
    expect(createHash('sha256').update(sql).digest('hex')).toBe(
      directoryCandidateMigrationIdentity.hash,
    );
  });
});
