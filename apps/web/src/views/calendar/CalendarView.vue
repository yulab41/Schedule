<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  ConfirmedHolidayDate,
  GroupSummary,
  ScheduleEvent,
} from '@schedule/contracts';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
} from 'tdesign-icons-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import {
  getConflictLatestData,
  getConflictMessage,
  getVersionConflictSummary,
  isDataConflictError,
} from '../../api/conflict-handler.js';
import { localAuth } from '../../auth/local-auth.js';
import DataConflictDialog from '../../components/DataConflictDialog.vue';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import { responsiveSheetPopupProps } from '../../components/responsive-sheet-popup.js';
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
  getDefaultSelectedDate,
  getSwipeMonthIntent,
  getVisibleWeekForMonth,
  getWeekLabel,
  type CalendarViewMode,
} from '../../features/calendar/calendar-views.js';
import ListGrid from '../../features/calendar/ListGrid.vue';
import MonthGrid from '../../features/calendar/MonthGrid.vue';
import SelectedDateDutyDetails from '../../features/calendar/SelectedDateDutyDetails.vue';
import WeekGrid from '../../features/calendar/WeekGrid.vue';
import EventTimeline from '../../features/events/EventTimeline.vue';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const businessMonth = ref(getCurrentBusinessMonth());
const calendar = ref<CalendarReadModel>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const errorMessage = ref<string>();
const conflictMessage = ref('');
const conflictSummary = ref<string>();
const conflictVisible = ref(false);
const isLoading = ref(false);
const isLoadingEvents = ref(false);
const selectedDate = ref<string>();
const selectedAssignment = ref<CalendarDutyAssignment>();
const assignmentEvents = ref<readonly ScheduleEvent[]>([]);
const eventDialogVisible = ref(false);
const filterSheetVisible = ref(false);
const membershipIds = ref<string[]>([]);
const onlyChanges = ref(false);
const roleIds = ref<string[]>([]);
const shiftTypeIds = ref<string[]>([]);
const viewMode = ref<CalendarViewMode>('month');
const weekStart = ref('');
const requestTracker = createLatestRequestTracker();
const todayBusinessDate = getBusinessDate();
const monthPointerStart = ref<{
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}>();

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
const activeFilterCount = computed(
  () =>
    Number(onlyChanges.value) +
    Number(roleIds.value.length > 0) +
    Number(shiftTypeIds.value.length > 0) +
    Number(membershipIds.value.length > 0),
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
      selectedDate.value = getDefaultSelectedDate({
        assignments: nextCalendar.assignments,
        businessMonth: nextCalendar.businessMonth,
        today: todayBusinessDate,
      });
      await scrollToSelectedDateOnMobile();
    }
  } catch (error) {
    if (requestTracker.isCurrent(request)) {
      if (isDataConflictError(error)) {
        conflictMessage.value = getConflictMessage(error);
        conflictSummary.value = getVersionConflictSummary(getConflictLatestData(error));
        conflictVisible.value = true;
      } else {
        errorMessage.value = toUserMessage(error, '排班日历暂时无法加载，请稍后重试。');
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

async function scrollToSelectedDateOnMobile(): Promise<void> {
  if (viewMode.value !== 'month' || !window.matchMedia('(max-width: 640px)').matches) {
    return;
  }

  await nextTick();
  document.querySelector('[data-selected="true"]')?.scrollIntoView({
    block: 'nearest',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
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

function onMonthPointerDown(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0) return;
  monthPointerStart.value = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
}

function onMonthPointerUp(event: PointerEvent): void {
  const start = monthPointerStart.value;
  monthPointerStart.value = undefined;
  if (start === undefined || start.pointerId !== event.pointerId) return;

  const intent = getSwipeMonthIntent({
    deltaX: event.clientX - start.x,
    deltaY: event.clientY - start.y,
  });
  if (intent === -1) goToPreviousMonth();
  if (intent === 1) goToNextMonth();
}

function cancelMonthPointer(): void {
  monthPointerStart.value = undefined;
}

function clearFilters(): void {
  membershipIds.value = [];
  onlyChanges.value = false;
  roleIds.value = [];
  shiftTypeIds.value = [];
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
    errorMessage.value = toUserMessage(error, '排班日历暂时无法加载，请稍后重试。');
  } finally {
    isLoadingEvents.value = false;
  }
}
</script>

<template>
  <section class="calendar-view" :aria-busy="isLoading">
    <h2>排班日历</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <div class="calendar-toolbar">
      <div class="calendar-view-switch">
        <t-radio-group v-model="viewMode" class="view-mode-switch" aria-label="日历视图">
          <t-radio-button value="month">月</t-radio-button>
          <t-radio-button value="week">周</t-radio-button>
          <t-radio-button value="list">列表</t-radio-button>
        </t-radio-group>
        <t-button
          class="mobile-filter-trigger"
          variant="outline"
          :aria-label="
            activeFilterCount > 0 ? `筛选排班，已启用${activeFilterCount}项` : '筛选排班'
          "
          @click="filterSheetVisible = true"
        >
          <template #icon><FilterIcon /></template>
          筛选
          <span v-if="activeFilterCount > 0" class="filter-count">{{ activeFilterCount }}</span>
        </t-button>
      </div>
      <div class="month-navigation">
        <t-button
          class="month-step"
          aria-label="上一月"
          variant="outline"
          @click="goToPreviousMonth"
        >
          <template #icon><ChevronLeftIcon /></template>
          <span>上一月</span>
        </t-button>
        <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
        <t-button class="month-step" aria-label="下一月" variant="outline" @click="goToNextMonth">
          <template #icon><ChevronRightIcon /></template>
          <span>下一月</span>
        </t-button>
        <t-button class="today-button" variant="outline" @click="goToToday">
          <template #icon><CalendarIcon /></template>
          今天
        </t-button>
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
    <ResponsiveSheet
      id="calendar-filter-sheet"
      v-model:visible="filterSheetVisible"
      title="筛选排班"
    >
      <div class="mobile-calendar-filters">
        <label class="changes-filter">
          <input v-model="onlyChanges" type="checkbox" />
          只看有变更的班次
        </label>
        <label v-if="roleOptions.length > 0" class="filter-field">
          排班岗位
          <t-select
            v-model="roleIds"
            multiple
            :options="roleOptions"
            :popup-props="responsiveSheetPopupProps"
            clearable
          />
        </label>
        <label v-if="shiftTypeOptions.length > 0" class="filter-field">
          班种
          <t-select
            v-model="shiftTypeIds"
            multiple
            :options="shiftTypeOptions"
            :popup-props="responsiveSheetPopupProps"
            clearable
          />
        </label>
        <label v-if="memberOptions.length > 0" class="filter-field">
          成员
          <t-select
            v-model="membershipIds"
            multiple
            :options="memberOptions"
            :popup-props="responsiveSheetPopupProps"
            clearable
          />
        </label>
        <div class="filter-sheet-actions">
          <t-button variant="outline" @click="clearFilters">清除筛选</t-button>
          <t-button theme="primary" @click="filterSheetVisible = false">查看结果</t-button>
        </div>
      </div>
    </ResponsiveSheet>
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
      <div
        v-else-if="viewMode === 'month'"
        class="month-swipe-surface"
        aria-label="月历，可左右滑动切换月份"
        @pointercancel="cancelMonthPointer"
        @pointerdown="onMonthPointerDown"
        @pointerup="onMonthPointerUp"
      >
        <MonthGrid
          :assignments="visibleAssignments"
          :business-month="calendar.businessMonth"
          :holidays="holidays"
          :members="calendar.members"
          :selected-date="selectedDate"
          :today="todayBusinessDate"
          @open-events="openAssignmentEvents"
          @select-date="selectedDate = $event"
        />
      </div>
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
      <SelectedDateDutyDetails
        v-if="viewMode === 'month' && selectedDate !== undefined"
        :assignments="visibleAssignments"
        :members="calendar.members"
        :selected-date="selectedDate"
        @open-events="openAssignmentEvents"
      />
    </template>
    <DataConflictDialog
      :message="conflictMessage"
      :summary="conflictSummary"
      :visible="conflictVisible"
      @close="conflictVisible = false"
      @refresh="refreshAfterConflict"
    />
    <ResponsiveSheet
      id="assignment-event-sheet"
      v-model:visible="eventDialogVisible"
      title="班次事件记录"
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
    </ResponsiveSheet>
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
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.calendar-view-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
}

.view-mode-switch :deep(.t-radio-button) {
  min-height: var(--ui-touch-target-minimum);
}

.mobile-filter-trigger {
  display: none;
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

.month-navigation :deep(.t-button),
.week-navigation :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
  border-radius: var(--ui-radius-small);
}

.month-picker {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-md);
}

.month-picker input {
  min-height: var(--ui-touch-target-minimum);
  padding: 4px 8px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
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

.filter-field :deep(.t-input),
.filter-field :deep(.t-select__wrap) {
  min-height: var(--ui-touch-target-minimum);
}

.mobile-calendar-filters {
  display: grid;
  gap: var(--ui-spacing-md);
}

.mobile-calendar-filters .changes-filter {
  min-height: var(--ui-touch-target-minimum);
}

.filter-sheet-actions {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: var(--ui-spacing-sm);
}

.filter-sheet-actions :deep(.t-button) {
  min-height: var(--ui-touch-target-comfortable);
  border-radius: var(--ui-radius-medium);
}

.filter-count {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  margin-left: 2px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-radius: var(--ui-radius-pill);
  font-size: 10px;
}

.calendar-empty {
  padding: 24px;
  color: var(--ui-color-text-muted);
  text-align: center;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
}

.month-swipe-surface {
  min-width: 0;
  touch-action: pan-y;
}

@media (max-width: 640px) {
  .calendar-view {
    gap: 10px;
  }

  .calendar-view h2 {
    font-size: var(--ui-font-size-lg);
  }

  .calendar-toolbar {
    gap: 8px;
    padding: 10px;
    box-shadow: none;
  }

  .calendar-view-switch {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .view-mode-switch {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .view-mode-switch :deep(.t-radio-button) {
    min-width: 0;
    padding-inline: 10px;
  }

  .mobile-filter-trigger {
    display: inline-flex;
    min-width: var(--ui-touch-target-minimum);
    min-height: var(--ui-touch-target-minimum);
    border-radius: var(--ui-radius-small);
  }

  .calendar-filters {
    display: none;
  }

  .month-navigation {
    display: grid;
    grid-template-columns:
      var(--ui-touch-target-minimum) minmax(0, 1fr) var(--ui-touch-target-minimum)
      auto;
    gap: 6px;
  }

  .month-navigation strong {
    min-width: 0;
  }

  .month-step {
    min-width: var(--ui-touch-target-minimum);
    padding-inline: 0;
  }

  .month-step span {
    display: none;
  }

  .today-button {
    padding-inline: 10px;
  }

  .month-picker {
    grid-column: 1 / -1;
  }

  .month-picker input {
    min-width: 0;
    flex: 1;
  }
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
