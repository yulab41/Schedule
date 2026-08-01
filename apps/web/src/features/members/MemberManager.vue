<script setup lang="ts">
import type { GroupMember, GroupMemberContact, GroupSummary } from '@schedule/contracts';
import { computed, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
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
const isLoading = ref(false);
const isUpdating = ref(false);
let requestVersion = 0;

const contactsByMembershipId = computed(
  () => new Map(contacts.value.map((contact) => [contact.membershipId, contact])),
);
const canManageAdministrators = computed(() => props.group.role === 'owner');
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
