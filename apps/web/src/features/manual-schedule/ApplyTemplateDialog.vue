<script setup lang="ts">
import type {
  AppliedManualScheduleTemplateResult,
  GroupSchedulePublishMode,
  GroupSummary,
  ManualApplyPreview,
  ManualScheduleTemplate,
  SchedulingConfig,
} from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { isDataConflictError } from '../../api/conflict-handler.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { getTemplateDateColumns } from './manual-schedule-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
  readonly template: ManualScheduleTemplate;
}>();

const emit = defineEmits<{
  applied: [result: AppliedManualScheduleTemplateResult];
  close: [];
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const config = ref<SchedulingConfig>();
const publishMode = ref<GroupSchedulePublishMode>();
const repeatEnabled = ref(false);
const endDate = ref(getDefaultEndDate());
const preview = ref<ManualApplyPreview>();
const acknowledgeBlockers = ref(false);
const isLoading = ref(true);
const isPreviewing = ref(false);
const isApplying = ref(false);
const errorMessage = ref<string>();

const visible = ref(true);
const blockerCount = computed(
  () => (preview.value?.conflicts.length ?? 0) + (preview.value?.vacancies.length ?? 0),
);
const hasBlockers = computed(() => blockerCount.value > 0);
const publishLabel = computed(() =>
  publishMode.value?.publishMode === 'published' ? '直接发布' : '保存草稿',
);

onMounted(() => {
  void loadContext();
});

async function loadContext(): Promise<void> {
  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    const [nextConfig, nextPublishMode] = await Promise.all([
      api.getSchedulingConfig(props.group.id),
      api.getSchedulePublishMode(props.group.id),
    ]);
    config.value = nextConfig;
    publishMode.value = nextPublishMode;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function computePreview(): Promise<void> {
  if (config.value === undefined) {
    return;
  }
  if (repeatEnabled.value && endDate.value < props.template.startDate) {
    errorMessage.value = '结束日期不能早于模板开始日期。';
    return;
  }

  errorMessage.value = undefined;
  isPreviewing.value = true;
  try {
    preview.value = await api.previewManualTemplateApply(props.group.id, props.template.id, {
      expectedRulesVersion: config.value.rulesVersion,
      ...(repeatEnabled.value ? { endDate: endDate.value } : {}),
    });
    acknowledgeBlockers.value = false;
  } catch (error) {
    if (isDataConflictError(error)) {
      await loadContext();
    }
    errorMessage.value = getErrorMessage(error);
  } finally {
    isPreviewing.value = false;
  }
}

async function apply(): Promise<void> {
  if (config.value === undefined) {
    return;
  }
  if (preview.value === undefined) {
    await computePreview();
    if (preview.value === undefined) {
      return;
    }
  }

  errorMessage.value = undefined;
  isApplying.value = true;
  try {
    const result = await api.applyManualTemplate(props.group.id, props.template.id, {
      ...(hasBlockers.value && acknowledgeBlockers.value ? { acknowledgeBlockers: true } : {}),
      expectedRulesVersion: config.value.rulesVersion,
      operationId: crypto.randomUUID(),
      ...(repeatEnabled.value ? { endDate: endDate.value } : {}),
    });
    emit('applied', result);
  } catch (error) {
    if (isDataConflictError(error)) {
      await loadContext();
    }
    errorMessage.value = getErrorMessage(error);
  } finally {
    isApplying.value = false;
  }
}

function close(): void {
  emit('close');
}

function getDefaultEndDate(): string {
  const columns = getTemplateDateColumns(props.template.startDate, props.template.cycleDays);
  return columns[columns.length - 1]?.date ?? props.template.startDate;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'CONFLICT') {
      return '排班规则或模板已被其他操作更新，请刷新后重新确认。';
    }
    return error.message;
  }

  return '模板暂时无法应用，请稍后重试。';
}
</script>

