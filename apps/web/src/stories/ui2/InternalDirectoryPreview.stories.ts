import type {
  DirectoryEntry,
  DirectoryFacetSnapshot,
  DirectoryPage,
  DirectoryQuery,
  GroupSummary,
} from '@schedule/contracts';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import InternalDirectoryView, {
  type DirectoryDataSource,
} from '../../views/directory/InternalDirectoryView.vue';

const previewGroup: GroupSummary = {
  groupCode: '0001',
  id: 'storybook-directory-group',
  name: '示例医疗中心',
  role: 'member',
  version: 1,
};

const syntheticEntries: readonly DirectoryEntry[] = [
  {
    building: '门诊楼',
    campus: { code: 'main', dialingNote: '示例数据', name: '本部院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '0754-00000000',
        id: '10000000-0000-4000-8000-000000000001',
        internalExtension: '6101',
        isPrimary: true,
        type: 'voice',
      },
    ],
    department: '医疗服务部',
    displayOrder: 1,
    entryKind: 'department',
    floor: '5楼',
    id: '20000000-0000-4000-8000-000000000001',
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
        fullNumber: '130-0000-0000',
        id: '10000000-0000-4000-8000-000000000002',
        internalExtension: '6202',
        isPrimary: true,
        label: '值班手机',
        type: 'mobile',
      },
      {
        displayOrder: 1,
        fullNumber: '0754-00000001',
        id: '10000000-0000-4000-8000-000000000003',
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
    id: '20000000-0000-4000-8000-000000000002',
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
        id: '10000000-0000-4000-8000-000000000004',
        isPrimary: true,
        type: 'emergency',
      },
    ],
    displayOrder: 3,
    entryKind: 'emergency',
    floor: '1楼',
    id: '20000000-0000-4000-8000-000000000003',
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
        id: '10000000-0000-4000-8000-000000000005',
        internalExtension: '6301',
        isPrimary: true,
        type: 'voice',
      },
    ],
    department: '健康管理部',
    displayOrder: 4,
    entryKind: 'service',
    floor: '2楼',
    id: '20000000-0000-4000-8000-000000000004',
    section: '门诊服务区',
    subunit: '预约服务台',
  },
];

function options(values: readonly (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ count, label: value, value }));
}

const syntheticFacets: DirectoryFacetSnapshot = {
  buildings: options(syntheticEntries.map((entry) => entry.building)),
  campuses: [
    { count: 3, label: '本部院区', value: 'main' },
    { count: 1, label: '东院区', value: 'east' },
  ],
  departments: options(syntheticEntries.map((entry) => entry.department)),
  entryKinds: [
    { count: 2, label: '科室', value: 'department' },
    { count: 1, label: '急救', value: 'emergency' },
    { count: 1, label: '服务点', value: 'service' },
  ],
  floors: options(syntheticEntries.map((entry) => entry.floor)),
  publishedEffectiveOn: '2026-07-05',
  publishedImportVersion: 'storybook-synthetic-v1',
  sections: options(syntheticEntries.map((entry) => entry.section)),
  subunits: options(syntheticEntries.map((entry) => entry.subunit)),
  totalCount: syntheticEntries.length,
};

const SyntheticDirectoryDataSource: DirectoryDataSource = {
  async getDirectoryFacets() {
    return syntheticFacets;
  },
  async searchDirectory(_groupId: string, query: DirectoryQuery): Promise<DirectoryPage> {
    const normalizedSearch = query.q?.toLocaleLowerCase('zh-CN');
    const filtered = syntheticEntries.filter((entry) => {
      if (query.campusCode !== undefined && entry.campus.code !== query.campusCode) return false;
      if (query.section !== undefined && entry.section !== query.section) return false;
      if (query.building !== undefined && entry.building !== query.building) return false;
      if (query.floor !== undefined && entry.floor !== query.floor) return false;
      if (query.department !== undefined && entry.department !== query.department) return false;
      if (query.subunit !== undefined && entry.subunit !== query.subunit) return false;
      if (query.entryKind !== undefined && entry.entryKind !== query.entryKind) return false;
      if (normalizedSearch === undefined) return true;
      return JSON.stringify(entry).toLocaleLowerCase('zh-CN').includes(normalizedSearch);
    });
    return { entries: filtered, totalCount: filtered.length };
  },
};

const meta = {
  title: 'Web UI 2.0/Hospital Directory',
  component: InternalDirectoryView,
  tags: ['autodocs'],
  args: {
    dataSource: SyntheticDirectoryDataSource,
    group: previewGroup,
  },
  globals: { viewport: 'mobile390' },
  parameters: {
    docs: {
      description: {
        component: '生产通讯录组件的隔离预览。所有号码均为 0 组成的合成数据，不连接生产 API。',
      },
    },
    layout: 'fullscreen',
  },
  decorators: [
    () => ({
      template:
        '<div style="width: 100%; max-width: 1040px; margin: 0 auto; padding: 16px; box-sizing: border-box"><story /></div>',
    }),
  ],
} satisfies Meta<typeof InternalDirectoryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile390: Story = {
  name: '1 · 移动端 · 390px',
};

export const Desktop1280: Story = {
  name: '2 · 桌面端 · 1280px',
  globals: { viewport: 'desktop1280' },
};
