<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarPreferences,
  CalendarReadModel,
  ConfirmedHolidayDate,
  GroupSummary,
  ScheduleEvent,
} from '@schedule/contracts';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

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
import LucideMinimalActionIcon from '../../components/LucideMinimalActionIcon.vue';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import SharedIcon from '../../components/SharedIcon.vue';
import TemporalPicker from '../../components/TemporalPicker.vue';
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
  retargetSelectedDateToMonth,
  getVisibleWeekForMonth,
  getWeekBusinessMonths,
  getWeekLabel,
  getWeekOfMonthLabel,
  type CalendarViewMode,
} from '../../features/calendar/calendar-views.js';
import { createAsyncResourceCache } from '../../features/calendar/calendar-resource-cache.js';
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
const calendar = shallowRef<CalendarReadModel>();
const calendarPreferences = shallowRef<CalendarPreferences>();
const holidays = shallowRef<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
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
const filterMotionKey = ref(0);
const locateMotionKey = ref(0);
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
const swipeViewportHeightPx = ref<number>();
const calendarSwipeViewport = ref<HTMLElement>();
let swipeLayoutFrame: number | undefined;
let swipeScrollTimer: number | undefined;
let swipeRecentering = false;
let swipeSettling = false;
let swipeTouchActive = false;
const PROGRAMMATIC_SWIPE_FALLBACK_MS = 700;
const SCROLL_IDLE_SETTLE_MS = 180;
interface SwipeNavigationRequest {
  readonly direction: -1 | 1;
  readonly targetBusinessMonth?: string;
  readonly targetWeekStart?: string;
}
let activeSwipeNavigation: SwipeNavigationRequest | undefined;
let queuedSwipeNavigation: SwipeNavigationRequest | undefined;
const calendarResourceCache = createAsyncResourceCache<CalendarReadModel>();
const holidayResourceCache =
  createAsyncResourceCache<Awaited<ReturnType<typeof api.getHolidays>>>();
