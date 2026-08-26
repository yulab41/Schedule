export type DirectoryFilterKey =
  'building' | 'campusCode' | 'department' | 'entryKind' | 'floor' | 'section' | 'subunit';

export interface DirectoryFilters {
  building?: string | undefined;
  campusCode?: string | undefined;
  department?: string | undefined;
  entryKind?: DirectoryEntryKind | undefined;
  floor?: string | undefined;
  section?: string | undefined;
  subunit?: string | undefined;
}
export type DirectoryNumberField = 'extension' | 'full';
export type DirectoryContactType = 'emergency' | 'fax' | 'hotline' | 'mobile' | 'other' | 'voice';
export type DirectoryEntryKind =
  | 'department'
  | 'emergency'
  | 'facility'
  | 'other'
  | 'person'
  | 'service'
  | 'switchboard'
  | 'vendor';

export interface DirectoryContactMethodLike {
  readonly displayOrder: number;
  readonly fullNumber?: string | undefined;
  readonly id: string;
  readonly internalExtension?: string | undefined;
  readonly isPrimary: boolean;
  readonly label?: string | undefined;
  readonly type: DirectoryContactType;
}

export interface DirectoryEntryLike {
  readonly building?: string | undefined;
  readonly campus: {
    readonly code: string;
    readonly dialingNote?: string | undefined;
    readonly name: string;
  };
  readonly contactName?: string | undefined;
  readonly contacts: readonly DirectoryContactMethodLike[];
  readonly department?: string | undefined;
  readonly displayOrder: number;
  readonly employeeCode?: string | undefined;
  readonly entryKind: DirectoryEntryKind;
  readonly floor?: string | undefined;
  readonly id: string;
  readonly jobTitle?: string | undefined;
  readonly notes?: string | undefined;
  readonly room?: string | undefined;
  readonly section?: string | undefined;
  readonly subunit?: string | undefined;
}

export interface DirectoryFacetOptionLike {
  readonly count: number;
  readonly label: string;
  readonly value: string;
}

export interface DirectoryFacetPathLike extends DirectoryFilters {
  readonly campusCode: string;
  readonly count: number;
  readonly entryKind: DirectoryEntryKind;
}

export interface DirectoryFacetSnapshotLike {
  readonly buildings: readonly DirectoryFacetOptionLike[];
  readonly campuses: readonly DirectoryFacetOptionLike[];
  readonly departments: readonly DirectoryFacetOptionLike[];
  readonly entryKinds: readonly DirectoryFacetOptionLike[];
  readonly floors: readonly DirectoryFacetOptionLike[];
  readonly paths: readonly DirectoryFacetPathLike[];
  readonly publishedEffectiveOn: string;
  readonly publishedImportVersion: string;
  readonly sections: readonly DirectoryFacetOptionLike[];
  readonly subunits: readonly DirectoryFacetOptionLike[];
  readonly totalCount: number;
}

export interface DirectoryQueryLike extends DirectoryFilters {
  readonly cursor?: string | undefined;
  readonly pageSize?: number | undefined;
  readonly q?: string | undefined;
}

export interface DirectoryEntryDisplayGroup {
  readonly contacts: readonly DirectoryContactMethodLike[];
  readonly entries: readonly DirectoryEntryLike[];
  readonly id: string;
}

export interface DirectoryUsage {
  readonly count: number;
  readonly lastUsedAt: number;
}

export interface DirectoryPreferences {
  readonly favoriteEntryIds: readonly string[];
  readonly usageByEntryId: Readonly<Record<string, DirectoryUsage>>;
  readonly version: 1;
}

export interface DirectoryPriorityGroups {
  readonly favorites: readonly DirectoryEntryDisplayGroup[];
  readonly frequent: readonly DirectoryEntryDisplayGroup[];
}

export const directoryFilterHierarchy: readonly DirectoryFilterKey[] = [
  'campusCode',
  'section',
  'building',
  'floor',
  'department',
  'subunit',
  'entryKind',
];

