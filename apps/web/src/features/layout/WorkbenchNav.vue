<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import SharedIcon from '../../components/SharedIcon.vue';
import WorkbenchNavIcon from './WorkbenchNavIcon.vue';
import type { WorkbenchNavItem, WorkbenchTabId } from './workbench-nav.js';

defineProps<{
  readonly activeTab: WorkbenchTabId;
  readonly desktopItems: readonly WorkbenchNavItem[];
  readonly forceIconMotion?: boolean;
  readonly primaryItems: readonly WorkbenchNavItem[];
  readonly secondaryItems: readonly WorkbenchNavItem[];
}>();

const emit = defineEmits<{
  (event: 'select', tabId: WorkbenchTabId): void;
  (event: 'sign-out'): void;
}>();

const desktopQuery = window.matchMedia('(min-width: 1024px)');
const isDesktop = ref(desktopQuery.matches);
const drawerVisible = ref(false);

function updateDesktop(): void {
  isDesktop.value = desktopQuery.matches;
}

function select(tabId: WorkbenchTabId): void {
  emit('select', tabId);
  drawerVisible.value = false;
}

function signOut(): void {
  drawerVisible.value = false;
  emit('sign-out');
}

onMounted(() => {
  updateDesktop();
  desktopQuery.addEventListener('change', updateDesktop);
});

onBeforeUnmount(() => {
  desktopQuery.removeEventListener('change', updateDesktop);
});
</script>

<template>
  <nav v-if="isDesktop" class="workbench-sidebar" aria-label="工作台导航">
    <button
      v-for="item in desktopItems"
      :key="item.id"
      type="button"
      class="nav-item"
      :class="{ 'is-active': item.id === activeTab }"
      :aria-current="item.id === activeTab ? 'page' : undefined"
      @click="select(item.id)"
    >
      <WorkbenchNavIcon
        :name="item.icon"
        :active="item.id === activeTab"
        :force-motion="forceIconMotion"
        :looping="item.id === activeTab"
        aria-hidden="true"
      />
      <span>{{ item.label }}</span>
    </button>
  </nav>
  <template v-else>
    <nav
      class="workbench-bottom-nav"
      aria-label="工作台导航"
      :style="{ '--mobile-nav-columns': primaryItems.length + 1 }"
    >
      <button
        v-for="item in primaryItems"
        :key="item.id"
        type="button"
        class="nav-item"
        :class="{ 'is-active': item.id === activeTab }"
        :aria-current="item.id === activeTab ? 'page' : undefined"
        @click="select(item.id)"
      >
        <WorkbenchNavIcon
          :name="item.icon"
          :active="item.id === activeTab"
          :force-motion="forceIconMotion"
          :looping="item.id === activeTab"
          aria-hidden="true"
        />
        <span>{{ item.label }}</span>
      </button>
      <button
        type="button"
        class="nav-item"
        :aria-expanded="drawerVisible"
        aria-controls="workbench-more-sheet"
        :class="{ 'is-active': secondaryItems.some((item) => item.id === activeTab) }"
        @click="drawerVisible = true"
      >
        <WorkbenchNavIcon
          name="more"
          :active="secondaryItems.some((item) => item.id === activeTab)"
          :force-motion="forceIconMotion"
          :looping="secondaryItems.some((item) => item.id === activeTab)"
          aria-hidden="true"
        />
        <span>更多</span>
      </button>
    </nav>
    <ResponsiveSheet id="workbench-more-sheet" v-model:visible="drawerVisible" title="更多功能">
      <nav class="more-nav" aria-label="更多功能导航">
        <p class="more-nav-group">群组与排班</p>
        <button
          v-for="item in secondaryItems.slice(0, 3)"
          :key="item.id"
          type="button"
          class="more-nav-item"
          :class="{ 'is-active': item.id === activeTab }"
          :aria-current="item.id === activeTab ? 'page' : undefined"
          @click="select(item.id)"
        >
          <WorkbenchNavIcon
            :name="item.icon"
            :active="item.id === activeTab"
            :force-motion="forceIconMotion"
            :looping="item.id === activeTab"
            aria-hidden="true"
          />
          <span>{{ item.label }}</span>
          <SharedIcon class="more-nav-chevron" name="chevron-right" />
        </button>
        <p v-if="secondaryItems.length > 3" class="more-nav-group">信息与管理</p>
        <button
          v-for="item in secondaryItems.slice(3)"
          :key="item.id"
          type="button"
          class="more-nav-item"
          :class="{ 'is-active': item.id === activeTab }"
          :aria-current="item.id === activeTab ? 'page' : undefined"
          @click="select(item.id)"
        >
          <WorkbenchNavIcon
            :name="item.icon"
            :active="item.id === activeTab"
            :force-motion="forceIconMotion"
            :looping="item.id === activeTab"
            aria-hidden="true"
          />
          <span>{{ item.label }}</span>
          <SharedIcon class="more-nav-chevron" name="chevron-right" />
        </button>
        <p class="more-nav-group">账号</p>
        <button type="button" class="more-nav-item is-danger" @click="signOut">
          <WorkbenchNavIcon name="logout" aria-hidden="true" />
          <span>退出登录</span>
        </button>
      </nav>
    </ResponsiveSheet>
  </template>
