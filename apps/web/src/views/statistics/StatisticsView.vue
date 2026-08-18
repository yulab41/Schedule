<script setup lang="ts">
import type {
  GroupSummary,
  MonthStatisticsSnapshot,
  StatisticsRecalculateCheckResult,
  StatisticsSummary,
  YearStatistics,
} from '@schedule/contracts';
import { getCurrentBusinessMonth } from '@schedule/scheduling-domain';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PrimaryTableCellParams, PrimaryTableCol, TableRowData } from 'tdesign-vue-next';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import TemporalPicker from '../../components/TemporalPicker.vue';
import {
  formatNetDutyAdjustment,
  formatStatisticsMonthLabel,
  getStatisticsSummaryItems,
  getStatisticsTableScrollHint,
  getStatisticsTableScrollState,
  sortMembersByActualCount,
  summarizeRecalculateMismatches,
  type StatisticsTableScrollState,
} from '../../features/statistics/statistics-logic.js';

const props = defineProps<{
  group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const viewMode = ref<'month' | 'year'>('month');
const businessMonth = ref(getCurrentBusinessMonth());
const year = ref(Number(getCurrentBusinessMonth().slice(0, 4)));
const statisticsYear = computed({
  get: () => String(year.value),
  set: (value: string) => {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) year.value = parsed;
  },
});
const isLoading = ref(false);
const errorMessage = ref<string>();
const monthData = ref<MonthStatisticsSnapshot>();
const yearData = ref<YearStatistics>();
const checkResult = ref<StatisticsRecalculateCheckResult>();

const summary = computed<StatisticsSummary | undefined>(() =>
  viewMode.value === 'month' ? monthData.value?.summary : yearData.value?.summary,
);
const members = computed(() =>
  summary.value === undefined ? [] : sortMembersByActualCount(summary.value.members),
);
const roleRows = computed(() => [...(summary.value?.byRole ?? [])]);
const shiftTypeRows = computed(() => [...(summary.value?.byShiftType ?? [])]);
const summaryItems = computed(() =>
  summary.value === undefined ? [] : getStatisticsSummaryItems(summary.value),
);
const primarySummaryItems = computed(() =>
  summaryItems.value.filter((item) => item.emphasis === 'primary'),
);
const secondarySummaryItems = computed(() =>
  summaryItems.value.filter((item) => item.emphasis === 'secondary'),
);
const periodLabel = computed(() =>
  viewMode.value === 'month' ? formatStatisticsMonthLabel(businessMonth.value) : `${year.value}年`,
);
const memberTableScroll = ref<HTMLDivElement>();
const memberScrollState = ref<StatisticsTableScrollState>(
  getStatisticsTableScrollState({ clientWidth: 0, scrollLeft: 0, scrollWidth: 0 }),
);
const memberScrollHint = computed(() => getStatisticsTableScrollHint(memberScrollState.value));
const memberScrollThumbStyle = computed(() => ({
  transform: `translateX(${Math.round(memberScrollState.value.progress * 36)}px)`,
}));
let memberTableResizeObserver: ResizeObserver | undefined;

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : 0;
}

function readArrayLength(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return Array.isArray(value) ? value.length : 0;
}

function renderNetDutyAdjustment(
  _h: unknown,
  params: PrimaryTableCellParams<TableRowData>,
): string {
  return formatNetDutyAdjustment(readNumber(params.row, 'netDutyAdjustment'));
}

function renderActualVsPlannedCount(
  _h: unknown,
  params: PrimaryTableCellParams<TableRowData>,
): string {
  return String(readArrayLength(params.row, 'actualVsPlanned'));
}

