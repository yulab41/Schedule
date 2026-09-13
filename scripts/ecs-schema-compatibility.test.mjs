import { describe, expect, it } from 'vitest';

import { releaseSchemaCompatibility } from './ecs-schema-compatibility.mjs';

describe('export format release compatibility', () => {
  const journal = (count, tag) => ({
    entries: Array.from({ length: count }, (_, idx) => ({
      idx,
      tag: idx === count - 1 ? tag : `prior-${idx}`,
    })),
  });

  it('requires export format and multi-selection columns', () => {
    expect(releaseSchemaCompatibility(journal(58, '0058_export_formats_and_multi_select'))).toEqual(
      {
        databaseSchemaMin: '58',
        databaseSchemaMax: '58',
      },
    );
  });

  it('fails closed on stale, unknown or malformed migration journals', () => {
    for (const value of [
      journal(52, '0052_old'),
      journal(53, '0053_directory_candidate_covering_index'),
      journal(54, '0054_retire_group_code'),
      journal(55, '0055_account_mobile_phone'),
      journal(56, '0056_retire_automatic_rotation'),
      journal(57, '0057_unknown'),
      journal(57, '0057_group_visitor_links'),
      journal(58, '0058_unknown'),
      journal(55, '0055_unknown'),
      journal(54, '0054_other'),
      { entries: [] },
      {},
    ]) {
      expect(() => releaseSchemaCompatibility(value)).toThrow();
    }
  });
});
