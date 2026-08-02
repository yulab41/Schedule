<script setup lang="ts">
import type {
  GroupSummary,
  MonthStatisticsSnapshot,
  StatisticsRecalculateCheckResult,
  StatisticsSummary,
  YearStatistics,
} from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import {
  formatNetDutyAdjustment,
  sortMembersByActualCount,
  summarizeRecalculateMismatches,
} from '../../features/statistics/statistics-logic.js';

const props = defineProps<{
  group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const viewMode = ref<'month' | 'year'>('month');
const businessMonth = ref(getCurrentCstMonth());
const year = ref(Number(getCurrentCstMonth().slice(0, 4)));
const isLoading = ref(false);
const errorMessage = ref<string>();
const monthData = ref<MonthStatisticsSnapshot>();
const yearData = ref<YearStatistics>();
const checkResult = ref<StatisticsRecalculateCheckResult>();

function getCurrentCstMonth(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

const summary = computed<StatisticsSummary | undefined>(() =>
  viewMode.value === 'month' ? monthData.value?.summary : yearData.value?.summary,
);
const members = computed(() =>
  summary.value === undefined ? [] : sortMembersByActualCount(summary.value.members),
);

onMounted(() => {
  void load();
});

async function load(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = undefined;
  try {
    if (viewMode.value === 'month') {
      monthData.value = await api.getMonthStatistics(props.group.id, businessMonth.value);
      yearData.value = undefined;
    } else {
      yearData.value = await api.getYearStatistics(props.group.id, year.value);
      monthData.value = undefined;
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function refreshSnapshot(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = undefined;
  try {
    monthData.value = await api.refreshMonthStatistics(props.group.id, businessMonth.value);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

async function runRecalculateCheck(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = undefined;
  try {
    checkResult.value = await api.recalculateStatistics(props.group.id, businessMonth.value);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '统计数据暂时无法加载，请稍后重试。';
}
</script>

<template>
  <section class="statistics-view">
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-loading v-if="isLoading" text="正在加载统计" />
    <template v-else>
      <div class="statistics-toolbar">
        <t-radio-group v-model="viewMode" @change="load">
          <t-radio-button value="month">按月</t-radio-button>
          <t-radio-button value="year">按年</t-radio-button>
        </t-radio-group>
        <input
          v-if="viewMode === 'month'"
          v-model="businessMonth"
          class="statistics-month-input"
          type="month"
          @change="load"
        />
        <select v-else v-model.number="year" class="statistics-year-input" @change="load">
          <option
            v-for="candidate in [year - 1, year, year + 1]"
            :key="candidate"
            :value="candidate"
          >
            {{ candidate }} 年
          </option>
        </select>
        <template v-if="group.role !== 'member'">
          <t-button variant="outline" size="small" @click="refreshSnapshot">刷新快照</t-button>
          <t-button variant="outline" size="small" @click="runRecalculateCheck">
            重算校验
          </t-button>
        </template>
      </div>

      <t-alert
        v-if="checkResult !== undefined"
        :theme="checkResult.matched ? 'success' : 'warning'"
        :message="summarizeRecalculateMismatches(checkResult.mismatches)"
        class="statistics-check-result"
        @close="checkResult = undefined"
      />

      <section v-if="summary !== undefined" class="statistics-summary-cards">
        <t-card title="计划班次">{{ summary.plannedCount }}</t-card>
        <t-card title="实际值班">{{ summary.actualCount }}</t-card>
        <t-card title="计值班次">{{ summary.countedActualCount }}</t-card>
        <t-card title="周末值班">{{ summary.weekendCount }}</t-card>
        <t-card title="法定节假日值班">{{ summary.holidayCount }}</t-card>
        <t-card title="换班">{{ summary.swapCount }}</t-card>
        <t-card title="加班 / 扣班"
          >{{ summary.overtimeCount }} / {{ summary.deductionCount }}</t-card
        >
        <t-card title="加扣班净值">{{ formatNetDutyAdjustment(summary.netDutyAdjustment) }}</t-card>
        <t-card title="请假补位">{{ summary.leaveCoverCount }}</t-card>
        <t-card title="人工调整">{{ summary.manualAdjustmentCount }}</t-card>
      </section>

      <section v-if="summary !== undefined" class="statistics-detail">
        <t-card title="成员统计">
          <t-table
            :data="members"
            :columns="[
              { colKey: 'realName', title: '成员' },
              { colKey: 'plannedCount', title: '计划' },
              { colKey: 'actualCount', title: '实际' },
              { colKey: 'countedActualCount', title: '计值班次' },
              { colKey: 'weekendCount', title: '周末' },
              { colKey: 'holidayCount', title: '节假日' },
              { colKey: 'swapCount', title: '换班' },
              { colKey: 'overtimeCount', title: '加班' },
              { colKey: 'deductionCount', title: '扣班' },
              {
                colKey: 'netDutyAdjustment',
                title: '净值',
                cell: (row: { netDutyAdjustment: number }) =>
                  formatNetDutyAdjustment(row.netDutyAdjustment),
              },
              { colKey: 'deltaCount', title: '增减' },
              {
                colKey: 'actualVsPlannedCount',
                title: '原实对照',
                cell: (row: { actualVsPlanned: readonly unknown[] }) => row.actualVsPlanned.length,
              },
            ]"
            :max-height="480"
            row-key="membershipId"
            size="small"
          />
        </t-card>
        <div class="statistics-breakdowns">
          <t-card title="按排班岗位">
            <t-table
              :data="summary.byRole"
              :columns="[
                { colKey: 'scheduleRoleName', title: '岗位' },
                { colKey: 'plannedCount', title: '计划' },
                { colKey: 'actualCount', title: '实际' },
              ]"
              row-key="scheduleRoleId"
              size="small"
            />
          </t-card>
          <t-card title="按班种">
            <t-table
              :data="summary.byShiftType"
              :columns="[
                { colKey: 'shiftTypeName', title: '班种' },
                { colKey: 'plannedCount', title: '计划' },
                { colKey: 'actualCount', title: '实际' },
              ]"
              row-key="shiftTypeId"
              size="small"
            />
          </t-card>
        </div>
      </section>
      <t-empty v-else description="暂无统计数据" />
    </template>
  </section>
</template>
