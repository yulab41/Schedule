<script setup lang="ts">
import type { DirectoryKind, GroupSummary } from '@schedule/contracts';
import { computed, nextTick, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import InternalDirectoryView, { type DirectoryDataSource } from './InternalDirectoryView.vue';

type DirectoryMode = 'internal' | 'employee';

const props = withDefaults(
  defineProps<{
    readonly employeeDataSource?: DirectoryDataSource | undefined;
    readonly group: GroupSummary;
    readonly initialDirectory?: DirectoryMode;
    readonly internalDataSource?: DirectoryDataSource | undefined;
  }>(),
  {
    employeeDataSource: undefined,
    initialDirectory: 'internal',
    internalDataSource: undefined,
  },
);

const api = createApiClient({ auth: localAuth });
const internalDirectoryDataSource: DirectoryDataSource = {
  getDirectoryFacets: (groupId) => api.getDirectoryFacets(groupId),
  lookupDirectoryEntries: (groupId, entryIds) => api.lookupDirectoryEntries(groupId, entryIds),
  searchDirectory: (groupId, query) => api.searchDirectory(groupId, query),
};
const employeeDirectoryDataSource: DirectoryDataSource = {
  getDirectoryFacets: (groupId) => api.getEmployeeDirectoryFacets(groupId),
  lookupDirectoryEntries: (groupId, entryIds) =>
    api.lookupEmployeeDirectoryEntries(groupId, entryIds),
  searchDirectory: (groupId, query) => api.searchEmployeeDirectory(groupId, query),
};

const activeDirectory = ref<DirectoryMode>(props.initialDirectory);
const employeeTab = ref<HTMLButtonElement>();
const internalTab = ref<HTMLButtonElement>();

const activeConfiguration = computed<{
  dataSource: DirectoryDataSource;
  directoryKind: DirectoryKind;
  title: string;
}>(() =>
  activeDirectory.value === 'internal'
    ? {
        dataSource: props.internalDataSource ?? internalDirectoryDataSource,
        directoryKind: 'internal',
        title: '科室通讯录',
      }
    : {
        dataSource: props.employeeDataSource ?? employeeDirectoryDataSource,
        directoryKind: 'employee',
        title: '人员通讯录',
      },
);

watch(
  () => props.initialDirectory,
  (directory) => {
    activeDirectory.value = directory;
  },
);

function selectDirectory(directory: DirectoryMode): void {
  activeDirectory.value = directory;
}

async function moveDirectoryFocus(directory: DirectoryMode): Promise<void> {
  selectDirectory(directory);
  await nextTick();
  (directory === 'internal' ? internalTab.value : employeeTab.value)?.focus();
}
</script>

<template>
  <main class="unified-directory">
    <div class="directory-page-shell">
      <header class="directory-page-heading">
        <div>
          <p class="directory-eyebrow">院内协作</p>
          <h1>通讯录</h1>
          <p>查科室分机，或按姓名找到人员。</p>
        </div>

        <div class="directory-mode-rail" role="tablist" aria-label="通讯录范围">
          <button
            id="directory-tab-internal"
            ref="internalTab"
            type="button"
            class="directory-mode-tab"
            :class="{ 'is-active': activeDirectory === 'internal' }"
            role="tab"
            :aria-selected="activeDirectory === 'internal'"
            aria-controls="directory-mode-panel"
            :tabindex="activeDirectory === 'internal' ? 0 : -1"
            @click="selectDirectory('internal')"
            @keydown.left.prevent="moveDirectoryFocus('employee')"
            @keydown.right.prevent="moveDirectoryFocus('employee')"
            @keydown.end.prevent="moveDirectoryFocus('employee')"
            @keydown.home.prevent="moveDirectoryFocus('internal')"
          >
            <span class="department-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>科室</span>
          </button>
          <button
            id="directory-tab-employee"
            ref="employeeTab"
            type="button"
            class="directory-mode-tab"
            :class="{ 'is-active': activeDirectory === 'employee' }"
            role="tab"
            :aria-selected="activeDirectory === 'employee'"
            aria-controls="directory-mode-panel"
            :tabindex="activeDirectory === 'employee' ? 0 : -1"
            @click="selectDirectory('employee')"
            @keydown.left.prevent="moveDirectoryFocus('internal')"
            @keydown.right.prevent="moveDirectoryFocus('internal')"
            @keydown.end.prevent="moveDirectoryFocus('employee')"
            @keydown.home.prevent="moveDirectoryFocus('internal')"
          >
            <span class="people-mark" aria-hidden="true">
              <i />
              <i />
              <b />
            </span>
            <span>人员</span>
          </button>
        </div>
      </header>

      <section
        id="directory-mode-panel"
        class="directory-mode-panel"
        role="tabpanel"
        :aria-labelledby="`directory-tab-${activeDirectory}`"
      >
        <KeepAlive>
          <InternalDirectoryView
            :key="activeDirectory"
            :data-source="activeConfiguration.dataSource"
            :directory-kind="activeConfiguration.directoryKind"
            :group="group"
            :title="activeConfiguration.title"
          />
        </KeepAlive>
      </section>
    </div>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.unified-directory {
  --directory-accent: #0a66d5;
  --directory-accent-soft: #eaf3ff;
  --directory-canvas: #f7f9fc;
  --directory-surface: #ffffff;
  --directory-text: #17202a;
  --directory-muted: #667386;
  --directory-border: #dce3eb;
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--directory-text);
  background:
    radial-gradient(circle at 50% -120px, rgb(10 102 213 / 8%), transparent 360px),
    var(--directory-canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.directory-page-shell {
  width: min(100%, 1060px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 28px 20px 48px;
}

.directory-page-heading {
  display: grid;
  margin-bottom: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  align-items: end;
  gap: 28px;
}

.directory-eyebrow {
  margin: 0 0 5px;
  color: var(--directory-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.directory-page-heading h1 {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Segoe UI', sans-serif;
  font-size: clamp(32px, 4vw, 42px);
  font-weight: 720;
  letter-spacing: -0.035em;
  line-height: 1.06;
}

.directory-page-heading > div:first-child > p:last-child {
  margin: 8px 0 0;
  color: var(--directory-muted);
  font-size: 14px;
}

.directory-mode-rail {
  position: relative;
  display: grid;
  min-width: 0;
  padding: 4px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  background: rgb(224 229 236 / 82%);
  border: 1px solid rgb(203 212 223 / 88%);
  border-radius: 15px;
  box-shadow:
    inset 0 1px 2px rgb(42 55 72 / 8%),
    0 10px 30px rgb(43 59 80 / 5%);
  backdrop-filter: blur(18px) saturate(1.18);
}

.directory-mode-tab {
  display: inline-flex;
  min-width: 0;
  min-height: 44px;
  padding: 0 16px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #586678;
  background: transparent;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  transition:
    color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.directory-mode-tab.is-active {
  color: var(--directory-accent);
  background: var(--directory-surface);
  box-shadow:
    0 1px 2px rgb(22 32 42 / 12%),
    0 5px 16px rgb(39 58 82 / 8%);
}

.directory-mode-tab:focus-visible {
  outline: 3px solid rgb(10 102 213 / 28%);
  outline-offset: 2px;
}

.directory-mode-tab:active {
  transform: scale(0.985);
}

.department-mark {
  display: grid;
  width: 17px;
  height: 17px;
  grid-template-columns: repeat(2, 6px);
  grid-template-rows: repeat(2, 6px);
  place-content: center;
  gap: 2px;
}

.department-mark i {
  display: block;
  border: 1.6px solid currentcolor;
  border-radius: 2px;
}

.people-mark {
  position: relative;
  width: 18px;
  height: 17px;
}

.people-mark i {
  position: absolute;
  top: 1px;
  width: 7px;
  height: 7px;
  border: 1.6px solid currentcolor;
  border-radius: 50%;
}

.people-mark i:first-child {
  left: 1px;
}

.people-mark i:nth-child(2) {
  right: 1px;
}

.people-mark b {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 7px;
  border: 1.6px solid currentcolor;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  border-bottom: 0;
}

.directory-mode-panel {
  min-width: 0;
}

@media (max-width: 700px) {
  .directory-page-shell {
    padding: 22px 14px 38px;
  }

  .directory-page-heading {
    margin-bottom: 16px;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .directory-page-heading h1 {
    font-size: 34px;
  }

  .directory-mode-rail {
    width: 100%;
  }
}

@media (max-width: 340px) {
  .directory-page-shell {
    padding-inline: 10px;
  }

  .directory-mode-tab {
    padding-inline: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .directory-mode-tab {
    transition: none;
  }
}
</style>
