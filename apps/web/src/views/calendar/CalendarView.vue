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
import CompactSwitch from '../../components/CompactSwitch.vue';
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
  getCalendarPanelMonths,
  getCalendarPanelWeeks,
  getDefaultSelectedDate,
  getSwipeNavigationIntent,
  getSwipeSettleDuration,
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
const calendarGroupId = ref<string>();
const swipePointer = ref<{
  axis?: 'horizontal' | 'vertical';
  readonly pointerId: number;
  readonly startedAt: number;
  readonly startX: number;
  readonly startY: number;
}>();
const swipeOffsetPx = ref(0);
const swipeTransitionMs = ref(0);
const swipeAnimating = ref(false);
const swipeViewportWidth = ref(0);
const suppressSwipeClick = ref(false);
const calendarSwipeViewport = ref<HTMLElement>();
let swipeTimer: number | undefined;
const listGridRef = ref<{
  scrollToDate: (businessDate: string, stickyOffset?: number) => boolean;
}>();
const listStickyToolbar = ref<HTMLElement>();
const pendingListTodayLocation = ref(false);
const listLocationMessage = ref<string>();

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
const monthPanels = computed(() => getCalendarPanelMonths(businessMonth.value));
const weekPanels = computed(() => getCalendarPanelWeeks(weekStart.value));
const swipeTrackStyle = computed(() => ({
  transform: `translate3d(calc(-100% + ${swipeOffsetPx.value}px), 0, 0)`,
  transitionDuration: `${swipeTransitionMs.value}ms`,
}));
const swipeTrackMoving = computed(
  () => swipeAnimating.value || swipePointer.value?.axis === 'horizontal',
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
  resetSwipeTrack();
  if (viewMode.value === 'week' && weekStart.value === '') {
    weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
  }
  if (viewMode.value === 'week') {
    selectedDate.value = todayBusinessDate;
  }
});

watch(
  [membershipIds, onlyChanges, roleIds, shiftTypeIds],
  () => {
    listLocationMessage.value = undefined;
  },
  { deep: true },
);

onMounted(() => {
  viewMode.value = 'month';
  weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
  window.addEventListener('focus', onWindowFocus);
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
  clearSwipeTimer();
});

function onWindowFocus(): void {
  void loadCalendar();
}

