/** This build requires account phone columns and removal of automatic rotation. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 56 && last === '0056_retire_automatic_rotation') {
    return { databaseSchemaMin: '56', databaseSchemaMax: '56' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
