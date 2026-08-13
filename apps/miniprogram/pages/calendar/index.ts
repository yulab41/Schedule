import {
  getCalendar,
  getGuestHolidays,
  getHolidays,
  getLoggedInGuestCalendar,
  listEvents,
} from '../../api/endpoints.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import {
  addBusinessMonths,
  getCurrentBusinessDate,
} from '../../features/calendar/calendar-logic.js';
import {
  buildCalendarSurfaceViewModel,
  recenterCalendarMonthSlots,
  type CalendarMonthSlotViewModel,
  type CalendarSurfaceViewModel,
} from '../../features/calendar/calendar-surface.js';
import {
  createCalendarPageController,
  type CalendarContext,
  type CalendarPageController,
  type CalendarMonthSlotUpdate,
} from '../../features/calendar/calendar-page-controller.js';
import {
  createCalendarViewModeState,
  goCalendarToBusinessMonth,
  goCalendarToThisWeek,
  goCalendarToToday,
  recenterMonthSlots,
  rotateMonthSlots,
  stepCalendarWeek,
  switchCalendarViewMode,
  type CalendarMonthSlots,
  type CalendarViewMode,
} from '../../features/calendar/calendar-view-mode.js';
import {
  createCalendarMonthStateViewModel,
  type CalendarFilterOption,
  type CalendarFilterViewModel,
  type CalendarMonthDataViewModel,
  type CalendarMonthViewModel,
} from '../../features/calendar/calendar-view-model.js';
import { getBusinessMonthsForWeek, getWeekLabel } from '../../features/calendar/calendar-views.js';
import {
  buildCalendarSurfaceFilters,
  getCalendarCacheNoticeData,
  getCalendarFilterSummary,
  parseCalendarMonthPickerValue,
} from '../../features/calendar/calendar-page-ui.js';
import type { CalendarCacheNotice } from '@schedule/calendar-core';
import {
  resolveCalendarRouteAction,
  type CalendarRouteTarget,
} from '../../features/calendar/calendar-routing.js';
import {
  guardMiniprogramRoute,
  isMembershipRouteRole,
} from '../../features/navigation/route-guard.js';
import {
  completeCalendarSheetClose,
  getCalendarSheetKind,
  getCalendarSheetTitle,
  openCalendarSheet,
  reconcileCalendarSheet,
  requestCalendarSheetClose,
  resetCalendarSheet,
  type CalendarSheetHostState,
  type CalendarSheetKind,
} from '../../features/calendar/calendar-sheet-host.js';
import {
  createEventTimelineController,
  type EventTimelineController,
  type EventTimelineState,
} from '../../features/events/event-timeline-controller.js';
import { getCalendarCacheRuntime } from '../../store/calendar-cache-runtime.js';
import {
  calendarInvalidationRegistry,
  createCalendarInvalidationObserver,
  type CalendarInvalidationObserver,
} from '../../store/calendar-invalidation.js';
import { sessionStore } from '../../store/session.js';

interface CalendarPageData {
  readonly activeRole: string;
  readonly cacheNotice: CalendarCacheNotice | null;
  readonly eventTimeline: EventTimelineState;
  readonly filterSheetKey: number;
  readonly filterSheetKind: CalendarFilterKind | '';
  readonly filterSheetOptions: readonly CalendarFilterOption[];
  readonly filterSheetSelectedIds: readonly string[];
  readonly filterSheetTitle: string;
  readonly filterSheetVisible: boolean;
  readonly hasActiveGroup: boolean;
  readonly hasCalendarData: boolean;
  readonly memberFilterSummary: string;
  readonly monthSlots: readonly [
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
  ];
  readonly renderer: string;
  readonly roleFilterSummary: string;
  readonly sheetHost: CalendarSheetHostState;
  readonly sheetKind: CalendarSheetKind;
  readonly sheetTitle: string;
  readonly surface: CalendarSurfaceViewModel;
  readonly shiftFilterSummary: string;
  readonly swiperIndex: 1;
  readonly viewMode: CalendarViewMode;
  readonly weekLabel: string;
  readonly weekStart: string;
}