let resourceCacheGroupId = '';
const listGridRef = ref<{
  scrollToDate: (businessDate: string, stickyOffset?: number) => boolean;
}>();
const calendarToolbar = ref<HTMLElement>();
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
const effectiveMonthShiftTypeId = computed(() => {
  const shiftTypes = calendar.value?.shiftTypes ?? [];
  const preferredId = calendarPreferences.value?.effectiveMonthShiftTypeId;
  if (preferredId !== null && preferredId !== undefined) {
    const preferred = shiftTypes.find((shiftType) => shiftType.id === preferredId);
    if (preferred !== undefined) return preferred.id;
  }
  return shiftTypes[0]?.id;
});
const monthVisibleAssignments = computed(() => {
  if (shiftTypeIds.value.length > 0) return visibleAssignments.value;
  const shiftTypeId = effectiveMonthShiftTypeId.value;
  return shiftTypeId === undefined
    ? visibleAssignments.value
    : visibleAssignments.value.filter((assignment) => assignment.shiftTypeId === shiftTypeId);
});
const listVisibleAssignments = computed(() =>
  visibleAssignments.value.filter((assignment) =>
    assignment.businessDate.startsWith(`${businessMonth.value}-`),
  ),
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
const swipeViewportStyle = computed(() =>
  swipeViewportHeightPx.value === undefined
    ? undefined
    : { height: `${swipeViewportHeightPx.value}px` },
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

watch(
  () => props.group.id,
  () => {
    calendarPreferences.value = undefined;
    void loadCalendarPreferences();
  },
  { immediate: true },
);

watch(viewMode, () => {
  if (viewMode.value === 'week' && weekStart.value === '') {
    weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
  }
  void recenterSwipeViewport();
});

watch(
  () => [
    businessMonth.value,
    calendar.value,
    holidays.value,
    visibleAssignments.value,
    weekStart.value,
  ],
  () => {
    if (viewMode.value !== 'list') void recenterSwipeViewport();
  },
  { flush: 'post' },
);

watch(
  [membershipIds, onlyChanges, roleIds, shiftTypeIds],
  () => {
    listLocationMessage.value = undefined;
  },
  { deep: true },
);

onMounted(() => {
  weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
  window.addEventListener('focus', onWindowFocus);
  window.addEventListener('resize', onWindowResize);
  void recenterSwipeViewport();
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
  window.removeEventListener('resize', onWindowResize);
  clearSwipeScrollTimer();
  if (swipeLayoutFrame !== undefined) window.cancelAnimationFrame(swipeLayoutFrame);
});

function onWindowFocus(): void {
  void loadCalendar({ forceRefresh: true });
}

function onWindowResize(): void {
  void recenterSwipeViewport();
}

async function loadCalendarPreferences(): Promise<void> {
  const groupId = props.group.id;
  try {
    const preferences = await api.getCalendarPreferences(props.group.id);
    if (props.group.id !== groupId) return;
    calendarPreferences.value = preferences;
    viewMode.value = preferences.effectiveView;
    if (viewMode.value === 'week' && weekStart.value === '') {
      weekStart.value = getVisibleWeekForMonth(businessMonth.value, todayBusinessDate);
    }
  } catch {
    // 偏好读取失败不应阻断日历；沿用月视图与首个可用班种。
  }
}

async function loadCalendar(options: { readonly forceRefresh?: boolean } = {}): Promise<void> {
  const request = requestTracker.begin();
  errorMessage.value = undefined;
  isLoading.value = true;
  ensureResourceCacheGroup();
  if (calendarGroupId.value !== props.group.id) {
    calendar.value = undefined;
  }
  const requestedMonths = getRequestedCalendarMonths();

  try {
    const monthCalendars = await Promise.all(
      requestedMonths.map((month) =>
        calendarResourceCache.get(month, () => api.getCalendar(props.group.id, month), options),
      ),
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
      const shouldInitializeSelection = selectedDate.value === undefined;
      if (shouldInitializeSelection) {
        selectedDate.value = getDefaultSelectedDate({
          assignments: nextCalendar.assignments,
          businessMonth: businessMonth.value,
          today: todayBusinessDate,
        });
      }
      if (shouldInitializeSelection) await scrollToSelectedDateOnMobile();
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

  await loadHolidays(request, requestedMonths, options);
  if (requestTracker.isCurrent(request)) {
    await locateTodayInListWhenReady();
  }
}

function ensureResourceCacheGroup(): void {
  if (resourceCacheGroupId === props.group.id) return;
  calendarResourceCache.clear();
  holidayResourceCache.clear();
  resourceCacheGroupId = props.group.id;
}

function getRequestedCalendarMonths(): readonly string[] {
  if (viewMode.value === 'month') {
    return [-2, -1, 0, 1, 2].map((relative) => addBusinessMonths(businessMonth.value, relative));
  }
  if (viewMode.value === 'week' && weekStart.value !== '') {
    return [...new Set(weekPanels.value.flatMap((panelWeek) => getWeekBusinessMonths(panelWeek)))];
  }
  return [businessMonth.value];
}

async function loadHolidays(
  request: number,
  requestedMonths: readonly string[],
  options: { readonly forceRefresh?: boolean } = {},
): Promise<void> {
  const years = [...new Set(requestedMonths.map((month) => Number(month.slice(0, 4))))];
  try {
    const holidayYears = await Promise.all(
      years.map((year) =>
        holidayResourceCache.get(String(year), () => api.getHolidays(year), options),
      ),
    );
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
  void loadCalendar({ forceRefresh: true });
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
  setBusinessMonth(addBusinessMonths(businessMonth.value, direction));
}

function setBusinessMonth(targetBusinessMonth: string): void {
  pendingListTodayLocation.value = false;
  listLocationMessage.value = undefined;
  if (selectedDate.value !== undefined) {
    selectedDate.value = retargetSelectedDateToMonth(selectedDate.value, targetBusinessMonth);
  }
  businessMonth.value = targetBusinessMonth;
}

function startSwipeNavigation(
  direction: -1 | 1,
  targets: Omit<SwipeNavigationRequest, 'direction'> = {},
): void {
  const request: SwipeNavigationRequest = { direction, ...targets };
  if (swipeSettling || swipeRecentering || activeSwipeNavigation !== undefined) {
    queuedSwipeNavigation = request;
    return;
  }
  const viewport = calendarSwipeViewport.value;
  if (viewport === undefined || viewport.clientWidth === 0) {
    applySwipeNavigation(request);
    return;
  }

  activeSwipeNavigation = request;
  const width = viewport.clientWidth;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  viewport.scrollTo({
    behavior: reducedMotion ? 'auto' : 'smooth',
    left: direction === -1 ? 0 : width * 2,
  });
  scheduleSwipeSettle(reducedMotion ? 0 : PROGRAMMATIC_SWIPE_FALLBACK_MS);
}

function onCalendarScroll(event: Event): void {
  if (swipeRecentering) return;
  const viewport = event.currentTarget as HTMLElement;
  syncSwipeViewportHeight(viewport);
  if (!swipeTouchActive && activeSwipeNavigation === undefined) {
    scheduleSwipeSettle(SCROLL_IDLE_SETTLE_MS);
  }
}

function onCalendarScrollEnd(): void {
  if (!swipeRecentering && !swipeTouchActive) void finishCalendarScroll();
}

function onCalendarTouchStart(): void {
  swipeTouchActive = true;
  activeSwipeNavigation = undefined;
  clearSwipeScrollTimer();
}

function onCalendarTouchEnd(): void {
  swipeTouchActive = false;
  scheduleSwipeSettle(SCROLL_IDLE_SETTLE_MS);
}

function pressCalendarControl(event: TouchEvent): void {
  (event.currentTarget as HTMLElement | null)?.classList.add('is-touch-pressed');
}

function releaseCalendarControl(event: TouchEvent): void {
  (event.currentTarget as HTMLElement | null)?.classList.remove('is-touch-pressed');
}

function scheduleSwipeSettle(delayMs: number): void {
  clearSwipeScrollTimer();
  swipeScrollTimer = window.setTimeout(() => void finishCalendarScroll(), delayMs);
}

async function finishCalendarScroll(): Promise<void> {
  if (swipeRecentering || swipeSettling) return;
  const viewport = calendarSwipeViewport.value;
  if (viewport === undefined || viewport.clientWidth === 0) return;

  clearSwipeScrollTimer();
  const pageIndex = Math.max(
    0,
    Math.min(2, Math.round(viewport.scrollLeft / viewport.clientWidth)),
  );
  const snappedDirection: -1 | 0 | 1 = pageIndex === 0 ? -1 : pageIndex === 2 ? 1 : 0;
  const navigationRequest = activeSwipeNavigation;
  const direction = navigationRequest?.direction ?? snappedDirection;
  activeSwipeNavigation = undefined;
  swipeSettling = true;

  if (direction !== 0) {
    applySwipeNavigation(navigationRequest ?? { direction });
  }

  await nextTick();
  const currentViewport = calendarSwipeViewport.value;
  if (currentViewport !== undefined && currentViewport.clientWidth > 0) {
    swipeRecentering = true;
    currentViewport.scrollLeft = currentViewport.clientWidth;
    syncSwipeViewportHeight(currentViewport);
  }
  if (swipeLayoutFrame !== undefined) window.cancelAnimationFrame(swipeLayoutFrame);
  swipeLayoutFrame = window.requestAnimationFrame(() => {
    swipeRecentering = false;
    swipeSettling = false;
    swipeLayoutFrame = undefined;
    flushQueuedSwipeNavigation();
  });
}

async function recenterSwipeViewport(): Promise<void> {
  if (viewMode.value === 'list' || swipeSettling || swipeRecentering) return;
  await nextTick();
  const viewport = calendarSwipeViewport.value;
  if (viewport === undefined || viewport.clientWidth === 0) return;

  clearSwipeScrollTimer();
  swipeRecentering = true;
  viewport.scrollLeft = viewport.clientWidth;
  syncSwipeViewportHeight(viewport);
  if (swipeLayoutFrame !== undefined) window.cancelAnimationFrame(swipeLayoutFrame);
  swipeLayoutFrame = window.requestAnimationFrame(() => {
    swipeRecentering = false;
    swipeLayoutFrame = undefined;
    flushQueuedSwipeNavigation();
  });
}

function applySwipeNavigation(request: SwipeNavigationRequest): void {
  if (viewMode.value === 'month') {
    if (request.targetBusinessMonth !== undefined) {
      setBusinessMonth(request.targetBusinessMonth);
    } else {
      shiftMonth(request.direction);
    }
    if (request.targetWeekStart !== undefined) weekStart.value = request.targetWeekStart;
    return;
  }

  if (viewMode.value === 'week') {
    if (request.targetWeekStart !== undefined) {
      weekStart.value = request.targetWeekStart;
    } else {
      shiftWeek(request.direction);
    }
    if (request.targetBusinessMonth !== undefined) {
      setBusinessMonth(request.targetBusinessMonth);
    }
  }
}

function flushQueuedSwipeNavigation(): void {
  const request = queuedSwipeNavigation;
  if (request === undefined || swipeSettling || swipeRecentering) return;
  queuedSwipeNavigation = undefined;
  startSwipeNavigation(request.direction, request);
}

function syncSwipeViewportHeight(viewport: HTMLElement): void {
  const panelHeights = [...viewport.querySelectorAll<HTMLElement>('.calendar-swipe-panel')].map(
    (panel) => panel.getBoundingClientRect().height,
  );
  if (panelHeights.length !== 3 || viewport.clientWidth === 0) return;

  const progress = Math.max(0, Math.min(2, viewport.scrollLeft / viewport.clientWidth));
  const lowerIndex = Math.floor(progress);
  const upperIndex = Math.ceil(progress);
  const fallbackHeight = panelHeights[1];
  if (fallbackHeight === undefined) return;
  const lowerHeight = panelHeights[lowerIndex] ?? fallbackHeight;
  const upperHeight = panelHeights[upperIndex] ?? lowerHeight;
  const interpolatedHeight = lowerHeight + (upperHeight - lowerHeight) * (progress - lowerIndex);
  if (interpolatedHeight > 0) swipeViewportHeightPx.value = Math.round(interpolatedHeight);
}

function clearSwipeScrollTimer(): void {
  if (swipeScrollTimer !== undefined) {
    window.clearTimeout(swipeScrollTimer);
    swipeScrollTimer = undefined;
  }
}

function clearFilters(): void {
  membershipIds.value = [];
  onlyChanges.value = false;
  roleIds.value = [];
  shiftTypeIds.value = [];
}

function openCalendarFilters(): void {
  filterMotionKey.value += 1;
  filterSheetVisible.value = true;
}

function playLocateMotionAndGoToToday(): void {
  locateMotionKey.value += 1;
  goToToday();
}

function goToToday(): void {
  if (viewMode.value === 'list') {
    pendingListTodayLocation.value = true;
    listLocationMessage.value = undefined;
    businessMonth.value = getCurrentBusinessMonth();
    weekStart.value = getWeekStartOfToday();
    selectedDate.value = todayBusinessDate;
    void locateTodayInListWhenReady();
    return;
  }

  const targetBusinessMonth = getCurrentBusinessMonth();
  const targetWeekStart = getWeekStartOfToday();
  selectedDate.value = todayBusinessDate;
  if (viewMode.value === 'month' && businessMonth.value !== targetBusinessMonth) {
    startSwipeNavigation(targetBusinessMonth < businessMonth.value ? -1 : 1, {
      targetBusinessMonth,
      targetWeekStart,
    });
    return;
  }
  if (viewMode.value === 'week' && weekStart.value !== targetWeekStart) {
    startSwipeNavigation(targetWeekStart < weekStart.value ? -1 : 1, {
      targetBusinessMonth,
      targetWeekStart,
    });
    return;
  }

  businessMonth.value = targetBusinessMonth;
  weekStart.value = targetWeekStart;
  void recenterSwipeViewport();
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
  const shellHeaderHeight =
    document.querySelector<HTMLElement>('.workbench-shell-header')?.offsetHeight ?? 0;
  const stickyOffset =
    shellHeaderHeight +
    (calendarToolbar.value?.offsetHeight ?? 0) +
    (listStickyToolbar.value?.offsetHeight ?? 0) +
    12;
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
    <div ref="calendarToolbar" class="calendar-toolbar">
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
          @click="openCalendarFilters"
        >
          <LucideMinimalActionIcon
            class="filter-icon"
            name="filter"
            :motion-key="filterMotionKey"
          />
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
          <button
            class="calendar-step week-step"
            type="button"
            aria-label="上一周"
            @click="goToPreviousWeek"
            @touchcancel.passive="releaseCalendarControl"
            @touchend.passive="releaseCalendarControl"
            @touchstart.passive="pressCalendarControl"
          >
            <SharedIcon name="chevron-left" />
            <span>上一周</span>
          </button>
          <div class="week-heading">
            <strong>{{ getWeekOfMonthLabel(weekStart) }}</strong>
            <span>{{ getWeekLabel(weekStart) }}</span>
          </div>
          <button
            class="calendar-locator"
            type="button"
            aria-label="定位到今天"
            @click="playLocateMotionAndGoToToday"
            @touchcancel.passive="releaseCalendarControl"
            @touchend.passive="releaseCalendarControl"
            @touchstart.passive="pressCalendarControl"
          >
            <LucideMinimalActionIcon
              class="locator-motion-icon"
              name="locate"
              :motion-key="locateMotionKey"
            />
          </button>
          <button
            class="calendar-step week-step"
            type="button"
            aria-label="下一周"
            @click="goToNextWeek"
            @touchcancel.passive="releaseCalendarControl"
            @touchend.passive="releaseCalendarControl"
            @touchstart.passive="pressCalendarControl"
          >
            <SharedIcon name="chevron-right" />
            <span>下一周</span>
          </button>
        </header>
        <div class="calendar-weekday-row" aria-hidden="true">
          <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday">
            {{ weekday }}
          </span>
        </div>
        <div
          ref="calendarSwipeViewport"
          class="calendar-swipe-viewport"
          :style="swipeViewportStyle"
          aria-label="周历，可左右滑动切换周"
          @scroll.passive="onCalendarScroll"
          @scrollend="onCalendarScrollEnd"
          @touchcancel.passive="onCalendarTouchEnd"
          @touchend.passive="onCalendarTouchEnd"
          @touchstart.passive="onCalendarTouchStart"
        >
          <div class="calendar-swipe-track">
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
            <button
              class="calendar-step month-step"
              type="button"
              aria-label="上一月"
              @click="goToPreviousMonth"
              @touchcancel.passive="releaseCalendarControl"
              @touchend.passive="releaseCalendarControl"
              @touchstart.passive="pressCalendarControl"
            >
              <SharedIcon name="chevron-left" />
              <span>上一月</span>
            </button>
            <div class="month-heading">
              <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
              <span class="month-swipe-hint">左右滑动切换月份</span>
            </div>
            <button
              class="calendar-locator"
              type="button"
              aria-label="定位到今天"
              @click="playLocateMotionAndGoToToday"
              @touchcancel.passive="releaseCalendarControl"
              @touchend.passive="releaseCalendarControl"
              @touchstart.passive="pressCalendarControl"
            >
              <LucideMinimalActionIcon
                class="locator-motion-icon"
                name="locate"
                :motion-key="locateMotionKey"
              />
            </button>
            <button
              class="calendar-step month-step"
              type="button"
              aria-label="下一月"
              @click="goToNextMonth"
              @touchcancel.passive="releaseCalendarControl"
              @touchend.passive="releaseCalendarControl"
              @touchstart.passive="pressCalendarControl"
            >
              <SharedIcon name="chevron-right" />
              <span>下一月</span>
            </button>
            <label class="month-picker">
              年月
              <TemporalPicker
                :model-value="businessMonth"
                kind="month"
                label="日历年月"
                @update:model-value="setBusinessMonth"
              />
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
            :style="swipeViewportStyle"
            aria-label="月历，可左右滑动切换月份"
            @scroll.passive="onCalendarScroll"
            @scrollend="onCalendarScrollEnd"
            @touchcancel.passive="onCalendarTouchEnd"
            @touchend.passive="onCalendarTouchEnd"
            @touchstart.passive="onCalendarTouchStart"
          >
            <div class="calendar-swipe-track">
              <div
                v-for="(panelMonth, panelIndex) in monthPanels"
                :key="panelMonth"
                class="calendar-swipe-panel"
                :aria-hidden="panelIndex !== 1"
                :inert="panelIndex !== 1"
              >
                <MonthGrid
                  :assignments="monthVisibleAssignments"
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
              <SharedIcon name="chevron-left" />
            </button>
            <div class="list-month-heading">
              <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
              <span>固定月份 · {{ listVisibleAssignments.length }} 个班次</span>
            </div>
            <button
              class="list-month-step"
              type="button"
              aria-label="下一月"
              @click="goToNextMonth"
            >
              <SharedIcon name="chevron-right" />
            </button>
            <button
              class="calendar-locator"
              type="button"
              aria-label="定位到今天"
              @click="playLocateMotionAndGoToToday"
              @touchcancel.passive="releaseCalendarControl"
              @touchend.passive="releaseCalendarControl"
              @touchstart.passive="pressCalendarControl"
            >
              <LucideMinimalActionIcon
                class="locator-motion-icon"
                name="locate"
                :motion-key="locateMotionKey"
              />
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
          v-if="listVisibleAssignments.length > 0"
          ref="listGridRef"
          :assignments="listVisibleAssignments"
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
        :shift-type-order="calendar.shiftTypes.map((shiftType) => shiftType.id)"
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
  --action-motion-icon-size: 20px;
  --action-motion-icon-stroke-width: 1.8;
}

.locator-motion-icon {
  --action-motion-icon-size: 16px;
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
  font: inherit;
  touch-action: manipulation;
  transition:
    color var(--ui-duration-fast) ease,
    background-color var(--ui-duration-fast) ease,
    transform var(--ui-duration-fast) ease;
  -webkit-tap-highlight-color: transparent;
}

.calendar-step {
  display: inline-flex;
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  align-items: center;
  justify-content: center;
  gap: 5px;
  appearance: none;
  color: var(--ui-color-primary);
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-medium);
  box-shadow: none;
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
  touch-action: manipulation;
  transition:
    color var(--ui-duration-fast) ease,
    background-color var(--ui-duration-fast) ease,
    transform var(--ui-duration-fast) ease;
  -webkit-tap-highlight-color: transparent;
}

.calendar-step svg {
  width: 20px;
  height: 20px;
  flex: none;
}

.calendar-step:active,
.calendar-locator:active {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  transform: scale(0.9);
}

.calendar-step.is-touch-pressed,
.calendar-locator.is-touch-pressed {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  transform: scale(0.9);
}

.calendar-step:focus-visible,
.calendar-locator:focus-visible {
  outline: 2px solid var(--ui-color-focus-ring);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .calendar-step,
  .calendar-locator {
    transition: none;
  }

  .calendar-step:active,
  .calendar-locator:active,
  .calendar-step.is-touch-pressed,
  .calendar-locator.is-touch-pressed {
    transform: none;
  }
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
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
  overflow-anchor: none;
}

.calendar-swipe-viewport::-webkit-scrollbar {
  display: none;
}

.calendar-swipe-track {
  display: grid;
  width: 300%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
}

.calendar-swipe-panel {
  min-width: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
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
    position: sticky;
    z-index: 4;
    top: calc(var(--ui-layout-header-height) + env(safe-area-inset-top));
    gap: 0;
    padding: 4px 0 8px;
    background: var(--ui-color-background);
    border: 0;
    box-shadow: none;
  }

  .list-sticky-toolbar {
    top: calc(
      var(--ui-layout-header-height) + env(safe-area-inset-top) +
        var(--ui-touch-target-comfortable) + 12px
    );
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
