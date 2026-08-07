<script setup lang="ts">
import type {
  GroupSummary,
  LeaveReflowPreview,
  LeaveReflowStrategy,
  LeaveRequest,
} from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { isDataConflictError } from '../../api/conflict-handler.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import {
  formatAffectedAssignment,
  formatLeaveRange,
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

const api = createApiClient({ auth: cloudbaseAuth });
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

function onStrategyChange(value: string | number | boolean | object | null): void {
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
  try {
    await api.approveLeaveRequest(props.group.id, props.request.id, {
      ...(hasBlockers.value && acknowledgeBlockers.value ? { acknowledgeBlockers: true } : {}),
      expectedPeriodVersions: preview.value.periodVersions,
      expectedRulesVersion: preview.value.rulesVersion,
      expectedVersion: props.request.version,
      operationId: crypto.randomUUID(),
      strategy: strategy.value,
    });
    emit('changed');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '请假审批暂时无法完成，请稍后重试。');
  } finally {
    isApproving.value = false;
  }
}

async function reject(): Promise<void> {
  errorMessage.value = undefined;
  isRejecting.value = true;
  try {
    await api.rejectLeaveRequest(props.group.id, props.request.id, {
      expectedVersion: props.request.version,
      operationId: crypto.randomUUID(),
    });
    emit('changed');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '请假审批暂时无法完成，请稍后重试。');
  } finally {
    isRejecting.value = false;
  }
}

function close(): void {
  emit('close');
}

function navigate(tab: 'duty' | 'manual' | 'swap'): void {
  emit('navigate', tab);
  emit('close');
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :cancel-btn="{ content: '关闭' }"
    :confirm-btn="null"
    :header="`请假审批：${request.memberName ?? '成员'}`"
    width="720px"
    @cancel="close"
    @close="close"
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
          <t-button variant="outline" :loading="isPreviewing" @click="refreshPreview">
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
  </t-dialog>
</template>

<style scoped>
.approval-dialog {
  display: grid;
  gap: 14px;
}

.request-summary {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.request-summary div {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px;
}

.request-summary dt {
  color: #6b7280;
  font-size: 13px;
}

.request-summary dd {
  margin: 0;
  color: #1f2937;
  font-size: 13px;
}

.strategy-field {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
}

.strategy-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.affected-count {
  margin: 0;
  padding: 10px 12px;
  color: #1f2937;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
}

.affected-shift-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 10px 12px 10px 28px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
}

.unpublished-warning {
  margin: 0;
  padding: 10px 12px;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  font-size: 13px;
}

.navigate-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.statistics-delta {
  margin: 0;
  padding: 10px 12px;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  background: #eff6ff;
  border-radius: 6px;
}

.affected-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 12px 12px 12px 28px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
}

.no-impact {
  margin: 0;
  padding: 12px;
  color: #6b7280;
  font-size: 13px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.acknowledge-field {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #92400e;
  font-size: 13px;
}

.approval-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}
</style>
