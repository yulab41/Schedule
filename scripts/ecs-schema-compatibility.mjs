/** The account activity requires schema 70. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 70 && last === '0070_account_activity') {
    return { databaseSchemaMin: '70', databaseSchemaMax: '70' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
