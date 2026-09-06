/** Compatibility of this retirement build, including its pre-expansion transition. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 53 && last === '0053_directory_candidate_covering_index') {
    return { databaseSchemaMin: '53', databaseSchemaMax: '54' };
  }
  if (entries.length === 54 && last === '0054_retire_group_code') {
    return { databaseSchemaMin: '54', databaseSchemaMax: '54' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