type CalendarFilterKind = 'member' | 'role' | 'shift';
type ActionIdEvent = WechatMiniprogram.CustomEvent<{ readonly actionId?: unknown }>;
type SheetLifecycleEvent = WechatMiniprogram.CustomEvent<{ readonly sheetKey?: unknown }>;
type ModeTapEvent = WechatMiniprogram.BaseEvent<Record<string, never>, { readonly mode?: unknown }>;
type FilterTapEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly filterKind?: unknown }
>;
type FilterApplyEvent = WechatMiniprogram.CustomEvent<{
  readonly filterKey?: unknown;
  readonly selectedIds?: unknown;
  readonly sheetKey?: unknown;
}>;
type FilterLifecycleEvent = WechatMiniprogram.CustomEvent<{
  readonly filterKey?: unknown;
  readonly sheetKey?: unknown;
}>;
type MonthPickerEvent = WechatMiniprogram.PickerChange;
type SwiperChangeEvent = WechatMiniprogram.CustomEvent<{
  readonly current?: unknown;
  readonly source?: unknown;
}>;

interface CalendarPageMethods {
  activeContextKey?: string;
  controller?: CalendarPageController;
  eventController?: EventTimelineController;
  invalidationObserver?: CalendarInvalidationObserver;
  applySlotUpdate(update: CalendarMonthSlotUpdate): void;
  handleCopy(event: ActionIdEvent): void;
  handleDial(event: ActionIdEvent): void;
  handleFilterApply(event: FilterApplyEvent): void;
  handleFilterClosed(event: FilterLifecycleEvent): void;
  handleFilterRequestClose(event: FilterLifecycleEvent): void;
  handleMonthChange(event: MonthPickerEvent): void;
  handleNextMonth(): void;
  handleNextWeek(): void;
  handleOnlyChanges(event: WechatMiniprogram.SwitchChange): void;
  handleOpenFilter(event: FilterTapEvent): void;
  handlePreviousMonth(): void;
  handlePreviousWeek(): void;
  handleRetry(): void;
  handleRouteAction(event: ActionIdEvent): void;
  handleSheetClosed(event: SheetLifecycleEvent): void;
  handleSheetRequestClose(event: SheetLifecycleEvent): void;
  handleSwiperChange(event: SwiperChangeEvent): void;
  handleThisWeek(): void;
  handleToday(): void;
  handleViewModeTap(event: ModeTapEvent): void;
  lastResolvedRoute?: CalendarRouteTarget;
  loadMonths(force?: boolean): void;
  navigationEpoch: number;
  resetSensitiveCalendarDetails(): void;
  resetCalendarContextData(): void;
  swiperLocked: boolean;
  updateNavigation(next: {
    readonly businessMonth: string;
    readonly mode: CalendarViewMode;
    readonly weekStart: string;
  }): void;
}

function isDataViewModel(
  viewModel: CalendarMonthViewModel,
): viewModel is CalendarMonthDataViewModel {
  return (
    viewModel.status === 'cached' ||
    viewModel.status === 'ready' ||
    viewModel.status === 'refreshing'
  );
}

function getActiveGroup() {
  const state = sessionStore.state;
  if (state.status !== 'authenticated' || state.activeGroupId === undefined) return undefined;
  return state.groups.find(({ id }) => id === state.activeGroupId);
}

function getToday(): string {
  return getCurrentBusinessDate();
}

function getInitialState() {
  return createCalendarViewModeState(getToday());
}

function getInitialSlots(): readonly [
  CalendarMonthSlotViewModel,
  CalendarMonthSlotViewModel,
  CalendarMonthSlotViewModel,
] {
  return recenterMonthSlots(getInitialState().businessMonth).map((businessMonth) => ({
    businessMonth,
    viewModel: createCalendarMonthStateViewModel(businessMonth, 'loading'),
  })) as [CalendarMonthSlotViewModel, CalendarMonthSlotViewModel, CalendarMonthSlotViewModel];
}

