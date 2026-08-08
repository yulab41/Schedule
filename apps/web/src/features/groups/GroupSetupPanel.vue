<script setup lang="ts">
import type { DissolvedGroup, GroupCatalogEntry, GroupSummary } from '@schedule/contracts';
import { computed, onMounted, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import { hasDuplicateRosterName, parseRosterNames } from './roster-input.js';

const props = defineProps<{
  readonly group: GroupSummary | undefined;
}>();

const emit = defineEmits<{
  'groups-changed': [groupId?: string];
}>();

const api = createApiClient({ auth: localAuth });
const createdGroup = ref<GroupSummary>();
const createGroupName = ref('');
const customGroupCode = ref('');
const rosterNames = ref('');
const catalog = ref<GroupCatalogEntry[]>([]);
const joinGroupId = ref('');
const claimCode = ref('');
const claimRealName = ref('');
const groupName = ref('');
const dissolvedGroups = ref<DissolvedGroup[]>([]);
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isCreating = ref(false);
const isSavingRoster = ref(false);
const isJoining = ref(false);
const isLeaving = ref(false);
const isSavingName = ref(false);
const isRegeneratingCode = ref(false);
const isDissolving = ref(false);
const isRestoring = ref(false);
const leaveConfirmVisible = ref(false);
const dissolveConfirmVisible = ref(false);

const parsedRosterNames = computed(() => parseRosterNames(rosterNames.value));
const catalogOptions = computed(() =>
  catalog.value.map((entry) => ({ label: catalogLabel(entry), value: entry.id })),
);
const selectedCatalogEntry = computed(() =>
  catalog.value.find((entry) => entry.id === joinGroupId.value),
);

watch(
  () => props.group?.id,
  () => {
    groupName.value = props.group?.name ?? '';
    void loadDissolved();
  },
  { immediate: true },
);

onMounted(() => {
  void loadCatalog();
});

async function loadCatalog(): Promise<void> {
  try {
    catalog.value = await api.listGroupCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '群组列表暂时无法加载，请稍后重试。');
  }
}

async function loadDissolved(): Promise<void> {
  if (props.group?.role !== 'owner') {
    dissolvedGroups.value = [];
    return;
  }
  try {
    dissolvedGroups.value = await api.listDissolvedGroups();
  } catch {
    dissolvedGroups.value = [];
  }
}

function catalogLabel(entry: GroupCatalogEntry): string {
  if (entry.relation === 'active-member' || entry.relation === 'active-guest') {
    return `${entry.name}（已加入）`;
  }
  if (entry.relation === 'left-member') {
    return `${entry.name}（未认领成员身份）`;
  }
  return entry.name;
}

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

async function joinSelectedGroup(): Promise<void> {
  resetMessages();
  const entry = selectedCatalogEntry.value;
  if (entry === undefined) {
    errorMessage.value = '请先选择要加入的群组。';
    return;
  }
  if (entry.relation === 'active-member' || entry.relation === 'active-guest') {
    errorMessage.value = '您已经加入该群组。';
    return;
  }
  if (claimCode.value.trim() === '') {
    errorMessage.value = '请输入四位群组码。';
    return;
  }

  isJoining.value = true;
  try {
    const result = await api.claimGroup({
      groupCode: claimCode.value.trim(),
      ...(claimRealName.value.trim() === '' ? {} : { realName: claimRealName.value.trim() }),
    });
    if (result.status === 'claimed') {
      resetJoinForm();
      infoMessage.value = `已加入“${result.group.name}”。`;
      emit('groups-changed', result.group.id);
    } else {
      infoMessage.value = '已向管理员提交添加人员请求，群组排班暂不会开放。';
    }
    await loadCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isJoining.value = false;
  }
}

async function leaveCurrentGroup(): Promise<void> {
  resetMessages();
  if (props.group === undefined) {
    return;
  }
  leaveConfirmVisible.value = false;
  isLeaving.value = true;
  try {
    await api.leaveGroup(props.group.id);
    infoMessage.value = '已退出该群组。';
    emit('groups-changed');
    await loadCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isLeaving.value = false;
  }
}

async function saveGroupName(): Promise<void> {
  resetMessages();
  if (props.group === undefined || props.group.role !== 'owner') {
    return;
  }
  isSavingName.value = true;
  try {
    await api.updateGroupName(props.group.id, { name: groupName.value });
    infoMessage.value = '群组名称已更新。';
    emit('groups-changed', props.group.id);
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isSavingName.value = false;
  }
}

async function regenerateCode(): Promise<void> {
  resetMessages();
  if (props.group === undefined || props.group.role !== 'owner') {
    return;
  }
  isRegeneratingCode.value = true;
  try {
    await api.regenerateGroupCode(props.group.id, {});
    infoMessage.value = '群组码已更新，旧码立即失效。';
    emit('groups-changed', props.group.id);
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isRegeneratingCode.value = false;
  }
}

async function dissolveCurrentGroup(): Promise<void> {
  resetMessages();
  if (props.group === undefined) {
    return;
  }
  dissolveConfirmVisible.value = false;
  isDissolving.value = true;
  try {
    await api.deleteGroup(props.group.id);
    infoMessage.value = '群组已解散，30 天内可在下方恢复。';
    emit('groups-changed');
    await loadDissolved();
    await loadCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isDissolving.value = false;
  }
}

