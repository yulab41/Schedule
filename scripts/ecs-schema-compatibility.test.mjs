import { describe, expect, it } from 'vitest';

import { releaseSchemaCompatibility } from './ecs-schema-compatibility.mjs';

describe('automatic rotation retirement release compatibility', () => {
  const journal = (count, tag) => ({
    entries: Array.from({ length: count }, (_, idx) => ({
      idx,
      tag: idx === count - 1 ? tag : `prior-${idx}`,
    })),
  });

  it('requires account phone columns and retired rotation tables', () => {
    expect(releaseSchemaCompatibility(journal(56, '0056_retire_automatic_rotation'))).toEqual({
      databaseSchemaMin: '56',
      databaseSchemaMax: '56',
    });
  });

  it('fails closed on stale, unknown or malformed migration journals', () => {
    for (const value of [
      journal(52, '0052_old'),
      journal(53, '0053_directory_candidate_covering_index'),
      journal(54, '0054_retire_group_code'),
      journal(55, '0055_account_mobile_phone'),
      journal(57, '0057_unknown'),
      journal(55, '0055_unknown'),
      journal(54, '0054_other'),
      { entries: [] },
      {},
    ]) {
      expect(() => releaseSchemaCompatibility(value)).toThrow();
    }
  });
});
