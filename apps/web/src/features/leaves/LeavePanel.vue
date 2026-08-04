<script setup lang="ts">
import type {
  GroupLeaveReflowStrategy,
  GroupSummary,
  LeaveAffectedShift,
  LeaveReflowStrategy,
  LeaveRequest,
  LeaveRequestType,
} from '@schedule/contracts';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import LeaveApprovalDialog from './LeaveApprovalDialog.vue';
import {
  buildLeaveFormInterval,
  formatLeaveRange,
  getLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  getReflowStrategyLabel,
  getTodayBusinessDate,
  leaveTypeLabels,
  reflowStrategyLabels,
} from './leave-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const myRequests = ref<LeaveRequest[]>([]);
const approvals = ref<LeaveRequest[]>([]);
const strategy = ref<GroupLeaveReflowStrategy>();
const leaveType = ref<LeaveRequestType>('sick');
const startDate = ref(getTodayBusinessDate());
const endDate = ref(getTodayBusinessDate());
const resolutionMode = ref<'manual' | 'shift-forward'>('shift-forward');
const affectedShifts = ref<readonly LeaveAffectedShift[]>([]);
const affectedShiftsLoading = ref(false);
const reason = ref('');
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isSubmitting = ref(false);
const approvalTarget = ref<LeaveRequest>();

const canApprove = computed(() => props.group.role !== 'member');
const leaveTypeOptions = computed(() =>
  (Object.keys(leaveTypeLabels) as LeaveRequestType[]).map((type) => ({
    label: leaveTypeLabels[type],
    value: type,
  })),
);
const strategyOptions = computed(() =>
  (Object.keys(reflowStrategyLabels) as LeaveReflowStrategy[]).map((item) => ({
    label: reflowStrategyLabels[item],
    value: item,
  })),
);
const pendingApprovals = computed(() =>
  approvals.value.filter((request) => request.status === 'pending'),
);
const decidedApprovals = computed(() =>
  approvals.value.filter((request) => request.status !== 'pending'),
);
const leaveDayCount = computed(() => getLeaveDayCount(startDate.value, endDate.value));
const uncoveredAffectedShifts = computed(() =>
  affectedShifts.value.filter((shift) => !shift.isCovered),
);