function contextForCurrentGroup(): CalendarContext | undefined {
  const group = getActiveGroup();
  if (group === undefined) return undefined;
  const profile = sessionStore.state.profile;
  if (profile?.id === undefined || group.version < 1) return undefined;
  return {
    groupId: group.id,
    groupRole: group.role,
    groupVersion: group.version,
    userId: profile.id,
  };
}

function getCalendarContextKey(context: CalendarContext): string {
  return JSON.stringify([context.userId, context.groupId, context.groupRole, context.groupVersion]);
}

function makeSurface(
  slots: readonly [
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
  ],
  viewMode: CalendarViewMode,
  weekStart: string,
): CalendarSurfaceViewModel {
  return buildCalendarSurfaceViewModel({
    businessMonth: slots[1].businessMonth,
    mode: viewMode,
    monthSlots: slots,
    weekStart,
  });
}

function getRequiredSurfaceMonths(
  slots: readonly CalendarMonthSlotViewModel[],
  viewMode: CalendarViewMode,
  weekStart: string,
): readonly string[] {
  return viewMode === 'week'
    ? getBusinessMonthsForWeek(weekStart)
    : [slots[1]?.businessMonth ?? ''];
}

function getCalendarPresentation(
  slots: readonly [
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
  ],
  viewMode: CalendarViewMode,
  weekStart: string,
) {
  const requiredMonths = getRequiredSurfaceMonths(slots, viewMode, weekStart);
  const filters = buildCalendarSurfaceFilters(slots, requiredMonths);
  const surface = makeSurface(slots, viewMode, weekStart);
  return {
    cacheNotice: getCalendarCacheNoticeData(slots, requiredMonths),
    hasCalendarData: filters !== undefined && surface.kind !== 'state',
    memberFilterSummary: getCalendarFilterSummary(
      '成员',
      filters?.members ?? [],
      filters?.selectedMembershipIds ?? [],
    ),
    roleFilterSummary: getCalendarFilterSummary(
      '岗位',
      filters?.roles ?? [],
      filters?.selectedRoleIds ?? [],
    ),
    shiftFilterSummary: getCalendarFilterSummary(
      '班种',
      filters?.shiftTypes ?? [],
      filters?.selectedShiftTypeIds ?? [],
    ),
    surface,
    weekLabel: getWeekLabel(weekStart),
  };
}

function isCalendarFilterKind(value: unknown): value is CalendarFilterKind {
  return value === 'member' || value === 'role' || value === 'shift';
}

function getFilterOptions(
  filters: CalendarFilterViewModel,
  kind: CalendarFilterKind,
): readonly CalendarFilterOption[] {
  const options =
    kind === 'role' ? filters.roles : kind === 'shift' ? filters.shiftTypes : filters.members;
  return options.filter(({ id }) => id.length > 0);
}

function getSelectedFilterIds(
  filters: CalendarFilterViewModel,
  kind: CalendarFilterKind,
): readonly string[] {
  return kind === 'role'
    ? filters.selectedRoleIds
    : kind === 'shift'
      ? filters.selectedShiftTypeIds
      : filters.selectedMembershipIds;
}

const initialViewState = getInitialState();
const initialSlots = getInitialSlots();
const initialPresentation = getCalendarPresentation(
  initialSlots,
  initialViewState.mode,
  initialViewState.weekStart,
);
const initialEventTimeline: EventTimelineState = { hasMore: false, items: [], status: 'idle' };
const initialSheetHost: CalendarSheetHostState = { sheetKey: 0, visible: false };

