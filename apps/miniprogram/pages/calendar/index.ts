import {
  getCalendar,
  getGuestHolidays,
  getHolidays,
  getLoggedInGuestCalendar,
  listEvents,
} from '../../api/endpoints.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { getCurrentBusinessDate } from '../../features/calendar/calendar-logic.js';
import {
  buildCalendarSurfaceViewModel,
  recenterCalendarMonthSlots,
  type CalendarMonthSlotViewModel,
  type CalendarSurfaceViewModel,
} from '../../features/calendar/calendar-surface.js';
import {
  createCalendarPageController,
  parseSelectorPickerIndex,
  type CalendarContext,
  type CalendarPageController,
  type CalendarMonthSlotUpdate,
} from '../../features/calendar/calendar-page-controller.js';
import {
  createCalendarViewModeState,
  recenterMonthSlots,
  rotateMonthSlots,
  stepCalendarMonth,
  stepCalendarWeek,
  switchCalendarViewMode,
  type CalendarMonthSlots,
  type CalendarViewMode,
} from '../../features/calendar/calendar-view-mode.js';
import {
  createCalendarMonthStateViewModel,
  type CalendarMonthDataViewModel,
  type CalendarMonthViewModel,
} from '../../features/calendar/calendar-view-model.js';
import { getBusinessMonthsForWeek } from '../../features/calendar/calendar-views.js';
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
  readonly cacheNotice?: { readonly savedAtText: string; readonly stale: boolean };
  readonly eventTimeline: EventTimelineState;
  readonly hasActiveGroup: boolean;
  readonly monthSlots: readonly [
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
    CalendarMonthSlotViewModel,
  ];
  readonly renderer: string;
  readonly sheetHost: CalendarSheetHostState;
  readonly sheetKind: CalendarSheetKind;
  readonly sheetTitle: string;
  readonly surface: CalendarSurfaceViewModel;
  readonly swiperIndex: 1;
  readonly viewMode: CalendarViewMode;
  readonly weekStart: string;
}

type PickerEvent = WechatMiniprogram.PickerChange;
type ActionIdEvent = WechatMiniprogram.CustomEvent<{ readonly actionId?: unknown }>;
type SheetLifecycleEvent = WechatMiniprogram.CustomEvent<{ readonly sheetKey?: unknown }>;
type ModeTapEvent = WechatMiniprogram.BaseEvent<Record<string, never>, { readonly mode?: unknown }>;
type SwiperChangeEvent = WechatMiniprogram.CustomEvent<{
  readonly current?: unknown;
  readonly source?: unknown;
}>;

