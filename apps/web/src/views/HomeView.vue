<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { ExportIcon } from 'tdesign-icons-vue-next';
import { computed, onMounted, ref } from 'vue';

import { createApiClient } from '../api/client.js';
import { toUserMessage } from '../utils/user-message.js';
import { localAuth } from '../auth/local-auth.js';
import AppStatePanel from '../components/AppStatePanel.vue';
import NotificationBell from '../features/notifications/NotificationBell.vue';
import GroupSetupPanel from '../features/groups/GroupSetupPanel.vue';
import GroupSwitcher from '../features/groups/GroupSwitcher.vue';
import GuestCalendarPanel from '../features/groups/GuestCalendarPanel.vue';
import WorkbenchNav from '../features/layout/WorkbenchNav.vue';
import {
  getDesktopNavItems,
  getPrimaryMobileNavItems,
  getSecondaryMobileNavItems,
  getWorkbenchPageTitle,
  type WorkbenchTabId,
} from '../features/layout/workbench-nav.js';
import MemberManager from '../features/members/MemberManager.vue';
import SchedulingConfigPanel from '../features/scheduling-config/SchedulingConfigPanel.vue';
import LeavePanel from '../features/leaves/LeavePanel.vue';
import SwapPanel from '../features/swaps/SwapPanel.vue';
import DutyAdjustmentPanel from '../features/duty-adjustments/DutyAdjustmentPanel.vue';
import EventCenterView from './events/EventCenterView.vue';
import NotificationSettingsPanel from '../features/notifications/NotificationSettingsPanel.vue';
import StatisticsView from './statistics/StatisticsView.vue';
import ExportDialog from '../features/exports/ExportDialog.vue';
import CalendarView from './calendar/CalendarView.vue';
import ManualScheduleView from './schedules/ManualScheduleView.vue';
import PastScheduleView from './schedules/PastScheduleView.vue';
import InternalDirectoryView from './directory/InternalDirectoryView.vue';
import EmployeeDirectoryView from './directory/EmployeeDirectoryView.vue';

const emit = defineEmits<{
  (event: 'sign-out'): void;
}>();

const lastGroupStorageKey = 'schedule.last-group-id';
const api = createApiClient({ auth: localAuth });
const groups = ref<GroupSummary[]>([]);
const currentGroupId = ref<string>();
const errorMessage = ref<string>();
const isLoading = ref(false);
const activeTab = ref<WorkbenchTabId>('calendar');
const exportDialogVisible = ref(false);

const effectiveGroupRole = computed(() =>
  currentGroup()?.isDeveloperAdmin ? 'owner' : (currentGroup()?.role ?? 'member'),
);
const desktopItems = computed(() => getDesktopNavItems(effectiveGroupRole.value));
const primaryItems = computed(() => getPrimaryMobileNavItems(effectiveGroupRole.value));
const secondaryItems = computed(() => getSecondaryMobileNavItems(effectiveGroupRole.value));
const activePageTitle = computed(() => getWorkbenchPageTitle(activeTab.value));
const canExport = computed(
  () =>
    currentGroup()?.isDeveloperAdmin === true ||
    currentGroup()?.role === 'owner' ||
    currentGroup()?.role === 'administrator',
);

onMounted(() => {
  void refreshGroups();
});