export interface DirectoryFilterSelectionResult {
  readonly clearedKeys: readonly DirectoryFilterKey[];
  readonly filters: DirectoryFilters;
}

export type DirectoryFacetOptionsByKey = ReadonlyMap<
  DirectoryFilterKey,
  readonly DirectoryFacetOptionLike[]
>;

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
const entryKindLabels: Readonly<Record<DirectoryEntryKind, string>> = {
  department: '科室',
  emergency: '急救',
  facility: '设施',
  other: '其他',
  person: '人员',
  service: '服务点',
  switchboard: '总机',
  vendor: '外部服务',
};
const emptyDirectoryPreferences: DirectoryPreferences = {
  favoriteEntryIds: [],
  usageByEntryId: {},
  version: 1,
};
const directoryUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function canDialDirectoryNumber(
  type: DirectoryContactType,
  field: DirectoryNumberField,
): boolean {
  if (field === 'extension') return type === 'mobile';
  return dialableFullNumberTypes.has(type);
}

export function getSafeInternalExtension(contact: DirectoryContactMethodLike): string | undefined {
  const extension = contact.internalExtension;
  return extension !== undefined && /^\d{3,6}$/u.test(extension) ? extension : undefined;
}

export function normalizeDirectoryDialNumber(number: string): string {
  const normalized = number.trim();
  const internationalPrefix = normalized.startsWith('+') ? '+' : '';
  return `${internationalPrefix}${normalized.replaceAll(/\D/gu, '')}`;
}

export function toDirectoryDialHref(number: string): string {
  return `tel:${normalizeDirectoryDialNumber(number)}`;
}

export function getDirectoryNumberLabel(
  type: DirectoryContactType,
  field: DirectoryNumberField,
): string {
  if (field === 'extension') return type === 'mobile' ? '手机短号' : '院内短号';
  if (type === 'mobile') return '手机长号';
  return contactTypeLabels[type];
}

export function getDirectoryEntryTitle(entry: DirectoryEntryLike): string {
  return (
    entry.contactName ?? entry.subunit ?? entry.department ?? entry.section ?? entry.campus.name
  );
}

export function getDirectoryEntryPath(entry: DirectoryEntryLike): readonly string[] {
  const title = getDirectoryEntryTitle(entry);
  const campusName = entry.campus.code === 'employee-hospital' ? undefined : entry.campus.name;
  return [...new Set([campusName, entry.section, entry.department, entry.subunit])].filter(
    (value): value is string => value !== undefined && value !== title,
  );
}

export function getDirectoryEntryLocation(entry: DirectoryEntryLike): string | undefined {
  const location = [entry.building, entry.floor, entry.room].filter(
    (value): value is string => value !== undefined,
  );
  return location.length > 0 ? location.join(' · ') : undefined;
}

export function hasActiveDirectoryCriteria(search: string, filters: DirectoryFilters): boolean {
  return (
    search.trim().length > 0 ||
    Object.values(filters).some((value) => value !== undefined && value.length > 0)
  );
}

export function toDirectoryQuery(
  search: string,
  filters: DirectoryFilters,
  cursor?: string,
): DirectoryQueryLike {
  const query: Record<string, string | number> = { pageSize: 30 };
  const normalizedSearch = search.trim();
  if (normalizedSearch.length > 0) query['q'] = normalizedSearch;
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value.length > 0) query[key] = value;
  }
  if (cursor !== undefined) query['cursor'] = cursor;
  return query as unknown as DirectoryQueryLike;
}

function normalizeNumber(value: string | undefined): string {
  return value?.replace(/[^+\d]/gu, '') ?? '';
}

function contactToken(contact: DirectoryContactMethodLike): string {
  return [
    contact.type,
    normalizeNumber(contact.fullNumber),
    normalizeNumber(contact.internalExtension),
  ].join(':');
}

