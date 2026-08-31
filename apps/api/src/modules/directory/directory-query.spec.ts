import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { buildEmployeeCodeCandidates, buildSearchRank } from './directory-query.js';

describe('directory employee-code search rank', () => {
  it('checks a three-digit numeric employee alias before existing phone matches', () => {
    const employeeEntryId = '11111111-1111-4111-8111-111111111111';
    const query = new MySqlDialect().sqlToQuery(buildSearchRank('468', [employeeEntryId]));
    const employeeAliasIndex = query.sql.indexOf('`directory_entries`.`id` in');
    const phoneExactIndex = query.sql.indexOf('directory_phone_exact');

    expect(employeeAliasIndex).toBeGreaterThan(0);
    expect(phoneExactIndex).toBeGreaterThan(employeeAliasIndex);
    expect(query.params).toContain(employeeEntryId);
    expect(query.sql).not.toContain("LIKE CONCAT('%'");
    expect(buildEmployeeCodeCandidates('468')).toEqual(
      expect.arrayContaining(['468', '0468', 'd468', 'd0468']),
    );
  });

  it('does not promote one- or two-digit queries to employee-code aliases', () => {
    for (const value of ['4', '68']) {
      const query = new MySqlDialect().sqlToQuery(buildSearchRank(value));
      expect(buildEmployeeCodeCandidates(value)).toEqual([]);
      expect(query.sql).toContain('directory_phone_exact');
    }
  });
});
