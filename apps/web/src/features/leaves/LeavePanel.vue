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
import type { SelectValue } from 'tdesign-vue-next';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import LeaveApprovalDialog from './LeaveApprovalDialog.vue';
import {
  buildLeaveFormInterval,
  formatLeaveRange,
  getLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveStatusTone,
  getLeaveTypeLabel,
  getReflowStrategyLabel,
  getTodayBusinessDate,
  leaveTypeLabels,
  reflowStrategyLabels,
} from './leave-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const emit = defineEmits<{
  navigate: [tab: 'duty' | 'manual' | 'swap'];
}>();

const api = createApiClient({ auth: localAuth });
const myRequests = ref<LeaveRequest[]>([]);
const approvals = ref<LeaveRequest[]>([]);
const strategy = ref<GroupLeaveReflowStrategy>();
const leaveType = ref<LeaveRequestType>('sick');
const startDate = ref(getTodayBusinessDate());
const endDate = ref(getTodayBusinessDate());
const affectedShifts = ref<readonly LeaveAffectedShift[]>([]);
const affectedShiftsLoading = ref(false);
const reason = ref('');
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isSubmitting = ref(false);
const approvalTarget = ref<LeaveRequest>();
const formVisible = ref(false);
const mobileTab = ref<'mine' | 'review'>('mine');

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
    errorMessage.value = toUserMessage(error, '请假数据暂时无法加载，请稍后重试。');
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
  isSubmitting.value = true;
  try {
    await api.createLeaveRequest(props.group.id, {
      endsAt: interval.endsAt,
      isAllDay: true,
      leaveType: leaveType.value,
      ...(reason.value.trim() === '' ? {} : { reason: reason.value.trim() }),
      startsAt: interval.startsAt,
    });
    infoMessage.value = '请假申请已提交，等待管理员审批。';
    reason.value = '';
    await loadData();
    formVisible.value = false;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '请假数据暂时无法加载，请稍后重试。');
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

async function updateStrategy(nextStrategy: SelectValue): Promise<void> {
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
    errorMessage.value = toUserMessage(error, '请假数据暂时无法加载，请稍后重试。');
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
    errorMessage.value = toUserMessage(error, '请假数据暂时无法加载，请稍后重试。');
  }
}

function onApprovalChanged(): void {
  approvalTarget.value = undefined;
  infoMessage.value = '请假申请已处理。';
  void loadData();
}