Page<CalendarPageData, CalendarPageMethods>({
  data: {
    activeRole: '',
    cacheNotice: initialPresentation.cacheNotice,
    eventTimeline: initialEventTimeline,
    filterSheetKey: 0,
    filterSheetKind: '',
    filterSheetOptions: [],
    filterSheetSelectedIds: [],
    filterSheetTitle: '',
    filterSheetVisible: false,
    hasActiveGroup: false,
    hasCalendarData: initialPresentation.hasCalendarData,
    memberFilterSummary: initialPresentation.memberFilterSummary,
    monthSlots: initialSlots,
    renderer: 'unknown',
    roleFilterSummary: initialPresentation.roleFilterSummary,
    sheetHost: initialSheetHost,
    sheetKind: 'none',
    sheetTitle: '',
    shiftFilterSummary: initialPresentation.shiftFilterSummary,
    surface: initialPresentation.surface,
    swiperIndex: 1,
    viewMode: initialViewState.mode,
    weekLabel: initialPresentation.weekLabel,
    weekStart: initialViewState.weekStart,
  },
  navigationEpoch: 0,
  swiperLocked: false,
  onLoad(): void {
    this.setData({ renderer: 'skyline' });
    this.controller = createCalendarPageController({
      cache: getCalendarCacheRuntime().cache,
      getCalendar: (groupId, businessMonth) => getCalendar(groupId, businessMonth),
      getGuestHolidays: (year) => getGuestHolidays(year),
      getHolidays: (year) => getHolidays(year),
      getLoggedInGuestCalendar: (groupId, businessMonth) =>
        getLoggedInGuestCalendar(groupId, businessMonth),
      getToday,
      makePhoneCall: (options) => wx.makePhoneCall(options),
      publish: () => undefined,
      publishUpdate: (update) => this.applySlotUpdate(update),
      setClipboardData: (options) => wx.setClipboardData(options),
    });
    this.eventController = createEventTimelineController({
      listEvents: (groupId, query) => listEvents(groupId, query),
      publish: (eventTimeline) => {
        const content = this.data.sheetHost.content;
        const group = getActiveGroup();
        if (
          content?.kind === 'events' &&
          this.data.sheetHost.visible &&
          content.assignment.assignmentId === eventTimeline.assignmentId &&
          group?.id === eventTimeline.groupId
        ) {
          this.setData({ eventTimeline });
        }
      },
    });
    this.invalidationObserver = createCalendarInvalidationObserver(calendarInvalidationRegistry);
  },
  onShow(): void {
    const state = sessionStore.state;
    if (state.status !== 'authenticated') {
      this.activeContextKey = undefined;
      this.resetSensitiveCalendarDetails();
      this.controller?.dispose();
      this.resetCalendarContextData();
      navigateForCurrentSession();
      return;
    }
    if (
      !guardMiniprogramRoute(state, '/pages/calendar/index', {
        hideTabBar: () => wx.hideTabBar({}),
        reLaunch: (options) => wx.reLaunch(options),
        showTabBar: () => wx.showTabBar({}),
        switchTab: (options) => wx.switchTab(options),
      })
    ) {
      this.activeContextKey = undefined;
      this.resetSensitiveCalendarDetails();
      this.controller?.dispose();
      this.resetCalendarContextData();
      return;
    }
    const group = getActiveGroup();
    const context = contextForCurrentGroup();
    if (group === undefined || context === undefined) {
      this.activeContextKey = undefined;
      this.resetSensitiveCalendarDetails();
      this.controller?.dispose();
      this.resetCalendarContextData();
      this.setData({ activeRole: '', hasActiveGroup: false });
      return;
    }
    const activeContextKey = getCalendarContextKey(context);
    if (this.activeContextKey !== activeContextKey) {
      this.resetSensitiveCalendarDetails();
      this.resetCalendarContextData();
    }
    this.activeContextKey = activeContextKey;
    this.setData({ activeRole: group.role, hasActiveGroup: true });
    this.controller?.activate(context);
    const visibleMonths = this.data.monthSlots.map(({ businessMonth }) => businessMonth);
    const invalidatedMonths = this.invalidationObserver?.consume(context, visibleMonths) ?? [];
    if (invalidatedMonths.length > 0) this.controller?.invalidate(context, invalidatedMonths);
    this.invalidationObserver?.observe(context, visibleMonths);
    this.loadMonths(true);
  },
  onHide(): void {
    this.resetSensitiveCalendarDetails();
  },
  onUnload(): void {
    this.resetSensitiveCalendarDetails();
    this.navigationEpoch += 1;
    this.controller?.dispose();
    this.controller = undefined;
    this.eventController = undefined;
    this.invalidationObserver = undefined;
    this.activeContextKey = undefined;
    this.swiperLocked = false;
  },
  applySlotUpdate(update): void {
    const context = contextForCurrentGroup();
    if (
      context === undefined ||
      update.context.groupId !== context.groupId ||
      update.context.groupRole !== context.groupRole ||
      update.context.groupVersion !== context.groupVersion ||
      update.context.userId !== context.userId
    )
      return;
    const index = this.data.monthSlots.findIndex(
      ({ businessMonth }) => businessMonth === update.businessMonth,
    );
    if (index < 0) return;
    const nextSlots = [...this.data.monthSlots] as [
      CalendarMonthSlotViewModel,
      CalendarMonthSlotViewModel,
      CalendarMonthSlotViewModel,
    ];
    nextSlots[index] = { businessMonth: update.businessMonth, viewModel: update.viewModel };
    const updateIsData = isDataViewModel(update.viewModel);
    if (
      !updateIsData &&
      (index === 1 ||
        update.viewModel.status === 'forbidden' ||
        update.viewModel.status === 'conflict')
    ) {
      this.resetSensitiveCalendarDetails();
    }
    const presentation = getCalendarPresentation(
      nextSlots,
      this.data.viewMode,
      this.data.weekStart,
    );
    if (!presentation.hasCalendarData && this.data.filterSheetVisible) {
      this.resetSensitiveCalendarDetails();
    }
    const filterSheetKind = this.data.filterSheetKind;
    const surfaceFilters = buildCalendarSurfaceFilters(
      nextSlots,
      getRequiredSurfaceMonths(nextSlots, this.data.viewMode, this.data.weekStart),
    );
    const filterSheetPatch =
      presentation.hasCalendarData &&
      surfaceFilters !== undefined &&
      this.data.filterSheetVisible &&
      isCalendarFilterKind(filterSheetKind)
        ? {
            filterSheetOptions: getFilterOptions(surfaceFilters, filterSheetKind),
            filterSheetSelectedIds: getSelectedFilterIds(surfaceFilters, filterSheetKind),
          }
        : {};
    const refreshedViewModels = nextSlots.map(({ viewModel }) => viewModel).filter(isDataViewModel);
    const refreshedDays = refreshedViewModels.flatMap(({ weeks }) =>
      weeks.flatMap(({ days }) => days.filter((day) => day.kind === 'day')),
    );
    const refreshedAssignments = refreshedDays.flatMap(({ assignments }) => assignments);
    const sheetHost = reconcileCalendarSheet(
      this.data.sheetHost,
      refreshedAssignments,
      refreshedDays,
    );
    const sheetPatch =
      sheetHost === this.data.sheetHost
        ? {}
        : {
            sheetHost,
            sheetKind: getCalendarSheetKind(sheetHost),
            sheetTitle: getCalendarSheetTitle(sheetHost),
          };
    this.setData({
      ...presentation,
      ...filterSheetPatch,
      ...sheetPatch,
      monthSlots: nextSlots,
    });
  },
  handleCopy(event): void {
    const actionId = event.detail.actionId;
    if (typeof actionId === 'string' && actionId.length > 0)
      this.controller?.performPhoneAction(actionId);
  },
  handleDial(event): void {
    const actionId = event.detail.actionId;
    if (typeof actionId === 'string' && actionId.length > 0)
      this.controller?.performPhoneAction(actionId);
  },
  handleFilterApply(event): void {
    const { filterKey, selectedIds, sheetKey } = event.detail;
    if (
      !isCalendarFilterKind(filterKey) ||
      filterKey !== this.data.filterSheetKind ||
      sheetKey !== this.data.filterSheetKey ||
      !Array.isArray(selectedIds) ||
      !selectedIds.every((id): id is string => typeof id === 'string')
    )
      return;
    const filters = buildCalendarSurfaceFilters(
      this.data.monthSlots,
      getRequiredSurfaceMonths(this.data.monthSlots, this.data.viewMode, this.data.weekStart),
    );
    if (filters === undefined) return;
    // Keep IDs that are outside the currently visible month as selection intent.
    // The core still applies them strictly to assignments; clipping here would
    // silently turn a cross-month filter back into “全部”.
    const nextSelectedIds = [...new Set(selectedIds)];
    this.controller?.setFilters({
      membershipIds: filterKey === 'member' ? nextSelectedIds : filters.selectedMembershipIds,
      onlyChanges: filters.onlyChanges,
      roleIds: filterKey === 'role' ? nextSelectedIds : filters.selectedRoleIds,
      shiftTypeIds: filterKey === 'shift' ? nextSelectedIds : filters.selectedShiftTypeIds,
    });
  },
  handleFilterClosed(event): void {
    if (
      event.detail.sheetKey !== this.data.filterSheetKey ||
      event.detail.filterKey !== this.data.filterSheetKind ||
      this.data.filterSheetVisible
    )
      return;
    this.setData({
      filterSheetKind: '',
      filterSheetOptions: [],
      filterSheetSelectedIds: [],
      filterSheetTitle: '',
    });
  },
  handleFilterRequestClose(event): void {
    if (
      event.detail.sheetKey !== this.data.filterSheetKey ||
      event.detail.filterKey !== this.data.filterSheetKind
    )
      return;
    this.setData({ filterSheetVisible: false });
  },
  handleMonthChange(event): void {
    const businessMonth = parseCalendarMonthPickerValue(event.detail.value);
    if (businessMonth === undefined) return;
    this.updateNavigation(
      goCalendarToBusinessMonth(
        {
          businessMonth: this.data.monthSlots[1].businessMonth,
          mode: this.data.viewMode,
          weekStart: this.data.weekStart,
        },
        businessMonth,
        getToday(),
      ),
    );
  },
  handleNextMonth(): void {
    const state = {
      businessMonth: this.data.monthSlots[1].businessMonth,
      mode: this.data.viewMode,
      weekStart: this.data.weekStart,
    };
    this.updateNavigation(
      goCalendarToBusinessMonth(state, addBusinessMonths(state.businessMonth, 1), getToday()),
    );
  },
  handleNextWeek(): void {
    const state = {
      businessMonth: this.data.monthSlots[1].businessMonth,
      mode: this.data.viewMode,
      weekStart: this.data.weekStart,
    };
    this.updateNavigation(stepCalendarWeek(state, 1));
  },
  handleOnlyChanges(event): void {
    if (typeof event.detail.value !== 'boolean') return;
    const filters = buildCalendarSurfaceFilters(
      this.data.monthSlots,
      getRequiredSurfaceMonths(this.data.monthSlots, this.data.viewMode, this.data.weekStart),
    );
    if (filters === undefined) return;
    this.controller?.setFilters({
      membershipIds: filters.selectedMembershipIds,
      onlyChanges: event.detail.value,
      roleIds: filters.selectedRoleIds,
      shiftTypeIds: filters.selectedShiftTypeIds,
    });
  },
  handleOpenFilter(event): void {
    const kind = event.currentTarget.dataset.filterKind;
    const filters = buildCalendarSurfaceFilters(
      this.data.monthSlots,
      getRequiredSurfaceMonths(this.data.monthSlots, this.data.viewMode, this.data.weekStart),
    );
    if (!isCalendarFilterKind(kind) || filters === undefined) return;
    const filterSheetKey = this.data.filterSheetKey + 1;
    this.setData({
      filterSheetKey,
      filterSheetKind: kind,
      filterSheetOptions: getFilterOptions(filters, kind),
      filterSheetSelectedIds: getSelectedFilterIds(filters, kind),
      filterSheetTitle:
        kind === 'role' ? '筛选排班岗位' : kind === 'shift' ? '筛选班种' : '筛选成员',
      filterSheetVisible: true,
    });
  },
  handlePreviousMonth(): void {
    const state = {
      businessMonth: this.data.monthSlots[1].businessMonth,
      mode: this.data.viewMode,
      weekStart: this.data.weekStart,
    };
    this.updateNavigation(
      goCalendarToBusinessMonth(state, addBusinessMonths(state.businessMonth, -1), getToday()),
    );
  },
  handlePreviousWeek(): void {
    const state = {
      businessMonth: this.data.monthSlots[1].businessMonth,
      mode: this.data.viewMode,
      weekStart: this.data.weekStart,
    };
    this.updateNavigation(stepCalendarWeek(state, -1));
  },
  handleRetry(): void {
    this.loadMonths(true);
  },
  handleRouteAction(event): void {
    const actionId = event.detail.actionId;
    const context = contextForCurrentGroup();
    if (typeof actionId !== 'string' || actionId.length === 0 || context === undefined) return;
    const viewModels = this.data.monthSlots
      .map(({ viewModel }) => viewModel)
      .filter(isDataViewModel);
    const target = resolveCalendarRouteAction(actionId, context.groupRole, viewModels);
    if (target === undefined) return;
    if (target.kind === 'events' && !isMembershipRouteRole(context.groupRole)) return;
    this.lastResolvedRoute = target;
    const content =
      target.kind === 'date'
        ? { day: target.day, kind: 'date' as const }
        : target.kind === 'assignment'
          ? { assignment: target.assignment, kind: 'duty' as const }
          : target.kind === 'events'
            ? { assignment: target.assignment, kind: 'events' as const }
            : {
                assignment: target.assignment,
                kind: 'phone' as const,
                phoneActions: target.assignment.phoneActions,
              };
    const sheetHost = openCalendarSheet(this.data.sheetHost, content);
    const sheetKind = getCalendarSheetKind(sheetHost);
    const sheetTitle = getCalendarSheetTitle(sheetHost);
    if (content.kind === 'events') this.eventController?.reset();
    this.setData({
      ...(content.kind === 'events' ? { eventTimeline: initialEventTimeline } : {}),
      sheetHost,
      sheetKind,
      sheetTitle,
    });
    if (content.kind === 'events')
      void this.eventController?.load(context.groupId, content.assignment);
  },
  handleSheetClosed(event): void {
    const sheetKey = event.detail.sheetKey;
    if (typeof sheetKey !== 'number' || !Number.isInteger(sheetKey)) return;
    const wasEvents = this.data.sheetHost.content?.kind === 'events';
    const sheetHost = completeCalendarSheetClose(this.data.sheetHost, sheetKey);
    if (sheetHost === this.data.sheetHost) return;
    this.setData({
      sheetHost,
      sheetKind: getCalendarSheetKind(sheetHost),
      sheetTitle: getCalendarSheetTitle(sheetHost),
    });
    if (wasEvents) this.eventController?.reset();
  },
  handleSheetRequestClose(event): void {
    const sheetKey = event.detail.sheetKey;
    if (typeof sheetKey !== 'number' || sheetKey !== this.data.sheetHost.sheetKey) return;
    const sheetHost = requestCalendarSheetClose(this.data.sheetHost);
    if (sheetHost !== this.data.sheetHost) this.setData({ sheetHost });
  },
  handleSwiperChange(event): void {
    const current = event.detail.current;
    if (
      event.detail.source !== 'touch' ||
      this.swiperLocked ||
      current === 1 ||
      (current !== 0 && current !== 2)
    )
      return;
    const context = contextForCurrentGroup();
    if (context === undefined) return;
    this.swiperLocked = true;
    this.navigationEpoch += 1;
    const navigationEpoch = this.navigationEpoch;
    const sourceSlots: CalendarMonthSlots = [
      this.data.monthSlots[0].businessMonth,
      this.data.monthSlots[1].businessMonth,
      this.data.monthSlots[2].businessMonth,
    ];
    const rotatedMonths = rotateMonthSlots(sourceSlots, current);
    const rotatedSlots = rotatedMonths.map(
      (businessMonth) =>
        this.data.monthSlots.find((slot) => slot.businessMonth === businessMonth) ?? {
          businessMonth,
          viewModel: createCalendarMonthStateViewModel(businessMonth, 'loading'),
        },
    ) as [CalendarMonthSlotViewModel, CalendarMonthSlotViewModel, CalendarMonthSlotViewModel];
    this.setData(
      {
        ...getCalendarPresentation(rotatedSlots, this.data.viewMode, this.data.weekStart),
        monthSlots: rotatedSlots,
        swiperIndex: 1,
      },
      () => {
        if (this.navigationEpoch !== navigationEpoch) return;
        this.swiperLocked = false;
        void this.controller?.loadMonths(context, rotatedMonths);
      },
    );
  },
  handleThisWeek(): void {
    this.updateNavigation(
      goCalendarToThisWeek(
        {
          businessMonth: this.data.monthSlots[1].businessMonth,
          mode: this.data.viewMode,
          weekStart: this.data.weekStart,
        },
        getToday(),
      ),
    );
  },
  handleToday(): void {
    this.updateNavigation(
      goCalendarToToday(
        {
          businessMonth: this.data.monthSlots[1].businessMonth,
          mode: this.data.viewMode,
          weekStart: this.data.weekStart,
        },
        getToday(),
      ),
    );
  },
  handleViewModeTap(event): void {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'month' && mode !== 'week' && mode !== 'list') return;
    this.navigationEpoch += 1;
    this.swiperLocked = false;
    const state = switchCalendarViewMode(
      {
        businessMonth: this.data.monthSlots[1].businessMonth,
        mode: this.data.viewMode,
        weekStart: this.data.weekStart,
      },
      mode,
      getToday(),
    );
    this.setData(
      {
        ...getCalendarPresentation(this.data.monthSlots, state.mode, state.weekStart),
        viewMode: state.mode,
        weekStart: state.weekStart,
      },
      () => this.loadMonths(),
    );
  },
  updateNavigation(next): void {
    const context = contextForCurrentGroup();
    if (context === undefined) return;
    this.navigationEpoch += 1;
    this.swiperLocked = false;
    const months = recenterMonthSlots(next.businessMonth);
    const slots = recenterCalendarMonthSlots(this.data.monthSlots, months);
    this.setData(
      {
        ...getCalendarPresentation(slots, next.mode, next.weekStart),
        monthSlots: slots,
        swiperIndex: 1,
        viewMode: next.mode,
        weekStart: next.weekStart,
      },
      () => this.loadMonths(),
    );
  },
  loadMonths(force = false): void {
    const context = contextForCurrentGroup();
    if (context === undefined) return;
    const months = new Set<string>(this.data.monthSlots.map(({ businessMonth }) => businessMonth));
    if (this.data.viewMode === 'week')
      getBusinessMonthsForWeek(this.data.weekStart).forEach((month) => months.add(month));
    void this.controller?.loadMonths(context, [...months], force);
  },
  resetSensitiveCalendarDetails(): void {
    const sheetHost = resetCalendarSheet(this.data.sheetHost);
    this.navigationEpoch += 1;
    this.swiperLocked = false;
    this.lastResolvedRoute = undefined;
    this.eventController?.reset();
    this.setData({
      eventTimeline: initialEventTimeline,
      filterSheetKey: this.data.filterSheetKey + 1,
      filterSheetKind: '',
      filterSheetOptions: [],
      filterSheetSelectedIds: [],
      filterSheetTitle: '',
      filterSheetVisible: false,
      sheetHost,
      sheetKind: getCalendarSheetKind(sheetHost),
      sheetTitle: getCalendarSheetTitle(sheetHost),
    });
  },
  resetCalendarContextData(): void {
    const monthSlots = this.data.monthSlots.map(({ businessMonth }) => ({
      businessMonth,
      viewModel: createCalendarMonthStateViewModel(businessMonth, 'loading'),
    })) as [CalendarMonthSlotViewModel, CalendarMonthSlotViewModel, CalendarMonthSlotViewModel];
    this.setData({
      ...getCalendarPresentation(monthSlots, this.data.viewMode, this.data.weekStart),
      monthSlots,
    });
  },
});
