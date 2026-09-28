/** The external duty ledger requires schema 67 and its unique date key. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 67 && last === '0067_external_duty_checks') {
    return { databaseSchemaMin: '67', databaseSchemaMax: '67' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
