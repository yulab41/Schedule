/** The per-kind WeChat notification preference requires schema 69. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 69 && last === '0069_member_wechat_notification_kinds') {
    return { databaseSchemaMin: '69', databaseSchemaMax: '69' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
