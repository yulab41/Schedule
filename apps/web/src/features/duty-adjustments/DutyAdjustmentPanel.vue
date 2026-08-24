<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  GroupDutyAdjustmentSettings,
  GroupMember,
  GroupSummary,
  MemberSwapSettings,
} from '@schedule/contracts';
import {
  resolveWorkflowOperationAttempt,
  type WorkflowOperationAttempt,
} from '@schedule/presentation-core';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import CompactSwitch from '../../components/CompactSwitch.vue';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import TemporalPicker from '../../components/TemporalPicker.vue';
import { responsiveSheetPopupProps } from '../../components/responsive-sheet-popup.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import type { SelectValue } from 'tdesign-vue-next';
import { getCurrentBusinessMonth } from '../calendar/calendar-logic.js';
import {
  createAssignmentOption,
  formatAssignmentSummaryOption,
} from '../workflows/assignment-option.js';
import { getWorkflowStatusTone } from '../workflows/workflow-logic.js';
import {
  buildDutyAdjustmentCandidates,
  formatDutyAdjustmentShiftTime,
  getDutyAdjustmentConflictMessage,
  getDutyAdjustmentNextStatusDescription,
  getDutyAdjustmentStatusLabel,
} from './duty-adjustment-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const businessMonth = ref(getCurrentBusinessMonth());
const calendar = ref<CalendarReadModel>();
const members = ref<GroupMember[]>([]);
const myMembershipId = ref<string>();
const groupSettings = ref<GroupDutyAdjustmentSettings>();
const mySettings = ref<MemberSwapSettings>();
const myDutyAdjustments = ref<DutyAdjustmentRequest[]>([]);
const approvals = ref<DutyAdjustmentRequest[]>([]);
const selectedMyAssignmentId = ref('');
const selectedOvertimeMembershipId = ref('');
const reason = ref('');
const preview = ref<DutyAdjustmentPreview>();
const selectedAdminAssignmentId = ref('');
const selectedAdminOvertimeMembershipId = ref('');
const adminReason = ref('');
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isPreviewing = ref(false);
const isSubmitting = ref(false);
const isAdminSubmitting = ref(false);
const requestFormVisible = ref(false);
const adminFormVisible = ref(false);
const operationAttempts = new Map<
  string,
  WorkflowOperationAttempt<Readonly<Record<string, unknown>>>
>();

function resolveOperation<Payload extends Readonly<Record<string, unknown>>>(
  key: string,
  payload: Payload,
): Readonly<Payload & { readonly operationId: string }> {
  const resolved = resolveWorkflowOperationAttempt(
    operationAttempts.get(key) as WorkflowOperationAttempt<Payload> | undefined,
    payload,
    () => crypto.randomUUID(),
  );
  operationAttempts.set(
    key,
    resolved.attempt as WorkflowOperationAttempt<Readonly<Record<string, unknown>>>,
  );
  return resolved.snapshot;
}

