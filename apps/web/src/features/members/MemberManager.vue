<script setup lang="ts">
import type { GroupMember, GroupMemberContact, GroupSummary } from '@schedule/contracts';
import { computed, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { hasDuplicateRosterName, parseRosterNames } from '../groups/roster-input.js';
import GroupContactForm from '../profile/GroupContactForm.vue';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const emit = defineEmits<{
  'group-changed': [];
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const members = ref<GroupMember[]>([]);
const contacts = ref<GroupMemberContact[]>([]);
const errorMessage = ref<string>();
const rosterNames = ref('');
const rosterMessage = ref<string>();
const isLoading = ref(false);
const isAddingRoster = ref(false);
const isUpdating = ref(false);
let requestVersion = 0;

const contactsByMembershipId = computed(
  () => new Map(contacts.value.map((contact) => [contact.membershipId, contact])),
);
const canManageAdministrators = computed(() => props.group.role === 'owner');
const canAddMembers = computed(() => props.group.role !== 'member');
const canManageContacts = computed(() => props.group.role !== 'member');

watch(
  () => [props.group.id, props.group.version],
  () => {
    void loadMembers();
  },
  { immediate: true },
);

async function loadMembers(): Promise<void> {
  const currentRequest = ++requestVersion;
  errorMessage.value = undefined;
  members.value = [];
  contacts.value = [];
  isLoading.value = true;

  try {
    const [nextMembers, nextContacts] = await Promise.all([
      api.listGroupMembers(props.group.id),
      api.listGroupContacts(props.group.id),
    ]);
    if (currentRequest === requestVersion) {
      members.value = nextMembers;
      contacts.value = nextContacts;
    }
  } catch (error) {
    if (currentRequest === requestVersion) {
      errorMessage.value = getErrorMessage(error);
    }
  } finally {
    if (currentRequest === requestVersion) {
      isLoading.value = false;
    }
  }
}

async function updateRole(member: GroupMember, role: 'administrator' | 'member'): Promise<void> {
  errorMessage.value = undefined;
  isUpdating.value = true;

  try {
    await api.updateGroupMemberRole(props.group.id, member.id, { role });
    await loadMembers();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isUpdating.value = false;
  }
}

async function addMembers(): Promise<void> {
  errorMessage.value = undefined;
  rosterMessage.value = undefined;
  const names = parseRosterNames(rosterNames.value);
  if (names.length === 0) {
    errorMessage.value = '请至少输入一位成员的真实姓名。';
    return;
  }
  if (hasDuplicateRosterName(names)) {
    errorMessage.value = '待认领名单中不能有重复姓名。';
    return;
  }

  isAddingRoster.value = true;
  try {
    const result = await api.addRosterEntries(props.group.id, { realNames: names });
    rosterNames.value = '';
    rosterMessage.value = `已添加 ${result.added} 位待认领成员，成员用真实姓名和群组码认领后自动加入。`;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isAddingRoster.value = false;
  }
}

async function transferOwnership(member: GroupMember): Promise<void> {
  if (!window.confirm(`确定将群主身份转让给 ${member.realName} 吗？`)) {
    return;
  }

  errorMessage.value = undefined;
  isUpdating.value = true;
  try {
    await api.transferGroupOwnership(props.group.id, { membershipId: member.id });
    await loadMembers();
    emit('group-changed');
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isUpdating.value = false;
  }
}

async function deleteGroup(): Promise<void> {
  if (!window.confirm('确定删除该群组吗？删除后 30 天内可恢复。')) {
    return;
  }

  errorMessage.value = undefined;
  isUpdating.value = true;
  try {
    await api.deleteGroup(props.group.id);
    emit('group-changed');
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isUpdating.value = false;
  }
}

function canEditContact(member: GroupMember): boolean {
  return member.isCurrentUser || canManageContacts.value;
}

function contactFor(member: GroupMember): GroupMemberContact | undefined {
  return contactsByMembershipId.value.get(member.id);
}

function roleLabel(role: GroupMember['role']): string {
  if (role === 'owner') {
    return '群主';
  }

  return role === 'administrator' ? '管理员' : '成员';
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '成员数据暂时无法加载，请稍后重试。';
}
</script>

<template>
  <section class="member-manager" :aria-busy="isLoading">
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="rosterMessage !== undefined" theme="success" :message="rosterMessage" />
    <form v-if="canAddMembers" class="add-member-form" @submit.prevent="addMembers">
      <label>
        添加成员（每行一个真实姓名）
        <textarea
          v-model="rosterNames"
          maxlength="2000"
          placeholder="例如：&#10;张三&#10;李四"
          rows="3"
        />
      </label>
      <t-button theme="primary" type="submit" :loading="isAddingRoster">添加成员</t-button>
    </form>
    <t-loading v-if="isLoading" text="正在加载成员" />
    <div v-else class="member-list">
      <article v-for="member in members" :key="member.id" class="member-row">
        <div class="member-summary">
          <strong>{{ member.realName }}</strong>
          <span>{{ roleLabel(member.role) }}</span>
          <span v-if="contactFor(member)?.mobilePhone !== undefined">
            长号：{{ contactFor(member)?.mobilePhone }}
          </span>
          <span v-if="contactFor(member)?.shortPhone !== undefined">
            短号：{{ contactFor(member)?.shortPhone }}
          </span>
          <span v-if="contactFor(member)?.isConfirmed === false">联系方式待确认</span>
        </div>
        <t-space v-if="canManageAdministrators && member.role !== 'owner'">
          <t-button
            v-if="member.role === 'member'"
            variant="outline"
            :loading="isUpdating"
            @click="updateRole(member, 'administrator')"
          >
            设为管理员
          </t-button>
          <t-button
            v-else
            variant="outline"
            :loading="isUpdating"
            @click="updateRole(member, 'member')"
          >
            移除管理员
          </t-button>
          <t-button
            theme="danger"
            variant="text"
            :loading="isUpdating"
            @click="transferOwnership(member)"
          >
            转让群主
          </t-button>
        </t-space>
        <GroupContactForm
          v-if="canEditContact(member)"
          :can-confirm="member.isCurrentUser"
          :contact="contactFor(member)"
          :group-id="group.id"
          :membership-id="member.id"
          @saved="loadMembers"
        />
      </article>
    </div>
    <t-button
      v-if="canManageAdministrators"
      theme="danger"
      variant="outline"
      :loading="isUpdating"
      @click="deleteGroup"
    >
      删除群组
    </t-button>
  </section>
</template>

<style scoped>
.add-member-form {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.add-member-form label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
}

.add-member-form textarea {
  min-height: 72px;
  padding: 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}

@media (max-width: 640px) {
  .add-member-form .t-button {
    width: 100%;
  }
}
</style>
