import type {
  DirectoryEntry,
  DirectoryFacetOption,
  DirectoryFacetSnapshot,
  DirectoryPage,
  DirectoryQuery,
  GroupSummary,
} from '@schedule/contracts';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import type { DirectoryDataSource } from '../../views/directory/InternalDirectoryView.vue';
import UnifiedDirectoryView from '../../views/directory/UnifiedDirectoryView.vue';

const previewGroup: GroupSummary = {
  groupCode: '0001',
  id: 'storybook-unified-directory-group',
  name: '示例医疗中心',
  role: 'member',
  version: 1,
};

const internalEntries: readonly DirectoryEntry[] = [
  {
    building: '门诊楼',
    campus: { code: 'main', dialingNote: '示例数据', name: '本部院区' },
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
  {
    building: '住院楼',
    campus: { code: 'main', name: '本部院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '130-0000-0001',
        id: '41000000-0000-4000-8000-000000000002',
        internalExtension: '6202',
        isPrimary: true,
        label: '值班手机',
        type: 'mobile',
      },
      {
        displayOrder: 1,
        fullNumber: '0754-00000001',
        id: '41000000-0000-4000-8000-000000000003',
        internalExtension: '6203',
        isPrimary: false,
        label: '护士站',
        type: 'voice',
      },
    ],
    department: '内科部',
    displayOrder: 2,
    entryKind: 'department',
    floor: '6楼',
    id: '31000000-0000-4000-8000-000000000002',
    room: '护士站',
    section: '住院诊疗区',
    subunit: '综合病区',
  },
  {
    building: '急诊楼',
    campus: { code: 'main', name: '本部院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '0754-00000120',
        id: '41000000-0000-4000-8000-000000000004',
        isPrimary: true,
        type: 'emergency',
      },
    ],
    displayOrder: 3,
    entryKind: 'emergency',
    floor: '1楼',
    id: '31000000-0000-4000-8000-000000000003',
    section: '急诊诊疗区',
    subunit: '急救调度',
  },
  {
    building: '健康管理楼',
    campus: { code: 'east', name: '东院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '0754-00000002',
        id: '41000000-0000-4000-8000-000000000005',
        internalExtension: '6301',
        isPrimary: true,
        type: 'voice',
      },
    ],
    department: '健康管理部',
    displayOrder: 4,
    entryKind: 'service',
    floor: '2楼',
    id: '31000000-0000-4000-8000-000000000004',
    section: '门诊服务区',
    subunit: '预约服务台',
  },
];

const employeeEntries: readonly DirectoryEntry[] = [
  {
    building: '临床科室',
    campus: { code: 'hospital', dialingNote: '示例数据', name: '示例肿瘤医院' },
    contactName: '林安然',
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '130-0000-1001',
        id: '42000000-0000-4000-8000-000000000001',
        internalExtension: '661001',
        isPrimary: true,
        type: 'mobile',
      },
    ],
    department: '肿瘤内科',
    displayOrder: 1,
    employeeCode: 'd0001',
    entryKind: 'person',
    floor: '内科系统',
    id: '32000000-0000-4000-8000-000000000001',
    section: '医疗系统',
    subunit: '化疗一区',
  },
  {
    building: '临床科室',
    campus: { code: 'hospital', name: '示例肿瘤医院' },
    contactName: '陈知夏',
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '130-0000-1002',
        id: '42000000-0000-4000-8000-000000000002',
        isPrimary: true,
        type: 'mobile',
      },
    ],
    department: '胸外科',
    displayOrder: 2,
    employeeCode: 'd0002',
    entryKind: 'person',
    floor: '外科系统',
    id: '32000000-0000-4000-8000-000000000002',
    section: '医疗系统',
    subunit: '胸外科病区',
  },
  {
    building: '医技科室',
    campus: { code: 'hospital', name: '示例肿瘤医院' },
    contactName: '周清和',
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '130-0000-1003',
        id: '42000000-0000-4000-8000-000000000003',
        internalExtension: '661003',
        isPrimary: true,
        type: 'mobile',
      },
    ],
    department: '医学影像科',
    displayOrder: 3,
    employeeCode: 'g0003',
    entryKind: 'person',
    floor: '影像系统',
    id: '32000000-0000-4000-8000-000000000003',
    section: '医技系统',
    subunit: 'CT室',
  },
  {
    building: '职能科室',
    campus: { code: 'hospital', name: '示例肿瘤医院' },
    contactName: '许明川',
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '130-0000-1004',
        id: '42000000-0000-4000-8000-000000000004',
        isPrimary: true,
        type: 'mobile',
      },
    ],
    department: '医务科',
    displayOrder: 4,
    employeeCode: 'g0004',
    entryKind: 'person',
    floor: '行政管理',
    id: '32000000-0000-4000-8000-000000000004',
    section: '行政系统',
    subunit: '医疗质量组',
  },
];

