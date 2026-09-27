/** History reads require persisted visibility and its indexes. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 65 && last === '0065_history_visibility') {
    return { databaseSchemaMin: '65', databaseSchemaMax: '65' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
