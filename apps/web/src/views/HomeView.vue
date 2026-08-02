<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../api/client.js';
import { cloudbaseAuth } from '../auth/cloudbase.js';
import GroupSetupPanel from '../features/groups/GroupSetupPanel.vue';
import GroupSwitcher from '../features/groups/GroupSwitcher.vue';
import MemberManager from '../features/members/MemberManager.vue';
import SchedulingConfigPanel from '../features/scheduling-config/SchedulingConfigPanel.vue';
import LeavePanel from '../features/leaves/LeavePanel.vue';
import SwapPanel from '../features/swaps/SwapPanel.vue';
import DutyAdjustmentPanel from '../features/duty-adjustments/DutyAdjustmentPanel.vue';
import EventCenterView from './events/EventCenterView.vue';
import CalendarView from './calendar/CalendarView.vue';
import ManualScheduleView from './schedules/ManualScheduleView.vue';

const lastGroupStorageKey = 'schedule.last-group-id';
const api = createApiClient({ auth: cloudbaseAuth });
const groups = ref<GroupSummary[]>([]);
const currentGroupId = ref<string>();
const errorMessage = ref<string>();
const isLoading = ref(false);
const activeTab = ref('calendar');

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
        <t-tabs v-model="activeTab">
          <t-tab-panel value="calendar" label="排班日历">
            <CalendarView :group="currentGroup()!" />
          </t-tab-panel>
          <t-tab-panel v-if="currentGroup()?.role !== 'member'" value="manual" label="手动排班">
            <ManualScheduleView :group="currentGroup()!" />
          </t-tab-panel>
          <t-tab-panel value="leave" label="请假">
            <LeavePanel :group="currentGroup()!" />
          </t-tab-panel>
          <t-tab-panel value="swap" label="换班">
            <SwapPanel :group="currentGroup()!" />
          </t-tab-panel>
          <t-tab-panel value="duty" label="加扣班">
            <DutyAdjustmentPanel :group="currentGroup()!" />
          </t-tab-panel>
          <t-tab-panel value="events" label="事件">
            <EventCenterView :group="currentGroup()!" />
          </t-tab-panel>
          <t-tab-panel value="members" label="成员">
            <MemberManager :group="currentGroup()!" @group-changed="refreshGroups" />
          </t-tab-panel>
          <t-tab-panel v-if="currentGroup()?.role !== 'member'" value="config" label="排班配置">
            <SchedulingConfigPanel :group="currentGroup()!" />
          </t-tab-panel>
        </t-tabs>
      </section>
      <GroupSetupPanel @groups-changed="refreshGroups" />
    </template>
  </section>
</template>
