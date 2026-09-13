/** This build additionally requires export format and multi-selection columns. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 58 && last === '0058_export_formats_and_multi_select') {
    return { databaseSchemaMin: '58', databaseSchemaMax: '58' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
