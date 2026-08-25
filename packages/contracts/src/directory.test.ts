import { describe, expect, it } from 'vitest';

import {
  directoryEntryKindSchema,
  directoryEntryLookupRequestSchema,
  directoryFacetSnapshotSchema,
  directoryKindSchema,
  directoryPageSchema,
  directoryQuerySchema,
} from './directory.js';

describe('directory contracts', () => {
  it('supports the hospital and employee directory kinds', () => {
    expect(directoryKindSchema.parse('internal')).toBe('internal');
    expect(directoryKindSchema.parse('employee')).toBe('employee');
    expect(() => directoryKindSchema.parse('unknown')).toThrow();
  });

  it('accepts independent skip-level filters and bounded cursor pagination', () => {
    expect(
      directoryQuerySchema.parse({
        department: '急诊科',
        floor: '3楼',
        pageSize: 30,
        q: 'jzk',
      }),
    ).toEqual({ department: '急诊科', floor: '3楼', pageSize: 30, q: 'jzk' });

    expect(() => directoryQuerySchema.parse({ pageSize: 101 })).toThrow();
    expect(() => directoryQuerySchema.parse({ cursor: 'x'.repeat(2049) })).toThrow();
  });

  it('accepts a bounded unique list of entry ids for preference restoration', () => {
    const entryId = '00000000-0000-4000-8000-000000000001';
    expect(directoryEntryLookupRequestSchema.parse({ entryIds: [entryId] })).toEqual({
      entryIds: [entryId],
    });
    expect(() =>
      directoryEntryLookupRequestSchema.parse({ entryIds: [entryId, entryId] }),
    ).toThrow();
    expect(() =>
      directoryEntryLookupRequestSchema.parse({
        entryIds: Array.from(
          { length: 101 },
          (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        ),
      }),
    ).toThrow();
  });

  it('rejects malformed directory contacts and preserves six-digit extensions', () => {
    const page = directoryPageSchema.parse({
      entries: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          campus: { code: 'central', name: '中心院区' },
          contactName: '测试总机',
          contacts: [
            {
              id: '00000000-0000-4000-8000-000000000002',
              displayOrder: 10,
              fullNumber: '0000-00000000',
              internalExtension: '123456',
              isPrimary: true,
              type: 'voice',
            },
          ],
          displayOrder: 10,
          employeeCode: 'd0001',
          jobTitle: '主任',
          entryKind: 'switchboard',
        },
      ],
      totalCount: 1,
    });

    expect(page.entries[0]?.contacts[0]?.internalExtension).toBe('123456');
    expect(page.entries[0]?.employeeCode).toBe('d0001');
    expect(page.entries[0]?.jobTitle).toBe('主任');
    expect(() =>
      directoryPageSchema.parse({
        entries: [
          {
            ...page.entries[0],
            contacts: [{ ...page.entries[0]?.contacts[0], internalExtension: '1234567' }],
          },
        ],
        totalCount: 1,
      }),
    ).toThrow();
  });

  it('validates stable facet snapshots and entry kinds', () => {
    expect(directoryEntryKindSchema.parse('department')).toBe('department');
    const snapshot = directoryFacetSnapshotSchema.parse({
      campuses: [{ count: 2, label: '中心院区', value: 'central' }],
      departments: [{ count: 1, label: '急诊科', value: '急诊科' }],
      entryKinds: [{ count: 2, label: '科室', value: 'department' }],
      paths: [
        {
          campusCode: 'central',
          count: 1,
          department: '急诊科',
          entryKind: 'department',
          section: '临床服务',
        },
        {
          campusCode: 'central',
          count: 1,
          entryKind: 'department',
          section: '行政服务',
        },
      ],
      publishedEffectiveOn: '2026-05-12',
      publishedImportVersion: 'synthetic-1',
      sections: [],
      buildings: [],
      floors: [],
      subunits: [],
      totalCount: 2,
    });

    expect(snapshot.totalCount).toBe(2);
    expect(snapshot.paths).toHaveLength(2);
    expect(snapshot.paths[0]).toMatchObject({ campusCode: 'central', department: '急诊科' });
  });

  it('rejects empty facet paths while keeping compact schema generation compatible', () => {
    expect(() =>
      directoryFacetSnapshotSchema.parse({
        buildings: [],
        campuses: [],
        departments: [],
        entryKinds: [],
        floors: [],
        paths: [{ campusCode: 'central', count: 0, entryKind: 'department' }],
        publishedEffectiveOn: '2026-08-19',
        publishedImportVersion: 'p10-test-v1',
        sections: [],
        subunits: [],
        totalCount: 0,
      }),
    ).toThrow();
  });
});
