import { describe, expect, it } from 'vitest';

import { releaseSchemaCompatibility } from './ecs-schema-compatibility.mjs';

describe('group-code retirement release compatibility', () => {
  const journal = (count, tag) => ({
    entries: Array.from({ length: count }, (_, idx) => ({
      idx,
      tag: idx === count - 1 ? tag : `prior-${idx}`,
    })),
  });

  it('keeps the sanitized transition release readable before and after expansion', () => {
    expect(
      releaseSchemaCompatibility(journal(53, '0053_directory_candidate_covering_index')),
    ).toEqual({ databaseSchemaMin: '53', databaseSchemaMax: '54' });
  });

  it('requires expanded schema for the final release', () => {
    expect(releaseSchemaCompatibility(journal(54, '0054_retire_group_code'))).toEqual({
      databaseSchemaMin: '54',
      databaseSchemaMax: '54',
    });
  });

  it('fails closed on stale, unknown or malformed migration journals', () => {
    for (const value of [
      journal(52, '0052_old'),
      journal(55, '0055_unknown'),
      journal(54, '0054_other'),
      { entries: [] },
      {},
    ]) {
      expect(() => releaseSchemaCompatibility(value)).toThrow();
    }
  });
});
