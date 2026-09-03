<script setup lang="ts">
import type {
  DirectoryEntry,
  DirectoryFacetOption,
  DirectoryFacetSnapshot,
  DirectoryPage,
  DirectoryQuery,
  GroupSummary,
} from '@schedule/contracts';

import type { DirectoryDataSource } from '../../views/directory/InternalDirectoryView.vue';
import UnifiedDirectoryView from '../../views/directory/UnifiedDirectoryView.vue';

type PreviewMode = 'internal' | 'employee';

const props = withDefaults(
  defineProps<{
    readonly mode?: PreviewMode;
  }>(),
  { mode: 'internal' },
);

const previewGroup: GroupSummary = {
  groupCode: 'preview',
  id: 'storybook-compact-directory-group',
  name: '示例医疗中心',
  role: 'member',
  version: 1,
};

const internalEntries: readonly DirectoryEntry[] = [
  {
    building: '门诊楼',
    campus: { code: 'main', name: '本部院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '0754-00000001',
        id: '51000000-0000-4000-8000-000000000001',
        internalExtension: '6101',
        isPrimary: true,
        type: 'voice',
      },
    ],
    department: '医疗服务部',
    displayOrder: 1,
    entryKind: 'department',
    floor: '5楼',
    id: '50000000-0000-4000-8000-000000000001',
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
        fullNumber: '0754-00000002',
        id: '51000000-0000-4000-8000-000000000002',
        internalExtension: '6202',
        isPrimary: true,
        type: 'voice',
      },
    ],
    department: '内科部',
    displayOrder: 2,
    entryKind: 'department',
    floor: '6楼',
    id: '50000000-0000-4000-8000-000000000002',
    room: '护士站',
    section: '住院诊疗区',
    subunit: '综合病区',
  },
];

const employeeEntries: readonly DirectoryEntry[] = [
  {
    building: '临床科室',
    campus: { code: 'hospital', name: '示例肿瘤医院' },
    contactName: '林安然',
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '130-0000-1001',
        id: '52000000-0000-4000-8000-000000000001',
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
    id: '50000000-0000-4000-8000-000000000101',
    section: '医疗系统',
    subunit: '化疗一区',
  },
  {
    building: '医技科室',
    campus: { code: 'hospital', name: '示例肿瘤医院' },
    contactName: '周清和',
    contacts: [
      {
        displayOrder: 0,
        fullNumber: '130-0000-1002',
        id: '52000000-0000-4000-8000-000000000002',
        internalExtension: '661002',
        isPrimary: true,
        type: 'mobile',
      },
    ],
    department: '医学影像科',
    displayOrder: 2,
    employeeCode: 'g0003',
    entryKind: 'person',
    floor: '影像系统',
    id: '50000000-0000-4000-8000-000000000102',
    section: '医技系统',
    subunit: 'CT室',
  },
];

function facetOptions(values: readonly (string | undefined)[]): DirectoryFacetOption[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ count, label: value, value }));
}

function createFacets(entries: readonly DirectoryEntry[]): DirectoryFacetSnapshot {
  const campuses = new Map<string, DirectoryFacetOption>();
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
    publishedImportVersion: 'storybook-compact-v1',
    sections: facetOptions(entries.map((entry) => entry.section)),
    subunits: facetOptions(entries.map((entry) => entry.subunit)),
    totalCount: entries.length,
  };
}

function createDataSource(entries: readonly DirectoryEntry[]): DirectoryDataSource {
  const facets = createFacets(entries);
  return {
    async getDirectoryFacets() {
      return facets;
    },
    async lookupDirectoryEntries(_groupId: string, entryIds: readonly string[]) {
      const selectedIds = new Set(entryIds);
      return entries.filter((entry) => selectedIds.has(entry.id));
    },
    async searchDirectory(_groupId: string, query: DirectoryQuery): Promise<DirectoryPage> {
      const normalized = query.q?.toLocaleLowerCase('zh-CN');
      const filtered = entries.filter((entry) => {
        if (query.campusCode !== undefined && entry.campus.code !== query.campusCode) return false;
        if (query.department !== undefined && entry.department !== query.department) return false;
        if (query.entryKind !== undefined && entry.entryKind !== query.entryKind) return false;
        if (query.floor !== undefined && entry.floor !== query.floor) return false;
        if (query.section !== undefined && entry.section !== query.section) return false;
        if (query.subunit !== undefined && entry.subunit !== query.subunit) return false;
        return (
          normalized === undefined ||
          JSON.stringify(entry).toLocaleLowerCase('zh-CN').includes(normalized)
        );
      });
      return { entries: filtered, totalCount: filtered.length };
    },
  };
}

const internalDataSource = createDataSource(internalEntries);
const employeeDataSource = createDataSource(employeeEntries);
</script>

<template>
  <div class="compact-directory-stage">
    <p class="visually-hidden" role="status">仅用于 Storybook 预览，不会写入生产数据。</p>
    <UnifiedDirectoryView
      :employee-data-source="employeeDataSource"
      :group="previewGroup"
      :initial-directory="props.mode"
      :internal-data-source="internalDataSource"
    />
  </div>
</template>

<style scoped>
.compact-directory-stage {
  --compact-blue: #0a66d5;
  --compact-ink: #17202a;
  --compact-muted: #6b7788;
  --compact-border: #e2e8f0;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 0 28px;
  color: var(--compact-ink);
  background: #f5f7fb;
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.compact-directory-stage .visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.compact-directory-stage :deep(.directory-page-shell) {
  width: min(100%, 1024px);
  padding: 12px 16px 32px;
}

.compact-directory-stage :deep(.directory-page-heading) {
  display: block;
  margin-bottom: 12px;
}

.compact-directory-stage :deep(.directory-mode-rail) {
  width: min(100%, 360px);
  margin-inline: auto;
  box-shadow: none;
}

.compact-directory-stage :deep(.directory-wayfinding) {
  padding: 12px;
  background: #fff;
  border-color: var(--compact-border);
  border-radius: 16px;
  box-shadow: 0 6px 18px rgb(25 42 67 / 4%);
}

.compact-directory-stage :deep(.wayfinding-header) {
  padding: 0 2px 8px;
}

.compact-directory-stage :deep(.wayfinding-header p) {
  color: var(--compact-ink);
  font-size: 14px;
  letter-spacing: -0.01em;
}

.compact-directory-stage :deep(.wayfinding-ribbon) {
  gap: 6px;
}

.compact-directory-stage :deep(.wayfinding-stop) {
  min-height: 46px;
  background: #f7f9fc;
  border-color: transparent;
  border-radius: 11px;
}

.compact-directory-stage :deep(.wayfinding-stop:hover),
.compact-directory-stage :deep(.wayfinding-stop.is-selected) {
  background: #f0f6ff;
  border-color: #cfe1f7;
}

.compact-directory-stage :deep(.directory-search) {
  min-height: 50px;
  border-color: var(--compact-border);
  border-radius: 14px;
  box-shadow: none;
}

.compact-directory-stage :deep(.directory-search input) {
  font-size: 15px;
}

@media (max-width: 760px) {
  .compact-directory-stage :deep(.directory-page-shell) {
    padding-inline: 12px;
  }

  .compact-directory-stage :deep(.directory-mode-rail) {
    width: 100%;
  }

  .compact-directory-stage :deep(.directory-wayfinding) {
    margin-inline: 0;
    border-right: 1px solid var(--compact-border);
    border-left: 1px solid var(--compact-border);
    border-radius: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .compact-directory-stage :deep(*) {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
