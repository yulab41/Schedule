<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../api/client.js';
import { cloudbaseAuth } from '../auth/cloudbase.js';
import GroupSetupPanel from '../features/groups/GroupSetupPanel.vue';
import GroupSwitcher from '../features/groups/GroupSwitcher.vue';
import WorkbenchNav from '../features/layout/WorkbenchNav.vue';
import {
  getDesktopNavItems,
  getPrimaryMobileNavItems,
  getSecondaryMobileNavItems,
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

const lastGroupStorageKey = 'schedule.last-group-id';
const api = createApiClient({ auth: cloudbaseAuth });
const groups = ref<GroupSummary[]>([]);
const currentGroupId = ref<string>();
const errorMessage = ref<string>();
const isLoading = ref(false);
const activeTab = ref<WorkbenchTabId>('calendar');
const exportDialogVisible = ref(false);

const desktopItems = computed(() => getDesktopNavItems(currentGroup()?.role ?? 'member'));
const primaryItems = computed(() => getPrimaryMobileNavItems(currentGroup()?.role ?? 'member'));
const secondaryItems = computed(() => getSecondaryMobileNavItems(currentGroup()?.role ?? 'member'));

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
    errorMessage.value = getErrorMessage(error);
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

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '群组数据暂时无法加载，请稍后重试。';
}
</script>

<template>
  <section class="home-view">
    <h1>排班工作台</h1>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-loading v-else-if="isLoading" text="正在加载群组" />
    <template v-else>
      <GroupSwitcher
        :groups="groups"
        :model-value="currentGroupId"
        @update:model-value="selectGroupTab"
      />
      <section v-if="currentGroup() !== undefined" class="current-group-workbench">
        <h2>{{ currentGroup()?.name }}</h2>
        <div v-if="currentGroup()?.role !== 'member'" class="workbench-actions">
          <t-button variant="outline" size="small" @click="exportDialogVisible = true">
            导出
          </t-button>
        </div>
        <ExportDialog
          v-if="exportDialogVisible"
          v-model="exportDialogVisible"
          :group="currentGroup()!"
          @close="exportDialogVisible = false"
        />
        <div class="workbench-layout">
          <WorkbenchNav
            :active-tab="activeTab"
            :desktop-items="desktopItems"
            :primary-items="primaryItems"
            :secondary-items="secondaryItems"
            @select="activeTab = $event"
          />
          <section class="workbench-panels">
            <CalendarView v-if="activeTab === 'calendar'" :group="currentGroup()!" />
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
            <GroupSetupPanel v-if="activeTab === 'groups'" @groups-changed="refreshGroups" />
            <SchedulingConfigPanel
              v-if="activeTab === 'config' && currentGroup()?.role !== 'member'"
              :group="currentGroup()!"
            />
          </section>
        </div>
      </section>
      <GroupSetupPanel v-else @groups-changed="refreshGroups" />
    </template>
  </section>
</template>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
}

.home-view h1 {
  margin: 0 0 8px;
  font-size: var(--ui-font-size-xxl);
  font-weight: 600;
}

.current-group-workbench {
  margin: 24px 0;
}

.current-group-workbench h2 {
  margin: 0 0 12px;
  font-size: var(--ui-font-size-xl);
  font-weight: 600;
}

.workbench-actions {
  margin-bottom: 12px;
}

.workbench-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.workbench-panels {
  flex: 1;
  min-width: 0;
}

@media (max-width: 640px) {
  .workbench-layout {
    display: block;
  }

  .workbench-panels {
    padding-bottom: calc(var(--ui-layout-bottom-nav-height) + 24px);
  }
}
</style>
