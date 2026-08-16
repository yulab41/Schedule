<script setup lang="ts">
import type {
  GroupMember,
  GroupMemberContact,
  GroupSummary,
  MembershipClaimRequest,
} from '@schedule/contracts';
import { MoreIcon } from 'tdesign-icons-vue-next';
import { computed, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import { hasDuplicateRosterName, parseRosterNames } from '../groups/roster-input.js';
import GroupContactForm from '../profile/GroupContactForm.vue';
import { getClaimRequestTone } from './member-presentation.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const emit = defineEmits<{
  'group-changed': [];
}>();

const api = createApiClient({ auth: localAuth });
const members = ref<GroupMember[]>([]);
const contacts = ref<GroupMemberContact[]>([]);
const claimRequests = ref<MembershipClaimRequest[]>([]);
const errorMessage = ref<string>();
const rosterMessage = ref<string>();
const identityMessage = ref<string>();
const isLoading = ref(false);
const isAddingRoster = ref(false);
const isUpdating = ref(false);
const isDeletingMemberId = ref<string>();
const rosterNames = ref('');
const editingContactMemberId = ref<string>();
const memberActionTarget = ref<GroupMember>();
let requestVersion = 0;

const contactsByMembershipId = computed(
  () => new Map(contacts.value.map((contact) => [contact.membershipId, contact])),
);
const isDeveloperAdmin = computed(() => props.group.isDeveloperAdmin === true);
const currentMember = computed(() => members.value.find((member) => member.isCurrentUser));
const otherMembers = computed(() => members.value.filter((member) => !member.isCurrentUser));
const canManageAdministrators = computed(
  () => props.group.role === 'owner' || isDeveloperAdmin.value,
);
const canAddMembers = computed(() => props.group.role !== 'member');
const canManageContacts = computed(
  () =>
    props.group.role === 'owner' || props.group.role === 'administrator' || isDeveloperAdmin.value,
);
const canHandleClaims = computed(() => isDeveloperAdmin.value);
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
const contactEditorVisible = computed({
  get: () => editingContactMemberId.value !== undefined,
  set: (visible: boolean) => {
    if (!visible) editingContactMemberId.value = undefined;
  },
});
const memberActionsVisible = computed({
  get: () => memberActionTarget.value !== undefined,
  set: (visible: boolean) => {
    if (!visible) memberActionTarget.value = undefined;
  },
});

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

