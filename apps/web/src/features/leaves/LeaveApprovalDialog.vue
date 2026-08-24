<script setup lang="ts">
import type {
  GroupSummary,
  LeaveReflowPreview,
  LeaveReflowStrategy,
  LeaveRequest,
} from '@schedule/contracts';
import {
  resolveWorkflowOperationAttempt,
  type WorkflowOperationAttempt,
} from '@schedule/presentation-core';
import { computed, onMounted, ref } from 'vue';
import type { SelectValue } from 'tdesign-vue-next';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { isDataConflictError } from '../../api/conflict-handler.js';
import { localAuth } from '../../auth/local-auth.js';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import {
  formatAffectedAssignment,
  formatLeaveRange,
  getLeaveRejectionConfirmation,
  getLeaveTypeLabel,
  getReflowStrategyLabel,
  reflowStrategyLabels,
  summarizeStatisticsDelta,
} from './leave-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
  readonly request: LeaveRequest;
}>();

const emit = defineEmits<{
  changed: [];
  close: [];
  navigate: [tab: 'duty' | 'manual' | 'swap'];
}>();

const api = createApiClient({ auth: localAuth });
const visible = ref(true);
const preview = ref<LeaveReflowPreview>();
const strategy = ref<LeaveReflowStrategy>(props.request.reflowStrategy);
const groupDefaultStrategy = ref<LeaveReflowStrategy>('keep-original-order');
const acknowledgeBlockers = ref(false);
const errorMessage = ref<string>();
const isLoading = ref(false);
const isPreviewing = ref(false);
const isApproving = ref(false);
const isRejecting = ref(false);
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

const strategyOptions = computed(() =>
  (Object.keys(reflowStrategyLabels) as LeaveReflowStrategy[]).map((item) => ({
    label: reflowStrategyLabels[item],
    value: item,
  })),
);
const blockerCount = computed(
  () => (preview.value?.conflicts.length ?? 0) + (preview.value?.vacancies.length ?? 0),
);
const hasBlockers = computed(() => blockerCount.value > 0);
const hasAffectedAssignments = computed(() => (preview.value?.affectedAssignments.length ?? 0) > 0);
const affectedShifts = computed(() => preview.value?.affectedShifts ?? []);

onMounted(() => {
  void loadContext();
});

async function loadContext(): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    const [strategyResult] = await Promise.all([
      api.getLeaveReflowStrategy(props.group.id),
      refreshPreview(),
    ]);
    groupDefaultStrategy.value = strategyResult.strategy;
  } catch (error) {
    errorMessage.value = toUserMessage(error, '请假审批暂时无法完成，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

async function refreshPreview(): Promise<void> {
  errorMessage.value = undefined;
  isPreviewing.value = true;
  try {
    preview.value = await api.previewLeaveRequestApproval(props.group.id, props.request.id, {
      strategy: strategy.value,
    });
    acknowledgeBlockers.value = false;
  } catch (error) {
    if (isDataConflictError(error)) {
      errorMessage.value = '排班数据已被其他操作更新，请重新生成预览。';
    } else {
      errorMessage.value = toUserMessage(error, '请假审批暂时无法完成，请稍后重试。');
    }
  } finally {
    isPreviewing.value = false;
  }
}

function onStrategyChange(value: SelectValue): void {
  if (value === 'keep-original-order' || value === 'shift-forward') {
    strategy.value = value;
    void refreshPreview();
  }
}

async function approve(): Promise<void> {
  if (preview.value === undefined) {
    await refreshPreview();
    if (preview.value === undefined) {
      return;
    }
  }

  errorMessage.value = undefined;
  isApproving.value = true;
  const operationKey = `${props.group.id}:leave:approve:${props.request.id}:${props.request.version}`;
  try {
    await api.approveLeaveRequest(
      props.group.id,
      props.request.id,
      resolveOperation(operationKey, {
        ...(hasBlockers.value && acknowledgeBlockers.value ? { acknowledgeBlockers: true } : {}),
        expectedPeriodVersions: preview.value.periodVersions,
        expectedRulesVersion: preview.value.rulesVersion,
        expectedVersion: props.request.version,
        strategy: strategy.value,
      }),
    );
    operationAttempts.delete(operationKey);
    emit('changed');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '请假审批暂时无法完成，请稍后重试。');
  } finally {
    isApproving.value = false;
  }
}

async function reject(): Promise<void> {
  if (!window.confirm(getLeaveRejectionConfirmation(props.request.memberName))) {
    return;
  }
  errorMessage.value = undefined;
  isRejecting.value = true;
  const operationKey = `${props.group.id}:leave:reject:${props.request.id}:${props.request.version}`;
  try {
    await api.rejectLeaveRequest(
      props.group.id,
      props.request.id,
      resolveOperation(operationKey, {
        expectedVersion: props.request.version,
      }),
    );
    operationAttempts.delete(operationKey);
    emit('changed');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '请假审批暂时无法完成，请稍后重试。');
  } finally {
    isRejecting.value = false;
  }
}

