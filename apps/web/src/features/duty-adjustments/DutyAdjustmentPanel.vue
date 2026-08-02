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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { getCurrentBusinessMonth } from '../calendar/calendar-logic.js';
import {
  buildDutyAdjustmentCandidates,
  formatDutyAdjustmentAssignmentOption,
  formatDutyAdjustmentAssignmentSummaryOption,
  formatDutyAdjustmentShiftTime,
  getDutyAdjustmentConflictMessage,
  getDutyAdjustmentNextStatusDescription,
  getDutyAdjustmentStatusLabel,
} from './duty-adjustment-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
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

const canApprove = computed(() => props.group.role !== 'member');
const candidates = computed(() =>
  calendar.value === undefined || myMembershipId.value === undefined
    ? undefined
    : buildDutyAdjustmentCandidates(calendar.value, myMembershipId.value),
);
const myAssignmentOptions = computed(() =>
  (candidates.value?.myAssignments ?? []).map((assignment) => ({
    label: formatDutyAdjustmentAssignmentOption(assignment),
    value: assignment.id,
  })),
);
const overtimeOptions = computed(() =>
  (candidates.value?.overtimeOptions ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);
const adminShiftOptions = computed(() =>
  (candidates.value?.adminShiftOptions ?? []).map((assignment) => ({
    label: formatDutyAdjustmentAssignmentOption(assignment),
    value: assignment.id,
  })),
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
const completedAdjustments = computed(() =>
  approvals.value.filter((request) => request.status === 'completed'),
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
        api.getMySwapSettings(props.group.id),
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
    errorMessage.value = getErrorMessage(error);
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

function onMyAssignmentChange(value: string | number | boolean | object | null): void {
  if (typeof value === 'string') {
    selectedMyAssignmentId.value = value;
    preview.value = undefined;
  }
}

function onOvertimeChange(value: string | number | boolean | object | null): void {
  if (typeof value === 'string') {
    selectedOvertimeMembershipId.value = value;
    preview.value = undefined;
  }
}

function onAdminAssignmentChange(value: string | number | boolean | object | null): void {
  if (typeof value === 'string') {
    selectedAdminAssignmentId.value = value;
    selectedAdminOvertimeMembershipId.value = '';
  }
}

function onAdminOvertimeChange(value: string | number | boolean | object | null): void {
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
      errorMessage.value = '班次或成员状态已变化，请刷新后重新选择。';
      void loadData();
    } else {
      errorMessage.value = getErrorMessage(error);
    }
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
    const created = await api.createDutyAdjustmentRequest(props.group.id, {
      coveredAssignmentId: selectedMyAssignmentId.value,
      operationId: crypto.randomUUID(),
      overtimeMembershipId: selectedOvertimeMembershipId.value,
      ...(reason.value.trim() === '' ? {} : { reason: reason.value.trim() }),
    });
    infoMessage.value =
      created.status === 'completed'
        ? '加扣班已生效，加班成员将代值该班次。'
        : created.status === 'pending_approval'
          ? '加扣班申请已提交，等待管理员审批。'
          : '加扣班申请已提交，等待加班成员接受。';
    resetForm();
    await loadData();
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      errorMessage.value = '该班次已有待处理或生效中的加扣班/换班关系，请先处理后再试。';
      void loadData();
    } else {
      errorMessage.value = getErrorMessage(error);
    }
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
  if (adminReason.value.trim() === '') {
    errorMessage.value = '管理员直接代值必须填写原因。';
    return;
  }

  isAdminSubmitting.value = true;
  try {
    const created = await api.createDirectDutyAdjustment(props.group.id, {
      coveredAssignmentId: selectedAdminAssignmentId.value,
      operationId: crypto.randomUUID(),
      overtimeMembershipId: selectedAdminOvertimeMembershipId.value,
      reason: adminReason.value.trim(),
    });
    infoMessage.value = `管理员代值已生效：${created.deductedMemberName ?? ''} 扣班，${created.overtimeMemberName ?? ''} 加班。`;
    resetForm();
    await loadData();
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      errorMessage.value = '该班次已有待处理或生效中的加扣班/换班关系，请先处理后再试。';
      void loadData();
    } else {
      errorMessage.value = getErrorMessage(error);
    }
  } finally {
    isAdminSubmitting.value = false;
  }
}