async function updateMemberName(member: GroupMember): Promise<void> {
  const realName = window
    .prompt('输入成员姓名（会同步到该账号的所有群组）', member.realName)
    ?.trim();
  if (realName === undefined || realName === '' || realName === member.realName) {
    return;
  }
  errorMessage.value = undefined;
  isUpdating.value = true;
  try {
    await api.updateGroupMemberName(props.group.id, member.id, { realName });
    await loadMembers();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '成员姓名暂时无法保存，请稍后重试。');
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
    errorMessage.value = '预设成员中不能有重复姓名。';
    return;
  }

  isAddingRoster.value = true;
  try {
    const result = await api.addGroupMembers(props.group.id, { realNames: names });
    rosterNames.value = '';
    rosterMessage.value = `已添加 ${result.added} 位预设成员；成员使用已保存姓名和群组码加入后会自动关联账号。`;
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
      `确定将 ${names.length} 位预设成员转为正式成员吗？转正后可填写手机号并参与排班。`,
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
  const label = isPending ? '预设成员' : '成员';
  const message = isPending
    ? `确定删除预设成员“${member.realName}”吗？删除后如需加入请重新添加。`
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

function mobilePhoneFor(member: GroupMember): string {
  const contact = contactFor(member);
  return contact?.mobilePhone ?? '未填写';
}

function shortPhoneFor(member: GroupMember): string {
  const contact = contactFor(member);
  return contact?.shortPhone ?? '未填写';
}

function initials(realName: string): string {
  return realName.slice(-2);
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

function openContactEditor(member: GroupMember): void {
  if (member.isPendingRoster === true || !canEditContact(member)) return;
  memberActionTarget.value = undefined;
  editingContactMemberId.value = member.id;
}

async function handleContactSaved(): Promise<void> {
  editingContactMemberId.value = undefined;
  identityMessage.value = '联系方式已保存，成员列表已刷新。';
  await loadMembers();
}

function hasMemberManagementActions(member: GroupMember): boolean {
  const canRevoke =
    member.isPendingRoster !== true &&
    member.isCurrentUser !== true &&
    member.isUnclaimed !== true &&
    canHandleClaims.value;
  const canChangeRole =
    canManageAdministrators.value && member.role !== 'owner' && member.isPendingRoster !== true;
  const canDelete = canAddMembers.value && member.isCurrentUser !== true && member.role !== 'owner';
  const canRename = isDeveloperAdmin.value && member.isPendingRoster !== true;
  return canRevoke || canChangeRole || canDelete || canRename;
}

function openMemberActions(member: GroupMember): void {
  memberActionTarget.value = member;
}

async function runMemberAction(
  action: 'convert' | 'delete' | 'rename' | 'revoke' | 'toggle-role' | 'transfer',
): Promise<void> {
  const member = memberActionTarget.value;
  if (member === undefined) return;
  memberActionTarget.value = undefined;

  switch (action) {
    case 'convert':
      await convertPending([member.realName]);
      break;
    case 'delete':
      await deleteMember(member);
      break;
    case 'rename':
      await updateMemberName(member);
      break;
    case 'revoke':
      await revokeClaim(member);
      break;
    case 'toggle-role':
      await updateRole(member, member.role === 'member' ? 'administrator' : 'member');
      break;
    case 'transfer':
      await transferOwnership(member);
      break;
  }
}
</script>

<template>
  <section class="member-manager" :aria-busy="isLoading">
    <header class="member-heading">
      <div>
        <h2>成员</h2>
        <p>
          {{
            isDeveloperAdmin
              ? '后台管理员可维护成员资料与历史记录。'
              : '查看成员目录并维护我的联系方式。'
          }}
        </p>
      </div>
      <span class="member-count">{{ members.length }} 位</span>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="rosterMessage !== undefined" theme="success" :message="rosterMessage" />
    <t-alert v-if="identityMessage !== undefined" theme="success" :message="identityMessage" />

    <form
      v-if="canAddMembers"
      class="add-member-form member-form-card"
      @submit.prevent="addMembers"
    >
      <label class="add-member-field">
        添加预设成员（每行一个姓名）
        <textarea
          v-model="rosterNames"
          maxlength="2000"
          placeholder="例如：&#10;张三&#10;李四"
          rows="2"
        />
      </label>
      <t-button variant="outline" type="submit" :loading="isAddingRoster">添加预设成员</t-button>
    </form>

    <div v-if="pendingMembers.length > 0 && canAddMembers" class="pending-panel">
      <t-alert
        theme="warning"
        :message="`有 ${pendingMembers.length} 位预设成员尚未转为正式成员。`"
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
      <header class="section-heading">
        <div>
          <h3>身份认领申请</h3>
          <p>核对申请人与目标成员后再处理。</p>
        </div>
        <span>{{ pendingClaimRequests.length }} 项待处理</span>
      </header>
      <table class="member-table claim-table">
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
          <tr
            v-for="request in claimRequests"
            :key="request.id"
            class="member-card claim-card"
            :class="{ 'is-actionable': request.status === 'pending' }"
          >
            <td class="member-primary" data-label="申请人">
              {{ request.requestingUserRealName }}
            </td>
            <td data-label="目标成员">{{ request.targetMemberRealName }}</td>
            <td data-label="状态">
              <span class="status-badge" :class="getClaimRequestTone(request.status)">
                {{ claimRequestStatusLabel(request.status) }}
              </span>
            </td>
            <td data-label="处理人">{{ request.decidedByRealName ?? '—' }}</td>
            <td class="action-cell claim-actions" data-label="操作">
              <template v-if="request.status === 'pending'">
                <t-button variant="outline" @click="decideClaim(request, true)"> 同意 </t-button>
                <t-button theme="danger" variant="text" @click="decideClaim(request, false)">
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
    <template v-else>
      <section
        v-if="currentMember !== undefined"
        class="member-directory-section self-directory-section"
        aria-labelledby="self-contact-heading"
      >
        <header class="directory-heading">
          <div>
            <h3 id="self-contact-heading">我的资料</h3>
            <p>初始状态不显示输入框，需要时再修改。</p>
          </div>
          <span>仅在需要时修改</span>
        </header>
        <article class="self-contact-card">
          <div class="directory-identity">
            <span class="directory-avatar self-avatar" aria-hidden="true">
              {{ initials(currentMember.realName) }}
            </span>
            <div>
              <div class="directory-name-line">
                <strong>{{ currentMember.realName }}</strong>
                <span class="current-badge">我</span>
              </div>
              <small>{{ roleLabel(currentMember.role) }}</small>
            </div>
          </div>
          <dl class="directory-contact-values">
            <div>
              <dt>长号</dt>
              <dd :class="{ 'is-missing': mobilePhoneFor(currentMember) === '未填写' }">
                {{ mobilePhoneFor(currentMember) }}
              </dd>
            </div>
            <div>
              <dt>短号</dt>
              <dd :class="{ 'is-missing': shortPhoneFor(currentMember) === '未填写' }">
                {{ shortPhoneFor(currentMember) }}
              </dd>
            </div>
          </dl>
          <t-button
            variant="outline"
            class="contact-edit-button"
            @click="openContactEditor(currentMember)"
          >
            修改
          </t-button>
        </article>
      </section>

      <section class="member-directory-section" aria-labelledby="member-directory-heading">
        <header class="directory-heading">
          <div>
            <h3 id="member-directory-heading">科室通讯录</h3>
            <p>同群组有效成员均可查看姓名、长号和短号。</p>
          </div>
          <span>{{ members.length }} 位成员</span>
        </header>
        <div class="member-directory-list" role="list">
          <article
            v-for="member in otherMembers"
            :key="member.id"
            class="member-directory-row"
            role="listitem"
          >
            <div class="directory-identity">
              <span class="directory-avatar" aria-hidden="true">{{
                initials(member.realName)
              }}</span>
              <div>
                <div class="directory-name-line">
                  <strong>{{ member.realName }}</strong>
                  <span v-if="member.isPendingRoster === true" class="status-badge neutral">
                    待认领
                  </span>
                </div>
                <small>{{ roleLabel(member.role) }}</small>
              </div>
            </div>
            <dl class="directory-contact-values">
              <div>
                <dt>长号</dt>
                <dd :class="{ 'is-missing': mobilePhoneFor(member) === '未填写' }">
                  {{ mobilePhoneFor(member) }}
                </dd>
              </div>
              <div>
                <dt>短号</dt>
                <dd :class="{ 'is-missing': shortPhoneFor(member) === '未填写' }">
                  {{ shortPhoneFor(member) }}
                </dd>
              </div>
            </dl>
            <div class="directory-actions">
              <t-button
                v-if="canEditContact(member) && member.isPendingRoster !== true"
                variant="outline"
                class="contact-edit-button"
                @click="openContactEditor(member)"
              >
                修改
              </t-button>
              <t-button
                v-if="hasMemberManagementActions(member)"
                variant="text"
                class="member-manage-button"
                aria-label="管理成员"
                @click="openMemberActions(member)"
              >
                <template #icon><MoreIcon /></template>
                管理
              </t-button>
            </div>
          </article>
        </div>
        <p class="directory-privacy-note">
          联系方式仅供群组内部协作使用，请勿转发或用于排班之外的用途。
        </p>
      </section>
    </template>

    <section v-if="canManageAdministrators" class="member-danger-zone">
      <div>
        <strong>群组管理</strong>
        <span>删除后 30 天内可恢复。</span>
      </div>
      <t-button theme="danger" variant="outline" :loading="isUpdating" @click="deleteGroup">
        删除群组
      </t-button>
    </section>

    <ResponsiveSheet
      v-model:visible="contactEditorVisible"
      :title="
        contactEditorMember === undefined
          ? '编辑联系方式'
          : `编辑 ${contactEditorMember.realName} 的联系方式`
      "
    >
      <GroupContactForm
        v-if="editingContactMemberId !== undefined"
        class="contact-editor"
        :can-confirm="canManageContacts"
        :contact="contactEditorMember === undefined ? undefined : contactFor(contactEditorMember)"
        :group-id="group.id"
        :membership-id="editingContactMemberId"
        @saved="handleContactSaved"
      />
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:visible="memberActionsVisible"
      :title="
        memberActionTarget === undefined ? '管理成员' : `管理成员 ${memberActionTarget.realName}`
      "
    >
      <div v-if="memberActionTarget !== undefined" class="member-sheet-actions">
        <p class="member-action-summary">
          {{ roleLabel(memberActionTarget.role) }} · {{ claimStatusLabel(memberActionTarget) }}
        </p>
        <t-button
          v-if="memberActionTarget.isPendingRoster === true && canAddMembers"
          variant="outline"
          :loading="isUpdating"
          @click="runMemberAction('convert')"
        >
          转为正式成员
        </t-button>
        <t-button
          v-if="isDeveloperAdmin && memberActionTarget.isPendingRoster !== true"
          variant="outline"
          :loading="isUpdating"
          @click="runMemberAction('rename')"
        >
          修改姓名
        </t-button>
        <t-button
          v-if="
            canManageAdministrators &&
            memberActionTarget.role !== 'owner' &&
            memberActionTarget.isPendingRoster !== true
          "
          variant="outline"
          :loading="isUpdating"
          @click="runMemberAction('toggle-role')"
        >
          {{ memberActionTarget.role === 'member' ? '设为管理员' : '移除管理员' }}
        </t-button>
        <t-button
          v-if="
            canManageAdministrators &&
            memberActionTarget.role !== 'owner' &&
            memberActionTarget.isPendingRoster !== true
          "
          variant="outline"
          :loading="isUpdating"
          @click="runMemberAction('transfer')"
        >
          转让群主
        </t-button>
        <t-button
          v-if="
            memberActionTarget.isPendingRoster !== true &&
            memberActionTarget.isCurrentUser !== true &&
            memberActionTarget.isUnclaimed !== true &&
            canHandleClaims
          "
          theme="danger"
          variant="outline"
          :loading="isUpdating"
          @click="runMemberAction('revoke')"
        >
          撤销身份认领
        </t-button>
        <t-button
          v-if="
            canAddMembers &&
            memberActionTarget.isCurrentUser !== true &&
            memberActionTarget.role !== 'owner'
          "
          theme="danger"
          variant="outline"
          :loading="isDeletingMemberId === memberActionTarget.id"
          @click="runMemberAction('delete')"
        >
          删除成员
        </t-button>
      </div>
    </ResponsiveSheet>
  </section>
</template>

<style scoped>
.member-manager {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-lg);
}

.member-heading,
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.member-heading h2,
.section-heading h3 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.member-heading h2 {
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.section-heading h3 {
  font-size: var(--ui-font-size-lg);
}

.member-heading p,
.section-heading p {
  margin: var(--ui-spacing-xxs) 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.member-count,
.section-heading > span {
  flex: none;
  padding: 5px 9px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.identity-form,
.add-member-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-sm);
  align-items: flex-end;
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.identity-field,
.add-member-field {
  display: grid;
  flex: 1 1 260px;
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.identity-field input,
.add-member-field textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--ui-touch-target-minimum);
  padding: 10px 12px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-medium);
  font: inherit;
  font-size: var(--ui-font-size-md);
}

.add-member-field textarea {
  min-height: 56px;
  resize: vertical;
}

.identity-field input:focus-visible,
.add-member-field textarea:focus-visible {
  border-color: var(--ui-color-primary);
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
}

.member-manager :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.identity-hint {
  width: 100%;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.pending-panel,
.claim-requests-panel {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-sm);
}

.member-directory-section {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-sm);
}