const memberColumns: PrimaryTableCol<TableRowData>[] = [
  { colKey: 'realName', fixed: 'left', title: '成员', width: 132 },
  { align: 'right', colKey: 'plannedCount', title: '计划', width: 74 },
  { align: 'right', colKey: 'actualCount', title: '实际', width: 74 },
  { align: 'right', colKey: 'countedActualCount', title: '计值班次', width: 92 },
  { align: 'right', colKey: 'weekendCount', title: '周末', width: 74 },
  { align: 'right', colKey: 'holidayCount', title: '节假日', width: 82 },
  { align: 'right', colKey: 'swapCount', title: '换班', width: 74 },
  { align: 'right', colKey: 'overtimeCount', title: '加班', width: 74 },
  { align: 'right', colKey: 'deductionCount', title: '扣班', width: 74 },
  {
    align: 'right',
    cell: renderNetDutyAdjustment,
    colKey: 'netDutyAdjustment',
    title: '净值',
    width: 74,
  },
  { align: 'right', colKey: 'deltaCount', title: '增减', width: 74 },
  {
    align: 'right',
    cell: renderActualVsPlannedCount,
    colKey: 'actualVsPlannedCount',
    title: '原实对照',
    width: 94,
  },
];

const roleColumns: PrimaryTableCol<TableRowData>[] = [
  { colKey: 'scheduleRoleName', title: '岗位' },
  { align: 'right', colKey: 'plannedCount', title: '计划', width: 72 },
  { align: 'right', colKey: 'actualCount', title: '实际', width: 72 },
];

const shiftTypeColumns: PrimaryTableCol<TableRowData>[] = [
  { colKey: 'shiftTypeName', title: '班种' },
  { align: 'right', colKey: 'plannedCount', title: '计划', width: 72 },
  { align: 'right', colKey: 'actualCount', title: '实际', width: 72 },
];

function updateMemberScrollState(): void {
  const element = memberTableScroll.value;
  if (!(element instanceof HTMLElement)) return;
  memberScrollState.value = getStatisticsTableScrollState({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  });
}

function scheduleMemberScrollUpdate(): void {
  void nextTick(updateMemberScrollState);
}

watch(memberTableScroll, (element) => {
  memberTableResizeObserver?.disconnect();
  memberTableResizeObserver = undefined;
  if (element instanceof HTMLElement && typeof ResizeObserver !== 'undefined') {
    memberTableResizeObserver = new ResizeObserver(updateMemberScrollState);
    memberTableResizeObserver.observe(element);
  }
  scheduleMemberScrollUpdate();
});

watch(() => members.value.length, scheduleMemberScrollUpdate);