function contactSetSignature(entry: DirectoryEntryLike): string | undefined {
  if (entry.contacts.length === 0) return undefined;
  return entry.contacts.map(contactToken).toSorted().join('|');
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export function groupDirectoryEntriesByContact(
  entries: readonly DirectoryEntryLike[],
): readonly DirectoryEntryDisplayGroup[] {
  const groups: Array<{
    contacts: readonly DirectoryContactMethodLike[];
    entries: DirectoryEntryLike[];
    id: string;
  }> = [];
  const groupsBySignature = new Map<string, (typeof groups)[number]>();
  for (const entry of entries) {
    const signature = contactSetSignature(entry);
    const existing = signature === undefined ? undefined : groupsBySignature.get(signature);
    if (existing !== undefined) {
      existing.entries.push(entry);
      continue;
    }
    const group = { contacts: entry.contacts, entries: [entry], id: entry.id };
    groups.push(group);
    if (signature !== undefined) groupsBySignature.set(signature, group);
  }
  return groups;
}

export function getDirectoryGroupTitle(group: DirectoryEntryDisplayGroup): string {
  return unique(group.entries.map(getDirectoryEntryTitle)).join(' / ');
}

export function getDirectoryGroupContexts(group: DirectoryEntryDisplayGroup): readonly string[] {
  return unique(
    group.entries
      .map((entry) => {
        const title = getDirectoryEntryTitle(entry);
        const path = getDirectoryEntryPath(entry).join(' › ');
        const location = [
          entry.building,
          entry.floor,
          entry.room === title ? undefined : entry.room,
        ]
          .filter((value): value is string => value !== undefined)
          .join(' · ');
        return [path, location].filter((value) => value.length > 0).join(' · ');
      })
      .filter((value) => value.length > 0),
  );
}

export function getDirectoryGroupNotes(group: DirectoryEntryDisplayGroup): string | undefined {
  const notes = unique(
    group.entries
      .map((entry) => entry.notes)
      .filter((value): value is string => value !== undefined && value.length > 0),
  );
  return notes.length === 0 ? undefined : notes.join('；');
}

export function getDirectoryGroupKindLabel(group: DirectoryEntryDisplayGroup): string {
  const kinds = unique(group.entries.map((entry) => entry.entryKind));
  const firstKind = kinds[0] as DirectoryEntryKind | undefined;
  return kinds.length === 1 && firstKind !== undefined ? entryKindLabels[firstKind] : '多类型';
}

export function getDirectoryGroupEmployeeCodes(
  group: DirectoryEntryDisplayGroup,
): readonly string[] {
  return unique(
    group.entries
      .map((entry) => entry.employeeCode)
      .filter((value): value is string => value !== undefined && value.length > 0),
  );
}

export function getDirectoryGroupJobTitles(group: DirectoryEntryDisplayGroup): readonly string[] {
  return unique(
    group.entries
      .map((entry) => entry.jobTitle)
      .filter((value): value is string => value !== undefined && value.length > 0),
  );
}

export function parseDirectoryPreferences(value: string | undefined): DirectoryPreferences {
  if (value === undefined || value.length === 0) return emptyDirectoryPreferences;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return emptyDirectoryPreferences;
  }
  if (parsed === null || typeof parsed !== 'object') return emptyDirectoryPreferences;
  const candidate = parsed as {
    favoriteEntryIds?: unknown;
    usageByEntryId?: unknown;
    version?: unknown;
  };
  if (candidate.version !== 1) return emptyDirectoryPreferences;
  const favoriteEntryIds = Array.isArray(candidate.favoriteEntryIds)
    ? [
        ...new Set(
          candidate.favoriteEntryIds.filter(
            (entryId): entryId is string =>
              typeof entryId === 'string' && directoryUuidPattern.test(entryId),
          ),
        ),
      ].slice(0, 1000)
    : [];
  const usageByEntryId: Record<string, DirectoryUsage> = {};
  if (candidate.usageByEntryId !== null && typeof candidate.usageByEntryId === 'object') {
    for (const [entryId, usage] of Object.entries(candidate.usageByEntryId)) {
      if (!directoryUuidPattern.test(entryId) || usage === null || typeof usage !== 'object') {
        continue;
      }
      const { count, lastUsedAt } = usage as Partial<DirectoryUsage>;
      if (
        !Number.isInteger(count) ||
        (count ?? 0) < 1 ||
        !Number.isFinite(lastUsedAt) ||
        (lastUsedAt ?? -1) < 0
      ) {
        continue;
      }
      usageByEntryId[entryId] = {
        count: Math.min(count!, 999_999),
        lastUsedAt: lastUsedAt!,
      };
      if (Object.keys(usageByEntryId).length >= 1000) break;
    }
  }
  return { favoriteEntryIds, usageByEntryId, version: 1 };
}

