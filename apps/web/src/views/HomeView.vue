<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../api/client.js';
import { cloudbaseAuth } from '../auth/cloudbase.js';
import GroupSetupPanel from '../features/groups/GroupSetupPanel.vue';
import GroupSwitcher from '../features/groups/GroupSwitcher.vue';
import MemberManager from '../features/members/MemberManager.vue';
import SchedulingConfigPanel from '../features/scheduling-config/SchedulingConfigPanel.vue';

const lastGroupStorageKey = 'schedule.last-group-id';
const api = createApiClient({ auth: cloudbaseAuth });
const groups = ref<GroupSummary[]>([]);
const currentGroupId = ref<string>();
const errorMessage = ref<string>();
const isLoading = ref(false);

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
        @update:model-value="selectGroup"
      />
      <section v-if="currentGroup() !== undefined" class="current-group-workbench">
        <h2>{{ currentGroup()?.name }}</h2>
        <MemberManager :group="currentGroup()!" @group-changed="refreshGroups" />
        <SchedulingConfigPanel v-if="currentGroup()?.role !== 'member'" :group="currentGroup()!" />
      </section>
      <GroupSetupPanel @groups-changed="refreshGroups" />
    </template>
  </section>
</template>
