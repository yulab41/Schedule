import { describe, expect, it } from 'vitest';

import {
  DIRECTORY_FILTER_KEYS,
  createBaseQueryKey,
  createContextKey,
  createDirectoryFilterStates,
  createPageRequestKey,
  setDirectoryFilterState,
} from '../src/subpackages/organization/components/directory-panel/query-runtime.ts';

describe('P10 directory query runtime keys', () => {
  it('uses stable JSON tuples for opaque values without delimiter collisions', () => {
    const context = createContextKey({
      accountId: 'account|with:[punctuation]',
      directoryKind: 'internal',
      groupId: 'group,with|punctuation',
      groupVersion: 7,
      permission: { isDeveloperAdmin: false, role: 'member' },
      publishedImportVersion: 'batch:[a|b],c',
    });
    const base = createBaseQueryKey({
      contextKey: context,
      filterStates: setDirectoryFilterState(
        createDirectoryFilterStates(),
        'department',
        'value',
        '病案|门诊:[A,B]',
      ),
      pageSize: 30,
      searchQuery: '  病案|门诊:[A,B]  ',
    });

    expect(JSON.parse(context)).toEqual([
      'directory-context-v1',
      ['account', 'account|with:[punctuation]'],
      ['group', 'group,with|punctuation'],
      ['permission', ['member', false]],
      ['mode', 'internal'],
      ['directory-version', 'batch:[a|b],c'],
      ['group-version', 7],
    ]);
    expect(JSON.parse(base)[2]).toBe('病案|门诊:[A,B]');
    expect(createPageRequestKey(base, 'opaque|cursor:[x,y]')).not.toBe(
      createPageRequestKey(`${base}|opaque`, 'cursor:[x,y]'),
    );
  });

  it('keeps all seven levels in fixed order and distinguishes unset, all and value', () => {
    const initial = createDirectoryFilterStates();
    const allCampus = setDirectoryFilterState(initial, 'campusCode', 'all');
    const selectedCampus = setDirectoryFilterState(initial, 'campusCode', 'value', 'main');

    expect(DIRECTORY_FILTER_KEYS).toEqual([
      'campusCode',
      'section',
      'building',
      'floor',
      'department',
      'subunit',
      'entryKind',
    ]);
    expect(initial).toHaveLength(7);
    expect(initial.map((state) => state[1])).toEqual(Array(7).fill('unset'));
    expect(allCampus[0]).toEqual(['campusCode', 'all']);
    expect(selectedCampus[0]).toEqual(['campusCode', 'value', 'main']);

    const contextKey = createContextKey({
      accountId: 'account',
      directoryKind: 'employee',
      groupId: 'group',
      groupVersion: 1,
      permission: { isDeveloperAdmin: true, role: 'administrator' },
      publishedImportVersion: 'batch',
    });
    const key = (filterStates) =>
      createBaseQueryKey({ contextKey, filterStates, pageSize: 30, searchQuery: '' });
    expect(new Set([key(initial), key(allCampus), key(selectedCampus)]).size).toBe(3);
  });

  it('keeps the base query independent from pagination and scopes every page cursor', () => {
    const contextKey = createContextKey({
      accountId: 'account',
      directoryKind: 'internal',
      groupId: 'group',
      groupVersion: 2,
      permission: { isDeveloperAdmin: false, role: 'owner' },
      publishedImportVersion: 'batch-2',
    });
    const base = createBaseQueryKey({
      contextKey,
      filterStates: createDirectoryFilterStates(),
      pageSize: 30,
      searchQuery: 'needle',
    });

    expect(createPageRequestKey(base)).not.toBe(createPageRequestKey(base, 'cursor-1'));
    expect(createPageRequestKey(base, 'cursor-1')).not.toBe(createPageRequestKey(base, 'cursor-2'));
    expect(JSON.parse(createPageRequestKey(base))).toEqual([
      'directory-page-request-v1',
      base,
      ['page', 'first-page'],
    ]);
  });
});
