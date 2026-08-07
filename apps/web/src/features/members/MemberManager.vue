<script setup lang="ts">
import type {
  GroupMember,
  GroupMemberContact,
  GroupSummary,
  MembershipClaimLookupEntry,
  MembershipClaimRequest,
} from '@schedule/contracts';
import { computed, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
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
const claimRequests = ref<MembershipClaimRequest[]>([]);
const errorMessage = ref<string>();
const rosterMessage = ref<string>();
const identityMessage = ref<string>();
const isLoading = ref(false);
const isAddingRoster = ref(false);
const isUpdating = ref(false);
const isCheckingIdentity = ref(false);
const isDeletingMemberId = ref<string>();
const rosterNames = ref('');
const myRealName = ref('');
const claimTargets = ref<readonly MembershipClaimLookupEntry[]>([]);
const selectedClaimTargetId = ref<string>();
const identityDialogVisible = ref(false);
const editingContactMemberId = ref<string>();
let requestVersion = 0;

const contactsByMembershipId = computed(
  () => new Map(contacts.value.map((contact) => [contact.membershipId, contact])),
);
const canManageAdministrators = computed(() => props.group.role === 'owner');
const canAddMembers = computed(() => props.group.role !== 'member');
const canManageContacts = computed(() => props.group.role !== 'member');
const canHandleClaims = computed(() => props.group.role !== 'member');
const pendingMembers = computed(() =>
  members.value.filter((member) => member.isPendingRoster === true),
);
const pendingClaimRequests = computed(() =>
  claimRequests.value.filter((request) => request.status === 'pending'),
);
const handledClaimRequests = computed(() =>
  claimRequests.value.filter((request) => request.status !== 'pending'),
);
const contactEditorMember = computed(() =>
  editingContactMemberId.value === undefined
    ? undefined
    : members.value.find((member) => member.id === editingContactMemberId.value),
);

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
    const [nextMembers, nextContacts, nextClaims] = await Promise.all([
      api.listGroupMembers(props.group.id),
      api.listGroupContacts(props.group.id),
      canHandleClaims.value ? api.listMembershipClaimRequests(props.group.id) : Promise.resolve([]),
    ]);
    if (currentRequest === requestVersion) {
      members.value = nextMembers;
      contacts.value = nextContacts;
      claimRequests.value = nextClaims;
      const currentMember = nextMembers.find((member) => member.isCurrentUser);
      myRealName.value = currentMember?.realName ?? '';
    }
  } catch (error) {
    if (currentRequest === requestVersion) {
      errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
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
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
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
    const result = await api.addGroupMembers(props.group.id, { realNames: names });
    rosterNames.value = '';
    rosterMessage.value = `已添加 ${result.added} 位成员，可直接填写手机号和参与排班；成员登录后用真实姓名和群组码认领即可绑定账号。`;
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isAddingRoster.value = false;
  }
}

async function convertPending(names: readonly string[]): Promise<void> {
  if (names.length === 0) {
    return;
  }
  if (
    !window.confirm(
      `确定将 ${names.length} 位待认领成员转为正式成员吗？转正后可填写手机号并参与排班。`,
    )
  ) {
    return;
  }

  errorMessage.value = undefined;
  rosterMessage.value = undefined;
  isUpdating.value = true;
  try {
    const result = await api.convertRosterEntries(props.group.id, { realNames: [...names] });
    rosterMessage.value =
      result.skipped > 0
        ? `已转正 ${result.converted} 位成员，跳过 ${result.skipped} 位（已存在或找不到）。`
        : `已转正 ${result.converted} 位成员。`;
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isUpdating.value = false;
  }
}

async function deleteMember(member: GroupMember): Promise<void> {
  const isPending = member.isPendingRoster === true;
  const label = isPending ? '未认领成员' : '成员';
  const message = isPending
    ? `确定删除未认领成员“${member.realName}”吗？删除后如需加入请重新添加。`
    : `确定删除成员“${member.realName}”吗？其未处理的请假/换班/加扣班申请将自动取消，历史排班保留姓名。`;
  if (!window.confirm(message)) {
    return;
  }

  errorMessage.value = undefined;
  isDeletingMemberId.value = member.id;
  try {
    await api.deleteGroupMember(props.group.id, member.id);
    rosterMessage.value = `已删除${label}“${member.realName}”。`;
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isDeletingMemberId.value = undefined;
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
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
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
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isUpdating.value = false;
  }
}