function navigateTo(tab: 'duty' | 'manual' | 'swap'): void {
  emit('navigate', tab);
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
    <header class="panel-heading">
      <div>
        <h2>请假与审批</h2>
        <p>查看请假状态，或处理会影响排班的申请。</p>
      </div>
      <t-button
        id="leave-create-button"
        theme="primary"
        :disabled="isLoading"
        @click="formVisible = true"
      >
        新建请假
      </t-button>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载请假数据" />
    <template v-else>
      <nav v-if="canApprove" class="mobile-workflow-tabs" role="tablist" aria-label="请假内容">
        <button
          type="button"
          role="tab"
          :aria-selected="mobileTab === 'mine'"
          :class="{ active: mobileTab === 'mine' }"
          @click="mobileTab = 'mine'"
        >
          我的请假
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mobileTab === 'review'"
          :class="{ active: mobileTab === 'review' }"
          @click="mobileTab = 'review'"
        >
          待我审批
          <span v-if="pendingApprovals.length > 0" class="count-badge">{{
            pendingApprovals.length
          }}</span>
        </button>
      </nav>

      <div
        v-if="canApprove"
        class="approval-config mobile-review-content"
        :class="{ 'mobile-tab-hidden': mobileTab !== 'review' }"
      >
        <label>
          群组默认重排策略
          <t-select
            :value="strategy?.strategy ?? ''"
            :options="strategyOptions"
            @change="updateStrategy"
          />
        </label>
        <span v-if="strategy !== undefined" class="strategy-hint">
          审批时仍可对单个申请覆盖此默认策略。
        </span>
      </div>

      <section
        v-if="canApprove"
        class="approval-section workflow-section mobile-review-content"
        :class="{ 'mobile-tab-hidden': mobileTab !== 'review' }"
      >
        <header class="section-heading">
          <div>
            <h3>待审批</h3>
            <p>先查看对排班的影响，再作出决定。</p>
          </div>
          <span>{{ pendingApprovals.length }} 项</span>
        </header>
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
            <tr
              v-for="request in pendingApprovals"
              :key="request.id"
              class="workflow-card featured"
            >
              <td class="member-cell" data-label="成员">
                <span class="member-avatar" aria-hidden="true">{{
                  request.memberName?.slice(0, 1) ?? '医'
                }}</span>
                <strong>{{ request.memberName ?? '成员' }}</strong>
              </td>
              <td data-label="类型">{{ getLeaveTypeLabel(request.leaveType) }}</td>
              <td data-label="时间">
                {{ formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay) }}
              </td>
              <td data-label="原因">{{ request.reason ?? '未填写' }}</td>
              <td data-label="策略">{{ getReflowStrategyLabel(request.reflowStrategy) }}</td>
              <td class="card-actions" data-label="操作">
                <t-button variant="outline" @click="openApproval(request)">预览并审批</t-button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="table-empty">暂无待审批的请假申请。</p>
      </section>

      <section
        class="my-leaves workflow-section mobile-mine-content"
        :class="{ 'mobile-tab-hidden': canApprove && mobileTab !== 'mine' }"
      >
        <header class="section-heading">
          <div>
            <h3>我的请假</h3>
            <p>申请进度和已处理记录会保留在这里。</p>
          </div>
          <span>{{ myRequests.length }} 项</span>
        </header>
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
            <tr
              v-for="request in myRequests"
              :key="request.id"
              class="workflow-card"
              :class="{ featured: request.status === 'pending' }"
            >
              <td data-label="类型">
                <strong>{{ getLeaveTypeLabel(request.leaveType) }}</strong>
              </td>
              <td data-label="时间">
                {{ formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay) }}
              </td>
              <td data-label="原因">{{ request.reason ?? '未填写' }}</td>
              <td data-label="策略">{{ getReflowStrategyLabel(request.reflowStrategy) }}</td>
              <td data-label="状态">
                <span class="status-badge" :class="getLeaveStatusTone(request.status)">
                  {{ getLeaveStatusLabel(request.status) }}
                </span>
              </td>
              <td class="card-actions" data-label="操作">
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

      <section
        v-if="canApprove && decidedApprovals.length > 0"
        class="approval-history workflow-section mobile-review-content"
        :class="{ 'mobile-tab-hidden': mobileTab !== 'review' }"
      >
        <header class="section-heading">
          <div>
            <h3>已处理记录</h3>
            <p>查看最近的审批结果与处理人。</p>
          </div>
          <span>{{ decidedApprovals.length }} 项</span>
        </header>
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
            <tr v-for="request in decidedApprovals" :key="request.id" class="workflow-card">
              <td class="member-cell" data-label="成员">
                <span class="member-avatar secondary" aria-hidden="true">{{
                  request.memberName?.slice(0, 1) ?? '医'
                }}</span>
                <strong>{{ request.memberName ?? '成员' }}</strong>
              </td>
              <td data-label="时间">
                {{ formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay) }}
              </td>
              <td data-label="状态">
                <span class="status-badge" :class="getLeaveStatusTone(request.status)">
                  {{ getLeaveStatusLabel(request.status) }}
                </span>
              </td>
              <td data-label="处理人">{{ request.decidedByMemberName ?? '—' }}</td>
              <td class="card-actions" data-label="操作">
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

    <ResponsiveSheet v-model:visible="formVisible" title="新建请假">
      <form class="leave-form" @submit.prevent="submit">
        <fieldset>
          <legend>请假信息</legend>
          <p class="form-intro">请假按整天计算；提交前会检查已发布的未来班次。</p>
          <label>
            请假类型
            <t-select v-model="leaveType" :options="leaveTypeOptions" />
          </label>
          <div class="date-fields">
            <label>
              开始日期
              <input v-model="startDate" type="date" required />
            </label>
            <label>
              结束日期
              <input v-model="endDate" type="date" required />
            </label>
          </div>
          <p v-if="leaveDayCount > 0" class="day-count-hint">
            {{ startDate }} 至 {{ endDate }}，共 {{ leaveDayCount }} 天
          </p>
          <div v-if="affectedShiftsLoading" class="affected-hint">正在检查请假期间班次…</div>
          <template v-else-if="affectedShifts.length > 0">
            <p class="affected-title">涉及 {{ affectedShifts.length }} 个已发布班次</p>
            <ul class="affected-list">
              <li v-for="shift in affectedShifts" :key="shift.assignmentId">
                <span>{{ shift.businessDate }} {{ shift.shiftTypeName }}</span>
                <strong :class="{ uncovered: !shift.isCovered }">
                  {{ shift.isCovered ? '已安排' : '未安排' }}
                </strong>
              </li>
            </ul>
            <p v-if="uncoveredAffectedShifts.length > 0" class="affected-warning">
              可先到“换班”或“加扣班”安排替班；未安排也可以提交申请。
            </p>
          </template>
          <p v-else class="affected-hint">请假期间没有已发布的未来班次。</p>
          <label class="reason-field">
            原因说明（选填）
            <textarea v-model="reason" maxlength="1000" placeholder="请填写请假原因" rows="3" />
          </label>
          <t-button theme="primary" type="submit" :loading="isSubmitting">提交请假</t-button>
        </fieldset>
      </form>
    </ResponsiveSheet>

    <LeaveApprovalDialog
      v-if="approvalTarget !== undefined"
      :group="group"
      :request="approvalTarget"
      @changed="onApprovalChanged"
      @close="approvalTarget = undefined"
      @navigate="navigateTo"
    />
  </section>