async function refreshGroups(preferredGroupId?: string): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;

  try {
    const nextGroups = await api.listGroups();
    groups.value = nextGroups;
    const savedGroupId =
      preferredGroupId ?? window.localStorage.getItem(lastGroupStorageKey) ?? undefined;
    const nextGroup = nextGroups.find((group) => group.id === savedGroupId) ?? nextGroups[0];
    selectGroup(nextGroup?.id);
  } catch (error) {
    errorMessage.value = toUserMessage(error, '群组数据暂时无法加载，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

function selectGroup(groupId: string | undefined): void {
  currentGroupId.value = groupId;
  if (groupId === undefined) {
    window.localStorage.removeItem(lastGroupStorageKey);
  } else {
    window.localStorage.setItem(lastGroupStorageKey, groupId);
  }
}

function currentGroup(): GroupSummary | undefined {
  return groups.value.find((group) => group.id === currentGroupId.value);
}

function selectGroupTab(groupId: string | undefined): void {
  selectGroup(groupId);
  activeTab.value = 'calendar';
}
</script>

<template>
  <section class="home-view">
    <header class="workbench-shell-header">
      <div class="workbench-shell-heading">
        <GroupSwitcher
          v-if="groups.length > 0"
          :groups="groups"
          :model-value="currentGroupId"
          @update:model-value="selectGroupTab"
        />
        <span v-else class="shell-context">正在加载群组</span>
        <h1>{{ activePageTitle }}</h1>
      </div>
      <div class="shell-actions">
        <NotificationBell />
        <button
          v-if="canExport"
          type="button"
          class="shell-export-action"
          aria-label="导出排班"
          @click="exportDialogVisible = true"
        >
          <ExportIcon aria-hidden="true" />
          <span>导出</span>
        </button>
      </div>
    </header>
    <div class="home-body">
      <ExportDialog
        v-if="exportDialogVisible && currentGroup() !== undefined"
        v-model="exportDialogVisible"
        :group="currentGroup()!"
        @close="exportDialogVisible = false"
      />
      <AppStatePanel
        v-if="errorMessage !== undefined"
        :eyebrow="activePageTitle"
        title="群组数据没有加载完成"
        :description="errorMessage"
        tone="error"
      >
        <template #actions>
          <t-button theme="primary" @click="refreshGroups()">重新加载</t-button>
        </template>
      </AppStatePanel>
      <t-loading v-else-if="isLoading" text="正在加载群组" />
      <template v-else>
        <section v-if="currentGroup() !== undefined" class="current-group-workbench">
          <div class="workbench-layout">
            <WorkbenchNav
              :active-tab="activeTab"
              :desktop-items="desktopItems"
              :primary-items="primaryItems"
              :secondary-items="secondaryItems"
              @select="activeTab = $event"
              @sign-out="emit('sign-out')"
            />
            <section class="workbench-panels">
              <GuestCalendarPanel
                v-if="activeTab === 'calendar' && currentGroup()?.role === 'guest'"
                :group="currentGroup()!"
              />
              <CalendarView v-else-if="activeTab === 'calendar'" :group="currentGroup()!" />
              <InternalDirectoryView v-if="activeTab === 'directory'" :group="currentGroup()!" />
              <EmployeeDirectoryView
                v-if="activeTab === 'employee-directory'"
                :group="currentGroup()!"
              />
              <ManualScheduleView
                v-if="activeTab === 'manual' && currentGroup()?.role !== 'member'"
                :group="currentGroup()!"
                @navigate="activeTab = $event"
              />
              <PastScheduleView
                v-if="activeTab === 'backfill' && currentGroup()?.role !== 'member'"
                :group="currentGroup()!"
              />
              <LeavePanel
                v-if="activeTab === 'leave'"
                :group="currentGroup()!"
                @navigate="activeTab = $event"
              />
              <SwapPanel v-if="activeTab === 'swap'" :group="currentGroup()!" />
              <DutyAdjustmentPanel v-if="activeTab === 'duty'" :group="currentGroup()!" />
              <EventCenterView v-if="activeTab === 'events'" :group="currentGroup()!" />
              <NotificationSettingsPanel
                v-if="activeTab === 'notifications'"
                :group="currentGroup()!"
              />
              <StatisticsView v-if="activeTab === 'statistics'" :group="currentGroup()!" />
              <MemberManager
                v-if="activeTab === 'members'"
                :group="currentGroup()!"
                @group-changed="refreshGroups"
              />
              <GroupSetupPanel
                v-if="activeTab === 'groups'"
                :group="currentGroup()"
                @groups-changed="refreshGroups"
              />
              <SchedulingConfigPanel
                v-if="activeTab === 'config' && currentGroup()?.role !== 'member'"
                :group="currentGroup()!"
              />
            </section>
          </div>
        </section>
        <GroupSetupPanel v-else :group="undefined" @groups-changed="refreshGroups" />
      </template>
    </div>
  </section>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  min-height: 100dvh;
}

.workbench-shell-header {
  position: sticky;
  z-index: var(--ui-z-index-navigation);
  top: 0;
  display: flex;
  min-height: calc(var(--ui-layout-header-height) + env(safe-area-inset-top));
  padding: calc(12px + env(safe-area-inset-top)) 16px 10px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  background: rgb(255 255 255 / 94%);
  border-bottom: 1px solid var(--ui-color-border);
  backdrop-filter: blur(20px);
}

.workbench-shell-heading {
  min-width: 0;
  flex: 1;
}

.workbench-shell-heading h1 {
  margin: 2px 0 0;
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
  line-height: 1.25;
  letter-spacing: -0.25px;
}

.shell-context {
  display: block;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-medium);
  line-height: 15px;
}

.shell-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.shell-export-action {
  display: inline-flex;
  min-width: var(--ui-touch-target-minimum);
  min-height: var(--ui-touch-target-minimum);
  padding: 0 12px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--ui-color-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.shell-export-action svg {
  width: 20px;
  height: 20px;
}

.home-body {
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 20px 24px 28px;
}

.current-group-workbench {
  margin: 0;
}

.workbench-layout {
  display: flex;
  gap: var(--ui-spacing-lg);
  align-items: flex-start;
}

.workbench-panels {
  flex: 1;
  min-width: 0;
}

@media (max-width: 640px) {
  .workbench-shell-header {
    padding-right: 12px;
    padding-left: 12px;
  }

  .shell-actions {
    max-width: none;
    gap: 4px;
  }

  .shell-export-action {
    padding: 0;
  }

  .shell-export-action span {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .home-body {
    padding: 14px 12px 0;
  }

  .workbench-layout {
    display: block;
  }

  .workbench-panels {
    padding-bottom: calc(
      var(--ui-layout-bottom-nav-height) + env(safe-area-inset-bottom) + var(--ui-spacing-xl)
    );
  }
}
</style>
