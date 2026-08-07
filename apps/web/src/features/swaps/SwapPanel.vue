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
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { getCurrentBusinessMonth } from '../calendar/calendar-logic.js';
import {
  buildSwapCandidates,
  formatSwapAssignmentOption,
  formatSwapAssignmentSummaryOption,
  formatSwapShiftTime,
  getSwapConflictMessage,
  getSwapNextStatusDescription,
  getSwapStatusLabel,
} from './swap-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
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

const canApprove = computed(() => props.group.role !== 'member');
const candidates = computed(() =>
  calendar.value === undefined || myMembershipId.value === undefined
    ? undefined
    : buildSwapCandidates(calendar.value, myMembershipId.value),
);
const myAssignmentOptions = computed(() =>
  (candidates.value?.myAssignments ?? []).map((assignment) => ({
    label: formatSwapAssignmentOption(assignment),
    value: assignment.id,
  })),
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
  return (candidates.value?.assignmentsByTarget.get(targetMembershipId) ?? []).map(
    (assignment) => ({
      label: formatSwapAssignmentOption(assignment),
      value: assignment.id,
    }),
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
    (assignment) => ({
      label: formatSwapAssignmentOption(assignment),
      value: assignment.id,
    }),
  );
});
const adminTargetAssignmentOptions = computed(() => {
  if (adminTargetMembershipId.value === '') {
    return [];
  }
  return (candidates.value?.assignmentsByTarget.get(adminTargetMembershipId.value) ?? []).map(
    (assignment) => ({
      label: formatSwapAssignmentOption(assignment),
      value: assignment.id,
    }),
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

function onTargetChange(value: string | number | boolean | object | null): void {
  if (typeof value !== 'string') {
    return;
  }
  selectedTargetMembershipId.value = value;
  selectedTargetAssignmentId.value = '';
  preview.value = undefined;
}

function onMyAssignmentChange(value: string | number | boolean | object | null): void {
  if (typeof value === 'string') {
    selectedMyAssignmentId.value = value;
    preview.value = undefined;
  }
}

function onTargetAssignmentChange(value: string | number | boolean | object | null): void {
  if (typeof value === 'string') {
    selectedTargetAssignmentId.value = value;
    preview.value = undefined;
  }
}

function onAdminInitiatorChange(value: string | number | boolean | object | null): void {
  if (typeof value !== 'string') {
    return;
  }
  adminInitiatorMembershipId.value = value;
  adminInitiatorAssignmentId.value = '';
  adminPreview.value = undefined;
}

function onAdminTargetChange(value: string | number | boolean | object | null): void {
  if (typeof value !== 'string') {
    return;
  }
  adminTargetMembershipId.value = value;
  adminTargetAssignmentId.value = '';
  adminPreview.value = undefined;
}

function onAdminInitiatorAssignmentChange(value: string | number | boolean | object | null): void {
  if (typeof value === 'string') {
    adminInitiatorAssignmentId.value = value;
    adminPreview.value = undefined;
  }
}

function onAdminTargetAssignmentChange(value: string | number | boolean | object | null): void {
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
  <section class="swap-panel" :aria-busy="isLoading || isSubmitting">
    <h2>换班</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载换班数据" />
    <template v-else>
      <div class="settings-row">
        <label v-if="canApprove" class="settings-field">
          <input
            type="checkbox"
            :checked="groupSettings?.requiresApproval === true"
            @change="updateGroupRequiresApproval(($event.target as HTMLInputElement).checked)"
          />
          换班需要管理员审批
        </label>
        <label class="settings-field">
          <input
            type="checkbox"
            :checked="mySettings?.autoAcceptSwaps === true"
            @change="updateAutoAccept(($event.target as HTMLInputElement).checked)"
          />
          自动接受换班
        </label>
      </div>

      <form class="swap-form" @submit.prevent="submit">
        <fieldset>
          <legend>发起换班</legend>
          <label>
            月份
            <input v-model="businessMonth" type="month" />
          </label>
          <label>
            我的班次
            <t-select
              :value="selectedMyAssignmentId"
              :options="myAssignmentOptions"
              placeholder="选择我的未来班次"
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
              placeholder="选择目标成员的未来班次"
              @change="onTargetAssignmentChange"
            />
          </label>
          <div class="form-actions">
            <t-button variant="outline" :loading="isPreviewing" @click="computePreview">
              生成预览
            </t-button>
            <t-button theme="primary" type="submit" :loading="isSubmitting">提交换班</t-button>
          </div>
        </fieldset>
      </form>

      <template v-if="preview !== undefined">
        <div class="preview-summary">
          <p>我的班次：{{ formatSwapAssignmentSummaryOption(preview.initiatorAssignment) }}</p>
          <p>目标班次：{{ formatSwapAssignmentSummaryOption(preview.targetAssignment) }}</p>
          <p class="next-status">结果：{{ getSwapNextStatusDescription(preview.nextStatus) }}</p>
        </div>
        <t-alert
          v-for="conflict in preview.conflicts"
          :key="conflict.code + conflict.membershipId + (conflict.assignmentId ?? '')"
          theme="error"
          :message="getSwapConflictMessage(conflict)"
        />
      </template>

      <section v-if="canApprove" class="admin-swap-section">
        <h3>管理员换班（无需对方同意/审批）</h3>
        <t-alert
          v-if="adminErrorMessage !== undefined"
          theme="error"
          :message="adminErrorMessage"
        />
        <t-alert
          v-if="adminInfoMessage !== undefined"
          theme="success"
          :message="adminInfoMessage"
        />
        <form class="swap-form" @submit.prevent="submitAdminSwap">
          <fieldset>
            <legend>选择双方班次</legend>
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
                placeholder="选择成员一的未来班次"
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
                placeholder="选择成员二的未来班次"
                @change="onAdminTargetAssignmentChange"
              />
            </label>
            <div class="form-actions">
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
          <div class="preview-summary">
            <p>
              {{
                adminPreview.initiatorAssignment.actualMemberName ??
                adminPreview.initiatorAssignment.plannedMemberName
              }}
              的班次：{{ formatSwapAssignmentSummaryOption(adminPreview.initiatorAssignment) }}
            </p>
            <p>
              {{
                adminPreview.targetAssignment.actualMemberName ??
                adminPreview.targetAssignment.plannedMemberName
              }}
              的班次：{{ formatSwapAssignmentSummaryOption(adminPreview.targetAssignment) }}
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
      </section>

      <section v-if="incomingRequests.length > 0" class="list-section">
        <h3>待我接受（{{ incomingRequests.length }}）</h3>
        <table class="swap-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>我的班次</th>
              <th>对方班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in incomingRequests" :key="request.id">
              <td>{{ request.initiatorMemberName }}</td>
              <td>
                {{ request.targetAssignment.businessDate }}
                {{ request.targetAssignment.shiftTypeName }}
              </td>
              <td>
                {{ request.initiatorAssignment.businessDate }}
                {{ request.initiatorAssignment.shiftTypeName }}
              </td>
              <td>
                <t-button variant="outline" @click="accept(request)">接受</t-button>
                <t-button theme="danger" variant="text" @click="reject(request)">驳回</t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="canApprove && pendingApprovals.length > 0" class="list-section">
        <h3>待管理员审批（{{ pendingApprovals.length }}）</h3>
        <table class="swap-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>目标成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in pendingApprovals" :key="request.id">
              <td>{{ request.initiatorMemberName }}</td>
              <td>{{ request.targetMemberName }}</td>
              <td>
                {{ request.initiatorAssignment.businessDate }}
                ↔ {{ request.targetAssignment.businessDate }}
              </td>
              <td>
                <t-button variant="outline" @click="approve(request)">批准</t-button>
                <t-button theme="danger" variant="text" @click="reject(request)">驳回</t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="canApprove && handledApprovals.length > 0" class="list-section">
        <h3>已受理记录（{{ handledApprovals.length }}）</h3>
        <table class="swap-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>目标成员</th>
              <th>状态</th>
              <th>处理人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in handledApprovals" :key="request.id">
              <td>{{ request.initiatorMemberName }}</td>
              <td>{{ request.targetMemberName }}</td>
              <td>{{ getSwapStatusLabel(request.status) }}</td>
              <td>{{ request.decidedByMemberName ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section
        v-if="canApprove && (completedSwaps.length > 0 || archivedSwapCount > 0)"
        class="list-section"
      >
        <h3>已生效待撤销（{{ completedSwaps.length }}）</h3>
        <table v-if="completedSwaps.length > 0" class="swap-table">
          <thead>
            <tr>
              <th>发起人</th>
              <th>目标成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in completedSwaps" :key="request.id">
              <td>{{ request.initiatorMemberName }}</td>
              <td>{{ request.targetMemberName }}</td>
              <td>
                {{ request.initiatorAssignment.businessDate }}
                → {{ request.targetAssignment.businessDate }}
              </td>
              <td>
                <t-button theme="danger" variant="text" @click="revokeSwap(request)">
                  撤销
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="archivedSwapCount > 0" class="table-empty">
          另有 {{ archivedSwapCount }} 条因后续排班变动而失效的换班记录已自动归档。
        </p>
      </section>

      <section class="list-section">
        <h3>我的换班申请（{{ mySwapRequests.length }}）</h3>
        <table v-if="mySwapRequests.length > 0" class="swap-table">
          <thead>
            <tr>
              <th>对方</th>
              <th>班次</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in mySwapRequests" :key="request.id">
              <td>{{ getCounterpartName(request) }}</td>
              <td>
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
              <td>
                {{ getSwapStatusLabel(request.status) }}
                <small v-if="request.revocationReason !== undefined" class="status-reason">
                  {{ request.revocationReason }}
                </small>
                <small v-if="request.revocationBlockedReason !== undefined" class="status-reason">
                  {{ request.revocationBlockedReason }}
                </small>
              </td>
              <td>
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
        <p v-else class="table-empty">暂无换班申请。</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.swap-panel {
  display: grid;
  gap: 16px;
}

.swap-panel h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.swap-panel h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.admin-swap-section {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #fefce8;
  border: 1px solid #e5d9a8;
  border-radius: 6px;
}

.settings-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.settings-field {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #374151;
  font-size: 14px;
}

.swap-form fieldset {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.swap-form legend {
  color: #374151;
  font-weight: 600;
}

.swap-form label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
}

.swap-form input[type='month'] {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.preview-summary {
  display: grid;
  gap: 6px;
  padding: 12px;
  background: #eff6ff;
  border-radius: 6px;
  font-size: 14px;
}

.preview-summary p {
  margin: 0;
  color: #1f2937;
}

.next-status {
  font-weight: 600;
}

.swap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #ffffff;
}

.swap-table th,
.swap-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.swap-table th {
  color: #374151;
  background: #f8fafc;
}

.table-empty {
  margin: 0;
  padding: 16px;
  color: #6b7280;
  font-size: 13px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.status-reason {
  display: block;
  margin-top: 2px;
  color: #92400e;
}
</style>
