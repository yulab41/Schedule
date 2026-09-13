/** This build additionally requires member WeChat binding QR context columns. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 59 && last === '0059_member_wechat_binding_qr') {
    return { databaseSchemaMin: '59', databaseSchemaMax: '59' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