export function getDirectoryPreferenceEntryIds(
  preferences: DirectoryPreferences,
): readonly string[] {
  return [
    ...new Set([...preferences.favoriteEntryIds, ...Object.keys(preferences.usageByEntryId)]),
  ];
}

export function isDirectoryGroupFavorite(
  preferences: DirectoryPreferences,
  group: DirectoryEntryDisplayGroup,
): boolean {
  const favoriteIds = new Set(preferences.favoriteEntryIds);
  return group.entries.every((entry) => favoriteIds.has(entry.id));
}

export function toggleDirectoryFavorite(
  preferences: DirectoryPreferences,
  group: DirectoryEntryDisplayGroup,
): DirectoryPreferences {
  const favoriteIds = new Set(preferences.favoriteEntryIds);
  const shouldRemove = group.entries.every((entry) => favoriteIds.has(entry.id));
  for (const entry of group.entries) {
    if (shouldRemove) favoriteIds.delete(entry.id);
    else favoriteIds.add(entry.id);
  }
  return { ...preferences, favoriteEntryIds: [...favoriteIds] };
}

export function recordDirectoryUse(
  preferences: DirectoryPreferences,
  group: DirectoryEntryDisplayGroup,
  usedAt = Date.now(),
): DirectoryPreferences {
  const usageByEntryId: Record<string, DirectoryUsage> = { ...preferences.usageByEntryId };
  for (const entry of group.entries) {
    const previous = usageByEntryId[entry.id];
    usageByEntryId[entry.id] = {
      count: Math.min((previous?.count ?? 0) + 1, 999_999),
      lastUsedAt: usedAt,
    };
  }
  return { ...preferences, usageByEntryId };
}

export function getDirectoryPriorityGroups(
  preferences: DirectoryPreferences,
  groups: readonly DirectoryEntryDisplayGroup[],
  limit = 4,
): DirectoryPriorityGroups {
  const favorites = groups.filter((group) => isDirectoryGroupFavorite(preferences, group));
  const frequent = groups
    .filter(
      (group) =>
        !isDirectoryGroupFavorite(preferences, group) &&
        group.entries.some((entry) => preferences.usageByEntryId[entry.id] !== undefined),
    )
    .toSorted((first, second) => {
      const firstUsage = getGroupUsage(preferences, first);
      const secondUsage = getGroupUsage(preferences, second);
      return secondUsage.count - firstUsage.count || secondUsage.lastUsedAt - firstUsage.lastUsedAt;
    });
  return { favorites: favorites.slice(0, limit), frequent: frequent.slice(0, limit) };
}

function getGroupUsage(
  preferences: DirectoryPreferences,
  group: DirectoryEntryDisplayGroup,
): DirectoryUsage {
  return group.entries.reduce<DirectoryUsage>(
    (result, entry) => {
      const usage = preferences.usageByEntryId[entry.id];
      if (usage === undefined) return result;
      return {
        count: Math.max(result.count, usage.count),
        lastUsedAt: Math.max(result.lastUsedAt, usage.lastUsedAt),
      };
    },
    { count: 0, lastUsedAt: 0 },
  );
}

