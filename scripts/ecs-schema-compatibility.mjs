/** The published-baseline duty ledger requires schema 68. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 68 && last === '0068_external_duty_published_baseline') {
    return { databaseSchemaMin: '68', databaseSchemaMax: '68' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
