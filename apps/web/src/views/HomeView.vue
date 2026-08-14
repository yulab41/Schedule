<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { ExportIcon } from 'tdesign-icons-vue-next';
import { computed, onMounted, ref } from 'vue';

import { createApiClient } from '../api/client.js';
import { toUserMessage } from '../utils/user-message.js';
import { localAuth } from '../auth/local-auth.js';
import GroupSetupPanel from '../features/groups/GroupSetupPanel.vue';
import GroupSwitcher from '../features/groups/GroupSwitcher.vue';
import GuestCalendarPanel from '../features/groups/GuestCalendarPanel.vue';
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
    <header class="home-heading">
      <p>群组排班</p>
      <h1>排班工作台</h1>
      <span>查看排班、处理申请并跟进班次变更。</span>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-loading v-else-if="isLoading" text="正在加载群组" />
    <template v-else>
      <GroupSwitcher
        :groups="groups"
        :model-value="currentGroupId"
        @update:model-value="selectGroupTab"
      />
      <section v-if="currentGroup() !== undefined" class="current-group-workbench">
        <header class="workbench-context-heading">
          <div>
            <p>当前工作群组</p>
            <h2>{{ currentGroup()?.name }}</h2>
          </div>
          <div
            v-if="currentGroup()?.role === 'owner' || currentGroup()?.role === 'administrator'"
            class="workbench-actions"
          >
            <t-button variant="outline" @click="exportDialogVisible = true">
              <template #icon><ExportIcon /></template>
              导出
            </t-button>
          </div>
        </header>
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
            @sign-out="emit('sign-out')"
          />
          <section class="workbench-panels">
            <GuestCalendarPanel
              v-if="activeTab === 'calendar' && currentGroup()?.role === 'guest'"
              :group="currentGroup()!"
            />
            <CalendarView v-else-if="activeTab === 'calendar'" :group="currentGroup()!" />
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
  </section>
</template>

<style scoped>
.home-view {
  max-width: 1280px;
  margin: 0 auto;
}

.home-heading {
  margin-bottom: var(--ui-spacing-lg);
}

.home-heading p,
.workbench-context-heading p {
  margin: 0;
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.home-heading h1 {
  margin: 4px 0 6px;
  font-size: var(--ui-font-size-xxl);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-title);
  letter-spacing: -0.6px;
}

.home-heading span {
  color: var(--ui-color-text-secondary);
}

.current-group-workbench {
  margin: var(--ui-spacing-xl) 0 0;
}

.workbench-context-heading {
  display: flex;
  margin-bottom: var(--ui-spacing-md);
  align-items: end;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.workbench-context-heading h2 {
  margin: 3px 0 0;
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.workbench-actions {
  flex: 0 0 auto;
}

.workbench-actions :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
  border-radius: var(--ui-radius-small);
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
  .home-heading {
    margin-bottom: var(--ui-spacing-md);
  }

  .workbench-context-heading {
    align-items: center;
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
