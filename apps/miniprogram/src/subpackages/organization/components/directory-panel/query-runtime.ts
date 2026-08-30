import type { DirectoryKind } from '@schedule/contracts';
import type { DirectoryFilterKey } from '@schedule/presentation-core';

export const DIRECTORY_FILTER_KEYS = [
  'campusCode',
  'section',
  'building',
  'floor',
  'department',
  'subunit',
  'entryKind',
] as const satisfies readonly DirectoryFilterKey[];

export type DirectoryFilterState =
  | readonly [DirectoryFilterKey, 'unset']
  | readonly [DirectoryFilterKey, 'all']
  | readonly [DirectoryFilterKey, 'value', string];

export interface DirectoryContextKeyInput {
  readonly accountId: string;
  readonly directoryKind: DirectoryKind;
  readonly groupId: string;
  readonly groupVersion: number;
  readonly permission: {
    readonly isDeveloperAdmin: boolean;
    readonly role: string;
  };
  readonly publishedImportVersion: string;
}

export interface DirectoryBaseQueryKeyInput {
  readonly contextKey: string;
  readonly filterStates: readonly DirectoryFilterState[];
  readonly pageSize: number;
  readonly searchQuery: string;
}

export function createDirectoryFilterStates(): readonly DirectoryFilterState[] {
  return DIRECTORY_FILTER_KEYS.map((key) => [key, 'unset'] as const);
}

export function setDirectoryFilterState(
  states: readonly DirectoryFilterState[],
  key: DirectoryFilterKey,
  state: 'all' | 'unset' | 'value',
  value?: string,
): readonly DirectoryFilterState[] {
  const normalized = normalizeDirectoryFilterStates(states);
  return normalized.map((current): DirectoryFilterState => {
    if (current[0] !== key) return current;
    if (state === 'value' && value !== undefined) return [key, 'value', value];
    return [key, state === 'all' ? 'all' : 'unset'];
  });
}

export function resetDirectoryFilterStates(
  states: readonly DirectoryFilterState[],
  keys: readonly DirectoryFilterKey[],
): readonly DirectoryFilterState[] {
  const keySet = new Set(keys);
  return normalizeDirectoryFilterStates(states).map((current) =>
    keySet.has(current[0]) ? ([current[0], 'unset'] as const) : current,
  );
}

export function createContextKey(input: DirectoryContextKeyInput): string {
  return stableSerialize([
    'directory-context-v1',
    ['account', input.accountId],
    ['group', input.groupId],
    ['permission', [input.permission.role, input.permission.isDeveloperAdmin]],
    ['mode', input.directoryKind],
    ['directory-version', input.publishedImportVersion],
    ['group-version', input.groupVersion],
  ]);
}

export function createBaseQueryKey(input: DirectoryBaseQueryKeyInput): string {
  return stableSerialize([
    'directory-base-query-v1',
    input.contextKey,
    input.searchQuery.trim(),
    normalizeDirectoryFilterStates(input.filterStates),
    ['page-size', input.pageSize],
  ]);
}

export function createPageRequestKey(baseQueryKey: string, cursor?: string): string {
  return stableSerialize([
    'directory-page-request-v1',
    baseQueryKey,
    ['page', cursor === undefined ? 'first-page' : ['cursor', cursor]],
  ]);
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(value);
}

function normalizeDirectoryFilterStates(
  states: readonly DirectoryFilterState[],
): readonly DirectoryFilterState[] {
  const statesByKey = new Map(states.map((state) => [state[0], state]));
  return DIRECTORY_FILTER_KEYS.map((key) => statesByKey.get(key) ?? ([key, 'unset'] as const));
}