function onVisibilityChange(nextVisible: boolean): void {
  visible.value = nextVisible;
  if (!nextVisible) {
    emit('close');
  }
}

function navigate(tab: 'duty' | 'manual' | 'swap'): void {
  emit('navigate', tab);
  emit('close');
}
</script>

<template>
  <ResponsiveSheet
    :visible="visible"
    :title="`请假审批 · ${request.memberName ?? '成员'}`"
    @update:visible="onVisibilityChange"
  >
    <div
      class="approval-dialog"
      :aria-busy="isLoading || isPreviewing || isApproving || isRejecting"
    >
      <t-loading v-if="isLoading" text="正在加载请假预览" />
      <template v-else>
        <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
        <dl class="request-summary">
          <div>
            <dt>请假类型</dt>
            <dd>{{ getLeaveTypeLabel(request.leaveType) }}</dd>
          </div>
          <div>
            <dt>时间范围</dt>
            <dd>{{ formatLeaveRange(request.startsAt, request.endsAt, request.isAllDay) }}</dd>
          </div>
          <div>
            <dt>原因</dt>
            <dd>{{ request.reason }}</dd>
          </div>
        </dl>

        <template v-if="preview !== undefined">
          <p class="affected-count">请假期间涉及 {{ preview.affectedShiftCount }} 个已发布班次。</p>
          <ul v-if="affectedShifts.length > 0" class="affected-shift-list">
            <li
              v-for="shift in affectedShifts"
              :key="`${shift.businessDate}-${shift.memberName ?? ''}-${shift.shiftTypeAbbreviation}`"
            >
              {{ shift.businessDate }} {{ shift.shiftTypeName }}（{{
                shift.shiftTypeAbbreviation
              }}）：
              {{ shift.memberName ?? '未知成员' }}
            </li>
          </ul>
          <p v-if="preview.overlapsUnpublishedPeriod" class="unpublished-warning">
            请假范围在未发布排班的时间段，无法调班；批准后仅记录请假，后续发布排班时将避开该成员。
          </p>
          <div class="navigate-row">
            <t-button variant="outline" size="small" @click="navigate('swap')">前往换班</t-button>
            <t-button variant="outline" size="small" @click="navigate('duty')">前往加扣班</t-button>
            <t-button variant="outline" size="small" @click="navigate('manual')">
              前往手动排班
            </t-button>
          </div>
        </template>

        <template v-if="hasAffectedAssignments">
          <label class="strategy-field">
            重排策略
            <t-select :value="strategy" :options="strategyOptions" @change="onStrategyChange" />
          </label>
          <p class="strategy-hint">
            群组默认：{{
              getReflowStrategyLabel(groupDefaultStrategy)
            }}；管理员可先通过换班、加扣班或手动排班完成安排，再选择顺延或保持原顺序重排。
          </p>
          <t-button
            class="strategy-preview-action"
            variant="outline"
            :loading="isPreviewing"
            @click="refreshPreview"
          >
            生成重排预览
          </t-button>
        </template>
        <p
          v-else-if="
            preview !== undefined &&
            preview.affectedShiftCount === 0 &&
            !preview.overlapsUnpublishedPeriod
          "
          class="no-impact"
        >
          该请假未涉及已发布班次。
        </p>

        <template v-if="preview !== undefined">
          <template v-if="hasAffectedAssignments">
            <p class="statistics-delta">
              统计变化：{{ summarizeStatisticsDelta(preview.statisticsDelta) }}
            </p>

            <ul class="affected-list">
              <li v-for="assignment in preview.affectedAssignments" :key="assignment.assignmentId">
                {{ formatAffectedAssignment(assignment) }}
              </li>
            </ul>

            <t-alert
              v-if="preview.conflicts.length > 0"
              theme="error"
              :message="`发现 ${preview.conflicts.length} 处硬冲突（请假或时间重叠）。`"
            />
            <t-alert
              v-if="preview.workflowBlockers.length > 0"
              theme="error"
              :message="preview.workflowBlockers.map((blocker) => blocker.message).join('；')"
            />
            <t-alert
              v-if="preview.continuousDutyWarnings.length > 0"
              theme="warning"
              :message="`发现 ${preview.continuousDutyWarnings.length} 处连续值班风险（至少 24 小时）。`"
            />
            <t-alert
              v-if="preview.vacancies.length > 0"
              theme="warning"
              :message="`发现 ${preview.vacancies.length} 个待处理空缺（无可用替班成员）。`"
            />

            <label v-if="hasBlockers" class="acknowledge-field">
              <input v-model="acknowledgeBlockers" type="checkbox" />
              我已知晓冲突和空缺，确认按预览结果批准该请假。
            </label>
          </template>

          <div class="approval-actions">
            <t-button theme="danger" variant="outline" :loading="isRejecting" @click="reject">
              驳回
            </t-button>
            <t-button theme="primary" :loading="isApproving" @click="approve">
              {{ hasAffectedAssignments ? '批准并重排' : '批准' }}
            </t-button>
          </div>
        </template>
      </template>
    </div>
  </ResponsiveSheet>
