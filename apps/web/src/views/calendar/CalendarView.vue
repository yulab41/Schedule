<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  ConfirmedHolidayDate,
  GroupSummary,
  ScheduleEvent,
} from '@schedule/contracts';
import { ChevronLeftIcon, ChevronRightIcon } from 'tdesign-icons-vue-next';
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
  getDefaultSelectedDate,
  getSwipeMonthIntent,
  getVisibleWeekForMonth,
  getWeekBusinessMonths,
  getWeekLabel,
  getWeekOfMonthLabel,
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
const viewModeOptions: readonly { readonly label: string; readonly value: CalendarViewMode }[] = [
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
  { label: '列表', value: 'list' },
];
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
const calendarRequestKey = computed(() =>
  viewMode.value === 'week' ? `week:${weekStart.value}` : `month:${businessMonth.value}`,
);

watch(
  () => [props.group.id, calendarRequestKey.value],
  () => {
    void loadCalendar();
  },
  { immediate: true },
);

watch(viewMode, () => {
  if (viewMode.value === 'week' && weekStart.value === '') {
    weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
  }
  if (viewMode.value === 'week') {
    selectedDate.value = todayBusinessDate;
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
  const requestedMonths =
    viewMode.value === 'week' && weekStart.value !== ''
      ? getWeekBusinessMonths(weekStart.value)
      : [businessMonth.value];

  try {
    const monthCalendars = await Promise.all(
      requestedMonths.map((month) => api.getCalendar(props.group.id, month)),
    );
    const firstCalendar = monthCalendars[0];
    if (firstCalendar === undefined) {
      throw new Error('Calendar month data is unavailable.');
    }
    const nextCalendar: CalendarReadModel = {
      ...firstCalendar,
      assignments: monthCalendars.flatMap((monthCalendar) => monthCalendar.assignments),
    };
    if (requestTracker.isCurrent(request)) {
      calendar.value = nextCalendar;
      if (viewMode.value !== 'week' || selectedDate.value === undefined) {
        selectedDate.value = getDefaultSelectedDate({
          assignments: nextCalendar.assignments,
          businessMonth: nextCalendar.businessMonth,
          today: todayBusinessDate,
        });
      }
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

  await loadHolidays(request, requestedMonths);
}

async function loadHolidays(request: number, requestedMonths: readonly string[]): Promise<void> {
  const years = [...new Set(requestedMonths.map((month) => Number(month.slice(0, 4))))];
  try {
    const holidayYears = await Promise.all(years.map((year) => api.getHolidays(year)));
    if (requestTracker.isCurrent(request)) {
      holidays.value = new Map(
        holidayYears.flatMap((year) => year.dates).map((date) => [date.date, date] as const),
      );
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
  selectedDate.value = todayBusinessDate;
}

function getWeekStartOfToday(): string {
  return getVisibleWeekForMonth(getCurrentBusinessMonth(), todayBusinessDate);
}

function goToPreviousWeek(): void {
  weekStart.value = addWeeks(weekStart.value, -1);
  selectedDate.value = weekStart.value;
}

function goToNextWeek(): void {
  weekStart.value = addWeeks(weekStart.value, 1);
  selectedDate.value = weekStart.value;
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
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <div class="calendar-toolbar">
      <div class="calendar-view-switch">
        <div class="view-mode-switch" role="tablist" aria-label="日历视图">
          <button
            v-for="option in viewModeOptions"
            :key="option.value"
            type="button"
            role="tab"
            class="view-mode-button"
            :class="{ active: viewMode === option.value }"
            :aria-selected="viewMode === option.value"
            @click="viewMode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <button
          type="button"
          class="mobile-filter-trigger"
          :aria-label="
            activeFilterCount > 0 ? `筛选排班，已启用${activeFilterCount}项` : '筛选排班'
          "
          @click="filterSheetVisible = true"
        >
          <svg class="filter-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          <span>筛选</span>
          <span v-if="activeFilterCount > 0" class="filter-count">{{ activeFilterCount }}</span>
        </button>
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
      <section v-if="viewMode === 'week'" class="week-calendar-card">
        <header class="week-navigation">
          <t-button class="week-step" aria-label="上一周" variant="text" @click="goToPreviousWeek">
            <template #icon><ChevronLeftIcon /></template>
            <span>上一周</span>
          </t-button>
          <div class="week-heading">
            <strong>{{ getWeekOfMonthLabel(weekStart) }}</strong>
            <span>{{ getWeekLabel(weekStart) }}</span>
          </div>
          <button class="calendar-locator" type="button" aria-label="定位到今天" @click="goToToday">
            <span class="locator-crosshair" aria-hidden="true">
              <span class="locator-crosshair-center" />
            </span>
          </button>
          <t-button class="week-step" aria-label="下一周" variant="text" @click="goToNextWeek">
            <template #icon><ChevronRightIcon /></template>
            <span>下一周</span>
          </t-button>
        </header>
        <WeekGrid
          :assignments="visibleAssignments"
          :holidays="holidays"
          :members="calendar.members"
          :selected-date="selectedDate"
          :today="todayBusinessDate"
          :week-start="weekStart"
          @open-events="openAssignmentEvents"
          @select-date="selectedDate = $event"
        />
      </section>
      <div
        v-else-if="viewMode === 'month'"
        class="month-swipe-surface"
        aria-label="月历，可左右滑动切换月份"
        @pointercancel="cancelMonthPointer"
        @pointerdown="onMonthPointerDown"
        @pointerup="onMonthPointerUp"
      >
        <section class="month-calendar-card">
          <header class="month-navigation">
            <t-button
              class="month-step"
              aria-label="上一月"
              variant="text"
              @click="goToPreviousMonth"
            >
              <template #icon><ChevronLeftIcon /></template>
              <span>上一月</span>
            </t-button>
            <div class="month-heading">
              <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
              <span class="month-swipe-hint">左右滑动切换月份</span>
            </div>
            <button
              class="calendar-locator"
              type="button"
              aria-label="定位到今天"
              @click="goToToday"
            >
              <span class="locator-crosshair" aria-hidden="true">
                <span class="locator-crosshair-center" />
              </span>
            </button>
            <t-button class="month-step" aria-label="下一月" variant="text" @click="goToNextMonth">
              <template #icon><ChevronRightIcon /></template>
              <span>下一月</span>
            </t-button>
            <label class="month-picker">
              年月
              <input v-model="businessMonth" type="month" />
            </label>
          </header>
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
        </section>
      </div>
      <section v-else-if="viewMode === 'list'" class="list-view" aria-label="列表视图">
        <header class="list-sticky-toolbar">
          <div class="list-month-bar">
            <button
              class="list-month-step"
              type="button"
              aria-label="上一月"
              @click="goToPreviousMonth"
            >
              <ChevronLeftIcon aria-hidden="true" />
            </button>
            <div class="list-month-heading">
              <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
              <span>固定月份 · {{ visibleAssignments.length }} 个班次</span>
            </div>
            <button
              class="list-month-step"
              type="button"
              aria-label="下一月"
              @click="goToNextMonth"
            >
              <ChevronRightIcon aria-hidden="true" />
            </button>
            <button
              class="calendar-locator"
              type="button"
              aria-label="定位到今天"
              @click="goToToday"
            >
              <span class="locator-crosshair" aria-hidden="true">
                <span class="locator-crosshair-center" />
              </span>
            </button>
          </div>
          <div class="list-meta">
            <span>月份工具栏固定 · 已按日期排序</span>
            <strong>今天 · {{ todayBusinessDate.slice(5).replace('-', '/') }}</strong>
          </div>
        </header>
        <ListGrid
          v-if="visibleAssignments.length > 0"
          :assignments="visibleAssignments"
          :holidays="holidays"
          :members="calendar.members"
          :today="todayBusinessDate"
          @open-events="openAssignmentEvents"
        />
        <p v-else class="calendar-empty">
          {{ onlyChanges ? '本月没有带变动标记的班次。' : '本月暂无已发布排班。' }}
        </p>
      </section>
      <SelectedDateDutyDetails
        v-if="(viewMode === 'month' || viewMode === 'week') && selectedDate !== undefined"
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
  align-content: start;
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

.view-mode-switch {
  display: grid;
  padding: 3px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: #e8edf3;
  border-radius: var(--ui-radius-medium);
}

.view-mode-button {
  min-width: 0;
  min-height: 44px;
  padding: 0 10px;
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: var(--ui-font-weight-semibold);
}

.view-mode-button.active {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  box-shadow: 0 2px 8px rgb(22 32 42 / 9%);
}

.mobile-filter-trigger {
  display: none;
}

.filter-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.calendar-locator {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui-color-primary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-medium);
  box-shadow: none;
  cursor: pointer;
}

.locator-crosshair {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
  background:
    linear-gradient(currentColor, currentColor) center top / 2px 4px no-repeat,
    linear-gradient(currentColor, currentColor) center bottom / 2px 4px no-repeat,
    linear-gradient(currentColor, currentColor) left center / 4px 2px no-repeat,
    linear-gradient(currentColor, currentColor) right center / 4px 2px no-repeat;
}

.locator-crosshair::before {
  position: absolute;
  inset: 2px;
  content: '';
  border: 2px solid currentColor;
  border-radius: 50%;
}

.locator-crosshair-center {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 4px;
  height: 4px;
  background: currentColor;
  border-radius: 50%;
}

.month-navigation,
.week-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.week-navigation {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px 44px;
  min-height: 60px;
  padding: 8px 12px;
  align-items: center;
  border-bottom: 1px solid var(--ui-color-border);
}

.week-heading {
  display: grid;
  min-width: 0;
  gap: 2px;
  text-align: center;
}

.week-heading strong {
  min-width: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-lg);
  line-height: 1.2;
}

.week-heading span {
  overflow: hidden;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.week-step {
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--ui-color-primary);
}

.month-calendar-card,
.week-calendar-card {
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.month-calendar-card .month-navigation {
  min-height: 60px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ui-color-border);
}

.month-heading {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  flex-direction: column;
  justify-content: center;
}

.month-swipe-hint {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-regular);
}

.month-calendar-card :deep(.month-grid) {
  border: 0;
  border-radius: 0;
}

.week-calendar-card :deep(.week-grid) {
  border: 0;
  border-radius: 0;
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

.list-view {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.list-sticky-toolbar {
  position: sticky;
  z-index: 2;
  top: 0;
  padding-bottom: 8px;
  background: var(--ui-color-background);
}

.list-month-bar {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px 44px;
  gap: 4px;
  padding: 4px;
  align-items: center;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.list-month-step {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui-color-primary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
}

.list-month-step svg {
  width: 20px;
  height: 20px;
}

.list-month-heading {
  display: grid;
  min-width: 0;
  gap: 2px;
  text-align: center;
}

.list-month-heading strong,
.list-month-heading span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-month-heading strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
}

.list-month-heading span,
.list-meta {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
}

.list-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}

.list-meta strong {
  color: var(--ui-color-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.month-swipe-surface {
  min-width: 0;
  touch-action: pan-y;
}

@media (max-width: 640px) {
  .calendar-view {
    gap: 14px;
  }

  .calendar-toolbar {
    gap: 0;
    padding: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .calendar-view-switch {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .mobile-filter-trigger {
    display: inline-flex;
    min-width: var(--ui-touch-target-minimum);
    min-height: 44px;
    padding: 0 12px;
    align-items: center;
    justify-content: center;
    gap: 5px;
    color: var(--ui-color-primary);
    background: var(--ui-color-surface);
    border: 1px solid var(--ui-color-border);
    border-radius: var(--ui-radius-medium);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: var(--ui-font-weight-semibold);
  }

  .calendar-filters {
    display: none;
  }

  .month-navigation {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px 44px;
    gap: 0;
  }

  .month-navigation strong {
    min-width: 0;
  }

  .month-step {
    min-width: var(--ui-touch-target-minimum);
    padding-inline: 0;
    color: var(--ui-color-primary);
  }

  .week-navigation {
    grid-template-columns: 44px minmax(0, 1fr) 44px 44px;
    gap: 0;
    padding: 8px 6px;
  }

  .week-navigation .week-step span {
    display: none;
  }

  .week-heading strong {
    font-size: var(--ui-font-size-md);
  }

  .week-heading span {
    font-size: 10px;
  }

  .month-step span {
    display: none;
  }

  .month-picker {
    display: none;
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
