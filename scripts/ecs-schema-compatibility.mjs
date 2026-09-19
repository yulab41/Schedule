/** This build requires the group calendar change ledger and all preceding schema. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 62 && last === '0062_group_calendar_changes') {
    return { databaseSchemaMin: '62', databaseSchemaMax: '62' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