async function loadData(): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;
  const currentGroup = props.group;

  try {
    const [nextMine, nextApprovals, nextStrategy] = await Promise.all([
      api.listMyLeaveRequests(currentGroup.id),
      canApprove.value ? api.listLeaveRequestApprovals(currentGroup.id) : Promise.resolve([]),
      api.getLeaveReflowStrategy(currentGroup.id),
    ]);
    myRequests.value = nextMine;
    approvals.value = nextApprovals;
    strategy.value = nextStrategy;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function submit(): Promise<void> {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  let interval;
  try {
    interval = buildLeaveFormInterval({
      allDay: true,
      endDate: endDate.value,
      startDate: startDate.value,
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '请假时间不正确。';
    return;
  }
  if (reason.value.trim().length === 0) {
    errorMessage.value = '请填写请假原因。';
    return;
  }

  isSubmitting.value = true;
  try {
    await api.createLeaveRequest(props.group.id, {
      endsAt: interval.endsAt,
      isAllDay: true,
      leaveType: leaveType.value,
      reason: reason.value.trim(),
      resolutionMode: resolutionMode.value,
      startsAt: interval.startsAt,
    });
    infoMessage.value = '请假申请已提交，等待管理员审批。';
    reason.value = '';
    await loadData();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isSubmitting.value = false;
  }
}

async function loadAffectedShifts(): Promise<void> {
  if (startDate.value.length === 0 || endDate.value.length === 0) {
    affectedShifts.value = [];
    return;
  }
  let interval;
  try {
    interval = buildLeaveFormInterval({
      allDay: true,
      endDate: endDate.value,
      startDate: startDate.value,
    });
  } catch {
    affectedShifts.value = [];
    return;
  }
  affectedShiftsLoading.value = true;
  try {
    affectedShifts.value = await api.getLeaveAffectedShifts(props.group.id, {
      endsAt: interval.endsAt,
      isAllDay: true,
      startsAt: interval.startsAt,
    });
  } catch {
    affectedShifts.value = [];
  } finally {
    affectedShiftsLoading.value = false;
  }
}

async function updateStrategy(
  nextStrategy: string | number | boolean | object | null,
): Promise<void> {
  if (
    typeof nextStrategy !== 'string' ||
    (nextStrategy !== 'keep-original-order' && nextStrategy !== 'shift-forward')
  ) {
    return;
  }

  errorMessage.value = undefined;
  try {
    strategy.value = await api.updateLeaveReflowStrategy(props.group.id, {
      strategy: nextStrategy,
    });
    infoMessage.value = '群组默认重排策略已更新，新提交的请假将使用该策略。';
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  }
}

function openApproval(request: LeaveRequest): void {
  approvalTarget.value = request;
}

async function cancelRequest(request: LeaveRequest): Promise<void> {
  if (!window.confirm('确定取消该请假申请吗？')) {
    return;
  }
  await runLeaveMutation(
    () =>
      api.cancelLeaveRequest(props.group.id, request.id, {
        expectedVersion: request.version,
        operationId: crypto.randomUUID(),
      }),
    '请假申请已取消。',
  );
}

async function revokeRequest(request: LeaveRequest): Promise<void> {
  if (!window.confirm('确定撤销该已批准的请假吗？撤销后如需恢复原排班，请重新生成或发布排班。')) {
    return;
  }
  await runLeaveMutation(
    () =>
      api.revokeLeaveRequest(props.group.id, request.id, {
        expectedVersion: request.version,
        operationId: crypto.randomUUID(),
      }),
    '请假已撤销；如需恢复原排班，请重新生成或发布排班。',
  );
}

async function runLeaveMutation(
  mutation: () => Promise<unknown>,
  successMessage: string,
): Promise<void> {
  errorMessage.value = undefined;
  try {
    await mutation();
    infoMessage.value = successMessage;
    await loadData();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  }
}

function onApprovalChanged(): void {
  approvalTarget.value = undefined;
  infoMessage.value = '请假申请已处理。';
  void loadData();
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '请假数据暂时无法加载，请稍后重试。';
}

void loadData();
void loadAffectedShifts();
watch([startDate, endDate], () => {
  void loadAffectedShifts();
});
onMounted(() => {
  window.addEventListener('focus', onWindowFocus);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
});

function onWindowFocus(): void {
  void loadData();
}
</script>

<template>
  <section class="leave-panel" :aria-busy="isLoading || isSubmitting">
    <h2>请假与重排</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载请假数据" />
    <template v-else>
      <form class="leave-form" @submit.prevent="submit">
        <fieldset>
          <legend>提交请假</legend>
          <label>
            请假类型
            <t-select v-model="leaveType" :options="leaveTypeOptions" />
          </label>
          <label>
            开始日期
            <input v-model="startDate" type="date" required />
          </label>
          <label>
            结束日期
            <input v-model="endDate" type="date" required />
          </label>
          <p class="all-day-hint">请假按整天计算（不允许请半天）。</p>
          <p v-if="leaveDayCount > 0" class="day-count-hint">
            已选 {{ startDate }} 至 {{ endDate }}，共请假 {{ leaveDayCount }} 天。
          </p>
          <fieldset class="resolution-fieldset">
            <legend>请假期间排班处理方式（二选一）</legend>
            <label class="resolution-option">
              <input v-model="resolutionMode" type="radio" value="shift-forward" />
              顺延：后续排班自动顺延，无需手动换班/加扣班
            </label>
            <label class="resolution-option">
              <input v-model="resolutionMode" type="radio" value="manual" />
              手动安排：请假期间的班次需先完成换班或加扣班
            </label>
          </fieldset>
          <div v-if="affectedShiftsLoading" class="affected-hint">正在检查请假期间班次…</div>
          <template v-else-if="affectedShifts.length > 0">
            <p class="affected-title">请假期间涉及 {{ affectedShifts.length }} 个班次：</p>
            <ul class="affected-list">
              <li v-for="shift in affectedShifts" :key="shift.assignmentId">
                {{ shift.businessDate }} {{ shift.shiftTypeName }}（{{
                  shift.shiftTypeAbbreviation
                }}）—
                {{ shift.isCovered ? '已安排换班/加扣班' : '未安排' }}
              </li>
            </ul>
            <p
              v-if="resolutionMode === 'manual' && uncoveredAffectedShifts.length > 0"
              class="affected-warning"
            >
              请先到“换班”或“加扣班”中为以上“未安排”班次完成安排，才能提交。
            </p>
          </template>
          <p v-else class="affected-hint">请假期间没有已发布的未来班次。</p>
          <label class="reason-field">
            原因说明
            <textarea
              v-model="reason"
              maxlength="1000"
              placeholder="请填写请假原因"
              required
              rows="2"
            />
          </label>
          <t-button theme="primary" type="submit" :loading="isSubmitting">提交请假</t-button>
        </fieldset>
      </form>

      <div v-if="canApprove" class="approval-config">
        <label>
          群组默认重排策略
          <t-select
            :value="strategy?.strategy"
            :options="strategyOptions"
            @change="updateStrategy"
          />
        </label>
        <span v-if="strategy !== undefined" class="strategy-hint">
          审批时仍可对单个申请覆盖此默认策略。
        </span>
      </div>

      <section v-if="canApprove" class="approval-section">
        <h3>待审批（{{ pendingApprovals.length }}）</h3>
        <table v-if="pendingApprovals.length > 0" class="leave-table">
          <thead>
            <tr>
              <th>成员</th>
              <th>类型</th>
              <th>时间</th>
              <th>原因</th>
              <th>策略</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in pendingApprovals" :key="request.id">
              <td>{{ request.memberName }}</td>
              <td>{{ getLeaveTypeLabel(request.leaveType) }}</td>
              <td>{{ formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay) }}</td>
              <td>{{ request.reason }}</td>
              <td>{{ getReflowStrategyLabel(request.reflowStrategy) }}</td>
              <td>
                <t-button variant="outline" @click="openApproval(request)">预览并审批</t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="table-empty">暂无待审批的请假申请。</p>
      </section>

      <section class="my-leaves">
        <h3>我的请假（{{ myRequests.length }}）</h3>
        <table v-if="myRequests.length > 0" class="leave-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>时间</th>
              <th>原因</th>
              <th>策略</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in myRequests" :key="request.id">
              <td>{{ getLeaveTypeLabel(request.leaveType) }}</td>
              <td>{{ formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay) }}</td>
              <td>{{ request.reason }}</td>
              <td>{{ getReflowStrategyLabel(request.reflowStrategy) }}</td>
              <td>{{ getLeaveStatusLabel(request.status) }}</td>
              <td>
                <t-button
                  v-if="request.status === 'pending'"
                  theme="danger"
                  variant="text"
                  @click="cancelRequest(request)"
                >
                  取消
                </t-button>
                <t-button
                  v-if="request.status === 'approved'"
                  theme="danger"
                  variant="text"
                  @click="revokeRequest(request)"
                >
                  撤销
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="table-empty">暂无请假记录。</p>
      </section>

      <section v-if="canApprove && decidedApprovals.length > 0" class="approval-history">
        <h3>已处理记录</h3>
        <table class="leave-table">
          <thead>
            <tr>
              <th>成员</th>
              <th>时间</th>
              <th>状态</th>
              <th>处理人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in decidedApprovals" :key="request.id">
              <td>{{ request.memberName }}</td>
              <td>{{ formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay) }}</td>
              <td>{{ getLeaveStatusLabel(request.status) }}</td>
              <td>{{ request.decidedByMemberName ?? '—' }}</td>
              <td>
                <t-button
                  v-if="request.status === 'approved'"
                  theme="danger"
                  variant="text"
                  @click="revokeRequest(request)"
                >
                  撤销
                </t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
    <LeaveApprovalDialog
      v-if="approvalTarget !== undefined"
      :group="group"
      :request="approvalTarget"
      @changed="onApprovalChanged"
      @close="approvalTarget = undefined"
    />
  </section>
