<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { computed, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { hasDuplicateRosterName, parseRosterNames } from './roster-input.js';

const emit = defineEmits<{
  'groups-changed': [groupId: string];
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const createdGroup = ref<GroupSummary>();
const joinedGroup = ref<GroupSummary>();
const createGroupName = ref('');
const customGroupCode = ref('');
const claimCode = ref('');
const claimRealName = ref('');
const rosterNames = ref('');
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isCreating = ref(false);
const isClaiming = ref(false);
const isSavingRoster = ref(false);
const isRegeneratingCode = ref(false);

const parsedRosterNames = computed(() => parseRosterNames(rosterNames.value));

async function createGroup(): Promise<void> {
  resetMessages();
  isCreating.value = true;

  try {
    createdGroup.value = await api.createGroup({
      ...(customGroupCode.value.trim() === '' ? {} : { groupCode: customGroupCode.value.trim() }),
      name: createGroupName.value,
    });
    createGroupName.value = '';
    customGroupCode.value = '';
    emit('groups-changed', createdGroup.value.id);
    infoMessage.value = '群组已创建。请将待认领人员逐行粘贴到下方名单中。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isCreating.value = false;
  }
}

async function saveRoster(): Promise<void> {
  resetMessages();

  if (createdGroup.value === undefined) {
    return;
  }

  if (parsedRosterNames.value.length === 0) {
    errorMessage.value = '请至少输入一位待认领人员。';
    return;
  }

  if (hasDuplicateRosterName(parsedRosterNames.value)) {
    errorMessage.value = '待认领名单中不能有重复姓名。';
    return;
  }

  isSavingRoster.value = true;
  try {
    const result = await api.addRosterEntries(createdGroup.value.id, {
      realNames: parsedRosterNames.value,
    });
    rosterNames.value = '';
    infoMessage.value = `已添加 ${result.added} 位成员（未认领状态，已可转正排班；成员用真实姓名和群组码认领后自动绑定账号）。`;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isSavingRoster.value = false;
  }
}

async function regenerateCode(): Promise<void> {
  resetMessages();

  if (createdGroup.value === undefined) {
    return;
  }

  isRegeneratingCode.value = true;
  try {
    createdGroup.value = await api.regenerateGroupCode(createdGroup.value.id, {});
    infoMessage.value = '群组码已更新，旧码立即失效。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isRegeneratingCode.value = false;
  }
}

async function claimGroup(): Promise<void> {
  resetMessages();
  isClaiming.value = true;

  try {
    const result = await api.claimGroup({
      groupCode: claimCode.value.trim(),
      realName: claimRealName.value.trim(),
    });
    claimCode.value = '';
    claimRealName.value = '';

    if (result.status === 'claimed') {
      joinedGroup.value = result.group;
      emit('groups-changed', result.group.id);
      infoMessage.value = `已加入“${result.group.name}”。`;
      return;
    }

    infoMessage.value = '已向管理员提交添加人员请求，群组排班暂不会开放。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isClaiming.value = false;
  }
}

function resetMessages(): void {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
}
</script>

<template>
  <section class="group-setup-panel">
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />

    <t-card title="创建群组" class="group-card">
      <form @submit.prevent="createGroup">
        <t-form-item label="群组名称" name="name">
          <t-input v-model="createGroupName" maxlength="100" required />
        </t-form-item>
        <t-form-item label="自定义四位群组码（可选）" name="groupCode">
          <t-input v-model="customGroupCode" inputmode="numeric" maxlength="4" pattern="\d{4}" />
        </t-form-item>
        <t-button theme="primary" type="submit" :loading="isCreating">创建群组</t-button>
      </form>
    </t-card>

    <t-card v-if="createdGroup !== undefined" title="待认领人员" class="group-card">
      <p>
        当前群组码：<strong>{{ createdGroup.groupCode }}</strong>
      </p>
      <form @submit.prevent="saveRoster">
        <t-form-item label="每行一个真实姓名" name="rosterNames">
          <t-textarea v-model="rosterNames" :autosize="{ minRows: 4, maxRows: 12 }" />
        </t-form-item>
        <t-space>
          <t-button theme="primary" type="submit" :loading="isSavingRoster">添加名单</t-button>
          <t-button variant="outline" :loading="isRegeneratingCode" @click="regenerateCode">
            重新生成群组码
          </t-button>
        </t-space>
      </form>
    </t-card>

    <t-card title="加入群组" class="group-card">
      <form @submit.prevent="claimGroup">
        <t-form-item label="真实姓名" name="claimRealName">
          <t-input
            v-model="claimRealName"
            maxlength="100"
            placeholder="请输入您的真实姓名"
            required
          />
        </t-form-item>
        <t-form-item label="四位群组码" name="claimCode">
          <t-input v-model="claimCode" inputmode="numeric" maxlength="4" pattern="\d{4}" required />
        </t-form-item>
        <t-button theme="primary" type="submit" :loading="isClaiming">认领并加入</t-button>
      </form>
      <p v-if="joinedGroup !== undefined" class="joined-group">已加入：{{ joinedGroup.name }}</p>
    </t-card>
  </section>
</template>