</template>

<style scoped>
.approval-dialog {
  display: grid;
  gap: var(--ui-spacing-md);
  padding-bottom: var(--ui-spacing-xxs);
}

.request-summary {
  display: grid;
  gap: var(--ui-spacing-sm);
  margin: 0;
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.request-summary div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: var(--ui-spacing-sm);
}

.request-summary dt {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.request-summary dd {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  overflow-wrap: anywhere;
}

.strategy-field {
  display: grid;
  gap: var(--ui-spacing-xxs);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.strategy-field :deep(.t-input),
.strategy-field :deep(.t-select) {
  min-height: var(--ui-touch-target-minimum);
}

.strategy-hint {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.strategy-preview-action {
  min-height: var(--ui-touch-target-minimum);
}

.affected-count {
  margin: 0;
  padding: 12px 14px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.affected-shift-list {
  display: grid;
  gap: var(--ui-spacing-xs);
  margin: 0;
  padding: 12px 12px 12px 30px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.unpublished-warning {
  margin: 0;
  padding: 12px 14px;
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.navigate-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
}

.navigate-row :deep(.t-button),
.approval-actions :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.statistics-delta {
  margin: 0;
  padding: 12px 14px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.affected-list {
  display: grid;
  gap: var(--ui-spacing-xs);
  margin: 0;
  padding: 12px 12px 12px 30px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.no-impact {
  margin: 0;
  padding: var(--ui-spacing-md);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
}

.acknowledge-field {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 10px 12px;
  align-items: center;
  gap: var(--ui-spacing-xs);
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  line-height: 1.45;
}

.acknowledge-field input {
  width: 20px;
  height: 20px;
  flex: none;
}

.approval-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: var(--ui-spacing-sm);
  padding-top: var(--ui-spacing-xs);
}

.approval-actions :deep(.t-button) {
  width: 100%;
}

@media (max-width: 640px) {
  .request-summary {
    padding: var(--ui-spacing-sm);
  }

  .request-summary div {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .navigate-row :deep(.t-button) {
    min-width: calc(50% - 4px);
    flex: 1 1 auto;
  }
}

@media (max-width: 340px) {
  .approval-actions {
    grid-template-columns: 1fr;
  }
}
</style>
