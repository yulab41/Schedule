/** This build requires the destructive account-contact, visitor-context and invite retirement schema. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 63 && last === '0063_account_short_phone_visitor_context') {
    return { databaseSchemaMin: '63', databaseSchemaMax: '63' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
