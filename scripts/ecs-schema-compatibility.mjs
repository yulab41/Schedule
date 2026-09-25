/** This build requires the active-only shift slot key after the account-contact migration. */
export function releaseSchemaCompatibility(journal) {
  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.some((entry, index) => entry.idx !== index)) {
    throw new Error('Invalid migration journal; refusing release compatibility declaration.');
  }
  const last = entries.at(-1)?.tag;
  if (entries.length === 64 && last === '0064_active_shift_slot') {
    return { databaseSchemaMin: '64', databaseSchemaMax: '64' };
  }
  throw new Error('Unreviewed migration journal; revalidate release compatibility.');
}
