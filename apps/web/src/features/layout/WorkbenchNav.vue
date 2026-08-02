<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import type { WorkbenchNavItem, WorkbenchTabId } from './workbench-nav.js';

defineProps<{
  readonly activeTab: WorkbenchTabId;
  readonly desktopItems: readonly WorkbenchNavItem[];
  readonly primaryItems: readonly WorkbenchNavItem[];
  readonly secondaryItems: readonly WorkbenchNavItem[];
}>();

const emit = defineEmits<{
  (event: 'select', tabId: WorkbenchTabId): void;
}>();

const isDesktop = ref(false);
const drawerVisible = ref(false);
const desktopQuery = window.matchMedia('(min-width: 1024px)');

function updateDesktop(): void {
  isDesktop.value = desktopQuery.matches;
}

function select(tabId: WorkbenchTabId): void {
  emit('select', tabId);
  drawerVisible.value = false;
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
      {{ item.label }}
    </button>
  </nav>
  <template v-else>
    <nav class="workbench-bottom-nav" aria-label="工作台导航">
      <button
        v-for="item in primaryItems"
        :key="item.id"
        type="button"
        class="nav-item"
        :class="{ 'is-active': item.id === activeTab }"
        :aria-current="item.id === activeTab ? 'page' : undefined"
        @click="select(item.id)"
      >
        {{ item.label }}
      </button>
      <button
        type="button"
        class="nav-item"
        :aria-expanded="drawerVisible"
        :class="{ 'is-active': secondaryItems.some((item) => item.id === activeTab) }"
        @click="drawerVisible = true"
      >
        更多
      </button>
    </nav>
    <t-drawer
      v-model:visible="drawerVisible"
      :footer="false"
      header="更多功能"
      placement="right"
      size="280px"
    >
      <nav class="drawer-nav" aria-label="更多功能导航">
        <button
          v-for="item in secondaryItems"
          :key="item.id"
          type="button"
          class="nav-item"
          :class="{ 'is-active': item.id === activeTab }"
          :aria-current="item.id === activeTab ? 'page' : undefined"
          @click="select(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>
    </t-drawer>
  </template>
</template>

<style scoped>
.workbench-sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 0 0 var(--ui-layout-sidebar-width);
  padding: 4px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 8px;
  align-self: start;
  position: sticky;
  top: 16px;
}

.nav-item {
  min-height: var(--app-nav-item-height);
  padding: 8px 12px;
  color: var(--ui-color-text-secondary);
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--ui-font-size-md);
  font-weight: 500;
  text-align: left;
}

.nav-item:hover {
  background: var(--ui-color-primary-light);
}

.nav-item.is-active {
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  font-weight: 600;
}

.workbench-bottom-nav {
  position: fixed;
  z-index: var(--ui-z-index-sticky);
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-height: calc(var(--ui-layout-bottom-nav-height) + env(safe-area-inset-bottom));
  padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
  background: var(--ui-color-surface);
  border-top: 1px solid var(--ui-color-border);
  box-shadow: 0 -2px 8px rgb(17 24 39 / 6%);
}

.workbench-bottom-nav .nav-item {
  padding: 8px 4px;
  text-align: center;
  font-size: var(--ui-font-size-sm);
}

.drawer-nav {
  display: grid;
  gap: 4px;
}

@media (min-width: 1024px) {
  .workbench-bottom-nav {
    display: none;
  }
}
</style>