async function accept(request: DutyAdjustmentRequest): Promise<void> {
  await runMutation(() =>
    api.acceptDutyAdjustment(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function approve(request: DutyAdjustmentRequest): Promise<void> {
  await runMutation(() =>
    api.approveDutyAdjustment(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function reject(request: DutyAdjustmentRequest): Promise<void> {
  if (!window.confirm(`确定驳回 ${request.deductedMemberName ?? ''} 的加扣班申请吗？`)) {
    return;
  }
  await runMutation(() =>
    api.rejectDutyAdjustment(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function cancel(request: DutyAdjustmentRequest): Promise<void> {
  if (!window.confirm('确定撤销该加扣班申请吗？')) {
    return;
  }
  await runMutation(() =>
    api.cancelDutyAdjustment(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
    }),
  );
}

async function revoke(request: DutyAdjustmentRequest): Promise<void> {
  const revokeReason = window.prompt(
    `确定撤销 ${request.deductedMemberName ?? ''} 与 ${request.overtimeMemberName ?? ''} 的加扣班关系吗？请填写撤销原因（必填）：`,
    '',
  );
  if (revokeReason === null) {
    return;
  }
  if (revokeReason.trim() === '') {
    errorMessage.value = '撤销加扣班必须填写原因。';
    return;
  }
  await runMutation(() =>
    api.revokeDutyAdjustment(props.group.id, request.id, {
      expectedVersion: request.version,
      operationId: crypto.randomUUID(),
      reason: revokeReason.trim(),
    }),
  );
}

async function runMutation(mutation: () => Promise<DutyAdjustmentRequest>): Promise<void> {
  errorMessage.value = undefined;
  try {
    await mutation();
    infoMessage.value = '加扣班状态已更新。';
    await loadData();
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'CONFLICT') {
      errorMessage.value = '加扣班记录或班次状态已变化，请刷新后重试。';
      void loadData();
    } else {
      errorMessage.value = getErrorMessage(error);
    }
  }
}

async function updateGroupRequiresApproval(checked: boolean): Promise<void> {
  try {
    groupSettings.value = await api.updateGroupDutyAdjustmentSettings(props.group.id, {
      requiresApproval: checked,
    });
    infoMessage.value = checked ? '加扣班已改为需要管理员审批。' : '加扣班已改为无需管理员审批。';
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  }
}

async function updateAutoAccept(checked: boolean): Promise<void> {
  try {
    mySettings.value = await api.updateMySwapSettings(props.group.id, {
      autoAcceptSwaps: checked,
    });
    infoMessage.value = checked ? '已开启自动接受换班/加扣班。' : '已关闭自动接受换班/加扣班。';
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
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

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '加扣班数据暂时无法加载，请稍后重试。';
}
</script>

<template>
  <section
    class="duty-adjustment-panel"
    :aria-busy="isLoading || isSubmitting || isAdminSubmitting"
  >
    <h2>加扣班</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载加扣班数据" />
    <template v-else>
      <div class="settings-row">
        <label v-if="canApprove" class="settings-field">
          <input
            type="checkbox"
            :checked="groupSettings?.requiresApproval === true"
            @change="updateGroupRequiresApproval(($event.target as HTMLInputElement).checked)"
          />
          加扣班需要管理员审批
        </label>
        <label class="settings-field">
          <input
            type="checkbox"
            :checked="mySettings?.autoAcceptSwaps === true"
            @change="updateAutoAccept(($event.target as HTMLInputElement).checked)"
          />
          自动接受换班/加扣班
        </label>
      </div>

      <form class="duty-adjustment-form" @submit.prevent="submit">
        <fieldset>
          <legend>发起加扣班（代我的班次）</legend>
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
            加班成员
            <t-select
              :value="selectedOvertimeMembershipId"
              :options="overtimeOptions"
              placeholder="选择代值的加班成员"
              @change="onOvertimeChange"
            />
          </label>
          <label>
            原因（可选）
            <input v-model="reason" maxlength="1000" placeholder="填写代值原因" />
          </label>
          <div class="form-actions">
            <t-button variant="outline" :loading="isPreviewing" @click="computePreview">
              生成预览
            </t-button>
            <t-button theme="primary" type="submit" :loading="isSubmitting">提交申请</t-button>
          </div>
        </fieldset>
      </form>

      <template v-if="preview !== undefined">
        <div class="preview-summary">
          <p>
            被代班班次：{{ formatDutyAdjustmentAssignmentSummaryOption(preview.coveredAssignment) }}
          </p>
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

      <form v-if="canApprove" class="duty-adjustment-form" @submit.prevent="submitDirect">
        <fieldset>
          <legend>管理员直接代值</legend>
          <p class="field-hint">直接生效，不需要双方确认或审批，但必须填写原因。</p>
          <label>
            月份
            <input v-model="businessMonth" type="month" />
          </label>
          <label>
            被代班班次
            <t-select
              :value="selectedAdminAssignmentId"
              :options="adminShiftOptions"
              placeholder="选择需要代值的班次"
              @change="onAdminAssignmentChange"
            />
          </label>
          <label>
            加班成员
            <t-select
              :value="selectedAdminOvertimeMembershipId"
              :options="adminOvertimeOptions"
              placeholder="选择代值的加班成员"
              @change="onAdminOvertimeChange"
            />
          </label>
          <label>
            原因（必填）
            <input
              v-model="adminReason"
              maxlength="1000"
              placeholder="管理员直接代值必须填写原因"
              required
            />
          </label>
          <div class="form-actions">
            <t-button theme="primary" type="submit" :loading="isAdminSubmitting">
              直接代值
            </t-button>
          </div>
        </fieldset>
      </form>

      <section v-if="incomingRequests.length > 0" class="list-section">
        <h3>待我接受（{{ incomingRequests.length }}）</h3>
        <table class="duty-adjustment-table">
          <thead>
            <tr>
              <th>扣班成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in incomingRequests" :key="request.id">
              <td>{{ request.deductedMemberName }}</td>
              <td>
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
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
        <table class="duty-adjustment-table">
          <thead>
            <tr>
              <th>扣班成员</th>
              <th>加班成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in pendingApprovals" :key="request.id">
              <td>{{ request.deductedMemberName }}</td>
              <td>{{ request.overtimeMemberName }}</td>
              <td>
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
              </td>
              <td>
                <t-button variant="outline" @click="approve(request)">批准</t-button>
                <t-button theme="danger" variant="text" @click="reject(request)">驳回</t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="canApprove && completedAdjustments.length > 0" class="list-section">
        <h3>已生效待撤销（{{ completedAdjustments.length }}）</h3>
        <table class="duty-adjustment-table">
          <thead>
            <tr>
              <th>扣班成员</th>
              <th>加班成员</th>
              <th>班次</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in completedAdjustments" :key="request.id">
              <td>{{ request.deductedMemberName }}</td>
              <td>{{ request.overtimeMemberName }}</td>
              <td>
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
              </td>
              <td>
                <t-button theme="danger" variant="text" @click="revoke(request)">撤销</t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="list-section">
        <h3>我的加扣班记录（{{ myDutyAdjustments.length }}）</h3>
        <table v-if="myDutyAdjustments.length > 0" class="duty-adjustment-table">
          <thead>
            <tr>
              <th>对方</th>
              <th>班次</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in myDutyAdjustments" :key="request.id">
              <td>{{ getCounterpartName(request) }}</td>
              <td>
                {{
                  formatDutyAdjustmentShiftTime(
                    request.coveredAssignment.startsAt,
                    request.coveredAssignment.endsAt,
                  )
                }}
              </td>
              <td>{{ getDutyAdjustmentStatusLabel(request.status) }}</td>
              <td>
                <t-button
                  v-if="myPendingRequests.some((pending) => pending.id === request.id)"
                  theme="danger"
                  variant="text"
                  @click="cancel(request)"
                >
                  撤销
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="table-empty">暂无加扣班记录。</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.duty-adjustment-panel {
  display: grid;
  gap: 16px;
}

.duty-adjustment-panel h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.duty-adjustment-panel h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
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

.duty-adjustment-form fieldset {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.duty-adjustment-form legend {
  color: #374151;
  font-weight: 600;
}

.duty-adjustment-form label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
}

.duty-adjustment-form input[type='month'] {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.duty-adjustment-form input:not([type='month']) {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.field-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
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

.duty-adjustment-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #ffffff;
}

.duty-adjustment-table th,
.duty-adjustment-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.duty-adjustment-table th {
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
</style>