async function loadCalendar(): Promise<void> {
  const request = requestTracker.begin();
  errorMessage.value = undefined;
  isLoading.value = true;
  if (calendarGroupId.value !== props.group.id) {
    calendar.value = undefined;
  }
  const requestedMonths = getRequestedCalendarMonths();

  try {
    const monthCalendars = await Promise.all(
      requestedMonths.map((month) => api.getCalendar(props.group.id, month)),
    );
    const activeMonth =
      viewMode.value === 'week' ? weekStart.value.slice(0, 7) : businessMonth.value;
    const activeCalendar =
      monthCalendars.find((monthCalendar) => monthCalendar.businessMonth === activeMonth) ??
      monthCalendars[0];
    if (activeCalendar === undefined) {
      throw new Error('Calendar month data is unavailable.');
    }
    const nextCalendar: CalendarReadModel = {
      ...activeCalendar,
      assignments: monthCalendars.flatMap((monthCalendar) => monthCalendar.assignments),
    };
    if (requestTracker.isCurrent(request)) {
      calendar.value = nextCalendar;
      calendarGroupId.value = props.group.id;
      if (viewMode.value !== 'week' || selectedDate.value === undefined) {
        selectedDate.value = getDefaultSelectedDate({
          assignments: nextCalendar.assignments,
          businessMonth: businessMonth.value,
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
  if (requestTracker.isCurrent(request)) {
    await locateTodayInListWhenReady();
  }
}

function getRequestedCalendarMonths(): readonly string[] {
  if (viewMode.value === 'month') {
    return monthPanels.value;
  }
  if (viewMode.value === 'week' && weekStart.value !== '') {
    return [...new Set(weekPanels.value.flatMap((panelWeek) => getWeekBusinessMonths(panelWeek)))];
  }
  return [businessMonth.value];
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
  if (viewMode.value === 'month') {
    startSwipeNavigation(-1);
    return;
  }
  shiftMonth(-1);
}

function goToNextMonth(): void {
  if (viewMode.value === 'month') {
    startSwipeNavigation(1);
    return;
  }
  shiftMonth(1);
}

function shiftMonth(direction: -1 | 1): void {
  pendingListTodayLocation.value = false;
  listLocationMessage.value = undefined;
  businessMonth.value = addBusinessMonths(businessMonth.value, direction);
}

function onCalendarPointerDown(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0 || swipeAnimating.value) return;
  const viewport = event.currentTarget as HTMLElement;
  swipeViewportWidth.value = viewport.getBoundingClientRect().width;
  suppressSwipeClick.value = false;
  swipeTransitionMs.value = 0;
  swipePointer.value = {
    pointerId: event.pointerId,
    startedAt: event.timeStamp,
    startX: event.clientX,
    startY: event.clientY,
  };
}

function onCalendarPointerMove(event: PointerEvent): void {
  const start = swipePointer.value;
  if (start === undefined || start.pointerId !== event.pointerId) return;

  const deltaX = event.clientX - start.startX;
  const deltaY = event.clientY - start.startY;
  if (start.axis === undefined && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 6) {
    start.axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.1 ? 'horizontal' : 'vertical';
  }
  if (start.axis !== 'horizontal') return;

  const viewport = event.currentTarget as HTMLElement;
  if (!viewport.hasPointerCapture(event.pointerId)) {
    viewport.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  const width = Math.max(1, swipeViewportWidth.value);
  swipeOffsetPx.value = Math.max(-width, Math.min(width, deltaX));
  if (Math.abs(deltaX) > 8) suppressSwipeClick.value = true;
}

function onCalendarPointerUp(event: PointerEvent): void {
  const start = swipePointer.value;
  if (start === undefined || start.pointerId !== event.pointerId) return;

  const viewport = event.currentTarget as HTMLElement;
  const deltaX = event.clientX - start.startX;
  const deltaY = event.clientY - start.startY;
  const elapsedMs = Math.max(16, event.timeStamp - start.startedAt);
  swipePointer.value = undefined;
  if (viewport.hasPointerCapture(event.pointerId)) {
    viewport.releasePointerCapture(event.pointerId);
  }
  if (start.axis !== 'horizontal') {
    swipeOffsetPx.value = 0;
    return;
  }

  const direction = getSwipeNavigationIntent({
    deltaX,
    deltaY,
    elapsedMs,
    viewportWidth: Math.max(1, swipeViewportWidth.value),
  });
  settleSwipe(direction, deltaX, elapsedMs);
}

function cancelCalendarPointer(event: PointerEvent): void {
  const start = swipePointer.value;
  if (start === undefined || start.pointerId !== event.pointerId) return;
  swipePointer.value = undefined;
  if (start.axis === 'horizontal') {
    settleSwipe(0, swipeOffsetPx.value, Math.max(16, performance.now() - start.startedAt));
  } else {
    swipeOffsetPx.value = 0;
  }
}

function onSwipeClickCapture(event: MouseEvent): void {
  if (!suppressSwipeClick.value) return;
  event.preventDefault();
  event.stopPropagation();
  suppressSwipeClick.value = false;
}

function startSwipeNavigation(direction: -1 | 1): void {
  if (swipeAnimating.value) return;
  swipeViewportWidth.value =
    calendarSwipeViewport.value?.getBoundingClientRect().width ?? swipeViewportWidth.value;
  settleSwipe(direction, 0, 240);
}

function settleSwipe(direction: -1 | 0 | 1, deltaX: number, elapsedMs: number): void {
  const width = Math.max(1, swipeViewportWidth.value);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = getSwipeSettleDuration({
    deltaX,
    direction,
    elapsedMs,
    reducedMotion,
    viewportWidth: width,
  });
  swipeAnimating.value = true;
  swipeTransitionMs.value = duration;
  swipeOffsetPx.value = direction === 0 ? 0 : -direction * width;
  clearSwipeTimer();
  if (duration === 0) {
    finishSwipe(direction);
    return;
  }
  swipeTimer = window.setTimeout(() => finishSwipe(direction), duration + 34);
}

function finishSwipe(direction: -1 | 0 | 1): void {
  clearSwipeTimer();
  swipeTransitionMs.value = 0;
  swipeOffsetPx.value = 0;
  swipeAnimating.value = false;
  suppressSwipeClick.value = false;
  if (direction === 0) return;

  if (viewMode.value === 'month') {
    shiftMonth(direction);
  } else if (viewMode.value === 'week') {
    shiftWeek(direction);
  }
}

function resetSwipeTrack(): void {
  clearSwipeTimer();
  swipePointer.value = undefined;
  swipeTransitionMs.value = 0;
  swipeOffsetPx.value = 0;
  swipeAnimating.value = false;
  suppressSwipeClick.value = false;
}

function clearSwipeTimer(): void {
  if (swipeTimer !== undefined) {
    window.clearTimeout(swipeTimer);
    swipeTimer = undefined;
  }
}

function clearFilters(): void {
  membershipIds.value = [];
  onlyChanges.value = false;
  roleIds.value = [];
  shiftTypeIds.value = [];
}

function goToToday(): void {
  if (viewMode.value === 'list') {
    pendingListTodayLocation.value = true;
    listLocationMessage.value = undefined;
  }
  businessMonth.value = getCurrentBusinessMonth();
  weekStart.value = getWeekStartOfToday();
  selectedDate.value = todayBusinessDate;
  void locateTodayInListWhenReady();
}

async function locateTodayInListWhenReady(): Promise<void> {
  if (
    viewMode.value !== 'list' ||
    !pendingListTodayLocation.value ||
    isLoading.value ||
    calendar.value?.businessMonth !== getCurrentBusinessMonth()
  ) {
    return;
  }

  await nextTick();
  const stickyOffset = (listStickyToolbar.value?.offsetHeight ?? 0) + 12;
  const located = listGridRef.value?.scrollToDate(todayBusinessDate, stickyOffset) ?? false;
  pendingListTodayLocation.value = false;
  listLocationMessage.value = located ? undefined : '当前筛选下今天没有排班';
}

function getWeekStartOfToday(): string {
  return getVisibleWeekForMonth(getCurrentBusinessMonth(), todayBusinessDate);
}

function goToPreviousWeek(): void {
  startSwipeNavigation(-1);
}

function goToNextWeek(): void {
  startSwipeNavigation(1);
}

function shiftWeek(direction: -1 | 1): void {
  weekStart.value = addWeeks(weekStart.value, direction);
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
        <div class="changes-filter">
          <span>只看变动</span>
          <CompactSwitch v-model="onlyChanges" label="只看变动" />
        </div>
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
        <div class="changes-filter">
          <span>只看有变更的班次</span>
          <CompactSwitch v-model="onlyChanges" label="只看有变更的班次" />
        </div>
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
    <t-loading v-if="isLoading && calendar === undefined" text="正在加载排班日历" />
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
        <div class="calendar-weekday-row" aria-hidden="true">
          <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday">
            {{ weekday }}
          </span>
        </div>
        <div
          ref="calendarSwipeViewport"
          class="calendar-swipe-viewport"
          :class="{ 'is-swiping': swipeTrackMoving }"
          aria-label="周历，可左右滑动切换周"
          @click.capture="onSwipeClickCapture"
          @lostpointercapture="cancelCalendarPointer"
          @pointercancel="cancelCalendarPointer"
          @pointerdown="onCalendarPointerDown"
          @pointermove="onCalendarPointerMove"
          @pointerup="onCalendarPointerUp"
        >
          <div class="calendar-swipe-track" :style="swipeTrackStyle">
            <div
              v-for="(panelWeek, panelIndex) in weekPanels"
              :key="panelWeek"
              class="calendar-swipe-panel"
              :aria-hidden="panelIndex !== 1"
              :inert="panelIndex !== 1"
            >
              <WeekGrid
                :assignments="visibleAssignments"
                :holidays="holidays"
                :members="calendar.members"
                :selected-date="panelIndex === 1 ? selectedDate : undefined"
                :show-weekday-header="false"
                :today="todayBusinessDate"
                :week-start="panelWeek"
                @select-date="selectedDate = $event"
              />
            </div>
          </div>
        </div>
      </section>
      <div v-else-if="viewMode === 'month'" class="month-swipe-surface">
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
          <div class="calendar-weekday-row" aria-hidden="true">
            <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday">
              {{ weekday }}
            </span>
          </div>
          <div
            ref="calendarSwipeViewport"
            class="calendar-swipe-viewport"
            :class="{ 'is-swiping': swipeTrackMoving }"
            aria-label="月历，可左右滑动切换月份"
            @click.capture="onSwipeClickCapture"
            @lostpointercapture="cancelCalendarPointer"
            @pointercancel="cancelCalendarPointer"
            @pointerdown="onCalendarPointerDown"
            @pointermove="onCalendarPointerMove"
            @pointerup="onCalendarPointerUp"
          >
            <div class="calendar-swipe-track" :style="swipeTrackStyle">
              <div
                v-for="(panelMonth, panelIndex) in monthPanels"
                :key="panelMonth"
                class="calendar-swipe-panel"
                :aria-hidden="panelIndex !== 1"
                :inert="panelIndex !== 1"
              >
                <MonthGrid
                  :assignments="visibleAssignments"
                  :business-month="panelMonth"
                  :holidays="holidays"
                  :members="calendar.members"
                  :selected-date="panelIndex === 1 ? selectedDate : undefined"
                  :show-weekday-header="false"
                  :today="todayBusinessDate"
                  @select-date="selectedDate = $event"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
      <section v-else-if="viewMode === 'list'" class="list-view" aria-label="列表视图">
        <header ref="listStickyToolbar" class="list-sticky-toolbar">
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
        <p v-if="listLocationMessage !== undefined" class="list-location-message" role="status">
          {{ listLocationMessage }}
        </p>
        <ListGrid
          v-if="visibleAssignments.length > 0"
          ref="listGridRef"
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
  height: 100%;
  flex: 1;
  border: 0;
  border-radius: 0;
}

.week-calendar-card .calendar-swipe-panel {
  display: flex;
}

.week-calendar-card .calendar-swipe-viewport.is-swiping :deep(.week-row .day-cell:first-child) {
  border-bottom-left-radius: 0;
}

.week-calendar-card .calendar-swipe-viewport.is-swiping :deep(.week-row .day-cell:last-child) {
  border-bottom-right-radius: 0;
}

.calendar-weekday-row {
  display: grid;
  min-height: 32px;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: center;
  background: #f8fafc;
  border-bottom: 1px solid var(--ui-color-border);
}

.calendar-weekday-row span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-weight: 600;
  text-align: center;
}

.calendar-weekday-row span:nth-last-child(-n + 2) {
  color: var(--ui-color-weekend);
}

.calendar-swipe-viewport {
  min-width: 0;
  overflow: hidden;
  overscroll-behavior-x: contain;
  touch-action: pan-y;
}

.calendar-swipe-track {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, 100%);
  align-items: stretch;
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.calendar-swipe-panel {
  min-width: 0;
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

.list-location-message {
  margin: 0;
  padding: 10px 12px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
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

  .calendar-weekday-row {
    min-height: 28px;
  }

  .calendar-weekday-row span {
    font-size: 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .calendar-swipe-track {
    transition: none;
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