</template>

<style scoped>
.leave-panel {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-lg);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-lg);
}

.panel-heading h2 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.panel-heading p,
.section-heading p {
  margin: 4px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.panel-heading :deep(.t-button),
.leave-panel :deep(.card-actions .t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.mobile-workflow-tabs {
  display: none;
}

.workflow-section {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-sm);
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.section-heading h3 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
}

.section-heading > span {
  flex: none;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.leave-form fieldset {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-md);
  margin: 0;
  padding: var(--ui-spacing-sm) 0 0;
  border: 0;
}

.leave-form legend {
  padding: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
}

.form-intro {
  margin: -4px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: 1.5;
}

.leave-form label,
.approval-config label {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.date-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-md);
}

.leave-form input,
.leave-form textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--ui-touch-target-minimum);
  padding: 10px 12px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-medium);
  font-family: inherit;
  font-size: var(--ui-font-size-md);
}

.leave-form textarea {
  min-height: 88px;
  resize: vertical;
}

.leave-form .t-button {
  width: 100%;
  min-height: 48px;
  white-space: normal;
}

.leave-form :deep(.t-input),
.leave-form :deep(.t-select) {
  min-height: var(--ui-touch-target-minimum);
}

.leave-form input:focus-visible,
.leave-form textarea:focus-visible {
  border-color: var(--ui-color-primary);
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
}

.day-count-hint {
  margin: 0;
  padding: 10px 12px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.affected-hint,
.affected-title {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.affected-title {
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.affected-list {
  display: grid;
  margin: 0;
  padding: 0;
  overflow: hidden;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  list-style: none;
}

.affected-list li {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 8px 12px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--ui-color-border);
}

.affected-list li:last-child {
  border-bottom: 0;
}

.affected-list strong {
  flex: none;
  color: var(--ui-color-success);
}

.affected-list strong.uncovered {
  color: var(--ui-color-warning);
}

.affected-warning {
  margin: 0;
  padding: 10px 12px;
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  line-height: 1.5;
}

.approval-config {
  display: grid;
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-lg);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
  font-weight: 400;
}

.strategy-hint {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.leave-table {
  width: 100%;
  overflow: hidden;
  border-collapse: collapse;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  font-size: var(--ui-font-size-sm);
}

.leave-table th,
.leave-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--ui-color-border);
  vertical-align: middle;
}

.leave-table th {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-background);
  font-weight: var(--ui-font-weight-semibold);
}

.leave-table tbody tr:last-child td {
  border-bottom: 0;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: var(--ui-spacing-sm);
}