.directory-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.directory-heading h3,
.directory-heading p {
  margin: 0;
}

.directory-heading h3 {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
}

.directory-heading p {
  margin-top: var(--ui-spacing-xxs);
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.directory-heading > span {
  flex: none;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.self-contact-card,
.member-directory-list {
  min-width: 0;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
  overflow: hidden;
}

.self-contact-card,
.member-directory-row {
  display: grid;
  min-width: 0;
  padding: 14px 16px;
  align-items: center;
  grid-template-columns: minmax(180px, 1.1fr) minmax(260px, 1fr) auto;
  gap: var(--ui-spacing-md);
}

.self-contact-card {
  background: linear-gradient(110deg, var(--ui-color-primary-light), var(--ui-color-surface) 72%);
  border-color: var(--ui-color-primary-border);
}

.member-directory-row + .member-directory-row {
  border-top: 1px solid var(--ui-color-border);
}

.member-directory-row:hover {
  background: var(--ui-color-surface-muted);
}

.directory-identity,
.directory-name-line,
.directory-actions {
  display: flex;
  min-width: 0;
  align-items: center;
}

.directory-identity {
  gap: var(--ui-spacing-sm);
}

.directory-name-line {
  gap: var(--ui-spacing-xxs);
}

.directory-identity strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
  overflow-wrap: anywhere;
}

.directory-identity small {
  display: block;
  margin-top: 2px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.directory-avatar {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: 50%;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.self-avatar {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border-color: var(--ui-color-primary-border);
}

.directory-contact-values {
  display: grid;
  min-width: 0;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-md);
}

.directory-contact-values div {
  min-width: 0;
}

.directory-contact-values dt {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.directory-contact-values dd {
  margin: 3px 0 0;
  color: var(--ui-color-text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: var(--ui-font-weight-medium);
  overflow-wrap: anywhere;
}

.directory-contact-values dd.is-missing {
  color: var(--ui-color-text-muted);
  font-weight: var(--ui-font-weight-regular);
}

.directory-actions {
  justify-content: flex-end;
  gap: var(--ui-spacing-xxs);
}

.directory-actions .contact-edit-button {
  margin-left: 0;
}

.directory-privacy-note {
  margin: 0;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.member-table-wrap {
  overflow-x: auto;
}

.member-table {
  width: 100%;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-collapse: separate;
  border-radius: var(--ui-radius-large);
  border-spacing: 0;
  font-size: var(--ui-font-size-sm);
  overflow: hidden;
}

.member-table th,
.member-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--ui-color-border);
  vertical-align: middle;
}

.member-table th {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-background);
  font-weight: var(--ui-font-weight-semibold);
  white-space: nowrap;
}

.member-table tbody tr:last-child td {
  border-bottom: 0;
}

.member-table tr:hover td {
  background: var(--ui-color-surface-muted);
}

.contact-cell {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xxs) var(--ui-spacing-xs);
  align-items: center;
}

.action-cell {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
  align-items: center;
}

.mobile-member-actions {
  display: none;
}

.member-primary {
  font-weight: var(--ui-font-weight-semibold);
}

.current-badge,
.unconfirmed-label,
.handled-label {
  display: inline-flex;
  min-height: 26px;
  padding: 3px 8px;
  align-items: center;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.current-badge {
  margin-left: var(--ui-spacing-xxs);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
}

.unconfirmed-label {
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
}

.status-badge {
  display: inline-flex;
  min-height: 28px;
  padding: 4px 9px;
  align-items: center;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.status-badge.warning {
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
}

.status-badge.success {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.status-badge.danger {
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
}

.status-badge.neutral {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  box-shadow: inset 0 0 0 1px var(--ui-color-border);
}

.handled-label {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
}

.contact-edit-button {
  min-height: var(--ui-touch-target-minimum) !important;
  margin-left: auto;
}

.contact-editor {
  display: grid;
  gap: var(--ui-spacing-md);
  padding-top: var(--ui-spacing-sm);
}

.contact-editor :deep(.t-input) {
  min-height: var(--ui-touch-target-minimum);
}

.contact-editor :deep(.t-button) {
  width: 100%;
}

.dialog-hint {
  margin: var(--ui-spacing-sm) 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.claim-option {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  margin-bottom: var(--ui-spacing-xs);
  padding: 10px 12px;
  gap: var(--ui-spacing-xs);
  align-items: center;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.claim-option input:disabled + span {
  color: var(--ui-color-text-muted);
}

.member-sheet-actions {
  display: grid;
  gap: var(--ui-spacing-sm);
  padding-top: var(--ui-spacing-sm);
}

.member-sheet-actions :deep(.t-button) {
  width: 100%;
}

.member-action-summary {
  margin: 0;
  padding: 10px 12px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.member-danger-zone {
  display: flex;
  padding: var(--ui-spacing-md);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-danger-light);
  border-radius: var(--ui-radius-large);
}

.member-danger-zone div {
  display: grid;
  gap: var(--ui-spacing-xxs);
}

.member-danger-zone strong {
  color: var(--ui-color-text-primary);
}

.member-danger-zone span {
  font-size: var(--ui-font-size-sm);
}

@media (max-width: 760px) {
  .member-manager {
    gap: var(--ui-spacing-md);
  }

  .member-heading,
  .section-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-spacing-sm);
  }

  .member-heading p,
  .section-heading p {
    max-width: none;
  }

  .member-count,
  .section-heading > span {
    justify-self: start;
  }

  .directory-heading {
    align-items: flex-start;
  }

  .self-contact-card,
  .member-directory-row {
    padding: 14px;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--ui-spacing-sm);
  }

  .directory-contact-values {
    padding-left: 56px;
    grid-column: 1 / -1;
    grid-row: 2;
    gap: var(--ui-spacing-sm);
  }

  .directory-actions,
  .self-contact-card > .contact-edit-button {
    grid-column: 2;
    grid-row: 1;
  }

  .directory-actions {
    align-self: center;
  }

  .identity-form,
  .add-member-form {
    display: grid;
    padding: var(--ui-spacing-md);
    box-shadow: none;
  }

  .identity-form :deep(.t-button),
  .add-member-form :deep(.t-button),
  .pending-panel :deep(.t-button) {
    width: 100%;
  }

  .member-table-wrap {
    overflow: visible;
  }

  .member-table,
  .member-table tbody {
    display: grid;
    gap: var(--ui-spacing-md);
    background: transparent;
    border: 0;
    border-radius: 0;
  }

  .member-table thead {
    display: none;
  }

  .member-table .member-card {
    display: grid;
    min-width: 0;
    padding: var(--ui-spacing-lg);
    gap: 10px;
    background: var(--ui-color-surface);
    border: 1px solid var(--ui-color-border);
    border-radius: var(--ui-radius-large);
    box-shadow: var(--ui-shadow-card);
  }

  .member-table .member-card.is-actionable {
    border-color: var(--ui-color-primary-border);
    box-shadow:
      var(--ui-shadow-card),
      inset 3px 0 var(--ui-color-primary);
  }

  .member-table .member-card td {
    display: flex;
    min-width: 0;
    min-height: 28px;
    padding: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--ui-spacing-md);
    border: 0;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .member-table .member-card td::before {
    min-width: 64px;
    flex: none;
    color: var(--ui-color-text-secondary);
    content: attr(data-label);
    font-size: var(--ui-font-size-xs);
    font-weight: var(--ui-font-weight-medium);
  }

  .member-table .member-card .member-primary {
    align-items: center;
    font-size: var(--ui-font-size-md);
  }

  .desktop-member-actions {
    display: none !important;
  }

  .member-table .member-card .mobile-member-actions,
  .member-table .member-card .claim-actions {
    display: grid;
    min-height: var(--ui-touch-target-minimum);
    padding-top: var(--ui-spacing-xxs);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-spacing-xs);
  }

  .member-table .member-card .mobile-member-actions::before,
  .member-table .member-card .claim-actions::before {
    display: none;
  }

  .mobile-member-actions :deep(.t-button),
  .claim-actions :deep(.t-button) {
    width: 100%;
    min-width: 0;
  }

  .contact-cell {
    align-items: center !important;
  }

  .member-danger-zone {
    align-items: stretch;
    flex-direction: column;
  }

  .member-danger-zone :deep(.t-button) {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .directory-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .directory-contact-values {
    padding-left: 0;
  }

  .directory-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .member-table .member-card .mobile-member-actions,
  .member-table .member-card .claim-actions {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .member-manager *,
  .member-manager *::before,
  .member-manager *::after {
    scroll-behavior: auto !important;
  }
}
</style>
