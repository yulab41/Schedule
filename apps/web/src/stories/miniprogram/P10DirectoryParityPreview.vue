<script setup lang="ts">
import type {
  DirectoryEntry,
  DirectoryFacetSnapshot,
  DirectoryPage,
  DirectoryQuery,
  GroupSummary,
} from '@schedule/contracts';
import { computed } from 'vue';

import InternalDirectoryView, {
  type DirectoryDataSource,
} from '../../views/directory/InternalDirectoryView.vue';

type PreviewState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';
type DirectoryMode = 'employee' | 'internal';

const props = withDefaults(
  defineProps<{
    readonly directoryKind?: DirectoryMode;
    readonly initialState?: PreviewState;
    readonly largeText?: boolean;
  }>(),
  { directoryKind: 'internal', initialState: 'ready', largeText: false },
);

const previewGroup: GroupSummary = {
  groupCode: '0001',
  id: 'storybook-p10-directory',
  name: '示例医疗中心',
  role: 'member',
  version: 1,
};

const entries: readonly DirectoryEntry[] = [
  {
    building: '门诊楼',
    campus: { code: 'main', dialingNote: '示例号码', name: '本部院区' },
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
        id: '10000000-0000-4000-8000-000000000003',
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
];

const facets: DirectoryFacetSnapshot = {
  buildings: [
    { count: 1, label: '门诊楼', value: '门诊楼' },
    { count: 1, label: '住院楼', value: '住院楼' },
    { count: 1, label: '急诊楼', value: '急诊楼' },
  ],
  campuses: [{ count: 3, label: '本部院区', value: 'main' }],
  departments: [
    { count: 1, label: '医疗服务部', value: '医疗服务部' },
    { count: 1, label: '内科部', value: '内科部' },
  ],
  entryKinds: [
    { count: 2, label: '科室', value: 'department' },
    { count: 1, label: '急救', value: 'emergency' },
  ],
  floors: [
    { count: 1, label: '1楼', value: '1楼' },
    { count: 1, label: '5楼', value: '5楼' },
    { count: 1, label: '6楼', value: '6楼' },
  ],
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
  publishedEffectiveOn: '2026-08-01',
  publishedImportVersion: 'storybook-p10-directory-v1',
  sections: [
    { count: 2, label: '住院诊疗区', value: '住院诊疗区' },
    { count: 1, label: '行政服务区', value: '行政服务区' },
  ],
  subunits: [
    { count: 1, label: '病案服务台', value: '病案服务台' },
    { count: 1, label: '综合病区', value: '综合病区' },
    { count: 1, label: '急救调度', value: '急救调度' },
  ],
  totalCount: entries.length,
};

const dataSource: DirectoryDataSource = {
  async getDirectoryFacets() {
    return facets;
  },
  async lookupDirectoryEntries(_groupId: string, entryIds: readonly string[]) {
    const selected = new Set(entryIds);
    return entries.filter((entry) => selected.has(entry.id));
  },
  async searchDirectory(_groupId: string, query: DirectoryQuery): Promise<DirectoryPage> {
    const search = query.q?.toLocaleLowerCase('zh-CN');
    const filtered = entries.filter((entry) => {
      if (query.campusCode !== undefined && entry.campus.code !== query.campusCode) return false;
      if (query.section !== undefined && entry.section !== query.section) return false;
      if (query.building !== undefined && entry.building !== query.building) return false;
      if (query.floor !== undefined && entry.floor !== query.floor) return false;
      if (query.department !== undefined && entry.department !== query.department) return false;
      if (query.subunit !== undefined && entry.subunit !== query.subunit) return false;
      if (query.entryKind !== undefined && entry.entryKind !== query.entryKind) return false;
      return (
        search === undefined || JSON.stringify(entry).toLocaleLowerCase('zh-CN').includes(search)
      );
    });
    return { entries: filtered, totalCount: filtered.length };
  },
};

const stateCopy = computed(() => {
  switch (props.initialState) {
    case 'disabled':
      return { body: '当前版本未开启通讯录能力，不会读取目录或号码。', title: '通讯录暂未开放' };
    case 'empty':
      return { body: '换一个搜索词或减少筛选条件，再试一次。', title: '没有匹配的通讯录条目' };
    case 'error':
      return {
        body: '目录服务暂时不可用，当前页面不会保留上一次号码结果。',
        title: '通讯录未能更新',
      };
    case 'loading':
      return { body: '正在读取院区、楼层和科室筛选项。', title: '正在查找通讯录号码' };
    default:
      return { body: '按院区、片区、楼宇、楼层、科室和单元找到正确的号码。', title: '院内通讯录' };
  }
});
</script>

<template>
  <div class="p10-directory-preview" :class="{ 'is-large-text': props.largeText }">
    <div class="preview-frame">
      <div class="preview-kicker">P10 · 组织目录</div>
      <div class="preview-title">{{ stateCopy.title }}</div>
      <div class="preview-copy">{{ stateCopy.body }}</div>
      <div v-if="props.initialState === 'ready'" class="preview-directory">
        <InternalDirectoryView
          :data-source="dataSource"
          :directory-kind="props.directoryKind"
          :group="previewGroup"
          :title="props.directoryKind === 'employee' ? '员工通讯录' : '院内通讯录'"
        />
      </div>
      <div v-else class="preview-state" :class="`state-${props.initialState}`">
        <span class="state-mark" aria-hidden="true">{{
          props.initialState === 'error' ? '!' : props.initialState === 'empty' ? '○' : '—'
        }}</span>
        <strong>{{ stateCopy.title }}</strong>
        <span>{{ stateCopy.body }}</span>
        <button v-if="props.initialState === 'error'" type="button">重新加载</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.p10-directory-preview {
  min-height: 100%;
  padding: 16px;
  box-sizing: border-box;
  color: #17202a;
  background: #f4f7fb;
}
.preview-frame {
  max-width: 1040px;
  margin: 0 auto;
}
.preview-kicker {
  color: #0a66d5;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.preview-title {
  margin-top: 4px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
}
.preview-copy {
  max-width: 560px;
  margin-top: 6px;
  color: #667386;
  font-size: 14px;
  line-height: 1.55;
}
.preview-directory {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid #dce3eb;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 30px rgb(23 32 42 / 8%);
}
.preview-state {
  display: grid;
  min-height: 310px;
  margin-top: 20px;
  padding: 26px 18px;
  place-items: center;
  align-content: center;
  gap: 9px;
  border: 1px solid #dce3eb;
  border-radius: 18px;
  background: #fff;
  text-align: center;
}
.preview-state > span:not(.state-mark) {
  max-width: 320px;
  color: #667386;
  font-size: 14px;
  line-height: 1.55;
}
.state-mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  color: #0752ad;
  background: #eaf3ff;
  font-size: 25px;
  font-weight: 700;
}
.state-error .state-mark {
  color: #a52b34;
  background: #fff0f1;
}
.preview-state button {
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 12px;
  color: #fff;
  background: #0a66d5;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.is-large-text {
  font-size: 18px;
}
.is-large-text .preview-title {
  font-size: 30px;
}
.is-large-text .preview-copy,
.is-large-text .preview-state > span:not(.state-mark) {
  font-size: 17px;
}
@media (max-width: 520px) {
  .p10-directory-preview {
    padding: 10px;
  }
  .preview-directory {
    border-radius: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
