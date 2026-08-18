import type { DirectoryFacetSnapshot } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  getCompatibleDirectoryFacetOptions,
  getMeaningfulDirectoryFilterKeys,
  updateDirectoryFilterSelection,
} from './directory-filter-hierarchy.js';

const snapshot: DirectoryFacetSnapshot = {
  buildings: [
    { count: 1, label: '门诊楼', value: '门诊楼' },
    { count: 1, label: '健康管理楼', value: '健康管理楼' },
  ],
  campuses: [
    { count: 1, label: '本部院区', value: 'main' },
    { count: 1, label: '东院区', value: 'east' },
  ],
  departments: [
    { count: 1, label: '医疗服务部', value: '医疗服务部' },
    { count: 1, label: '健康管理部', value: '健康管理部' },
  ],
  entryKinds: [
    { count: 1, label: '科室', value: 'department' },
    { count: 1, label: '服务点', value: 'service' },
  ],
  floors: [
    { count: 1, label: '5楼', value: '5楼' },
    { count: 1, label: '2楼', value: '2楼' },
  ],
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
    {
      building: '健康管理楼',
      campusCode: 'east',
      count: 1,
      department: '健康管理部',
      entryKind: 'service',
      floor: '2楼',
      section: '门诊服务区',
      subunit: '预约服务台',
    },
  ],
  publishedEffectiveOn: '2026-07-05',
  publishedImportVersion: 'hierarchy-test',
  sections: [
    { count: 1, label: '行政服务区', value: '行政服务区' },
    { count: 1, label: '门诊服务区', value: '门诊服务区' },
  ],
  subunits: [
    { count: 1, label: '病案服务台', value: '病案服务台' },
    { count: 1, label: '预约服务台', value: '预约服务台' },
  ],
  totalCount: 2,
};

describe('directory filter hierarchy', () => {
  it('omits hierarchy levels with no data or only one compatible choice', () => {
    const withoutBuildings: DirectoryFacetSnapshot = {
      ...snapshot,
      buildings: [],
      paths: snapshot.paths.map((path) => ({
        campusCode: path.campusCode,
        count: path.count,
        ...(path.department === undefined ? {} : { department: path.department }),
        entryKind: path.entryKind,
        ...(path.floor === undefined ? {} : { floor: path.floor }),
        ...(path.section === undefined ? {} : { section: path.section }),
        ...(path.subunit === undefined ? {} : { subunit: path.subunit }),
      })),
    };

    expect(getMeaningfulDirectoryFilterKeys(withoutBuildings, {})).not.toContain('building');
    expect(getMeaningfulDirectoryFilterKeys(withoutBuildings, { campusCode: 'main' })).toEqual([
      'campusCode',
    ]);
  });

  it('keeps skip-level selection but only exposes descendants compatible with selected parents', () => {
    expect(
      getCompatibleDirectoryFacetOptions(snapshot, {}, 'floor').map((option) => option.value),
    ).toEqual(['5楼', '2楼']);

    expect(
      getCompatibleDirectoryFacetOptions(snapshot, { campusCode: 'main' }, 'department').map(
        (option) => option.value,
      ),
    ).toEqual(['医疗服务部']);
  });

  it('clears incompatible descendants when an ancestor changes', () => {
    const result = updateDirectoryFilterSelection(
      snapshot,
      {
        department: '健康管理部',
        subunit: '预约服务台',
      },
      'campusCode',
      'main',
    );

    expect(result.filters).toEqual({ campusCode: 'main' });
    expect(result.clearedKeys).toEqual(['department', 'subunit']);
  });

  it('clears compatible descendants that become redundant as the only available choice', () => {
    const result = updateDirectoryFilterSelection(
      snapshot,
      {
        department: '医疗服务部',
        subunit: '病案服务台',
      },
      'campusCode',
      'main',
    );

    expect(result.filters).toEqual({ campusCode: 'main' });
    expect(result.clearedKeys).toEqual(['department', 'subunit']);
  });

  it('preserves descendants that remain valid under the new ancestor', () => {
    const snapshotWithChoices: DirectoryFacetSnapshot = {
      ...snapshot,
      paths: [
        ...snapshot.paths,
        {
          building: '门诊楼',
          campusCode: 'main',
          count: 1,
          department: '医疗服务部',
          entryKind: 'service',
          floor: '5楼',
          section: '行政服务区',
          subunit: '门诊服务台',
        },
        {
          building: '急诊楼',
          campusCode: 'main',
          count: 1,
          department: '急诊科',
          entryKind: 'service',
          floor: '1楼',
          section: '急诊服务区',
          subunit: '急诊分诊台',
        },
      ],
      departments: [...snapshot.departments, { count: 1, label: '急诊科', value: '急诊科' }],
      subunits: [
        ...snapshot.subunits,
        { count: 1, label: '门诊服务台', value: '门诊服务台' },
        { count: 1, label: '急诊分诊台', value: '急诊分诊台' },
      ],
    };
    const result = updateDirectoryFilterSelection(
      snapshotWithChoices,
      {
        department: '医疗服务部',
        subunit: '病案服务台',
      },
      'campusCode',
      'main',
    );

    expect(result.filters).toEqual({
      campusCode: 'main',
      department: '医疗服务部',
      subunit: '病案服务台',
    });
    expect(result.clearedKeys).toEqual([]);
  });
});
