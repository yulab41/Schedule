/** This build additionally requires the group visitor association table. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 57 && last === '0057_group_visitor_links') {
    return { databaseSchemaMin: '57', databaseSchemaMax: '57' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