function facetOptions(values: readonly (string | undefined)[]): DirectoryFacetOption[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ count, label: value, value }));
}

function createFacets(entries: readonly DirectoryEntry[], version: string): DirectoryFacetSnapshot {
  const campuses = new Map<string, { count: number; label: string; value: string }>();
  for (const entry of entries) {
    const current = campuses.get(entry.campus.code);
    campuses.set(entry.campus.code, {
      count: (current?.count ?? 0) + 1,
      label: entry.campus.name,
      value: entry.campus.code,
    });
  }

  return {
    buildings: facetOptions(entries.map((entry) => entry.building)),
    campuses: [...campuses.values()],
    departments: facetOptions(entries.map((entry) => entry.department)),
    entryKinds: facetOptions(
      entries.map((entry) => entry.entryKind),
    ) as DirectoryFacetSnapshot['entryKinds'],
    floors: facetOptions(entries.map((entry) => entry.floor)),
    paths: entries.map((entry) => ({
      ...(entry.building === undefined ? {} : { building: entry.building }),
      campusCode: entry.campus.code,
      count: 1,
      ...(entry.department === undefined ? {} : { department: entry.department }),
      entryKind: entry.entryKind,
      ...(entry.floor === undefined ? {} : { floor: entry.floor }),
      ...(entry.section === undefined ? {} : { section: entry.section }),
      ...(entry.subunit === undefined ? {} : { subunit: entry.subunit }),
    })),
    publishedEffectiveOn: '2026-08-19',
    publishedImportVersion: version,
    sections: facetOptions(entries.map((entry) => entry.section)),
    subunits: facetOptions(entries.map((entry) => entry.subunit)),
    totalCount: entries.length,
  };
}

function matchesQuery(entry: DirectoryEntry, query: DirectoryQuery): boolean {
  if (query.campusCode !== undefined && entry.campus.code !== query.campusCode) return false;
  if (query.section !== undefined && entry.section !== query.section) return false;
  if (query.building !== undefined && entry.building !== query.building) return false;
  if (query.floor !== undefined && entry.floor !== query.floor) return false;
  if (query.department !== undefined && entry.department !== query.department) return false;
  if (query.subunit !== undefined && entry.subunit !== query.subunit) return false;
  if (query.entryKind !== undefined && entry.entryKind !== query.entryKind) return false;
  const search = query.q?.toLocaleLowerCase('zh-CN');
  return search === undefined || JSON.stringify(entry).toLocaleLowerCase('zh-CN').includes(search);
}

function createDataSource(
  entries: readonly DirectoryEntry[],
  version: string,
): DirectoryDataSource {
  const facets = createFacets(entries, version);
  return {
    async getDirectoryFacets() {
      return facets;
    },
    async lookupDirectoryEntries(_groupId: string, entryIds: readonly string[]) {
      const selectedIds = new Set(entryIds);
      return entries.filter((entry) => selectedIds.has(entry.id));
    },
    async searchDirectory(_groupId: string, query: DirectoryQuery): Promise<DirectoryPage> {
      const filtered = entries.filter((entry) => matchesQuery(entry, query));
      return { entries: filtered, totalCount: filtered.length };
    },
  };
}

const internalDataSource = createDataSource(internalEntries, 'storybook-unified-internal-v1');
const employeeDataSource = createDataSource(employeeEntries, 'storybook-unified-employee-v1');

const meta = {
  title: 'Web UI 2.0/Unified Directory',
  component: UnifiedDirectoryView,
  tags: ['autodocs'],
  args: {
    employeeDataSource,
    group: previewGroup,
    initialDirectory: 'internal',
    internalDataSource,
  },
  argTypes: {
    initialDirectory: { control: 'radio', options: ['internal', 'employee'] },
  },
  globals: { viewport: 'mobile390' },
  parameters: {
    docs: {
      description: {
        component:
          '已落地的生产合并通讯录组件。科室与人员复用原有交互，预览数据全部为隔离的合成示例。',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof UnifiedDirectoryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DepartmentMobile390: Story = {
  name: '1 · 科室 · 移动端 390px',
};

export const PeopleMobile390: Story = {
  name: '2 · 人员 · 移动端 390px',
  args: { initialDirectory: 'employee' },
};

export const Mobile320: Story = {
  name: '3 · 科室 · 小屏 320px',
  globals: { viewport: 'mobile320' },
};

export const Desktop1280: Story = {
  name: '4 · 人员 · 桌面端 1280px',
  args: { initialDirectory: 'employee' },
  globals: { viewport: 'desktop1280' },
};
