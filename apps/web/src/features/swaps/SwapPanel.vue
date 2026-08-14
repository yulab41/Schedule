<script setup lang="ts">
import type {
  CalendarReadModel,
  GroupMember,
  GroupSummary,
  GroupSwapSettings,
  MemberSwapSettings,
  SwapPreview,
  SwapRequest,
} from '@schedule/contracts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import type { SelectValue } from 'tdesign-vue-next';
import { getCurrentBusinessMonth } from '../calendar/calendar-logic.js';
import {
  createAssignmentOption,
  formatAssignmentSummaryOption,
} from '../workflows/assignment-option.js';
import { getWorkflowStatusTone } from '../workflows/workflow-logic.js';
import {
  buildSwapCandidates,
  formatSwapShiftTime,
  getSwapConflictMessage,
  getSwapNextStatusDescription,
  getSwapStatusLabel,
} from './swap-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const businessMonth = ref(getCurrentBusinessMonth());
const calendar = ref<CalendarReadModel>();
const members = ref<GroupMember[]>([]);
const myMembershipId = ref<string>();
const groupSettings = ref<GroupSwapSettings>();
const mySettings = ref<MemberSwapSettings>();
const mySwapRequests = ref<SwapRequest[]>([]);
const approvals = ref<SwapRequest[]>([]);
const selectedMyAssignmentId = ref('');
const selectedTargetMembershipId = ref('');
const selectedTargetAssignmentId = ref('');
const preview = ref<SwapPreview>();
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isPreviewing = ref(false);
const isSubmitting = ref(false);
const adminInitiatorMembershipId = ref('');
const adminInitiatorAssignmentId = ref('');
const adminTargetMembershipId = ref('');
const adminTargetAssignmentId = ref('');
const adminPreview = ref<SwapPreview>();
const adminErrorMessage = ref<string>();
const adminInfoMessage = ref<string>();
const adminIsPreviewing = ref(false);
const adminIsSubmitting = ref(false);
const requestFormVisible = ref(false);
const adminFormVisible = ref(false);

