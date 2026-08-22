import type { DirectoryFacetOption, DirectoryFacetSnapshot } from '@schedule/contracts';

import type { DirectoryFilterKey, DirectoryFilters } from './directory-presentation.js';

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
  readonly DirectoryFacetOption[]
>;

export function getCompatibleDirectoryFacetOptionsByKey(
  snapshot: DirectoryFacetSnapshot,
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
  snapshot: DirectoryFacetSnapshot,
  filters: DirectoryFilters,
  key: DirectoryFilterKey,
): readonly DirectoryFacetOption[] {
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
  snapshot: DirectoryFacetSnapshot,
  filters: DirectoryFilters,
  compatibleOptions: DirectoryFacetOptionsByKey = getCompatibleDirectoryFacetOptionsByKey(
    snapshot,
    filters,
  ),
): readonly DirectoryFilterKey[] {
  return directoryFilterHierarchy.filter((key) => (compatibleOptions.get(key)?.length ?? 0) > 1);
}

export function updateDirectoryFilterSelection(
  snapshot: DirectoryFacetSnapshot,
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
  snapshot: DirectoryFacetSnapshot,
  key: DirectoryFilterKey,
): readonly DirectoryFacetOption[] {
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
