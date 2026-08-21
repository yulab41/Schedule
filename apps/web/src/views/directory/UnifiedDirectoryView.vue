<script setup lang="ts">
import type { DirectoryKind, GroupSummary } from '@schedule/contracts';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import LucideMinimalActionIcon from '../../components/LucideMinimalActionIcon.vue';
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
const departmentMotionKey = ref(0);
const employeeTab = ref<HTMLButtonElement>();
const internalTab = ref<HTMLButtonElement>();
const peopleMotionKey = ref(0);
const modeTransitionDirection = ref<'forward' | 'backward' | undefined>();
let modeTransitionTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

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
  if (directory === activeDirectory.value) {
    return;
  }

  playDirectoryMotion(directory);
  modeTransitionDirection.value =
    activeDirectory.value === 'internal' && directory === 'employee' ? 'forward' : 'backward';
  activeDirectory.value = directory;

  if (modeTransitionTimer !== undefined) {
    globalThis.clearTimeout(modeTransitionTimer);
  }
  modeTransitionTimer = globalThis.setTimeout(() => {
    modeTransitionDirection.value = undefined;
    modeTransitionTimer = undefined;
  }, 240);
}

function playDirectoryMotion(directory: DirectoryMode): void {
  if (directory === 'internal') departmentMotionKey.value += 1;
  else peopleMotionKey.value += 1;
}

async function moveDirectoryFocus(directory: DirectoryMode): Promise<void> {
  selectDirectory(directory);
  await nextTick();
  (directory === 'internal' ? internalTab.value : employeeTab.value)?.focus();
}

onBeforeUnmount(() => {
  if (modeTransitionTimer !== undefined) {
    globalThis.clearTimeout(modeTransitionTimer);
  }
});
</script>

<template>
  <main class="unified-directory">
    <div class="directory-page-shell">
      <header class="directory-page-heading">
        <div
          class="directory-mode-rail"
          :class="{ 'is-employee': activeDirectory === 'employee' }"
          role="tablist"
          aria-label="通讯录范围"
        >
          <span class="directory-mode-indicator" aria-hidden="true" />
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
            <LucideMinimalActionIcon
              class="directory-mode-icon"
              name="department"
              :motion-key="departmentMotionKey"
            />
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
            <LucideMinimalActionIcon
              class="directory-mode-icon"
              name="people"
              :motion-key="peopleMotionKey"
            />
            <span>人员</span>
          </button>
        </div>
      </header>

      <section
        id="directory-mode-panel"
        class="directory-mode-panel"
        :class="{
          'mode-transition-forward': modeTransitionDirection === 'forward',
          'mode-transition-backward': modeTransitionDirection === 'backward',
        }"
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
  padding: 12px 20px 40px;
}

.directory-page-heading {
  display: flex;
  margin-bottom: 12px;
  align-items: center;
  justify-content: center;
}

.directory-mode-rail {
  position: relative;
  display: grid;
  width: min(100%, 360px);
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

.directory-mode-indicator {
  position: absolute;
  z-index: 0;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 5.5px);
  background: var(--directory-surface);
  border-radius: 11px;
  box-shadow:
    0 1px 2px rgb(22 32 42 / 12%),
    0 5px 16px rgb(39 58 82 / 8%);
  pointer-events: none;
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.directory-mode-rail.is-employee .directory-mode-indicator {
  transform: translateX(calc(100% + 3px));
}

.directory-mode-tab {
  position: relative;
  z-index: 1;
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
  background: transparent;
  box-shadow: none;
}

.directory-mode-tab:focus-visible {
  outline: 3px solid rgb(10 102 213 / 28%);
  outline-offset: 2px;
}

.directory-mode-tab:active {
  transform: scale(0.985);
}

.directory-mode-icon {
  --action-motion-icon-size: 18px;
  --action-motion-icon-stroke-width: 1.8;
}

.directory-mode-panel {
  min-width: 0;
}

.directory-mode-panel.mode-transition-forward :deep(.internal-directory) {
  animation: directory-mode-enter-forward 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.directory-mode-panel.mode-transition-backward :deep(.internal-directory) {
  animation: directory-mode-enter-backward 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes directory-mode-enter-forward {
  from {
    opacity: 0.55;
    transform: translateX(18px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes directory-mode-enter-backward {
  from {
    opacity: 0.55;
    transform: translateX(-18px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 700px) {
  .directory-page-shell {
    padding: 10px 14px 32px;
  }

  .directory-page-heading {
    margin-bottom: 12px;
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
  .directory-mode-indicator,
  .directory-mode-tab {
    transition: none;
  }

  .directory-mode-panel.mode-transition-forward :deep(.internal-directory),
  .directory-mode-panel.mode-transition-backward :deep(.internal-directory) {
    animation: none;
  }
}
</style>