</template>

<style scoped>
.leave-panel {
  display: grid;
  gap: 16px;
}

.leave-panel h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.leave-panel h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.leave-form fieldset {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.leave-form legend,
.approval-config {
  color: #374151;
  font-weight: 600;
}

.leave-form label,
.approval-config label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
  min-width: 0;
}

.leave-form input,
.leave-form textarea {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
  font-family: inherit;
}

.leave-form textarea {
  resize: vertical;
}

.leave-form .t-button {
  width: 100%;
  white-space: normal;
}

.leave-form fieldset {
  min-width: 0;
}

.all-day-hint,
.day-count-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.day-count-hint {
  color: #1f5aa6;
  font-weight: 600;
}

.resolution-fieldset {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.resolution-fieldset legend {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.resolution-option {
  display: flex !important;
  flex-direction: row !important;
  gap: 6px;
  align-items: center;
  color: #374151;
  font-size: 13px;
}

.resolution-option input {
  min-height: auto;
}

.affected-hint,
.affected-title {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.affected-title {
  color: #374151;
  font-weight: 600;
}

.affected-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0 0 0 20px;
  color: #374151;
  font-size: 13px;
}

.affected-warning {
  margin: 0;
  padding: 8px 10px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 6px;
  font-size: 13px;
}

.reason-field {
  display: grid;
}

.approval-config {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
  font-weight: 400;
}

.strategy-hint {
  color: #6b7280;
  font-size: 13px;
}

.leave-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #ffffff;
}

.leave-table th,
.leave-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.leave-table th {
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
