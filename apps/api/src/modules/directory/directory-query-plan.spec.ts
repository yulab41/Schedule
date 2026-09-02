import type { DirectoryQuery } from '@schedule/contracts';
import { directoryCandidateMigrationIdentity } from '@schedule/database';
import { describe, expect, it, vi } from 'vitest';

import {
  DirectoryCandidateIndexGuard,
  directoryCandidateReadinessTtlMs,
  directoryCandidateIndexName,
  hasCandidateDirectoryIndexDefinition,
  selectDirectoryQueryPlan,
  type DirectoryCandidateReadiness,
  type DirectoryIndexDefinitionRow,
  type DirectoryMigrationJournalRow,
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
    migrationRows: [migrationRow()],
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

  it('coalesces concurrent inspection and rechecks only after the bounded TTL', async () => {
    let now = 10_000;
    const inspect = vi.fn(async () => exactReadiness);
    const warn = vi.fn();
    const guard = new DirectoryCandidateIndexGuard(inspect, warn, {
      now: () => now,
      ttlMs: directoryCandidateReadinessTtlMs,
    });

    await expect(Promise.all([guard.isAvailable(), guard.isAvailable()])).resolves.toEqual([
      true,
      true,
    ]);
    expect(inspect).toHaveBeenCalledTimes(1);
    now += directoryCandidateReadinessTtlMs - 1;
    await expect(guard.isAvailable()).resolves.toBe(true);
    expect(inspect).toHaveBeenCalledTimes(1);

    now += 1;
    await expect(Promise.all([guard.isAvailable(), guard.isAvailable()])).resolves.toEqual([
      true,
      true,
    ]);
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('requires the exact 0053 journal identity and exact index definition', async () => {
    for (const [inspect, reason] of [
      [
        vi.fn(async () => ({ indexRows: [], migrationRows: [migrationRow()] })),
        'index-missing-or-invalid',
      ],
      [
        vi.fn(async () => ({
          indexRows: [row('type', 1), row('entry_id', 2), row('normalized_value', 3)],
          migrationRows: [migrationRow()],
        })),
        'index-missing-or-invalid',
      ],
      [vi.fn(async () => ({ indexRows: [], migrationRows: [] })), 'migration-missing-or-invalid'],
      [
        vi.fn(async () => ({
          indexRows: exactRows,
          migrationRows: [migrationRow({ hash: '0'.repeat(64) })],
        })),
        'migration-index-inconsistent',
      ],
      [
        vi.fn(async () => {
          throw new Error('private database detail');
        }),
        'readiness-inspection-failed',
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

  it('keeps failures cached only for the TTL and supports an explicit post-migration refresh', async () => {
    let readiness: DirectoryCandidateReadiness = { indexRows: [], migrationRows: [] };
    const inspect = vi.fn(async () => readiness);
    const warn = vi.fn();
    const guard = new DirectoryCandidateIndexGuard(inspect, warn);

    await expect(guard.isAvailable()).resolves.toBe(false);
    readiness = exactReadiness;
    await expect(guard.isAvailable()).resolves.toBe(false);
    expect(inspect).toHaveBeenCalledTimes(1);

    await expect(guard.refresh()).resolves.toBe(true);
    await expect(guard.isAvailable()).resolves.toBe(true);
    expect(inspect).toHaveBeenCalledTimes(2);
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

function migrationRow(
  overrides: Partial<DirectoryMigrationJournalRow> = {},
): DirectoryMigrationJournalRow {
  return {
    createdAt: directoryCandidateMigrationIdentity.createdAt,
    hash: directoryCandidateMigrationIdentity.hash,
    id: 53,
    ...overrides,
  };
}