export function getCompatibleDirectoryFacetOptionsByKey(
  snapshot: DirectoryFacetSnapshotLike,
  filters: DirectoryFilters,
): DirectoryFacetOptionsByKey {
  const countsByKey = new Map<DirectoryFilterKey, Map<string, number>>(
    directoryFilterHierarchy.map((key) => [key, new Map<string, number>()]),
  );
  for (const path of snapshot.paths) {
    let matchesAncestors = true;
    for (const key of directoryFilterHierarchy) {
      const value = path[key];
      if (matchesAncestors && value !== undefined) {
        const counts = countsByKey.get(key);
        if (counts !== undefined) counts.set(value, (counts.get(value) ?? 0) + path.count);
      }
      const selected = filters[key];
      if (selected !== undefined && value !== selected) matchesAncestors = false;
    }
  }
  return new Map(
    directoryFilterHierarchy.map((key) => {
      const counts = countsByKey.get(key) ?? new Map<string, number>();
      return [
        key,
        getSnapshotOptions(snapshot, key).flatMap((option) => {
          const count = counts.get(option.value);
          return count === undefined ? [] : [{ ...option, count }];
        }),
      ];
    }),
  );
}

export function getCompatibleDirectoryFacetOptions(
  snapshot: DirectoryFacetSnapshotLike,
  filters: DirectoryFilters,
  key: DirectoryFilterKey,
): readonly DirectoryFacetOptionLike[] {
  const keyIndex = directoryFilterHierarchy.indexOf(key);
  const ancestors = directoryFilterHierarchy.slice(0, keyIndex);
  const counts = new Map<string, number>();
  for (const path of snapshot.paths) {
    const matchesAncestors = ancestors.every((ancestor) => {
      const selected = filters[ancestor];
      return selected === undefined || path[ancestor] === selected;
    });
    if (!matchesAncestors) continue;
    const value = path[key];
    if (value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + path.count);
  }
  return getSnapshotOptions(snapshot, key).flatMap((option) => {
    const count = counts.get(option.value);
    return count === undefined ? [] : [{ ...option, count }];
  });
}

export function getMeaningfulDirectoryFilterKeys(
  snapshot: DirectoryFacetSnapshotLike,
  filters: DirectoryFilters,
  compatibleOptions: DirectoryFacetOptionsByKey = getCompatibleDirectoryFacetOptionsByKey(
    snapshot,
    filters,
  ),
): readonly DirectoryFilterKey[] {
  return directoryFilterHierarchy.filter((key) => (compatibleOptions.get(key)?.length ?? 0) > 1);
}

export function updateDirectoryFilterSelection(
  snapshot: DirectoryFacetSnapshotLike,
  currentFilters: DirectoryFilters,
  changedKey: DirectoryFilterKey,
  value: string | undefined,
): DirectoryFilterSelectionResult {
  const filters: DirectoryFilters = { ...currentFilters };
  if (value === undefined) delete filters[changedKey];
  else Object.assign(filters, { [changedKey]: value });
  const clearedKeys: DirectoryFilterKey[] = [];
  const changedIndex = directoryFilterHierarchy.indexOf(changedKey);
  for (const descendant of directoryFilterHierarchy.slice(changedIndex + 1)) {
    const selected = filters[descendant];
    if (selected === undefined) continue;
    const compatibleOptions = getCompatibleDirectoryFacetOptions(snapshot, filters, descendant);
    const remainsMeaningful =
      compatibleOptions.length > 1 && compatibleOptions.some((option) => option.value === selected);
    if (!remainsMeaningful) {
      delete filters[descendant];
      clearedKeys.push(descendant);
    }
  }
  return { clearedKeys, filters };
}

function getSnapshotOptions(
  snapshot: DirectoryFacetSnapshotLike,
  key: DirectoryFilterKey,
): readonly DirectoryFacetOptionLike[] {
  switch (key) {
    case 'building':
      return snapshot.buildings;
    case 'campusCode':
      return snapshot.campuses;
    case 'department':
      return snapshot.departments;
    case 'entryKind':
      return snapshot.entryKinds;
    case 'floor':
      return snapshot.floors;
    case 'section':
      return snapshot.sections;
    case 'subunit':
      return snapshot.subunits;
  }
}
