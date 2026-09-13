/** This build requires persistent visitor QR assets and all preceding schema. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 61 && last === '0061_group_visitor_qr_assets') {
    return { databaseSchemaMin: '61', databaseSchemaMax: '61' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
