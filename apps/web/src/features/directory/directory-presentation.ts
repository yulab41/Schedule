import type {
  DirectoryContactMethod,
  DirectoryContactType,
  DirectoryEntry,
  DirectoryQuery,
} from '@schedule/contracts';

export type DirectoryFilterKey =
  'building' | 'campusCode' | 'department' | 'entryKind' | 'floor' | 'section' | 'subunit';

export type DirectoryFilters = Partial<Pick<DirectoryQuery, DirectoryFilterKey>>;
export type DirectoryNumberField = 'extension' | 'full';

const dialableFullNumberTypes = new Set<DirectoryContactType>([
  'emergency',
  'hotline',
  'mobile',
  'voice',
]);

const contactTypeLabels: Readonly<Record<DirectoryContactType, string>> = {
  emergency: '急救电话',
  fax: '传真',
  hotline: '服务热线',
  mobile: '手机',
  other: '联系电话',
  voice: '固定电话',
};

export function canDialDirectoryNumber(
  type: DirectoryContactType,
  field: DirectoryNumberField,
): boolean {
  if (field === 'extension') return type === 'mobile';
  return dialableFullNumberTypes.has(type);
}

export function getSafeInternalExtension(contact: DirectoryContactMethod): string | undefined {
  const extension = contact.internalExtension;
  return extension !== undefined && /^\d{3,6}$/u.test(extension) ? extension : undefined;
}

export function toDirectoryDialHref(number: string): string {
  const normalized = number.trim();
  const internationalPrefix = normalized.startsWith('+') ? '+' : '';
  return `tel:${internationalPrefix}${normalized.replaceAll(/\D/gu, '')}`;
}

export function getDirectoryNumberLabel(
  type: DirectoryContactType,
  field: DirectoryNumberField,
): string {
  if (field === 'extension') {
    return type === 'mobile' ? '手机短号' : '院内短号';
  }
  if (type === 'mobile') return '手机长号';
  return contactTypeLabels[type];
}

export function getDirectoryEntryTitle(entry: DirectoryEntry): string {
  return (
    entry.contactName ?? entry.subunit ?? entry.department ?? entry.section ?? entry.campus.name
  );
}

export function getDirectoryEntryPath(entry: DirectoryEntry): readonly string[] {
  const title = getDirectoryEntryTitle(entry);
  return [...new Set([entry.campus.name, entry.section, entry.department, entry.subunit])].filter(
    (value): value is string => value !== undefined && value !== title,
  );
}

export function getDirectoryEntryLocation(entry: DirectoryEntry): string | undefined {
  const location = [entry.building, entry.floor, entry.room].filter(
    (value): value is string => value !== undefined,
  );
  return location.length > 0 ? location.join(' · ') : undefined;
}

export function toDirectoryQuery(
  search: string,
  filters: DirectoryFilters,
  cursor?: string,
): DirectoryQuery {
  const query: DirectoryQuery = { pageSize: 30 };
  const normalizedSearch = search.trim();
  if (normalizedSearch.length > 0) query.q = normalizedSearch;

  for (const [key, value] of Object.entries(filters) as [
    DirectoryFilterKey,
    DirectoryFilters[DirectoryFilterKey],
  ][]) {
    if (value !== undefined && value.length > 0) {
      Object.assign(query, { [key]: value });
    }
  }

  if (cursor !== undefined) query.cursor = cursor;
  return query;
}
