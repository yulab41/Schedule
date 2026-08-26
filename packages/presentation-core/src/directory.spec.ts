import { describe, expect, it } from 'vitest';

import {
  canDialDirectoryNumber,
  getDirectoryNumberLabel,
  getMeaningfulDirectoryFilterKeys,
  groupDirectoryEntriesByContact,
  updateDirectoryFilterSelection,
} from './directory.js';

const snapshot = {
  buildings: [],
  campuses: [
    { count: 2, label: '大学路院区', value: 'university-road' },
    { count: 1, label: '汕大肿瘤医院', value: 'employee-hospital' },
  ],
  departments: [
    { count: 1, label: '临床服务类科室', value: '临床服务类科室' },
    { count: 1, label: '医疗技术类科室', value: '医疗技术类科室' },
  ],
  entryKinds: [
    { count: 2, label: '人员', value: 'person' },
    { count: 1, label: '科室', value: 'department' },
  ],
  floors: [],
  paths: [
    {
      campusCode: 'university-road',
      count: 1,
      department: '临床服务类科室',
      entryKind: 'person',
      section: '门诊系统',
    },
    {
      campusCode: 'university-road',
      count: 1,
      department: '医疗技术类科室',
      entryKind: 'department',
      section: '医技系统',
    },
    {
      campusCode: 'employee-hospital',
      count: 1,
      department: '临床服务类科室',
      entryKind: 'person',
      section: '临床系统',
    },
  ],
  publishedEffectiveOn: '2026-08-01',
  publishedImportVersion: 'shared-directory-test',
  sections: [
    { count: 1, label: '门诊系统', value: '门诊系统' },
    { count: 1, label: '医技系统', value: '医技系统' },
    { count: 1, label: '临床系统', value: '临床系统' },
  ],
  subunits: [],
  totalCount: 3,
} as const;

describe('shared Web/Mini directory presentation', () => {
  it('merges entries with the same complete contact set regardless of number formatting', () => {
    const groups = groupDirectoryEntriesByContact([
      entry('20000000-0000-4000-8000-000000000001', '护士站', '0754-00000001'),
      entry('20000000-0000-4000-8000-000000000002', '值班房', '(0754) 0000 0001'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries).toHaveLength(2);
  });

  it('derives meaningful levels and clears incompatible descendants exactly once', () => {
    expect(getMeaningfulDirectoryFilterKeys(snapshot, {})).toEqual([
      'campusCode',
      'section',
      'department',
      'entryKind',
    ]);

    expect(
      updateDirectoryFilterSelection(
        snapshot,
        { department: '临床服务类科室', section: '临床系统' },
        'campusCode',
        'university-road',
      ),
    ).toEqual({
      clearedKeys: ['section'],
      filters: { campusCode: 'university-road', department: '临床服务类科室' },
    });
  });

  it('keeps Web long/short number labels and dialing policy canonical', () => {
    expect(getDirectoryNumberLabel('mobile', 'full')).toBe('手机长号');
    expect(getDirectoryNumberLabel('mobile', 'extension')).toBe('手机短号');
    expect(canDialDirectoryNumber('voice', 'full')).toBe(true);
    expect(canDialDirectoryNumber('voice', 'extension')).toBe(false);
  });
});

function entry(id: string, subunit: string, fullNumber: string) {
  return {
    building: '住院楼',
    campus: { code: 'university-road', name: '大学路院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber,
        id: id.replace(/^2/u, '1'),
        internalExtension: '6101',
        isPrimary: true,
        type: 'voice' as const,
      },
    ],
    department: '国际医疗部',
    displayOrder: 1,
    entryKind: 'department' as const,
    floor: '3楼',
    id,
    section: '住院',
    subunit,
  };
}
