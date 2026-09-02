import type { DirectoryQuery } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  DirectoryCandidateIndexGuard,
  directoryCandidateIndexName,
  hasCandidateDirectoryIndexDefinition,
  selectDirectoryQueryPlan,
  type DirectoryCandidateReadiness,
  type DirectoryIndexDefinitionRow,
} from './directory-query-plan.js';

describe('directory query plan routing', () => {
  const candidateCases: ReadonlyArray<readonly [string, DirectoryQuery]> = [
    ['unfiltered Chinese name', { q: '徐漫彬' }],
    ['unfiltered pinyin initials', { q: 'xmb' }],
    ['unfiltered full pinyin', { q: 'xumanbin' }],
    ['unfiltered partial pinyin', { q: 'xuman' }],
    ['unfiltered employee code', { q: '0468' }],
    ['unfiltered phone', { q: '70000000001' }],
    ['unfiltered no-result query', { q: 'not-present' }],
    ['cursor continuation', { cursor: 'opaque', pageSize: 1, q: 'xmb' }],
    [
      'seven levels explicitly unselected',
      {
        building: '',
        campusCode: '',
        department: '',
        entryKind: undefined,
        floor: '',
        q: 'xmb',
        section: '',
        subunit: '',
      } as DirectoryQuery,
    ],
  ];

  it.each(candidateCases)(
    'routes %s through candidate when its index is available',
    (_name, query) => {
      expect(
        selectDirectoryQueryPlan({
          candidateIndexAvailable: true,
          configuredPlan: 'candidate',
          query,
        }),
      ).toBe('candidate');
    },
  );

  it.each([
    ['empty query object', {}],
    ['empty text', { q: '' }],
    ['whitespace text', { q: '   ' }],
    ['single Han character', { q: '徐' }],
    ['single ASCII character', { q: 'x' }],
    ['single numeric character', { q: '0' }],
    ['single supplementary Unicode character', { q: '𠀀' }],
    ['campus filter', { campusCode: 'main', q: 'xmb' }],
    ['section filter', { q: 'xmb', section: 'section' }],
    ['building filter', { building: 'building', q: 'xmb' }],
    ['floor filter', { floor: 'floor', q: 'xmb' }],
    ['department filter', { department: 'department', q: 'xmb' }],
    ['subunit filter', { q: 'xmb', subunit: 'subunit' }],
    ['entry-kind filter', { entryKind: 'person', q: 'xmb' }],
  ] satisfies ReadonlyArray<readonly [string, DirectoryQuery]>)(
    'keeps %s on legacy',
    (_name, query) => {
      expect(
        selectDirectoryQueryPlan({
          candidateIndexAvailable: true,
          configuredPlan: 'candidate',
          query,
        }),
      ).toBe('legacy');
    },
  );

  it('keeps every request on legacy when the flag is legacy or the index is unavailable', () => {
    expect(
      selectDirectoryQueryPlan({
        candidateIndexAvailable: true,
        configuredPlan: 'legacy',
        query: { q: 'xmb' },
      }),
    ).toBe('legacy');
    expect(
      selectDirectoryQueryPlan({
        candidateIndexAvailable: false,
        configuredPlan: 'candidate',
        query: { q: 'xmb' },
      }),
    ).toBe('legacy');
  });
});

describe('directory candidate covering-index guard', () => {
  const exactRows: readonly DirectoryIndexDefinitionRow[] = [
    row('entry_id', 1),
    row('type', 2),
    row('normalized_value', 3),
  ];
  const exactReadiness: DirectoryCandidateReadiness = {
    indexRows: exactRows,
    migrationCount: 53,
  };

  it('accepts only the named non-unique index with the exact ordered columns', () => {
    expect(hasCandidateDirectoryIndexDefinition(exactRows)).toBe(true);
    expect(hasCandidateDirectoryIndexDefinition([])).toBe(false);
    expect(hasCandidateDirectoryIndexDefinition(exactRows.slice(0, 2))).toBe(false);
    expect(
      hasCandidateDirectoryIndexDefinition([
        row('type', 1),
        row('entry_id', 2),
        row('normalized_value', 3),
      ]),
    ).toBe(false);
    expect(
      hasCandidateDirectoryIndexDefinition(
        exactRows.map((indexRow) => ({ ...indexRow, isVisible: 'NO' })),
      ),
    ).toBe(false);
    expect(
      hasCandidateDirectoryIndexDefinition(
        exactRows.map((indexRow) => ({ ...indexRow, indexType: 'HASH' })),
      ),
    ).toBe(false);
    expect(
      hasCandidateDirectoryIndexDefinition([
        row('entry_id', 1, 0),
        row('type', 2, 0),
        row('normalized_value', 3, 0),
      ]),
    ).toBe(false);
    expect(directoryCandidateIndexName).toBe('directory_search_aliases_entry_type_normalized_idx');
  });

  it('memoizes a successful inspection across concurrent requests', async () => {
    const inspect = vi.fn(async () => exactReadiness);
    const warn = vi.fn();
    const guard = new DirectoryCandidateIndexGuard(inspect, warn);

    await expect(Promise.all([guard.isAvailable(), guard.isAvailable()])).resolves.toEqual([
      true,
      true,
    ]);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('fails closed without throwing when the index is absent or inspection fails', async () => {
    for (const [inspect, reason] of [
      [vi.fn(async () => ({ indexRows: exactRows, migrationCount: 52 })), 'migration-incomplete'],
      [vi.fn(async () => ({ indexRows: [], migrationCount: 53 })), 'index-missing-or-invalid'],
      [
        vi.fn(async () => {
          throw new Error('private database detail');
        }),
        'index-inspection-failed',
      ],
    ] as const) {
      const warn = vi.fn();
      const guard = new DirectoryCandidateIndexGuard(inspect, warn);

      await expect(guard.isAvailable()).resolves.toBe(false);
      await expect(guard.isAvailable()).resolves.toBe(false);
      expect(inspect).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(reason);
      expect(warn).toHaveBeenCalledTimes(1);
    }
  });
});

function row(columnName: string, sequence: number, nonUnique = 1): DirectoryIndexDefinitionRow {
  return {
    columnName,
    indexName: directoryCandidateIndexName,
    indexType: 'BTREE',
    isVisible: 'YES',
    nonUnique,
    sequence,
  };
}