async function restoreGroup(groupId: string): Promise<void> {
  resetMessages();
  isRestoring.value = true;
  try {
    await api.restoreGroup(groupId);
    infoMessage.value = '群组已恢复。';
    emit('groups-changed', groupId);
    await loadDissolved();
    await loadCatalog();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  } finally {
    isRestoring.value = false;
  }
}

function resetJoinForm(): void {
  joinGroupId.value = '';
  claimCode.value = '';
  claimRealName.value = '';
}

function resetMessages(): void {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
}

function roleLabel(role: GroupSummary['role']): string {
  if (role === 'owner') {
    return '群主';
  }
  if (role === 'administrator') {
    return '管理员';
  }
  return role === 'guest' ? '访客' : '成员';
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
        当前群组码：<strong>{{ createdGroup.groupCode ?? '' }}</strong>
      </p>
      <form @submit.prevent="saveRoster">
        <t-form-item label="每行一个真实姓名" name="rosterNames">
          <t-textarea v-model="rosterNames" :autosize="{ minRows: 4, maxRows: 12 }" />
        </t-form-item>
        <t-button theme="primary" type="submit" :loading="isSavingRoster">添加名单</t-button>
      </form>
    </t-card>

    <t-card title="加入其他群组" class="group-card">
      <t-form-item label="选择群组" name="joinGroup">
        <t-select v-model="joinGroupId" :options="catalogOptions" placeholder="请选择群组" />
      </t-form-item>
      <p v-if="selectedCatalogEntry?.relation === 'left-member'" class="join-hint">
        该群有您的未认领成员身份，请输入群组码重新加入。
      </p>
      <t-form-item label="四位群组码" name="joinCode">
        <t-input v-model="claimCode" inputmode="numeric" maxlength="4" pattern="\d{4}" />
      </t-form-item>
      <t-form-item label="真实姓名（可选）" name="joinRealName">
        <t-input v-model="claimRealName" maxlength="100" placeholder="默认使用您的真实姓名" />
      </t-form-item>
      <t-button theme="primary" :loading="isJoining" @click="joinSelectedGroup">加入群组</t-button>
    </t-card>

    <t-card v-if="props.group !== undefined" title="当前群组操作" class="group-card">
      <p>当前群组：{{ props.group.name }}（{{ roleLabel(props.group.role) }}）</p>
      <template v-if="props.group.role === 'owner'">
        <t-form-item label="群组名称" name="groupName">
          <t-input v-model="groupName" maxlength="100" />
        </t-form-item>
        <t-space>
          <t-button variant="outline" :loading="isSavingName" @click="saveGroupName">
            保存名称
          </t-button>
          <t-button variant="outline" :loading="isRegeneratingCode" @click="regenerateCode">
            重新生成群组码
          </t-button>
          <t-button theme="danger" variant="outline" @click="dissolveConfirmVisible = true">
            解散群组
          </t-button>
        </t-space>
      </template>
      <t-button v-else variant="outline" @click="leaveConfirmVisible = true">退出群组</t-button>
    </t-card>

    <t-card
      v-if="props.group?.role === 'owner' && dissolvedGroups.length > 0"
      title="已解散群组（30 天内可恢复）"
      class="group-card"
    >
      <div v-for="dissolvedGroup in dissolvedGroups" :key="dissolvedGroup.id" class="dissolved-row">
        <span>{{ dissolvedGroup.name }}</span>
        <t-button
          size="small"
          variant="outline"
          :loading="isRestoring"
          @click="restoreGroup(dissolvedGroup.id)"
        >
          恢复
        </t-button>
      </div>
    </t-card>

    <t-dialog v-model:visible="leaveConfirmVisible" header="退出群组" :footer="false" width="420px">
      <p>
        退出后：历史排班和联系方式仍保留，名单中您的身份变为“未认领”，不再收到该群通知；
        重新加入时输入群组码可恢复原身份。
      </p>
      <t-space>
        <t-button variant="outline" @click="leaveConfirmVisible = false">取消</t-button>
        <t-button theme="primary" :loading="isLeaving" @click="leaveCurrentGroup">
          确认退出
        </t-button>
      </t-space>
    </t-dialog>

    <t-dialog
      v-model:visible="dissolveConfirmVisible"
      header="解散群组"
      :footer="false"
      width="420px"
    >
      <p>解散后群组立即从所有列表消失，数据保留 30 天；您可在“已解散群组”中恢复。</p>
      <t-space>
        <t-button variant="outline" @click="dissolveConfirmVisible = false">取消</t-button>
        <t-button theme="danger" :loading="isDissolving" @click="dissolveCurrentGroup">
          确认解散
        </t-button>
      </t-space>
    </t-dialog>
  </section>
</template>

<style scoped>
.group-setup-panel {
  display: grid;
  gap: 16px;
}

.join-hint {
  margin: 0 0 12px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.dissolved-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--ui-color-border);
}

.dissolved-row:last-child {
  border-bottom: 0;
}
</style>
