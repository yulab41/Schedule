/** This build requires member binding QR context columns and the DOCX export file format. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 60 && last === '0060_head_neck_docx_export') {
    return { databaseSchemaMin: '60', databaseSchemaMax: '60' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
