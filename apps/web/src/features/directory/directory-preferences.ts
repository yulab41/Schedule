import type { DirectoryEntryDisplayGroup } from './directory-entry-groups.js';

const emptyPreferences: DirectoryPreferences = {
  favoriteEntryIds: [],
  usageByEntryId: {},
  version: 1,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

export function parseDirectoryPreferences(value: string | undefined): DirectoryPreferences {
  if (value === undefined || value.length === 0) return emptyPreferences;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return emptyPreferences;
  }
  if (parsed === null || typeof parsed !== 'object') return emptyPreferences;
  const candidate = parsed as {
    favoriteEntryIds?: unknown;
    usageByEntryId?: unknown;
    version?: unknown;
  };
  if (candidate.version !== 1) return emptyPreferences;

  const favoriteEntryIds = Array.isArray(candidate.favoriteEntryIds)
    ? [
        ...new Set(
          candidate.favoriteEntryIds.filter(
            (entryId): entryId is string =>
              typeof entryId === 'string' && uuidPattern.test(entryId),
          ),
        ),
      ].slice(0, 1000)
    : [];
  const usageByEntryId: Record<string, DirectoryUsage> = {};
  if (candidate.usageByEntryId !== null && typeof candidate.usageByEntryId === 'object') {
    for (const [entryId, usage] of Object.entries(candidate.usageByEntryId)) {
      if (!uuidPattern.test(entryId) || usage === null || typeof usage !== 'object') continue;
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