onBeforeUnmount(() => memberTableResizeObserver?.disconnect());

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
    errorMessage.value = toUserMessage(error, '统计数据暂时无法加载，请稍后重试。');
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
    errorMessage.value = toUserMessage(error, '统计数据暂时无法加载，请稍后重试。');
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
    errorMessage.value = toUserMessage(error, '统计数据暂时无法加载，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section class="statistics-view">
    <header class="statistics-heading">
      <div>
        <p>值班台账</p>
        <h2>排班统计</h2>
      </div>
      <span>从排班与变更记录汇总，保持当前统计口径。</span>
    </header>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-loading v-if="isLoading" text="正在加载统计" />
    <template v-else>
      <div class="statistics-toolbar">
        <t-radio-group v-model="viewMode" class="statistics-mode-control" @change="load">
          <t-radio-button value="month">按月</t-radio-button>
          <t-radio-button value="year">按年</t-radio-button>
        </t-radio-group>
        <TemporalPicker
          v-if="viewMode === 'month'"
          v-model="businessMonth"
          class="statistics-month-input"
          kind="month"
          label="统计月份"
          @change="load"
        />
        <TemporalPicker
          v-else
          v-model="statisticsYear"
          class="statistics-year-input"
          kind="year"
          label="统计年份"
          @change="load"
        />
        <div v-if="group.role !== 'member'" class="statistics-admin-actions">
          <t-button variant="outline" size="small" @click="refreshSnapshot">刷新快照</t-button>
          <t-button variant="outline" size="small" @click="runRecalculateCheck">
            重算校验
          </t-button>
        </div>
      </div>

      <t-alert
        v-if="checkResult !== undefined"
        :theme="checkResult.matched ? 'success' : 'warning'"
        :message="summarizeRecalculateMismatches(checkResult.mismatches)"
        class="statistics-check-result"
        @close="checkResult = undefined"
      />

      <section v-if="summary !== undefined" class="statistics-summary-ledger">
        <header class="summary-ledger-heading">
          <span>统计周期</span>
          <strong>{{ periodLabel }}</strong>
        </header>
        <div class="statistics-primary-summary">
          <article v-for="item in primarySummaryItems" :key="item.key" class="primary-statistic">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>
        <div class="statistics-secondary-summary">
          <article
            v-for="item in secondarySummaryItems"
            :key="item.key"
            class="secondary-statistic"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>
      </section>

      <section v-if="summary !== undefined" class="statistics-detail">
        <section class="statistics-card member-statistics-card">
          <header class="statistics-card-heading">
            <div>
              <h3>成员统计</h3>
              <span>{{ members.length }} 位成员，按实际值班数排序</span>
            </div>
          </header>
          <div v-if="memberScrollState.isOverflowing" class="statistics-scroll-guide">
            <span>{{ memberScrollHint }}</span>
            <span
              class="statistics-scroll-progress"
              role="progressbar"
              aria-label="成员统计横向浏览进度"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="Math.round(memberScrollState.progress * 100)"
            >
              <span class="statistics-scroll-thumb" :style="memberScrollThumbStyle" />
            </span>
          </div>
          <div
            ref="memberTableScroll"
            class="member-statistics-scroll"
            tabindex="0"
            aria-label="成员统计表，可横向滚动"
            @scroll.passive="updateMemberScrollState"
          >
            <t-table
              class="member-statistics-table"
              :data="members"
              :columns="memberColumns"
              bordered
              row-key="membershipId"
              size="small"
              table-layout="fixed"
            />
          </div>
        </section>
        <div class="statistics-breakdowns">
          <section class="statistics-card breakdown-card">
            <header class="statistics-card-heading"><h3>按排班岗位</h3></header>
            <t-table
              :data="roleRows"
              :columns="roleColumns"
              bordered
              row-key="scheduleRoleId"
              size="small"
            />
          </section>
          <section class="statistics-card breakdown-card">
            <header class="statistics-card-heading"><h3>按班种</h3></header>
            <t-table
              :data="shiftTypeRows"
              :columns="shiftTypeColumns"
              bordered
              row-key="shiftTypeId"
              size="small"
            />
          </section>
        </div>
      </section>
      <t-empty v-else description="暂无统计数据" />
    </template>
  </section>
</template>

<style scoped>
.statistics-view {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-md);
}

.statistics-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.statistics-heading p,
.statistics-heading h2 {
  margin: 0;
}

.statistics-heading p {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.statistics-heading h2 {
  margin-top: var(--ui-spacing-xxs);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.statistics-heading > span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  text-align: right;
}

.statistics-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-sm);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.statistics-mode-control :deep(.t-radio-button),
.statistics-admin-actions :deep(.t-button),
.statistics-month-input,
.statistics-year-input {
  min-height: var(--ui-touch-target-minimum);
}

.statistics-admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-xs);
  margin-left: auto;
}

.statistics-summary-ledger {
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.summary-ledger-heading {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-spacing-xs) var(--ui-spacing-md);
  color: var(--ui-color-text-muted);
  background: var(--ui-color-primary-light);
  border-bottom: 1px solid var(--ui-color-primary-border);
  font-size: var(--ui-font-size-sm);
}

.summary-ledger-heading strong {
  color: var(--ui-color-primary-dark);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.statistics-primary-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--ui-color-border);
}

.primary-statistic {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-xxs);
  padding: var(--ui-spacing-md);
  border-right: 1px solid var(--ui-color-border);
}

.primary-statistic:last-child {
  border-right: 0;
}