interface CalendarPageMethods {
  activeContextKey?: string;
  controller?: CalendarPageController;
  eventController?: EventTimelineController;
  invalidationObserver?: CalendarInvalidationObserver;
  applyPicker(kind: 'member' | 'role' | 'shift', event: PickerEvent): void;
  applySlotUpdate(update: CalendarMonthSlotUpdate): void;
  handleCopy(event: ActionIdEvent): void;
  handleDial(event: ActionIdEvent): void;
  handleMemberFilter(event: PickerEvent): void;
  handleNextMonth(): void;
  handleNextWeek(): void;
  handleOnlyChanges(event: WechatMiniprogram.SwitchChange): void;
  handlePreviousMonth(): void;
  handlePreviousWeek(): void;
  handleRetry(): void;
  handleRouteAction(event: ActionIdEvent): void;
  handleSheetClosed(event: SheetLifecycleEvent): void;
  handleSheetRequestClose(event: SheetLifecycleEvent): void;
  handleRoleFilter(event: PickerEvent): void;
  handleShiftFilter(event: PickerEvent): void;
  handleSwiperChange(event: SwiperChangeEvent): void;
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

const initialViewState = getInitialState();
const initialSlots = getInitialSlots();
const initialEventTimeline: EventTimelineState = { hasMore: false, items: [], status: 'idle' };
const initialSheetHost: CalendarSheetHostState = { sheetKey: 0, visible: false };

Page<CalendarPageData, CalendarPageMethods>({
  data: {
    activeRole: '',
    eventTimeline: initialEventTimeline,
    hasActiveGroup: false,
    monthSlots: initialSlots,
    renderer: 'unknown',
    sheetHost: initialSheetHost,
    sheetKind: 'none',
    sheetTitle: '',
    surface: makeSurface(initialSlots, initialViewState.mode, initialViewState.weekStart),
    swiperIndex: 1,
    viewMode: initialViewState.mode,
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
      listEvents: (groupId, cursor, pageSize) => listEvents(groupId, cursor, pageSize),
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
    const surface = makeSurface(nextSlots, this.data.viewMode, this.data.weekStart);
    const center = nextSlots[1].viewModel;
    const cacheNotice =
      center.status === 'cached'
        ? { savedAtText: center.cacheSavedAt ?? '', stale: center.isStale === true }
        : undefined;
    this.setData({ cacheNotice, monthSlots: nextSlots, surface });
  },
  applyPicker(kind, event): void {
    const viewModel = this.data.monthSlots[1].viewModel;
    if (!isDataViewModel(viewModel)) return;
    const options =
      kind === 'role'
        ? viewModel.filters.roles
        : kind === 'shift'
          ? viewModel.filters.shiftTypes
          : viewModel.filters.members;
    const index = parseSelectorPickerIndex(event.detail.value, options.length);
    if (index === undefined) return;
    const selectedId = index === 0 ? undefined : options[index]?.id;
    if (index > 0 && selectedId === undefined) return;
    this.controller?.setFilters({
      membershipIds:
        kind === 'member'
          ? selectedId === undefined
            ? []
            : [selectedId]
          : viewModel.filters.selectedMembershipIds,
      onlyChanges: viewModel.filters.onlyChanges,
      roleIds:
        kind === 'role'
          ? selectedId === undefined
            ? []
            : [selectedId]
          : viewModel.filters.selectedRoleIds,
      shiftTypeIds:
        kind === 'shift'
          ? selectedId === undefined
            ? []
            : [selectedId]
          : viewModel.filters.selectedShiftTypeIds,
    });
  },
  handleMemberFilter(event): void {
    this.applyPicker('member', event);
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
  handleNextMonth(): void {
    const state = {
      businessMonth: this.data.monthSlots[1].businessMonth,
      mode: this.data.viewMode,
      weekStart: this.data.weekStart,
    };
    if (state.mode === 'week') return;
    this.updateNavigation(stepCalendarMonth(state, 1, getToday()));
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
    const viewModel = this.data.monthSlots[1].viewModel;
    if (!isDataViewModel(viewModel)) return;
    this.controller?.setFilters({
      membershipIds: viewModel.filters.selectedMembershipIds,
      onlyChanges: event.detail.value,
      roleIds: viewModel.filters.selectedRoleIds,
      shiftTypeIds: viewModel.filters.selectedShiftTypeIds,
    });
  },
  handlePreviousMonth(): void {
    const state = {
      businessMonth: this.data.monthSlots[1].businessMonth,
      mode: this.data.viewMode,
      weekStart: this.data.weekStart,
    };
    if (state.mode === 'week') return;
    this.updateNavigation(stepCalendarMonth(state, -1, getToday()));
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
  handleRoleFilter(event): void {
    this.applyPicker('role', event);
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
  handleShiftFilter(event): void {
    this.applyPicker('shift', event);
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
    const surface = makeSurface(rotatedSlots, this.data.viewMode, this.data.weekStart);
    this.setData({ monthSlots: rotatedSlots, surface, swiperIndex: 1 }, () => {
      if (this.navigationEpoch !== navigationEpoch) return;
      this.swiperLocked = false;
      void this.controller?.loadMonths(context, rotatedMonths);
    });
  },
  handleViewModeTap(event): void {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'month' && mode !== 'week' && mode !== 'list') return;
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
        surface: makeSurface(this.data.monthSlots, state.mode, state.weekStart),
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
    const months = recenterMonthSlots(next.businessMonth);
    const slots = recenterCalendarMonthSlots(this.data.monthSlots, months);
    this.setData(
      {
        monthSlots: slots,
        surface: makeSurface(slots, next.mode, next.weekStart),
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
      cacheNotice: undefined,
      monthSlots,
      surface: makeSurface(monthSlots, this.data.viewMode, this.data.weekStart),
    });
  },
});
