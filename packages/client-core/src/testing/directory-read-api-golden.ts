import type { DirectoryFacetSnapshot, DirectoryPage } from '@schedule/contracts';

export const directoryReadApiGoldenResponse = {
  facets: {
    buildings: [{ count: 1, label: '门诊楼', value: '门诊楼' }],
    campuses: [{ count: 1, label: '本部院区', value: 'main' }],
    departments: [{ count: 1, label: '医疗服务部', value: '医疗服务部' }],
    entryKinds: [{ count: 1, label: '科室', value: 'department' }],
    floors: [{ count: 1, label: '5楼', value: '5楼' }],
    paths: [
      {
        building: '门诊楼',
        campusCode: 'main',
        count: 1,
        department: '医疗服务部',
        entryKind: 'department',
        floor: '5楼',
        section: '行政服务区',
        subunit: '病案服务台',
      },
    ],
    publishedEffectiveOn: '2026-08-19',
    publishedImportVersion: 'p10-internal-v1',
    sections: [{ count: 1, label: '行政服务区', value: '行政服务区' }],
    subunits: [{ count: 1, label: '病案服务台', value: '病案服务台' }],
    totalCount: 1,
  } as const satisfies DirectoryFacetSnapshot,
  page: {
    entries: [
      {
        building: '门诊楼',
        campus: { code: 'main', dialingNote: '合成数据', name: '本部院区' },
        contacts: [
          {
            displayOrder: 0,
            fullNumber: '0754-00000000',
            id: '41000000-0000-4000-8000-000000000001',
            internalExtension: '6101',
            isPrimary: true,
            type: 'voice',
          },
        ],
        department: '医疗服务部',
        displayOrder: 1,
        entryKind: 'department',
        floor: '5楼',
        id: '31000000-0000-4000-8000-000000000001',
        room: '502室',
        section: '行政服务区',
        subunit: '病案服务台',
      },
    ],
    nextCursor:
      'eyJjYW1wdXNEaXNwbGF5T3JkZXIiOjEsImVudHJ5RGlzcGxheU9yZGVyIjoxLCJpZCI6IjMxMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsInJhbmsiOjcwMH0',
    totalCount: 1,
  } as const satisfies DirectoryPage,
} as const;