.member-avatar {
  display: inline-grid;
  width: var(--ui-touch-target-minimum);
  height: var(--ui-touch-target-minimum);
  flex: none;
  place-items: center;
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
  border-radius: var(--ui-radius-medium);
  font-weight: var(--ui-font-weight-semibold);
}

.member-avatar.secondary {
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
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

.table-empty {
  margin: 0;
  padding: var(--ui-spacing-xl);
  color: var(--ui-color-text-secondary);
  text-align: center;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  font-size: var(--ui-font-size-sm);
}

@media (max-width: 760px) {
  .leave-panel {
    gap: var(--ui-spacing-md);
  }

  .panel-heading {
    align-items: flex-start;
  }

  .panel-heading p {
    max-width: 220px;
  }

  .panel-heading :deep(.t-button) {
    flex: none;
  }

  .mobile-workflow-tabs {
    display: grid;
    padding: 3px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3px;
    background: var(--ui-color-border);
    border-radius: var(--ui-radius-medium);
  }

  .mobile-workflow-tabs button {
    display: inline-flex;
    min-width: 0;
    min-height: var(--ui-touch-target-minimum);
    padding: 0 10px;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--ui-color-text-secondary);
    background: transparent;
    border: 0;
    border-radius: calc(var(--ui-radius-medium) - 3px);
    font: inherit;
    font-size: var(--ui-font-size-sm);
    font-weight: var(--ui-font-weight-semibold);
  }

  .mobile-workflow-tabs button.active {
    color: var(--ui-color-text-primary);
    background: var(--ui-color-surface);
    box-shadow: 0 1px 4px rgb(22 32 42 / 10%);
  }

  .mobile-workflow-tabs button:focus-visible {
    outline: 3px solid var(--ui-color-focus-ring);
    outline-offset: 1px;
  }

  .count-badge {
    display: inline-grid;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    place-items: center;
    color: var(--ui-color-white);
    background: var(--ui-color-primary);
    border-radius: var(--ui-radius-pill);
    font-size: 11px;
  }

  .mobile-tab-hidden {
    display: none;
  }

  .section-heading p {
    display: none;
  }

  .approval-config {
    padding: var(--ui-spacing-md);
    box-shadow: none;
  }

  .leave-table,
  .leave-table tbody {
    display: grid;
    gap: var(--ui-spacing-md);
    background: transparent;
    border: 0;
    border-radius: 0;
  }

  .leave-table thead {
    display: none;
  }

  .leave-table .workflow-card {
    display: grid;
    min-width: 0;
    padding: var(--ui-spacing-lg);
    gap: 10px;
    background: var(--ui-color-surface);
    border: 1px solid var(--ui-color-border);
    border-radius: var(--ui-radius-large);
    box-shadow: var(--ui-shadow-card);
  }

  .leave-table .workflow-card.featured {
    border-color: var(--ui-color-primary-border);
    box-shadow:
      var(--ui-shadow-card),
      inset 3px 0 var(--ui-color-primary);
  }

  .leave-table .workflow-card td {
    display: flex;
    min-width: 0;
    min-height: 24px;
    padding: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--ui-spacing-md);
    border: 0;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .leave-table .workflow-card td::before {
    min-width: 48px;
    flex: none;
    color: var(--ui-color-text-secondary);
    content: attr(data-label);
    font-size: var(--ui-font-size-xs);
    font-weight: var(--ui-font-weight-medium);
  }

  .leave-table .workflow-card .member-cell {
    min-height: var(--ui-touch-target-minimum);
    justify-content: flex-start;
  }

  .leave-table .workflow-card .member-cell::before {
    display: none;
  }

  .leave-table .workflow-card .card-actions {
    min-height: var(--ui-touch-target-minimum);
    padding-top: 4px;
  }

  .leave-table .workflow-card .card-actions::before {
    display: none;
  }

  .leave-table .workflow-card .card-actions :deep(.t-button) {
    width: 100%;
    min-height: var(--ui-touch-target-minimum);
  }

  .date-fields {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 360px) {
  .panel-heading {
    display: grid;
  }

  .panel-heading :deep(.t-button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-workflow-tabs button {
    transition: none;
  }
}
</style>
