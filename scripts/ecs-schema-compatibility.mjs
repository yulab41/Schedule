/** History reads require persisted visibility and its indexes. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 66 && last === '0066_notification_visibility') {
    return { databaseSchemaMin: '66', databaseSchemaMax: '66' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