async function submitIdentity(): Promise<void> {
  errorMessage.value = undefined;
  identityMessage.value = undefined;
  const realName = myRealName.value.trim();
  if (realName.length === 0) {
    errorMessage.value = '请先填写你的真实姓名。';
    return;
  }

  isCheckingIdentity.value = true;
  try {
    const lookup = await api.lookupClaimMatches(props.group.id, realName);
    if (lookup.matches.length === 0) {
      await api.updateProfile(realName);
      identityMessage.value = '已更新真实姓名，未发现同名成员。';
      await loadMembers();
      return;
    }
    claimTargets.value = lookup.matches;
    selectedClaimTargetId.value = lookup.matches[0]?.membershipId;
    identityDialogVisible.value = true;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isCheckingIdentity.value = false;
  }
}

async function confirmIdentityClaim(): Promise<void> {
  if (selectedClaimTargetId.value === undefined) {
    errorMessage.value = '请选择要认领的成员身份。';
    return;
  }

  isUpdating.value = true;
  try {
    const result = await api.createMembershipClaimRequest(props.group.id, {
      membershipId: selectedClaimTargetId.value,
    });
    identityDialogVisible.value = false;
    identityMessage.value = result.direct
      ? '已认领该成员身份。'
      : '已向管理员发送认领申请，等待批准后生效。';
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isUpdating.value = false;
  }
}

async function claimMember(member: GroupMember): Promise<void> {
  if (!window.confirm(`确定认领成员“${member.realName}”的身份吗？`)) {
    return;
  }
  errorMessage.value = undefined;
  identityMessage.value = undefined;
  isUpdating.value = true;
  try {
    const result = await api.createMembershipClaimRequest(props.group.id, {
      membershipId: member.id,
    });
    identityMessage.value = result.direct
      ? `已认领成员“${member.realName}”的身份。`
      : `已向管理员发送认领“${member.realName}”的申请，等待批准后生效。`;
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isUpdating.value = false;
  }
}

async function revokeClaim(member: GroupMember): Promise<void> {
  if (!window.confirm(`确定撤销成员“${member.realName}”的认领吗？撤销后该成员恢复为未认领状态。`)) {
    return;
  }
  errorMessage.value = undefined;
  isUpdating.value = true;
  try {
    await api.revokeMembershipClaim(props.group.id, member.id);
    identityMessage.value = `已撤销成员“${member.realName}”的认领。`;
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
  } finally {
    isUpdating.value = false;
  }
}