const canApprove = computed(() => props.group.role !== 'member');
const candidates = computed(() =>
  calendar.value === undefined || myMembershipId.value === undefined
    ? undefined
    : buildDutyAdjustmentCandidates(calendar.value, myMembershipId.value),
);
const myAssignmentOptions = computed(() =>
  (candidates.value?.myAssignments ?? []).map((assignment) => createAssignmentOption(assignment)),
);
const overtimeOptions = computed(() =>
  (candidates.value?.overtimeOptions ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);
const adminShiftOptions = computed(() =>
  (candidates.value?.adminShiftOptions ?? []).map((assignment) =>
    createAssignmentOption(assignment),
  ),
);
const selectedAdminShift = computed<CalendarDutyAssignment | undefined>(() =>
  calendar.value?.assignments.find(
    (assignment) => assignment.id === selectedAdminAssignmentId.value,
  ),
);
const adminOvertimeOptions = computed(() => {
  const dutyMembershipId = selectedAdminShift.value
    ? (selectedAdminShift.value.actualMembershipId ?? selectedAdminShift.value.plannedMembershipId)
    : undefined;
  return (calendar.value?.members ?? [])
    .filter((member) => member.membershipId !== dutyMembershipId)
    .map((member) => ({ label: member.realName, value: member.membershipId }));
});
const incomingRequests = computed(() =>
  myDutyAdjustments.value.filter(
    (request) =>
      request.overtimeMembershipId === myMembershipId.value && request.status === 'pending_target',
  ),
);
const pendingApprovals = computed(() =>
  approvals.value.filter((request) => request.status === 'pending_approval'),
);
const handledApprovals = computed(() =>
  approvals.value.filter((request) =>
    ['cancelled', 'rejected', 'revoked'].includes(request.status),
  ),
);
const completedAdjustments = computed(() =>
  approvals.value.filter(
    (request) => request.status === 'completed' && request.isRevocable !== false,
  ),
);
const archivedDutyCount = computed(
  () =>
    approvals.value.filter(
      (request) => request.status === 'completed' && request.isRevocable === false,
    ).length,
);
const myPendingRequests = computed(() =>
  myDutyAdjustments.value.filter(
    (request) =>
      request.deductedMembershipId === myMembershipId.value &&
      (request.status === 'pending_target' || request.status === 'pending_approval'),
  ),
);

watch(
  () => [props.group.id, businessMonth.value],
  () => {
    resetForm();
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
        api.getGroupDutyAdjustmentSettings(props.group.id),
        api.getMyDutyAdjustmentSettings(props.group.id),
        api.listMyDutyAdjustments(props.group.id),
        canApprove.value ? api.listDutyAdjustmentApprovals(props.group.id) : Promise.resolve([]),
      ]);
    calendar.value = nextCalendar;
    members.value = nextMembers;
    groupSettings.value = nextGroupSettings;
    mySettings.value = nextMySettings;
    myDutyAdjustments.value = nextMine;
    approvals.value = nextApprovals;
    const currentUser = nextMembers.find((member) => member.isCurrentUser);
    myMembershipId.value = currentUser?.id;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

function resetForm(): void {
  selectedMyAssignmentId.value = '';
  selectedOvertimeMembershipId.value = '';
  reason.value = '';
  preview.value = undefined;
  selectedAdminAssignmentId.value = '';
  selectedAdminOvertimeMembershipId.value = '';
  adminReason.value = '';
}

function onMyAssignmentChange(value: SelectValue): void {
  if (typeof value === 'string') {
    selectedMyAssignmentId.value = value;
    preview.value = undefined;
  }
}

function onOvertimeChange(value: SelectValue): void {
  if (typeof value === 'string') {
    selectedOvertimeMembershipId.value = value;
    preview.value = undefined;
  }
}

function onAdminAssignmentChange(value: SelectValue): void {
  if (typeof value === 'string') {
    selectedAdminAssignmentId.value = value;
    selectedAdminOvertimeMembershipId.value = '';
  }
}

function onAdminOvertimeChange(value: SelectValue): void {
  if (typeof value === 'string') {
    selectedAdminOvertimeMembershipId.value = value;
  }
}

async function computePreview(): Promise<void> {
  errorMessage.value = undefined;
  if (selectedMyAssignmentId.value === '' || selectedOvertimeMembershipId.value === '') {
    errorMessage.value = '请先选择自己的班次和加班成员。';
    return;
  }

  isPreviewing.value = true;
  try {
    preview.value = await api.previewDutyAdjustment(props.group.id, {
      coveredAssignmentId: selectedMyAssignmentId.value,
      overtimeMembershipId: selectedOvertimeMembershipId.value,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    errorMessage.value = toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。');
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
  const operationKey = `${props.group.id}:duty-adjustment:create`;
  try {
    const created = await api.createDutyAdjustmentRequest(
      props.group.id,
      resolveOperation(operationKey, {
        coveredAssignmentId: selectedMyAssignmentId.value,
        overtimeMembershipId: selectedOvertimeMembershipId.value,
        ...(reason.value.trim() === '' ? {} : { reason: reason.value.trim() }),
      }),
    );
    operationAttempts.delete(operationKey);
    infoMessage.value =
      created.status === 'completed'
        ? '加扣班已生效，加班成员将代值该班次。'
        : created.status === 'pending_approval'
          ? '加扣班申请已提交，等待管理员审批。'
          : '加扣班申请已提交，等待加班成员接受。';
    resetForm();
    await loadData();
    requestFormVisible.value = false;
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    errorMessage.value = toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。');
  } finally {
    isSubmitting.value = false;
  }
}

async function submitDirect(): Promise<void> {
  errorMessage.value = undefined;
  if (selectedAdminAssignmentId.value === '' || selectedAdminOvertimeMembershipId.value === '') {
    errorMessage.value = '请选择被代班班次和加班成员。';
    return;
  }

  isAdminSubmitting.value = true;
  const operationKey = `${props.group.id}:duty-adjustment:create-direct`;
  try {
    const created = await api.createDirectDutyAdjustment(
      props.group.id,
      resolveOperation(operationKey, {
        coveredAssignmentId: selectedAdminAssignmentId.value,
        overtimeMembershipId: selectedAdminOvertimeMembershipId.value,
        ...(adminReason.value.trim() === '' ? {} : { reason: adminReason.value.trim() }),
      }),
    );
    operationAttempts.delete(operationKey);
    infoMessage.value = `管理员代值已生效：${created.deductedMemberName ?? ''} 扣班，${created.overtimeMemberName ?? ''} 加班。`;
    resetForm();
    await loadData();
    adminFormVisible.value = false;
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    errorMessage.value = toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。');
  } finally {
    isAdminSubmitting.value = false;
  }
}

async function accept(request: DutyAdjustmentRequest): Promise<void> {
  const operationKey = getMutationOperationKey('accept', request);
  await runMutation(operationKey, () =>
    api.acceptDutyAdjustment(
      props.group.id,
      request.id,
      resolveOperation(operationKey, {
        expectedVersion: request.version,
      }),
    ),
  );
}

async function approve(request: DutyAdjustmentRequest): Promise<void> {
  const operationKey = getMutationOperationKey('approve', request);
  await runMutation(operationKey, () =>
    api.approveDutyAdjustment(
      props.group.id,
      request.id,
      resolveOperation(operationKey, {
        expectedVersion: request.version,
      }),
    ),
  );
}

async function reject(request: DutyAdjustmentRequest): Promise<void> {
  if (!window.confirm(`确定驳回 ${request.deductedMemberName ?? ''} 的加扣班申请吗？`)) {
    return;
  }
  const operationKey = getMutationOperationKey('reject', request);
  await runMutation(operationKey, () =>
    api.rejectDutyAdjustment(
      props.group.id,
      request.id,
      resolveOperation(operationKey, {
        expectedVersion: request.version,
      }),
    ),
  );
}

async function cancel(request: DutyAdjustmentRequest): Promise<void> {
  if (!window.confirm('确定撤销该加扣班申请吗？')) {
    return;
  }
  const operationKey = getMutationOperationKey('cancel', request);
  await runMutation(operationKey, () =>
    api.cancelDutyAdjustment(
      props.group.id,
      request.id,
      resolveOperation(operationKey, {
        expectedVersion: request.version,
      }),
    ),
  );
}

async function revoke(request: DutyAdjustmentRequest): Promise<void> {
  const revokeReason = window.prompt(
    `确定撤销 ${request.deductedMemberName ?? ''} 与 ${request.overtimeMemberName ?? ''} 的加扣班关系吗？请填写撤销原因（选填）：`,
    '',
  );
  if (revokeReason === null) {
    return;
  }
  const operationKey = getMutationOperationKey('revoke', request);
  await runMutation(operationKey, () =>
    api.revokeDutyAdjustment(
      props.group.id,
      request.id,
      resolveOperation(operationKey, {
        expectedVersion: request.version,
        ...(revokeReason.trim() === '' ? {} : { reason: revokeReason.trim() }),
      }),
    ),
  );
}

function getMutationOperationKey(action: string, request: DutyAdjustmentRequest): string {
  return `${props.group.id}:duty-adjustment:${action}:${request.id}:${request.version}`;
}

async function runMutation(
  operationKey: string,
  mutation: () => Promise<DutyAdjustmentRequest>,
): Promise<void> {
  errorMessage.value = undefined;
  try {
    await mutation();
    operationAttempts.delete(operationKey);
    infoMessage.value = '加扣班状态已更新。';
    await loadData();
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      await loadData();
    }
    errorMessage.value = toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。');
  }
}

async function updateGroupRequiresApproval(checked: boolean): Promise<void> {
  try {
    groupSettings.value = await api.updateGroupDutyAdjustmentSettings(props.group.id, {
      requiresApproval: checked,
    });
    infoMessage.value = checked ? '加扣班已改为需要管理员审批。' : '加扣班已改为无需管理员审批。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。');
  }
}

async function updateAutoAccept(checked: boolean): Promise<void> {
  try {
    mySettings.value = await api.updateMySwapSettings(props.group.id, {
      autoAcceptSwaps: checked,
    });
    infoMessage.value = checked ? '已开启自动接受换班/加扣班。' : '已关闭自动接受换班/加扣班。';
  } catch (error) {
    errorMessage.value = toUserMessage(error, '加扣班数据暂时无法加载，请稍后重试。');
  }
}

function onWindowFocus(): void {
  void loadData();
}

function getCounterpartName(request: DutyAdjustmentRequest): string {
  return request.overtimeMembershipId === myMembershipId.value
    ? (request.deductedMemberName ?? '')
    : (request.overtimeMemberName ?? '');
}
</script>

<template>
  <section
    class="duty-adjustment-panel workflow-panel"
    :aria-busy="isLoading || isSubmitting || isAdminSubmitting"
  >
    <header class="workflow-panel-heading">
      <div>
        <p>安排成员代值已发布班次，并跟踪接受与审批状态。</p>
      </div>
      <div class="workflow-heading-actions">
        <t-button
          v-if="canApprove"
          id="duty-admin-create-button"
          variant="outline"
          :disabled="isLoading"
          @click="adminFormVisible = true"
        >
          管理员代值
        </t-button>
        <t-button
          id="duty-create-button"
          theme="primary"
          :disabled="isLoading"
          @click="requestFormVisible = true"
        >
          发起加扣班
        </t-button>
      </div>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载加扣班数据" />
    <template v-else>
      <div class="settings-row workflow-settings">
        <div v-if="canApprove" class="settings-field workflow-settings-field">
          <span>加扣班需要管理员审批</span>
          <CompactSwitch
            label="加扣班需要管理员审批"
            :model-value="groupSettings?.requiresApproval === true"
            @update:model-value="updateGroupRequiresApproval"
          />
        </div>
        <div class="settings-field workflow-settings-field">
          <span>自动接受换班/加扣班</span>
          <CompactSwitch
            label="自动接受换班/加扣班"
            :model-value="mySettings?.autoAcceptSwaps === true"
            @update:model-value="updateAutoAccept"
          />
        </div>
      </div>

      <section v-if="incomingRequests.length > 0" class="list-section workflow-list-section">
        <h3>待我接受（{{ incomingRequests.length }}）</h3>
        <table class="duty-adjustment-table workflow-table">
          <thead>
            <tr>
              <th>扣班成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="request in incomingRequests"
              :key="request.id"
              class="workflow-card is-actionable"
            >
              <td class="workflow-person" data-label="扣班成员">
                {{ request.deductedMemberName }}
              </td>
              <td data-label="班次">
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
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
        <table class="duty-adjustment-table workflow-table">
          <thead>
            <tr>
              <th>扣班成员</th>
              <th>加班成员</th>
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
              <td class="workflow-person" data-label="扣班成员">
                {{ request.deductedMemberName }}
              </td>
              <td data-label="加班成员">{{ request.overtimeMemberName }}</td>
              <td data-label="班次">
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
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
        <table class="duty-adjustment-table workflow-table">
          <thead>
            <tr>
              <th>扣班成员</th>
              <th>加班成员</th>
              <th>班次</th>
              <th>状态</th>
              <th>处理人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in handledApprovals" :key="request.id" class="workflow-card">
              <td class="workflow-person" data-label="扣班成员">
                {{ request.deductedMemberName }}
              </td>
              <td data-label="加班成员">{{ request.overtimeMemberName }}</td>
              <td data-label="班次">
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
              </td>
              <td data-label="状态">
                <span class="workflow-status-badge" :class="getWorkflowStatusTone(request.status)">
                  {{ getDutyAdjustmentStatusLabel(request.status) }}
                </span>
              </td>
              <td data-label="处理人">{{ request.decidedByMemberName ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-if="canApprove && (completedAdjustments.length > 0 || archivedDutyCount > 0)"
        class="list-section workflow-list-section"
      >
        <h3>已生效待撤销（{{ completedAdjustments.length }}）</h3>
        <table v-if="completedAdjustments.length > 0" class="duty-adjustment-table workflow-table">
          <thead>
            <tr>
              <th>扣班成员</th>
              <th>加班成员</th>
              <th>班次</th>
              <th>处理人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in completedAdjustments" :key="request.id" class="workflow-card">
              <td class="workflow-person" data-label="扣班成员">
                {{ request.deductedMemberName }}
              </td>
              <td data-label="加班成员">{{ request.overtimeMemberName }}</td>
              <td data-label="班次">
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
              </td>
              <td data-label="处理人">{{ request.decidedByMemberName ?? '—' }}</td>
              <td class="workflow-actions-cell" data-label="操作">
                <t-button theme="danger" variant="text" @click="revoke(request)">撤销</t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="archivedDutyCount > 0" class="table-empty workflow-empty">
          另有 {{ archivedDutyCount }} 条因后续排班变动而失效的加扣班记录已自动归档。
        </p>
      </section>

      <section class="list-section workflow-list-section">
        <h3>我的加扣班记录（{{ myDutyAdjustments.length }}）</h3>
        <table v-if="myDutyAdjustments.length > 0" class="duty-adjustment-table workflow-table">
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
              v-for="request in myDutyAdjustments"
              :key="request.id"
              class="workflow-card"
              :class="{
                'is-actionable': myPendingRequests.some((pending) => pending.id === request.id),
              }"
            >
              <td class="workflow-person" data-label="对方">{{ getCounterpartName(request) }}</td>
              <td data-label="班次">
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
              </td>
              <td data-label="状态">
                <span class="workflow-status-badge" :class="getWorkflowStatusTone(request.status)">
                  {{ getDutyAdjustmentStatusLabel(request.status) }}
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
                  @click="revoke(request)"
                >
                  撤销
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="table-empty workflow-empty">暂无加扣班记录。</p>
      </section>
    </template>

    <ResponsiveSheet v-model:visible="requestFormVisible" title="发起加扣班">
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <form class="duty-adjustment-form workflow-form" @submit.prevent="submit">
        <fieldset>
          <legend>安排成员代值我的班次</legend>
          <label>
            月份
            <TemporalPicker v-model="businessMonth" kind="month" label="月份" />
          </label>
          <label>
            我的班次
            <t-select
              :value="selectedMyAssignmentId"
              :options="myAssignmentOptions"
              :popup-props="responsiveSheetPopupProps"
              placeholder="选择我的班次"
              @change="onMyAssignmentChange"
            />
          </label>
          <label>
            加班成员
            <t-select
              :value="selectedOvertimeMembershipId"
              :options="overtimeOptions"
              :popup-props="responsiveSheetPopupProps"
              placeholder="选择代值的加班成员"
              @change="onOvertimeChange"
            />
          </label>
          <label>
            原因（可选）
            <input v-model="reason" maxlength="1000" placeholder="填写代值原因" />
          </label>
          <div class="form-actions workflow-form-actions">
            <t-button variant="outline" :loading="isPreviewing" @click="computePreview">
              生成预览
            </t-button>
            <t-button theme="primary" type="submit" :loading="isSubmitting">提交申请</t-button>
          </div>
        </fieldset>
      </form>

      <template v-if="preview !== undefined">
        <div class="preview-summary workflow-preview">
          <p>被代班班次：{{ formatAssignmentSummaryOption(preview.coveredAssignment) }}</p>
          <p>
            扣班成员：{{ preview.deductedMemberName }}；加班成员：{{ preview.overtimeMemberName }}
          </p>
          <p class="next-status">
            结果：{{ getDutyAdjustmentNextStatusDescription(preview.nextStatus) }}
          </p>
        </div>
        <t-alert
          v-for="conflict in preview.conflicts"
          :key="conflict.code + conflict.membershipId + (conflict.assignmentId ?? '')"
          theme="error"
          :message="getDutyAdjustmentConflictMessage(conflict)"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet v-model:visible="adminFormVisible" title="管理员直接代值">
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <form class="duty-adjustment-form workflow-form" @submit.prevent="submitDirect">
        <fieldset>
          <legend>选择代值班次与成员</legend>
          <p class="workflow-form-hint">直接生效，不需要双方确认或审批；原因选填。</p>
          <label>
            月份
            <TemporalPicker v-model="businessMonth" kind="month" label="月份" />
          </label>
          <label>
            被代班班次
            <t-select
              :value="selectedAdminAssignmentId"
              :options="adminShiftOptions"
              :popup-props="responsiveSheetPopupProps"
              placeholder="选择需要代值的班次"
              @change="onAdminAssignmentChange"
            />
          </label>
          <label>
            加班成员
            <t-select
              :value="selectedAdminOvertimeMembershipId"
              :options="adminOvertimeOptions"
              :popup-props="responsiveSheetPopupProps"
              placeholder="选择代值的加班成员"
              @change="onAdminOvertimeChange"
            />
          </label>
          <label>
            原因（选填）
            <input v-model="adminReason" maxlength="1000" placeholder="填写代值原因（选填）" />
          </label>
          <div class="form-actions workflow-form-actions">
            <t-button theme="primary" type="submit" :loading="isAdminSubmitting">
              直接代值
            </t-button>
          </div>
        </fieldset>
      </form>
    </ResponsiveSheet>
  </section>
</template>

<style scoped src="../workflows/workflow-panel.css"></style>