const canApprove = computed(() => props.group.role !== 'member');
const candidates = computed(() =>
  calendar.value === undefined || myMembershipId.value === undefined
    ? undefined
    : buildSwapCandidates(calendar.value, myMembershipId.value),
);
const myAssignmentOptions = computed(() =>
  (candidates.value?.myAssignments ?? []).map((assignment) => createAssignmentOption(assignment)),
);
const targetOptions = computed(() =>
  (candidates.value?.targetOptions ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);
const targetAssignmentOptions = computed(() => {
  const targetMembershipId = selectedTargetMembershipId.value;
  if (targetMembershipId === '') {
    return [];
  }
  return (candidates.value?.assignmentsByTarget.get(targetMembershipId) ?? []).map((assignment) =>
    createAssignmentOption(assignment),
  );
});
const adminMemberOptions = computed(() =>
  (calendar.value?.members ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);
const adminInitiatorAssignmentOptions = computed(() => {
  if (adminInitiatorMembershipId.value === '') {
    return [];
  }
  return (candidates.value?.assignmentsByTarget.get(adminInitiatorMembershipId.value) ?? []).map(
    (assignment) => createAssignmentOption(assignment),
  );
});
const adminTargetAssignmentOptions = computed(() => {
  if (adminTargetMembershipId.value === '') {
    return [];
  }
  return (candidates.value?.assignmentsByTarget.get(adminTargetMembershipId.value) ?? []).map(
    (assignment) => createAssignmentOption(assignment),
  );
});
const incomingRequests = computed(() =>
  mySwapRequests.value.filter(
    (request) =>
      request.targetMembershipId === myMembershipId.value && request.status === 'pending_target',
  ),
);
const pendingApprovals = computed(() =>
  approvals.value.filter((request) => request.status === 'pending_approval'),
);
const handledApprovals = computed(() =>
  approvals.value.filter((request) => request.status !== 'pending_approval'),
);
const completedSwaps = computed(() =>
  approvals.value.filter(
    (request) => request.status === 'completed' && request.isRevocable !== false,
  ),
);
const archivedSwapCount = computed(
  () =>
    approvals.value.filter(
      (request) => request.status === 'completed' && request.isRevocable === false,
    ).length,
);
const myPendingRequests = computed(() =>
  mySwapRequests.value.filter(
    (request) =>
      request.initiatorMembershipId === myMembershipId.value &&
      (request.status === 'pending_target' || request.status === 'pending_approval'),
  ),
);

watch(
  () => [props.group.id, businessMonth.value],
  () => {
    resetForm();
    resetAdminForm();
    void loadData();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('focus', onWindowFocus);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
});

async function loadData(): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    const [nextCalendar, nextMembers, nextGroupSettings, nextMySettings, nextMine, nextApprovals] =
      await Promise.all([
        api.getCalendar(props.group.id, businessMonth.value),
        api.listGroupMembers(props.group.id),
        api.getGroupSwapSettings(props.group.id),
        api.getMySwapSettings(props.group.id),
        api.listMySwapRequests(props.group.id),
        canApprove.value ? api.listSwapApprovals(props.group.id) : Promise.resolve([]),
      ]);
    calendar.value = nextCalendar;
    members.value = nextMembers;
    groupSettings.value = nextGroupSettings;
    mySettings.value = nextMySettings;
    mySwapRequests.value = nextMine;
    approvals.value = nextApprovals;
    const currentUser = nextMembers.find((member) => member.isCurrentUser);
    myMembershipId.value = currentUser?.id;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

function resetForm(): void {
  selectedMyAssignmentId.value = '';
  selectedTargetMembershipId.value = '';
  selectedTargetAssignmentId.value = '';
  preview.value = undefined;
}

function resetAdminForm(): void {
  adminInitiatorMembershipId.value = '';
  adminInitiatorAssignmentId.value = '';
  adminTargetMembershipId.value = '';
  adminTargetAssignmentId.value = '';
  adminPreview.value = undefined;
}

function onTargetChange(value: SelectValue): void {
  if (typeof value !== 'string') {
    return;
  }
  selectedTargetMembershipId.value = value;
  selectedTargetAssignmentId.value = '';
  preview.value = undefined;
}

function onMyAssignmentChange(value: SelectValue): void {
  if (typeof value === 'string') {
    selectedMyAssignmentId.value = value;
    preview.value = undefined;
  }
}

function onTargetAssignmentChange(value: SelectValue): void {
  if (typeof value === 'string') {
    selectedTargetAssignmentId.value = value;
    preview.value = undefined;
  }
}

function onAdminInitiatorChange(value: SelectValue): void {
  if (typeof value !== 'string') {
    return;
  }
  adminInitiatorMembershipId.value = value;
  adminInitiatorAssignmentId.value = '';
  adminPreview.value = undefined;
}

function onAdminTargetChange(value: SelectValue): void {
  if (typeof value !== 'string') {
    return;
  }
  adminTargetMembershipId.value = value;
  adminTargetAssignmentId.value = '';
  adminPreview.value = undefined;
}

function onAdminInitiatorAssignmentChange(value: SelectValue): void {
  if (typeof value === 'string') {
    adminInitiatorAssignmentId.value = value;
    adminPreview.value = undefined;
  }
}

function onAdminTargetAssignmentChange(value: SelectValue): void {
  if (typeof value === 'string') {
    adminTargetAssignmentId.value = value;
    adminPreview.value = undefined;
  }
}

async function computePreview(): Promise<void> {
  errorMessage.value = undefined;
  if (
    selectedMyAssignmentId.value === '' ||
    selectedTargetMembershipId.value === '' ||
    selectedTargetAssignmentId.value === ''
  ) {
    errorMessage.value = '请先选择自己的班次、目标成员和目标班次。';
    return;
  }

  isPreviewing.value = true;
  try {
    preview.value = await api.previewSwap(props.group.id, {
      initiatorAssignmentId: selectedMyAssignmentId.value,
      targetAssignmentId: selectedTargetAssignmentId.value,
      targetMembershipId: selectedTargetMembershipId.value,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    errorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  } finally {
    isPreviewing.value = false;
  }
}

async function submit(): Promise<void> {
  errorMessage.value = undefined;
  if (preview.value === undefined) {
    await computePreview();
    if (preview.value === undefined) {
      return;
    }
  }

  isSubmitting.value = true;
  try {
    const created = await api.createSwapRequest(props.group.id, {
      initiatorAssignmentId: selectedMyAssignmentId.value,
      operationId: crypto.randomUUID(),
      targetAssignmentId: selectedTargetAssignmentId.value,
      targetMembershipId: selectedTargetMembershipId.value,
    });
    infoMessage.value =
      created.status === 'completed'
        ? '换班已生效，双方实际班次已交换。'
        : created.status === 'pending_approval'
          ? '换班申请已提交，等待管理员审批。'
          : '换班申请已提交，等待目标成员接受。';
    resetForm();
    await loadData();
    requestFormVisible.value = false;
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    errorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  } finally {
    isSubmitting.value = false;
  }
}

async function computeAdminPreview(): Promise<void> {
  adminErrorMessage.value = undefined;
  if (
    adminInitiatorMembershipId.value === '' ||
    adminInitiatorAssignmentId.value === '' ||
    adminTargetMembershipId.value === '' ||
    adminTargetAssignmentId.value === ''
  ) {
    adminErrorMessage.value = '请先选择两位成员及其班次。';
    return;
  }
  if (adminInitiatorMembershipId.value === adminTargetMembershipId.value) {
    adminErrorMessage.value = '换班双方必须是不同成员。';
    return;
  }

  adminIsPreviewing.value = true;
  try {
    adminPreview.value = await api.previewSwap(props.group.id, {
      initiatorAssignmentId: adminInitiatorAssignmentId.value,
      initiatorMembershipId: adminInitiatorMembershipId.value,
      targetAssignmentId: adminTargetAssignmentId.value,
      targetMembershipId: adminTargetMembershipId.value,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    adminErrorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  } finally {
    adminIsPreviewing.value = false;
  }
}

async function submitAdminSwap(): Promise<void> {
  adminErrorMessage.value = undefined;
  if (adminPreview.value === undefined) {
    await computeAdminPreview();
    if (adminPreview.value === undefined) {
      return;
    }
  }

  adminIsSubmitting.value = true;
  try {
    const created = await api.createDirectSwapRequest(props.group.id, {
      initiatorAssignmentId: adminInitiatorAssignmentId.value,
      operationId: crypto.randomUUID(),
      targetAssignmentId: adminTargetAssignmentId.value,
    });
    adminInfoMessage.value = `已为 ${created.initiatorMemberName ?? ''} 与 ${created.targetMemberName ?? ''} 完成换班，实际班次已交换。`;
    resetAdminForm();
    await loadData();
    adminFormVisible.value = false;
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    adminErrorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  } finally {
    adminIsSubmitting.value = false;
  }
}

async function accept(request: SwapRequest): Promise<void> {
  await runMutation(() =>
    api.acceptSwapRequest(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function approve(request: SwapRequest): Promise<void> {
  await runMutation(() =>
    api.approveSwapRequest(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function reject(request: SwapRequest): Promise<void> {
  if (!window.confirm(`确定驳回与 ${request.initiatorMemberName ?? '对方'} 的换班申请吗？`)) {
    return;
  }
  await runMutation(() =>
    api.rejectSwapRequest(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function cancel(request: SwapRequest): Promise<void> {
  if (!window.confirm('确定撤销该换班申请吗？')) {
    return;
  }
  await runMutation(() =>
    api.cancelSwapRequest(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function revokeSwap(request: SwapRequest): Promise<void> {
  const reason = window.prompt(
    `确定撤销与 ${getCounterpartName(request)} 的换班吗？请填写撤销原因（选填）：`,
    '',
  );
  if (reason === null) {
    return;
  }
  await runMutation(() =>
    api.revokeSwapRequest(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
      ...(reason.trim() === '' ? {} : { reason: reason.trim() }),
    }),
  );
}

async function runMutation(mutation: () => Promise<SwapRequest>): Promise<void> {
  errorMessage.value = undefined;
  try {
    await mutation();
    await loadData();
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    errorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  }
}

async function updateGroupRequiresApproval(checked: boolean): Promise<void> {
  try {
    groupSettings.value = await api.updateGroupSwapSettings(props.group.id, {
      requiresApproval: checked,
    });
    infoMessage.value = checked ? '换班已改为需要管理员审批。' : '换班已改为无需管理员审批。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  }
}

async function updateAutoAccept(checked: boolean): Promise<void> {
  try {
    mySettings.value = await api.updateMySwapSettings(props.group.id, {
      autoAcceptSwaps: checked,
    });
    infoMessage.value = checked ? '已开启自动接受换班。' : '已关闭自动接受换班。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '换班数据暂时无法加载，请稍后重试。');
  }
}

function onWindowFocus(): void {
  void loadData();
}

function getCounterpartName(request: SwapRequest): string {
  return request.initiatorMembershipId === myMembershipId.value
    ? (request.targetMemberName ?? '')
    : (request.initiatorMemberName ?? '');
}
</script>

<template>
  <section class="swap-panel workflow-panel" :aria-busy="isLoading || isSubmitting">
    <header class="workflow-panel-heading">
      <div>
        <h2>换班</h2>
        <p>交换双方已发布班次，并跟踪接受与审批状态。</p>
      </div>
      <div class="workflow-heading-actions">
        <t-button
          v-if="canApprove"
          id="swap-admin-create-button"
          variant="outline"
          :disabled="isLoading"
          @click="adminFormVisible = true"
        >
          管理员换班
        </t-button>
        <t-button
          id="swap-create-button"
          theme="primary"
          :disabled="isLoading"
          @click="requestFormVisible = true"
        >
          发起换班
        </t-button>
      </div>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-alert v-if="adminInfoMessage !== undefined" theme="success" :message="adminInfoMessage" />
    <t-loading v-if="isLoading" text="正在加载换班数据" />
    <template v-else>
      <div class="settings-row workflow-settings">
        <label v-if="canApprove" class="settings-field workflow-settings-field">
          <input
            type="checkbox"
            :checked="groupSettings?.requiresApproval === true"
            @change="updateGroupRequiresApproval(($event.target as HTMLInputElement).checked)"
          />
          换班需要管理员审批
        </label>
        <label class="settings-field workflow-settings-field">
          <input
            type="checkbox"
            :checked="mySettings?.autoAcceptSwaps === true"
            @change="updateAutoAccept(($event.target as HTMLInputElement).checked)"
          />
          自动接受换班
        </label>
      </div>

      <section v-if="incomingRequests.length > 0" class="list-section workflow-list-section">
        <h3>待我接受（{{ incomingRequests.length }}）</h3>
        <table class="swap-table workflow-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>我的班次</th>
              <th>对方班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="request in incomingRequests"
              :key="request.id"
              class="workflow-card is-actionable"
            >
              <td class="workflow-person" data-label="发起人">
                {{ request.initiatorMemberName }}
              </td>
              <td data-label="我的班次">
                {{ request.targetAssignment.businessDate }}
                {{ request.targetAssignment.shiftTypeName }}
              </td>
              <td data-label="对方班次">
                {{ request.initiatorAssignment.businessDate }}
                {{ request.initiatorAssignment.shiftTypeName }}
              </td>
              <td class="workflow-actions-cell" data-label="操作">
                <t-button variant="outline" @click="accept(request)">接受</t-button>
                <t-button theme="danger" variant="text" @click="reject(request)">驳回</t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-if="canApprove && pendingApprovals.length > 0"
        class="list-section workflow-list-section"
      >
        <h3>待管理员审批（{{ pendingApprovals.length }}）</h3>
        <table class="swap-table workflow-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>目标成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="request in pendingApprovals"
              :key="request.id"
              class="workflow-card is-actionable"
            >
              <td class="workflow-person" data-label="发起人">
                {{ request.initiatorMemberName }}
              </td>
              <td data-label="目标成员">{{ request.targetMemberName }}</td>
              <td data-label="班次">
                {{ request.initiatorAssignment.businessDate }}
                ↔ {{ request.targetAssignment.businessDate }}
              </td>
              <td class="workflow-actions-cell" data-label="操作">
                <t-button variant="outline" @click="approve(request)">批准</t-button>
                <t-button theme="danger" variant="text" @click="reject(request)">驳回</t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-if="canApprove && handledApprovals.length > 0"
        class="list-section workflow-list-section"
      >
        <h3>已受理记录（{{ handledApprovals.length }}）</h3>
        <table class="swap-table workflow-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>目标成员</th>
              <th>状态</th>
              <th>处理人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in handledApprovals" :key="request.id" class="workflow-card">
              <td class="workflow-person" data-label="发起人">
                {{ request.initiatorMemberName }}
              </td>
              <td data-label="目标成员">{{ request.targetMemberName }}</td>
              <td data-label="状态">
                <span class="workflow-status-badge" :class="getWorkflowStatusTone(request.status)">
                  {{ getSwapStatusLabel(request.status) }}
                </span>
              </td>
              <td data-label="处理人">{{ request.decidedByMemberName ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-if="canApprove && (completedSwaps.length > 0 || archivedSwapCount > 0)"
        class="list-section workflow-list-section"
      >
        <h3>已生效待撤销（{{ completedSwaps.length }}）</h3>
        <table v-if="completedSwaps.length > 0" class="swap-table workflow-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>目标成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in completedSwaps" :key="request.id" class="workflow-card">
              <td class="workflow-person" data-label="发起人">
                {{ request.initiatorMemberName }}
              </td>
              <td data-label="目标成员">{{ request.targetMemberName }}</td>
              <td data-label="班次">
                {{ request.initiatorAssignment.businessDate }}
                → {{ request.targetAssignment.businessDate }}
              </td>
              <td class="workflow-actions-cell" data-label="操作">
                <t-button theme="danger" variant="text" @click="revokeSwap(request)">
                  撤销
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="archivedSwapCount > 0" class="table-empty workflow-empty">
          另有 {{ archivedSwapCount }} 条因后续排班变动而失效的换班记录已自动归档。
        </p>
      </section>

      <section class="list-section workflow-list-section">
        <h3>我的换班申请（{{ mySwapRequests.length }}）</h3>
        <table v-if="mySwapRequests.length > 0" class="swap-table workflow-table">
          <thead>
            <tr>
              <th>对方</th>
              <th>班次</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="request in mySwapRequests"
              :key="request.id"
              class="workflow-card"
              :class="{
                'is-actionable': myPendingRequests.some((pending) => pending.id === request.id),
              }"
            >
              <td class="workflow-person" data-label="对方">{{ getCounterpartName(request) }}</td>
              <td data-label="班次">
                {{
                  formatSwapShiftTime(
                    request.initiatorAssignment.startsAt,
                    request.initiatorAssignment.endsAt,
                  )
                }}
                ↔
                {{
                  formatSwapShiftTime(
                    request.targetAssignment.startsAt,
                    request.targetAssignment.endsAt,
                  )
                }}
              </td>
              <td data-label="状态">
                <span class="workflow-status-badge" :class="getWorkflowStatusTone(request.status)">
                  {{ getSwapStatusLabel(request.status) }}
                </span>
                <small
                  v-if="request.revocationReason !== undefined"
                  class="status-reason workflow-status-reason"
                >
                  {{ request.revocationReason }}
                </small>
                <small
                  v-if="request.revocationBlockedReason !== undefined"
                  class="status-reason workflow-status-reason"
                >
                  {{ request.revocationBlockedReason }}
                </small>
              </td>
              <td class="workflow-actions-cell" data-label="操作">
                <t-button
                  v-if="myPendingRequests.some((pending) => pending.id === request.id)"
                  theme="danger"
                  variant="text"
                  @click="cancel(request)"
                >
                  撤销
                </t-button>
                <t-button
                  v-if="request.status === 'completed' && request.isRevocable !== false"
                  theme="danger"
                  variant="text"
                  @click="revokeSwap(request)"
                >
                  撤销
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="table-empty workflow-empty">暂无换班申请。</p>
      </section>
    </template>

    <ResponsiveSheet v-model:visible="requestFormVisible" title="发起换班">
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <form class="swap-form workflow-form" @submit.prevent="submit">
        <fieldset>
          <legend>选择双方班次</legend>
          <label>
            月份
            <input v-model="businessMonth" type="month" />
          </label>
          <label>
            我的班次
            <t-select
              :value="selectedMyAssignmentId"
              :options="myAssignmentOptions"
              placeholder="选择我的班次"
              @change="onMyAssignmentChange"
            />
          </label>
          <label>
            目标成员
            <t-select
              :value="selectedTargetMembershipId"
              :options="targetOptions"
              placeholder="选择目标成员"
              @change="onTargetChange"
            />
          </label>
          <label>
            目标班次
            <t-select
              :value="selectedTargetAssignmentId"
              :options="targetAssignmentOptions"
              placeholder="选择目标成员的班次"
              @change="onTargetAssignmentChange"
            />
          </label>
          <div class="form-actions workflow-form-actions">
            <t-button variant="outline" :loading="isPreviewing" @click="computePreview">
              生成预览
            </t-button>
            <t-button theme="primary" type="submit" :loading="isSubmitting">提交换班</t-button>
          </div>
        </fieldset>
      </form>

      <template v-if="preview !== undefined">
        <div class="preview-summary workflow-preview">
          <p>我的班次：{{ formatAssignmentSummaryOption(preview.initiatorAssignment) }}</p>
          <p>目标班次：{{ formatAssignmentSummaryOption(preview.targetAssignment) }}</p>
          <p class="next-status">结果：{{ getSwapNextStatusDescription(preview.nextStatus) }}</p>
        </div>
        <t-alert
          v-for="conflict in preview.conflicts"
          :key="conflict.code + conflict.membershipId + (conflict.assignmentId ?? '')"
          theme="error"
          :message="getSwapConflictMessage(conflict)"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet v-model:visible="adminFormVisible" title="管理员直接换班">
      <t-alert v-if="adminErrorMessage !== undefined" theme="error" :message="adminErrorMessage" />
      <form class="swap-form workflow-form" @submit.prevent="submitAdminSwap">
        <fieldset>
          <legend>选择双方班次</legend>
          <p class="workflow-form-hint">直接生效，无需对方同意或审批。</p>
          <label>
            成员一
            <t-select
              :value="adminInitiatorMembershipId"
              :options="adminMemberOptions"
              placeholder="选择成员一"
              @change="onAdminInitiatorChange"
            />
          </label>
          <label>
            成员一的班次
            <t-select
              :value="adminInitiatorAssignmentId"
              :options="adminInitiatorAssignmentOptions"
              placeholder="选择成员一的班次"
              @change="onAdminInitiatorAssignmentChange"
            />
          </label>
          <label>
            成员二
            <t-select
              :value="adminTargetMembershipId"
              :options="adminMemberOptions"
              placeholder="选择成员二"
              @change="onAdminTargetChange"
            />
          </label>
          <label>
            成员二的班次
            <t-select
              :value="adminTargetAssignmentId"
              :options="adminTargetAssignmentOptions"
              placeholder="选择成员二的班次"
              @change="onAdminTargetAssignmentChange"
            />
          </label>
          <div class="form-actions workflow-form-actions">
            <t-button variant="outline" :loading="adminIsPreviewing" @click="computeAdminPreview">
              生成预览
            </t-button>
            <t-button theme="primary" type="submit" :loading="adminIsSubmitting">
              直接执行换班
            </t-button>
          </div>
        </fieldset>
      </form>

      <template v-if="adminPreview !== undefined">
        <div class="preview-summary workflow-preview">
          <p>
            {{
              adminPreview.initiatorAssignment.actualMemberName ??
              adminPreview.initiatorAssignment.plannedMemberName
            }}
            的班次：{{ formatAssignmentSummaryOption(adminPreview.initiatorAssignment) }}
          </p>
          <p>
            {{
              adminPreview.targetAssignment.actualMemberName ??
              adminPreview.targetAssignment.plannedMemberName
            }}
            的班次：{{ formatAssignmentSummaryOption(adminPreview.targetAssignment) }}
          </p>
          <p class="next-status">执行后立即生效，无需审批和成员同意。</p>
        </div>
        <t-alert
          v-for="conflict in adminPreview.conflicts"
          :key="conflict.code + conflict.membershipId + (conflict.assignmentId ?? '')"
          theme="error"
          :message="getSwapConflictMessage(conflict)"
        />
      </template>
    </ResponsiveSheet>
  </section>
</template>

<style scoped src="../workflows/workflow-panel.css"></style>