.primary-statistic span,
.secondary-statistic span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.primary-statistic strong {
  color: var(--ui-color-text-primary);
  font-size: 28px;
  font-weight: var(--ui-font-weight-semibold);
  line-height: 1.08;
  letter-spacing: -0.6px;
}

.statistics-secondary-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.secondary-statistic {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-xs) var(--ui-spacing-md);
  border-right: 1px solid var(--ui-color-border);
  border-bottom: 1px solid var(--ui-color-border);
}

.secondary-statistic:nth-child(4n) {
  border-right: 0;
}

.secondary-statistic:nth-last-child(-n + 3) {
  border-bottom: 0;
}

.secondary-statistic strong {
  flex: none;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
}

.statistics-detail {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-md);
}

.statistics-card {
  min-width: 0;
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.statistics-card-heading {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
  margin-bottom: var(--ui-spacing-xs);
}

.statistics-card-heading h3,
.statistics-card-heading span {
  margin: 0;
}

.statistics-card-heading h3 {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.statistics-card-heading span {
  display: block;
  margin-top: 2px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.statistics-scroll-guide {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
  margin-bottom: var(--ui-spacing-xs);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.statistics-scroll-progress {
  position: relative;
  flex: 0 0 52px;
  height: 4px;
  overflow: hidden;
  background: rgb(10 102 213 / 16%);
  border-radius: var(--ui-radius-pill);
}

.statistics-scroll-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 4px;
  background: var(--ui-color-primary);
  border-radius: inherit;
  transition: transform var(--ui-duration-fast) ease;
}

.member-statistics-scroll {
  max-height: 480px;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.member-statistics-scroll:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.member-statistics-table {
  min-width: 1020px;
}

.member-statistics-table :deep(.t-table__content) {
  overflow: visible;
}

.member-statistics-table :deep(thead th) {
  position: sticky;
  z-index: 2;
  top: 0;
  background: var(--ui-color-surface-muted);
}

.member-statistics-table :deep(th:first-child),
.member-statistics-table :deep(td:first-child) {
  position: sticky;
  z-index: 1;
  left: 0;
  background: var(--ui-color-surface);
  box-shadow: 1px 0 0 var(--ui-color-border);
  font-weight: var(--ui-font-weight-semibold);
}

.member-statistics-table :deep(thead th:first-child) {
  z-index: 3;
  background: var(--ui-color-surface-muted);
}

.member-statistics-table :deep(td) {
  min-height: var(--ui-touch-target-minimum);
}

.statistics-breakdowns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-md);
}

.breakdown-card :deep(.t-table__th-cell-inner),
.breakdown-card :deep(.t-table__td-inner) {
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
}

@media (max-width: 760px) {
  .statistics-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .statistics-heading > span {
    text-align: left;
  }

  .statistics-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .statistics-mode-control,
  .statistics-admin-actions {
    grid-column: 1 / -1;
  }

  .statistics-mode-control {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .statistics-mode-control :deep(.t-radio-button) {
    width: 100%;
    justify-content: center;
  }

  .statistics-month-input,
  .statistics-year-input {
    grid-column: 1 / -1;
    width: 100%;
  }

  .statistics-admin-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-left: 0;
  }

  .statistics-admin-actions :deep(.t-button) {
    width: 100%;
  }

  .statistics-secondary-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .secondary-statistic,
  .secondary-statistic:nth-child(4n) {
    border-right: 1px solid var(--ui-color-border);
    border-bottom: 1px solid var(--ui-color-border);
  }

  .secondary-statistic:nth-child(2n) {
    border-right: 0;
  }

  .secondary-statistic:last-child {
    border-bottom: 0;
  }

  .statistics-card {
    padding: var(--ui-spacing-sm);
  }

  .statistics-breakdowns {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 360px) {
  .primary-statistic {
    padding: var(--ui-spacing-sm);
  }

  .primary-statistic strong {
    font-size: 24px;
  }

  .secondary-statistic {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .statistics-scroll-thumb {
    transition: none;
  }
}
</style>