async function decideClaim(request: MembershipClaimRequest, approve: boolean): Promise<void> {
  if (
    !window.confirm(
      approve
        ? `确定同意 ${request.requestingUserRealName} 认领成员“${request.targetMemberRealName}”吗？`
        : `确定驳回 ${request.requestingUserRealName} 认领成员“${request.targetMemberRealName}”的申请吗？`,
    )
  ) {
    return;
  }
  errorMessage.value = undefined;
  isUpdating.value = true;
  try {
    if (approve) {
      await api.approveMembershipClaimRequest(props.group.id, request.id);
    } else {
      await api.rejectMembershipClaimRequest(props.group.id, request.id);
    }
    identityMessage.value = approve ? '已同意该认领申请。' : '已驳回该认领申请。';
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员数据暂时无法加载，请稍后重试。');
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

function claimStatusLabel(member: GroupMember): string {
  if (member.isPendingRoster === true) {
    return '待认领名单';
  }
  if (member.isUnclaimed === true) {
    return '未认领';
  }
  if (member.isClaimedByCurrentUser === true) {
    return '已认领（我）';
  }
  if (member.claimRequestStatus === 'pending') {
    return '认领申请待审批';
  }
  return '已认领';
}

function claimRequestStatusLabel(status: MembershipClaimRequest['status']): string {
  switch (status) {
    case 'pending':
      return '待审批';
    case 'approved':
      return '已同意';
    case 'rejected':
      return '已驳回';
    case 'cancelled':
      return '已取消';
  }
}
</script>

<template>
  <section class="member-manager" :aria-busy="isLoading">
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="rosterMessage !== undefined" theme="success" :message="rosterMessage" />
    <t-alert v-if="identityMessage !== undefined" theme="success" :message="identityMessage" />

    <form class="identity-form" @submit.prevent="submitIdentity">
      <label class="identity-field">
        我的真实姓名
        <input v-model="myRealName" maxlength="100" placeholder="填写真实姓名并检测群内同名成员" />
      </label>
      <t-button theme="primary" type="submit" :loading="isCheckingIdentity || isUpdating">
        确认并检测同名成员
      </t-button>
      <small class="identity-hint">
        发现同名成员后可认领该身份；普通成员的认领申请需管理员批准，管理员可直接认领未认领成员。
      </small>
    </form>

    <form v-if="canAddMembers" class="add-member-form" @submit.prevent="addMembers">
      <label class="add-member-field">
        添加成员（每行一个真实姓名）
        <textarea
          v-model="rosterNames"
          maxlength="2000"
          placeholder="例如：&#10;张三&#10;李四"
          rows="2"
        />
      </label>
      <t-button variant="outline" type="submit" :loading="isAddingRoster">添加成员</t-button>
    </form>

    <div v-if="pendingMembers.length > 0 && canAddMembers" class="pending-panel">
      <t-alert
        theme="warning"
        :message="`有 ${pendingMembers.length} 位待认领成员尚未转为正式成员。`"
      />
      <t-button
        variant="outline"
        :loading="isUpdating"
        @click="convertPending(pendingMembers.map((member) => member.realName))"
      >
        全部转为正式成员
      </t-button>
    </div>

    <section
      v-if="canHandleClaims && (pendingClaimRequests.length > 0 || handledClaimRequests.length > 0)"
      class="claim-requests-panel"
    >
      <h3>身份认领申请</h3>
      <table class="member-table">
        <thead>
          <tr>
            <th>申请人</th>
            <th>目标成员</th>
            <th>状态</th>
            <th>处理人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in claimRequests" :key="request.id">
            <td>{{ request.requestingUserRealName }}</td>
            <td>{{ request.targetMemberRealName }}</td>
            <td>{{ claimRequestStatusLabel(request.status) }}</td>
            <td>{{ request.decidedByRealName ?? '—' }}</td>
            <td>
              <template v-if="request.status === 'pending'">
                <t-button variant="outline" size="small" @click="decideClaim(request, true)">
                  同意
                </t-button>
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  @click="decideClaim(request, false)"
                >
                  驳回
                </t-button>
              </template>
              <span v-else class="handled-label">
                {{ request.status === 'approved' ? '已同意' : '已处理' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <t-loading v-if="isLoading" text="正在加载成员" />
    <div v-else class="member-table-wrap">
      <table class="member-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>角色</th>
            <th>联系方式</th>
            <th>认领状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in members" :key="member.id">
            <td>
              <strong>{{ member.realName }}</strong>
              <span v-if="member.isCurrentUser" class="current-badge">我</span>
            </td>
            <td>{{ roleLabel(member.role) }}</td>
            <td class="contact-cell">
              <template v-if="contactFor(member)?.mobilePhone !== undefined">
                长号：{{ contactFor(member)?.mobilePhone }}
              </template>
              <template v-if="contactFor(member)?.shortPhone !== undefined">
                短号：{{ contactFor(member)?.shortPhone }}
              </template>
              <span v-if="contactFor(member)?.isConfirmed === false" class="unconfirmed-label">
                未确认
              </span>
              <span v-if="contactFor(member) === undefined">—</span>
              <button
                v-if="canEditContact(member) && member.isPendingRoster !== true"
                type="button"
                class="link-button"
                @click="
                  editingContactMemberId =
                    editingContactMemberId === member.id ? undefined : member.id
                "
              >
                {{ editingContactMemberId === member.id ? '收起' : '编辑' }}
              </button>
            </td>
            <td>
              <span
                :class="{
                  'unclaimed-label': member.isUnclaimed === true,
                  'claimed-label': member.isUnclaimed !== true,
                }"
              >
                {{ claimStatusLabel(member) }}
              </span>
            </td>
            <td class="action-cell">
              <template v-if="member.isPendingRoster === true && canAddMembers">
                <t-button
                  variant="outline"
                  size="small"
                  :loading="isUpdating"
                  @click="convertPending([member.realName])"
                >
                  转正
                </t-button>
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  :loading="isDeletingMemberId === member.id"
                  @click="deleteMember(member)"
                >
                  删除
                </t-button>
              </template>
              <template v-else-if="member.isCurrentUser">
                <span class="handled-label">当前账号</span>
              </template>
              <template v-else-if="member.isUnclaimed === true">
                <t-button
                  variant="outline"
                  size="small"
                  :loading="isUpdating"
                  @click="claimMember(member)"
                >
                  认领
                </t-button>
              </template>
              <template v-else-if="member.isClaimedByCurrentUser === true && canHandleClaims">
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  :loading="isUpdating"
                  @click="revokeClaim(member)"
                >
                  撤销认领
                </t-button>
              </template>
              <template v-else-if="member.isClaimedByCurrentUser !== true && canHandleClaims">
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  :loading="isUpdating"
                  @click="revokeClaim(member)"
                >
                  撤销认领
                </t-button>
              </template>
              <template
                v-if="
                  canManageAdministrators &&
                  member.role !== 'owner' &&
                  member.isPendingRoster !== true
                "
              >
                <t-button
                  v-if="member.role === 'member'"
                  variant="outline"
                  size="small"
                  :loading="isUpdating"
                  @click="updateRole(member, 'administrator')"
                >
                  设为管理员
                </t-button>
                <t-button
                  v-else
                  variant="outline"
                  size="small"
                  :loading="isUpdating"
                  @click="updateRole(member, 'member')"
                >
                  移除管理员
                </t-button>
                <t-button
                  variant="outline"
                  size="small"
                  :loading="isUpdating"
                  @click="transferOwnership(member)"
                >
                  转让群主
                </t-button>
              </template>
              <template
                v-if="canAddMembers && member.isCurrentUser !== true && member.role !== 'owner'"
              >
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  :loading="isDeletingMemberId === member.id"
                  @click="deleteMember(member)"
                >
                  删除
                </t-button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <GroupContactForm
      v-if="editingContactMemberId !== undefined"
      class="contact-editor"
      :can-confirm="contactEditorMember?.isCurrentUser === true"
      :contact="contactEditorMember === undefined ? undefined : contactFor(contactEditorMember)"
      :group-id="group.id"
      :membership-id="editingContactMemberId"
      @saved="loadMembers"
    />

    <t-button
      v-if="canManageAdministrators"
      theme="danger"
      variant="outline"
      :loading="isUpdating"
      @click="deleteGroup"
    >
      删除群组
    </t-button>

    <t-dialog
      v-model:visible="identityDialogVisible"
      header="发现同名成员"
      :confirm-btn="{ content: '确认认领', loading: isUpdating }"
      :cancel-btn="{ content: '取消' }"
      @confirm="confirmIdentityClaim"
    >
      <p class="dialog-hint">检测到以下同名成员，请选择要认领的身份：</p>
      <label v-for="entry in claimTargets" :key="entry.membershipId" class="claim-option">
        <input
          v-model="selectedClaimTargetId"
          type="radio"
          name="claim-target"
          :value="entry.membershipId"
          :disabled="!entry.isUnclaimed"
        />
        <span>
          {{ entry.realName }}（{{ roleLabel(entry.role) }} ·
          {{ entry.isUnclaimed ? '未认领' : '已被认领' }}）
        </span>
      </label>
    </t-dialog>
  </section>
</template>

<style scoped>
.member-manager {
  display: grid;
  gap: 14px;
}

.identity-form,
.add-member-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  padding: 12px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 8px;
}

.identity-field,
.add-member-field {
  display: grid;
  flex: 1 1 260px;
  gap: 4px;
  color: var(--ui-color-text-secondary);
  font-size: 14px;
}

.identity-field input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.add-member-field textarea {
  min-height: 56px;
  padding: 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}

.identity-hint {
  width: 100%;
  color: var(--ui-color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.pending-panel,
.claim-requests-panel {
  display: grid;
  gap: 10px;
}

.claim-requests-panel h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.member-table-wrap {
  overflow-x: auto;
}

.member-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: var(--ui-color-surface);
}

.member-table th,
.member-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--ui-color-border);
  vertical-align: middle;
}

.member-table th {
  color: var(--ui-color-text-secondary);
  background: #f8fafc;
  font-weight: 600;
  white-space: nowrap;
}

.member-table tr:hover td {
  background: #fafbfc;
}

.contact-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
}

.action-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  align-items: center;
}

.current-badge,
.unconfirmed-label,
.unclaimed-label,
.claimed-label,
.handled-label {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.current-badge {
  margin-left: 4px;
  color: #1f5aa6;
  background: #e8f1fb;
}

.unconfirmed-label {
  color: #92400e;
  background: #fef3c7;
}

.unclaimed-label {
  color: #92400e;
  background: #fef3c7;
}

.claimed-label {
  color: #1f5aa6;
  background: #e8f1fb;
}

.handled-label {
  color: #6b7280;
  background: #f3f4f6;
}

.link-button {
  padding: 0;
  color: #1f5aa6;
  background: none;
  border: 0;
  cursor: pointer;
  font-size: 12px;
}

.contact-editor {
  padding: 12px;
  background: #f8fafc;
  border: 1px solid var(--ui-color-border);
  border-radius: 8px;
}

.dialog-hint {
  margin: 0 0 10px;
  color: var(--ui-color-text-secondary);
  font-size: 14px;
}

.claim-option {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}

.claim-option input:disabled + span {
  color: #9ca3af;
}

@media (max-width: 640px) {
  .identity-form .t-button,
  .add-member-form .t-button {
    width: 100%;
  }
}
</style>