<template>
  <t-dialog
    v-model:visible="visible"
    :cancel-btn="{ content: '关闭' }"
    :confirm-btn="{ content: '应用模板', loading: isApplying, theme: 'primary' }"
    :header="`应用模板：${template.scheduleRoleName}`"
    width="680px"
    @cancel="close"
    @close="close"
    @confirm="apply"
  >
    <div class="apply-dialog" :aria-busy="isLoading || isPreviewing || isApplying">
      <t-loading v-if="isLoading" text="正在加载排班配置" />
      <template v-else>
        <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
        <dl class="template-summary">
          <div>
            <dt>模板</dt>
            <dd>{{ template.startDate }} 起 · {{ template.cycleDays }} 天周期</dd>
          </div>
          <div>
            <dt>应用范围</dt>
            <dd>
              {{
                repeatEnabled
                  ? `${template.startDate} 至 ${endDate}`
                  : `仅一轮（${template.startDate} 至 ${getDefaultEndDate()}）`
              }}
            </dd>
          </div>
          <div>
            <dt>保存方式</dt>
            <dd>{{ publishLabel }}</dd>
          </div>
        </dl>

        <label class="repeat-field">
          <input v-model="repeatEnabled" type="checkbox" />
          重复应用到结束日期
          <input
            v-if="repeatEnabled"
            v-model="endDate"
            class="end-date-input"
            min="2020-01-01"
            type="date"
          />
        </label>

        <t-button variant="outline" :loading="isPreviewing" @click="computePreview">
          生成预览
        </t-button>

        <template v-if="preview !== undefined">
          <div class="preview-stats">
            <span>班次 {{ preview.statistics.assignmentCount }}</span>
            <span>计入值班 {{ preview.statistics.countedAssignmentCount }}</span>
            <span>空缺 {{ preview.statistics.vacancyCount }}</span>
          </div>

          <table v-if="preview.statistics.byShiftType.length > 0" class="shift-type-stats">
            <thead>
              <tr>
                <th>班种</th>
                <th>班次数</th>
                <th>计入值班</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="shiftType in preview.statistics.byShiftType" :key="shiftType.shiftTypeId">
                <td>{{ shiftType.shiftTypeName }}（{{ shiftType.shiftTypeAbbreviation }}）</td>
                <td>{{ shiftType.assignmentCount }}</td>
                <td>{{ shiftType.countedAssignmentCount }}</td>
              </tr>
            </tbody>
          </table>

          <t-alert
            v-if="preview.conflicts.length > 0"
            theme="error"
            :message="`发现 ${preview.conflicts.length} 处硬冲突（请假或时间重叠）。`"
          />
          <t-alert
            v-if="preview.continuousDutyWarnings.length > 0"
            theme="warning"
            :message="`发现 ${preview.continuousDutyWarnings.length} 处连续值班风险（至少 24 小时）。`"
          />
          <t-alert
            v-if="preview.vacancies.length > 0"
            theme="warning"
            :message="`发现 ${preview.vacancies.length} 个待处理空缺（成员已离开角色或不在生效区间）。`"
          />

          <label v-if="hasBlockers" class="acknowledge-field">
            <input v-model="acknowledgeBlockers" type="checkbox" />
            我已知晓冲突和空缺，确认按预览结果{{ publishLabel }}。
          </label>
        </template>
      </template>
    </div>
  </t-dialog>
</template>

<style scoped>
.apply-dialog {
  display: grid;
  gap: 14px;
}

.template-summary {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.template-summary div {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
}

.template-summary dt {
  color: #6b7280;
  font-size: 13px;
}

.template-summary dd {
  margin: 0;
  color: #1f2937;
  font-size: 13px;
}

.repeat-field {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: #374151;
  font-size: 14px;
}

.end-date-input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 12px;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  background: #eff6ff;
  border-radius: 6px;
}

.shift-type-stats {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.shift-type-stats th,
.shift-type-stats td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.shift-type-stats th {
  color: #374151;
  background: #f8fafc;
}

.acknowledge-field {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #92400e;
  font-size: 13px;
}
</style>