</template>

<style scoped>
.workbench-sidebar {
  position: sticky;
  top: calc(var(--ui-layout-header-height) + var(--ui-spacing-lg));
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 0 0 var(--ui-layout-sidebar-width);
  padding: 8px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
  align-self: start;
}

.nav-item {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 8px 12px;
  align-items: center;
  gap: 10px;
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  text-align: left;
  transition:
    color var(--ui-duration-fast) ease,
    background var(--ui-duration-fast) ease,
    transform var(--ui-icon-navigation-press-duration) ease;
}

.nav-item:hover,
.nav-item:active {
  background: var(--ui-color-primary-light);
}

.nav-item:active {
  transform: var(--ui-icon-navigation-press-transform);
}

.nav-item.is-active {
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  font-weight: var(--ui-font-weight-semibold);
}

.workbench-bottom-nav {
  position: fixed;
  z-index: var(--ui-z-index-navigation);
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(var(--mobile-nav-columns), minmax(0, 1fr));
  min-height: calc(var(--ui-layout-bottom-nav-height) + env(safe-area-inset-bottom));
  padding: 5px 3px calc(5px + env(safe-area-inset-bottom));
  background: rgb(255 255 255 / 96%);
  border-top: 1px solid var(--ui-color-border);
  box-shadow: 0 -8px 24px rgb(22 32 42 / 6%);
  backdrop-filter: blur(20px);
}

.workbench-bottom-nav .nav-item {
  min-height: var(--ui-touch-target-navigation);
  padding: 5px 2px 3px;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  text-align: center;
  font-size: var(--ui-font-size-xs);
  line-height: 1.1;
}

.more-nav {
  display: grid;
}

.more-nav-group {
  margin: 0;
  padding: 14px 4px 4px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.more-nav-item {
  display: grid;
  min-height: var(--ui-touch-target-comfortable);
  padding: 0 4px;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  gap: 10px;
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--ui-color-border);
  cursor: pointer;
  text-align: left;
}

.more-nav-item .more-nav-chevron {
  color: var(--ui-color-text-secondary);
}

.more-nav-item.is-active,
.more-nav-item.is-active svg {
  color: var(--ui-color-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.more-nav-item:active {
  background: var(--ui-color-primary-light);
}

.more-nav-item.is-danger,
.more-nav-item.is-danger svg {
  color: var(--ui-color-danger);
}

.more-nav-chevron {
  width: 20px;
  height: 20px;
  color: var(--ui-color-text-muted);
  font-size: 24px;
}

@media (min-width: 1024px) {
  .workbench-bottom-nav {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-item {
    transition: none;
  }
}
</style>
