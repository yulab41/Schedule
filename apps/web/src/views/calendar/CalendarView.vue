<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  ConfirmedHolidayDate,
  GroupSummary,
  ScheduleEvent,
} from '@schedule/contracts';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import {
  getConflictLatestData,
  getConflictMessage,
  getVersionConflictSummary,
  isDataConflictError,
} from '../../api/conflict-handler.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import DataConflictDialog from '../../components/DataConflictDialog.vue';
import {
  addBusinessMonths,
  createLatestRequestTracker,
  filterCalendarAssignments,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import {
  addWeeks,
  getBusinessDate,
  getBusinessMonthOf,
  getVisibleWeekForMonth,
  getWeekLabel,
  type CalendarViewMode,
} from '../../features/calendar/calendar-views.js';
import ListGrid from '../../features/calendar/ListGrid.vue';
import MonthGrid from '../../features/calendar/MonthGrid.vue';
import WeekGrid from '../../features/calendar/WeekGrid.vue';
import EventTimeline from '../../features/events/EventTimeline.vue';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const businessMonth = ref(getCurrentBusinessMonth());
const calendar = ref<CalendarReadModel>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const errorMessage = ref<string>();
const conflictMessage = ref('');
const conflictSummary = ref<string>();
const conflictVisible = ref(false);
const isLoading = ref(false);
const isLoadingEvents = ref(false);
const selectedAssignment = ref<CalendarDutyAssignment>();
const assignmentEvents = ref<readonly ScheduleEvent[]>([]);
const eventDialogVisible = ref(false);
const membershipIds = ref<string[]>([]);
const onlyChanges = ref(false);
const roleIds = ref<string[]>([]);
const shiftTypeIds = ref<string[]>([]);
const viewMode = ref<CalendarViewMode>('month');
const weekStart = ref('');
const requestTracker = createLatestRequestTracker();
const todayBusinessDate = getBusinessDate();

const visibleAssignments = computed(() =>
  filterCalendarAssignments(calendar.value?.assignments ?? [], {
    membershipIds: membershipIds.value,
    onlyChanges: onlyChanges.value,
    roleIds: roleIds.value,
    shiftTypeIds: shiftTypeIds.value,
  }),
);
const roleOptions = computed(() =>
  (calendar.value?.roles ?? []).map((role) => ({ label: role.name, value: role.id })),
);
const shiftTypeOptions = computed(() =>
  (calendar.value?.shiftTypes ?? []).map((shiftType) => ({
    label: `${shiftType.name}（${shiftType.abbreviation}）`,
    value: shiftType.id,
  })),
);
const memberOptions = computed(() =>
  (calendar.value?.members ?? []).map((member) => ({
    label: member.realName,
    value: member.membershipId,
  })),
);

watch(
  () => [props.group.id, businessMonth.value],
  () => {
    if (viewMode.value === 'week') {
      weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
    }
    void loadCalendar();
  },
  { immediate: true },
);

watch(viewMode, () => {
  if (viewMode.value === 'week' && weekStart.value === '') {
    weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
  }
});

onMounted(() => {
  viewMode.value = 'month';
  weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
  window.addEventListener('focus', onWindowFocus);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
});

function onWindowFocus(): void {
  void loadCalendar();
}

async function loadCalendar(): Promise<void> {
  const request = requestTracker.begin();
  errorMessage.value = undefined;
  isLoading.value = true;
  calendar.value = undefined;

  try {
    const nextCalendar = await api.getCalendar(props.group.id, businessMonth.value);
    if (requestTracker.isCurrent(request)) {
      calendar.value = nextCalendar;
      await scrollToTodayOnMobile();
    }
  } catch (error) {
    if (requestTracker.isCurrent(request)) {
      if (isDataConflictError(error)) {
        conflictMessage.value = getConflictMessage(error);
        conflictSummary.value = getVersionConflictSummary(getConflictLatestData(error));
        conflictVisible.value = true;
      } else {
        errorMessage.value = getErrorMessage(error);
      }
    }
  } finally {
    if (requestTracker.isCurrent(request)) {
      isLoading.value = false;
    }
  }

  await loadHolidays(request);
}

async function loadHolidays(request: number): Promise<void> {
  const year = Number(businessMonth.value.slice(0, 4));
  try {
    const nextHolidays = await api.getHolidays(year);
    if (requestTracker.isCurrent(request)) {
      holidays.value = new Map(nextHolidays.dates.map((date) => [date.date, date] as const));
    }
  } catch {
    // 节假日缺失不应阻断排班日历，保持空节假日状态。
    if (requestTracker.isCurrent(request)) {
      holidays.value = new Map();
    }
  }
}

async function scrollToTodayOnMobile(): Promise<void> {
  if (viewMode.value !== 'month' || !window.matchMedia('(max-width: 640px)').matches) {
    return;
  }

  await nextTick();
  document
    .querySelector('[data-today="true"]')
    ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function refreshAfterConflict(): void {
  conflictVisible.value = false;
  void loadCalendar();
}

function goToPreviousMonth(): void {
  businessMonth.value = addBusinessMonths(businessMonth.value, -1);
}

function goToNextMonth(): void {
  businessMonth.value = addBusinessMonths(businessMonth.value, 1);
}

function goToToday(): void {
  businessMonth.value = getCurrentBusinessMonth();
  weekStart.value = getWeekStartOfToday();
}

function getWeekStartOfToday(): string {
  return getVisibleWeekForMonth(getCurrentBusinessMonth(), todayBusinessDate);
}

function goToPreviousWeek(): void {
  weekStart.value = addWeeks(weekStart.value, -1);
  syncMonthToWeek();
}

function goToNextWeek(): void {
  weekStart.value = addWeeks(weekStart.value, 1);
  syncMonthToWeek();
}

function goToThisWeek(): void {
  weekStart.value = getWeekStartOfToday();
  businessMonth.value = getCurrentBusinessMonth();
}

function syncMonthToWeek(): void {
  const weekMonth = getBusinessMonthOf(weekStart.value);
  if (weekMonth !== businessMonth.value) {
    businessMonth.value = weekMonth;
  }
}

async function openAssignmentEvents(assignment: CalendarDutyAssignment): Promise<void> {
  selectedAssignment.value = assignment;
  assignmentEvents.value = [];
  eventDialogVisible.value = true;
  isLoadingEvents.value = true;
  try {
    const page = await api.getGroupEvents(props.group.id, {
      pageSize: 100,
      shiftId: assignment.id,
    });
    assignmentEvents.value = page.events;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isLoadingEvents.value = false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : '排班日历暂时无法加载，请稍后重试。';
}
</script>

<template>
  <section class="calendar-view" :aria-busy="isLoading">
    <h2>排班日历</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <div class="calendar-toolbar">
      <t-radio-group v-model="viewMode" aria-label="日历视图">
        <t-radio-button value="month">月</t-radio-button>
        <t-radio-button value="week">周</t-radio-button>
        <t-radio-button value="list">列表</t-radio-button>
      </t-radio-group>
      <div class="month-navigation">
        <t-button variant="outline" @click="goToPreviousMonth">上一月</t-button>
        <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
        <t-button variant="outline" @click="goToNextMonth">下一月</t-button>
        <t-button variant="outline" @click="goToToday">今天</t-button>
        <label class="month-picker">
          年月
          <input v-model="businessMonth" type="month" />
        </label>
      </div>
      <div v-if="viewMode === 'week'" class="week-navigation">
        <t-button variant="outline" @click="goToPreviousWeek">上一周</t-button>
        <strong>{{ getWeekLabel(weekStart) }}</strong>
        <t-button variant="outline" @click="goToNextWeek">下一周</t-button>
        <t-button variant="outline" @click="goToThisWeek">本周</t-button>
      </div>
      <div class="calendar-filters">
        <label class="changes-filter">
          <input v-model="onlyChanges" type="checkbox" />
          只看变动
        </label>
        <label v-if="roleOptions.length > 0" class="filter-field">
          排班岗位
          <t-select v-model="roleIds" multiple :options="roleOptions" clearable />
        </label>
        <label v-if="shiftTypeOptions.length > 0" class="filter-field">
          班种
          <t-select v-model="shiftTypeIds" multiple :options="shiftTypeOptions" clearable />
        </label>
        <label v-if="memberOptions.length > 0" class="filter-field">
          成员
          <t-select v-model="membershipIds" multiple :options="memberOptions" clearable />
        </label>
      </div>
    </div>
    <t-loading v-if="isLoading" text="正在加载排班日历" />
    <template v-else-if="calendar !== undefined">
      <WeekGrid
        v-if="viewMode === 'week'"
        :assignments="visibleAssignments"
        :holidays="holidays"
        :members="calendar.members"
        :today="todayBusinessDate"
        :week-start="weekStart"
        @open-events="openAssignmentEvents"
      />
      <MonthGrid
        v-else-if="viewMode === 'month'"
        :assignments="visibleAssignments"
        :business-month="calendar.businessMonth"
        :holidays="holidays"
        :members="calendar.members"
        :today="todayBusinessDate"
        @open-events="openAssignmentEvents"
      />
      <ListGrid
        v-else-if="viewMode === 'list' && visibleAssignments.length > 0"
        :assignments="visibleAssignments"
        :holidays="holidays"
        :members="calendar.members"
        :today="todayBusinessDate"
        @open-events="openAssignmentEvents"
      />
      <p v-else-if="viewMode === 'list'" class="calendar-empty">
        {{ onlyChanges ? '本月没有带变动标记的班次。' : '本月暂无已发布排班。' }}
      </p>
    </template>
    <DataConflictDialog
      :message="conflictMessage"
      :summary="conflictSummary"
      :visible="conflictVisible"
      @close="conflictVisible = false"
      @refresh="refreshAfterConflict"
    />
    <t-dialog
      v-model:visible="eventDialogVisible"
      header="班次事件记录"
      :footer="false"
      width="640px"
    >
      <template v-if="selectedAssignment !== undefined">
        <p class="assignment-events-meta">
          {{ selectedAssignment.businessDate }} {{ selectedAssignment.shiftTypeName }} ·
          {{ selectedAssignment.scheduleRoleName }}
        </p>
        <t-loading v-if="isLoadingEvents" text="正在加载事件记录" />
        <EventTimeline
          v-else-if="assignmentEvents.length > 0"
          :assignment="selectedAssignment"
          :events="assignmentEvents"
        />
        <p v-else class="assignment-events-empty">该班次暂无事件记录。</p>
      </template>
    </t-dialog>
  </section>
</template>

<style scoped>
.calendar-view {
  display: grid;
  gap: 12px;
}

.calendar-view h2 {
  margin: 0;
  font-size: var(--ui-font-size-xl);
  font-weight: 600;
}

.calendar-toolbar {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 8px;
}

.month-navigation,
.week-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.month-navigation strong,
.week-navigation strong {
  min-width: 96px;
  font-size: var(--ui-font-size-lg);
  text-align: center;
}

.month-picker {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-md);
}

.month-picker input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.calendar-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.changes-filter {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-md);
}

.filter-field {
  display: grid;
  gap: 4px;
  min-width: 160px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-md);
}

.calendar-empty {
  padding: 24px;
  color: var(--ui-color-text-muted);
  text-align: center;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
}

.assignment-events-meta {
  margin: 0 0 12px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  font-weight: 600;
}

.assignment-events-empty {
  margin: 0;
  padding: 16px;
  color: var(--ui-color-text-muted);
  text-align: center;
  background: var(--ui-color-background);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
}
</style>
