import type {
  CalendarDutyAssignment,
  ScheduleEvent,
  CalendarReadModel,
  HolidayReadModel,
} from '@schedule/contracts';
import {
  addBusinessMonths,
  addWeeks,
  getWeekStartDate,
  getWeekBusinessMonths,
  retargetSelectedDateToMonth,
} from '@schedule/presentation-core';
import { createRuntimeCalendarReadClient } from '../../platform/client-core-calendar.js';
import { createRuntimeGuestCalendarDisplaySettingsClient } from '../../platform/client-core-calendar.js';
import {
  reconcileDetailExpansion,
  toggleDetailExpansion,
} from '../../features/workbench/detail-expansion.js';
import {
  reconcileShiftCardExpansion,
  toggleShiftCardExpansion,
} from '../../features/workbench/shift-card-expansion.js';
import { isNurseCalendarGroup } from '../../features/workbench/nurse-duty-state.js';
import {
  createShiftEventCards,
  getShiftEventChangeChain,
  type ShiftEventCard,
} from '../../features/workbench/shift-event-model.js';
import { getStoredWechatProfile } from '../../platform/wechat-identity.js';
import {
  clearGuestPublicCache,
  readGuestPublicCache,
  writeGuestPublicCache,
} from '../../platform/guest-public-cache.js';
import { ClientCapabilityDisabledError } from '../../app/client-capability-store.js';
import { createVisitorCalendarRequestContext } from '../../platform/visitor-client-context.js';
import {
  commitCalendarPeriodSwipe,
  finishCalendarPeriodShift,
  isCalendarPeriodSlot,
  mapCalendarPeriodRing,
  prepareCalendarPeriodChange,
  requestCalendarPeriodShift,
  takeQueuedCalendarPeriodShift,
  type CalendarPeriodPagerState,
  type CalendarPeriodSlot,
} from '../../components/calendar/calendar-period-pager.js';
import {
  createMonthRing,
  createWorkbenchViewModel,
  formatDateLabel,
  formatMonthLabel,
  getTodayBusinessDate,
  type MonthSlot,
  type WorkbenchViewModel,
} from '../../features/workbench/workbench-model.js';

type View = 'month' | 'week' | 'list';
type Option = { label: string; value: string; selected: boolean };
type Tap = {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
  readonly detail?: { readonly businessDate?: string };
};
const client = createRuntimeCalendarReadClient(() => undefined);
const displaySettingsClient = createRuntimeGuestCalendarDisplaySettingsClient(() => undefined);
function emptyView() {
  return {
    monthPanels: [] as WorkbenchViewModel['monthPanels'],
    weekPanels: [] as WorkbenchViewModel['weekPanels'],
    listPanels: [] as WorkbenchViewModel['listPanels'],
    selectedDetails: [] as WorkbenchViewModel['selectedDetails'],
  };
}
function initialData() {
  const today = getTodayBusinessDate();
  return {
    ...emptyView(),
    compactEvents: false,
    shiftCardExpansion: reconcileShiftCardExpansion(undefined, [], []),
    detailExpansion: reconcileDetailExpansion(undefined, [], []),
    announcement: '',
    filterOnlyChanges: false,
    shiftEventCards: [] as readonly ShiftEventCard[],
    shiftEventChangeChain: '',
    shiftEventErrorMessage: '',
    shiftEventMeta: '',
    shiftEventSheetOpen: false,
    shiftEventState: 'closed' as 'closed' | 'loading' | 'ready' | 'empty' | 'error',
    state: 'loading' as 'loading' | 'ready' | 'error',
    errorMessage: '',
    guestHeaderStyle: 'height:64px;padding-top:20px;padding-right:104px;',
    guestViewportStyle: 'height:calc(100vh - 64px);',
    currentGroupId: '',
    currentGroupName: '访客排班',
    currentGroupRoleKind: 'guest',
    activeWorkspace: 'calendar',
    businessMonth: today.slice(0, 7),
    selectedDate: today,
    weekStart: getWeekStartDate(today),
    monthLabel: formatMonthLabel(today.slice(0, 7)),
    selectedLabel: formatDateLabel(today),
    selectedCountLabel: '0 个班种',
    viewMode: 'month' as View,
    viewOptions: ['month', 'week', 'list'],
    gridHeight: 270,
    monthPanelHeights: [270, 270, 270] as readonly number[],
    weekSwiperCurrent: 1,
    weekGridHeight: 112,
    listSwiperCurrent: 1,
    periodSwiperDuration: 260,
    listScrollTarget: '',
    scrollTarget: '',
    activeFilterCount: 0,
    filterOpen: false,
    filterOpenField: '',
    filterDropdownDirection: 'down',
    filterMembershipIds: [] as string[],
    filterRoleIds: [] as string[],
    filterShiftTypeIds: [] as string[],
    filterMemberOptions: [] as Option[],
    filterRoleOptions: [] as Option[],
    filterShiftTypeOptions: [] as Option[],
    filterMemberSummary: '全部成员',
    filterRoleSummary: '全部岗位',
    filterShiftTypeSummary: '全部班种',
  };
}
type Data = ReturnType<typeof initialData>;
interface GuestPage {
  data: Data;
  visitorKey: string | undefined;
  calendar: CalendarReadModel | undefined;
  holidays: HolidayReadModel | undefined;
  serial: number;
  eventSerial: number;
  eventAssignment: CalendarDutyAssignment | undefined;
  visible: boolean;
  shown: boolean;
  monthRingSlot: MonthSlot;
  resolvedGroup: { readonly groupId: string; readonly groupName: string } | undefined;
  resolvingGroup: Promise<{ readonly groupId: string; readonly groupName: string }> | undefined;
  monthResources: Map<string, CalendarReadModel>;
  holidayResources: Map<number, HolidayReadModel>;
  monthReads: Map<string, Promise<CalendarReadModel>>;
  holidayReads: Map<number, Promise<HolidayReadModel>>;
  contextGeneration: number;
  groupMonthShiftTypeId: string | null | undefined;
  groupDefaultView: View | undefined;
  displaySettingsRead: Promise<void> | undefined;
  periodShiftActive: 'list' | 'week' | undefined;
  periodShiftCommitPending: boolean;
  periodShiftQueue: number;
  weekRingSlot: CalendarPeriodSlot;
  weekShiftTargetSlot: CalendarPeriodSlot | undefined;
  weekSwiperSlot: CalendarPeriodSlot;
  weekSteps: number;
  _weekLayoutHeight: number;
  _weekHeightCache?: Map<string, number>;
  setData(patch: Partial<Data>, callback?: () => void): void;
  selectComponent(
    selector: string,
  ): { finishPeriodShift?(): void; continueQueuedShift?(): void } | undefined;
}
Page({
  data: initialData(),
  serial: 0,
  eventSerial: 0,
  eventAssignment: undefined,
  visible: true,
  shown: false,
  monthRingSlot: 1,
  resolvedGroup: undefined,
  resolvingGroup: undefined,
  monthResources: new Map(),
  holidayResources: new Map(),
  monthReads: new Map(),
  holidayReads: new Map(),
  contextGeneration: 0,
  groupMonthShiftTypeId: undefined,
  groupDefaultView: undefined,
  displaySettingsRead: undefined,
  periodShiftActive: undefined,
  periodShiftCommitPending: false,
  periodShiftQueue: 0,
  weekRingSlot: 1,
  weekShiftTargetSlot: undefined,
  weekSwiperSlot: 1,
  weekSteps: 0,
  _weekLayoutHeight: 112,
  visitorKey: undefined,
  calendar: undefined,
  holidays: undefined,
  onLoad(
    this: GuestPage,
    options: { scene?: string; visitorKey?: string; vkey?: string } = {},
  ): void {
    this.visible = true;
    this.setData(guestLayout());
    this.serial = 0;
    this.shown = false;
    this.monthRingSlot = 1;
    try {
      const key = decodeURIComponent(options.scene ?? options.visitorKey ?? options.vkey ?? '');
      this.visitorKey = /^[0-9a-f]{32}$/iu.test(key) ? key : undefined;
    } catch {
      this.visitorKey = undefined;
    }
    void loadCalendar(this);
  },
  onResize(this: GuestPage): void {
    this.setData(guestLayout());
  },
  onShow(this: GuestPage): void {
    this.visible = true;
    if (this.shown) void loadCalendar(this, true);
    this.shown = true;
  },
  onHide(this: GuestPage): void {
    this.visible = false;
    this.serial += 1;
    clearEvents(this);
  },
  onUnload(this: GuestPage): void {
    this.visible = false;
    this.serial += 1;
    this.visitorKey = undefined;
    clearCalendar(this);
  },
  handleListCall(this: GuestPage, event: Tap): void {
    const phoneNumber = event.currentTarget.dataset['phone'];
    if (this.data.state !== 'ready' || !this.visible || !phoneNumber) return;
    const visible =
      /^\+?\d[\d ()-]*$/u.test(phoneNumber) &&
      this.calendar?.members.some(
        (member) => member.mobilePhone === phoneNumber || member.shortPhone === phoneNumber,
      );
    if (!visible) return;
    wx.makePhoneCall({ phoneNumber, fail: () => this.setData({ announcement: '未能发起通话。' }) });
  },
  handleDetailPhoneToggle(this: GuestPage, event: Tap): void {
    const key = event.currentTarget.dataset['key'];
    if (key)
      this.setData({ detailExpansion: toggleDetailExpansion(this.data.detailExpansion, key) });
  },
  handleShiftCardToggle(this: GuestPage, event: Tap): void {
    const key = event.currentTarget.dataset['key'];
    if (key)
      this.setData({
        shiftCardExpansion: toggleShiftCardExpansion(this.data.shiftCardExpansion, key),
      });
  },
  handleOnlyChangesToggle(this: GuestPage): void {
    this.setData({ filterOnlyChanges: !this.data.filterOnlyChanges });
    renderCalendar(this);
  },
  handleOpenShiftEvents(this: GuestPage, event: Tap): void {
    const assignment = this.calendar?.assignments.find(
      (value) => value.id === event.currentTarget.dataset['assignmentId'],
    );
    if (assignment && this.data.state === 'ready') void loadEvents(this, assignment);
  },
  handleShiftEventRetry(this: GuestPage): void {
    if (this.eventAssignment) void loadEvents(this, this.eventAssignment);
  },
  handleShiftEventClose(this: GuestPage): void {
    clearEvents(this);
  },
  handleRetry(this: GuestPage): void {
    resetGuestContext(this);
    void loadCalendar(this);
  },
  handleReturn(): void {
    wx.navigateBack({
      fail: () =>
        wx.reLaunch({
          url:
            getStoredWechatProfile() === undefined
              ? '/pages/identity/index'
              : '/pages/workbench/index',
        }),
    });
  },
  handleViewChange(this: GuestPage, event: Tap): void {
    const view = event.currentTarget.dataset['view'];
    if (view !== 'month' && view !== 'week' && view !== 'list') return;
    if (view === this.data.viewMode) return;
    this.setData({ listSwiperCurrent: 1, viewMode: view, weekSwiperCurrent: 1, filterOpen: false });
    this.monthRingSlot = 1;
    this.weekRingSlot = 1;
    this.weekShiftTargetSlot = undefined;
    this.weekSwiperSlot = 1;
    this.weekSteps = 0;
    this.periodShiftActive = undefined;
    this.periodShiftCommitPending = false;
    this.periodShiftQueue = 0;
    void loadCalendar(this);
  },
  handleDateSelect(this: GuestPage, event: Tap): void {
    selectDate(this, event.detail?.businessDate);
  },
  handleWeekDaySelect(this: GuestPage, event: Tap): void {
    selectDate(this, event.currentTarget.dataset['businessDate']);
  },
  handleListSelect(this: GuestPage, event: Tap): void {
    selectDate(this, event.currentTarget.dataset['businessDate']);
  },
  handleMonthChange(
    this: GuestPage,
    event: { detail: { delta: number; current: MonthSlot } },
  ): void {
    this.monthRingSlot = event.detail.current;
    const month = addBusinessMonths(this.data.businessMonth, event.detail.delta);
    this.setData({
      businessMonth: month,
      selectedDate: retargetSelectedDateToMonth(this.data.selectedDate, month),
      weekStart: getWeekStartDate(`${month}-01`),
    });
    renderCalendar(this);
    const component = this.selectComponent('#workbench-month');
    if (component?.finishPeriodShift) component.finishPeriodShift();
    else void loadCalendar(this);
  },
  handleMonthSettled(this: GuestPage, event: { detail: { continues: boolean } }): void {
    const component = this.selectComponent('#workbench-month');
    if (event.detail.continues && component?.continueQueuedShift) component.continueQueuedShift();
    else void loadCalendar(this);
  },
  handleWeekChange(this: GuestPage, event: Tap): void {
    startPeriodSwiper(this, 'week', event.currentTarget.dataset['delta'] === '-1' ? -1 : 1);
  },
  handleListMonthChange(this: GuestPage, event: Tap): void {
    startPeriodSwiper(this, 'list', event.currentTarget.dataset['delta'] === '-1' ? -1 : 1);
  },
  handleWeekSwiperFinish(this: GuestPage, event: { detail: { current: number } }): void {
    handleCircularWeekSwiperFinish(this, event.detail.current);
  },
  handleWeekSwiperChange(this: GuestPage, event: { detail: { current: number } }): void {
    const state = readCircularWeekPagerState(this);
    if (!prepareCalendarPeriodChange(state, event.detail.current)) return;
    writeCircularWeekPagerState(this, state);
  },
  handleListSwiperFinish(this: GuestPage, event: { detail: { current: number } }): void {
    const delta = getSwiperDelta(event.detail.current);
    if (delta === 0 || this.periodShiftCommitPending) return;
    this.periodShiftActive = 'list';
    this.periodShiftCommitPending = true;
    commitPeriodShift(this, 'list', delta);
  },
  handleLocateToday(this: GuestPage): void {
    const today = getTodayBusinessDate();
    this.monthRingSlot = 1;
    this.weekRingSlot = 1;
    this.weekShiftTargetSlot = undefined;
    this.weekSwiperSlot = 1;
    this.weekSteps = 0;
    this.periodShiftActive = undefined;
    this.periodShiftCommitPending = false;
    this.periodShiftQueue = 0;
    this.setData({
      selectedDate: today,
      businessMonth: today.slice(0, 7),
      weekStart: getWeekStartDate(today),
      weekSwiperCurrent: 1,
      listSwiperCurrent: 1,
      listScrollTarget: `list-day-${today}`,
    });
    void loadCalendar(this);
  },
  handleFilterToggle(this: GuestPage): void {
    this.setData({ filterOpen: !this.data.filterOpen, filterOpenField: '' });
  },
  handleFilterApply(this: GuestPage): void {
    this.setData({ filterOpen: false, filterOpenField: '' });
  },
  handleFilterClose(this: GuestPage): void {
    this.setData({ filterOpen: false, filterOpenField: '' });
  },
  handleFilterSheetBackgroundTap(): void {},
  preventSheetTouchMove(): void {},
  handleFilterFieldToggle(this: GuestPage, event: Tap): void {
    const field = event.currentTarget.dataset['field'];
    if (!['member', 'role', 'shift'].includes(field ?? '')) return;
    this.setData({
      filterOpenField: this.data.filterOpenField === field ? '' : (field ?? ''),
      filterDropdownDirection: field === 'member' ? 'up' : 'down',
    });
  },
  handleFilterOptionToggle(this: GuestPage, event: Tap): void {
    const kind = event.currentTarget.dataset['kind'];
    const value = event.currentTarget.dataset['value'];
    if (!value) return;
    const field =
      kind === 'member'
        ? 'filterMembershipIds'
        : kind === 'role'
          ? 'filterRoleIds'
          : kind === 'shift'
            ? 'filterShiftTypeIds'
            : undefined;
    if (!field) return;
    const ids = this.data[field];
    this.setData({
      [field]: ids.includes(value) ? ids.filter((id) => id !== value) : [...ids, value],
    });
    renderCalendar(this);
  },
  handleFilterClear(this: GuestPage): void {
    this.setData({
      filterOnlyChanges: false,
      filterMembershipIds: [],
      filterRoleIds: [],
      filterShiftTypeIds: [],
      filterOpenField: '',
    });
    renderCalendar(this);
  },
});

function guestLayout(): Pick<Data, 'guestHeaderStyle' | 'guestViewportStyle'> {
  const info = wx.getWindowInfo();
  const capsule = wx.getMenuButtonBoundingClientRect?.();
  const status = Math.max(0, info.statusBarHeight ?? info.safeArea?.top ?? 0);
  const hasCapsule =
    capsule !== undefined &&
    capsule.width > 0 &&
    capsule.height > 0 &&
    capsule.left > 0 &&
    capsule.right <= info.windowWidth;
  const height = Math.ceil(Math.max(status + 44, hasCapsule ? capsule.bottom + 8 : 0));
  const right = hasCapsule ? Math.ceil(info.windowWidth - capsule.left + 8) : 104;
  return {
    guestHeaderStyle: `height:${height}px;padding-top:${status}px;padding-right:${right}px;`,
    guestViewportStyle: `height:${Math.max(1, Math.floor(info.windowHeight - height))}px;`,
  };
}

function selectDate(page: GuestPage, date: string | undefined): void {
  if (date === undefined || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return;
  page.setData({ selectedDate: date });
  renderCalendar(page);
}
function commitPeriodShift(page: GuestPage, view: 'week' | 'list', delta: number): void {
  const weekStart = view === 'week' ? addWeeks(page.data.weekStart, delta) : page.data.weekStart;
  const month =
    view === 'week' ? weekStart.slice(0, 7) : addBusinessMonths(page.data.businessMonth, delta);
  const selectedDate =
    view === 'week'
      ? addWeeks(page.data.selectedDate, delta)
      : retargetSelectedDateToMonth(page.data.selectedDate, month);
  if (view === 'week') {
    page.setData(
      {
        businessMonth: month,
        periodSwiperDuration: 260,
        selectedDate,
        weekStart,
        weekSwiperCurrent: page.weekRingSlot,
      },
      () => {
        applyCachedWindow(page, requestedMonths(page));
        finishCircularWeekShift(page);
      },
    );
    page.monthRingSlot = 1;
    return;
  }
  page.setData(
    {
      businessMonth: month,
      weekStart,
      selectedDate,
      periodSwiperDuration: 0,
      listSwiperCurrent: 1,
    },
    () => {
      applyCachedWindow(page, requestedMonths(page));
      continuePeriodShift(page, view);
    },
  );
  page.monthRingSlot = 1;
}
function getSwiperDelta(current: number): -1 | 0 | 1 {
  return current === 0 ? -1 : current === 2 ? 1 : 0;
}
function startPeriodSwiper(page: GuestPage, view: 'week' | 'list', delta: -1 | 1): void {
  if (view === 'week') {
    startCircularWeekSwiper(page, delta);
    return;
  }
  const current = page.data.listSwiperCurrent;
  if (page.periodShiftActive !== undefined || current !== 1) {
    page.periodShiftQueue = Math.max(-6, Math.min(6, page.periodShiftQueue + delta));
    return;
  }
  page.periodShiftActive = view;
  page.setData({ periodSwiperDuration: 260, listSwiperCurrent: delta < 0 ? 0 : 2 });
}
function readCircularWeekPagerState(page: GuestPage): CalendarPeriodPagerState {
  return {
    activeSlot: page.weekRingSlot,
    steps: page.weekSteps,
    queuedDelta: page.periodShiftQueue,
    shiftPending: page.periodShiftCommitPending,
    swiperSlot: page.weekSwiperSlot,
    targetSlot: page.weekShiftTargetSlot,
  };
}
function writeCircularWeekPagerState(page: GuestPage, state: CalendarPeriodPagerState): void {
  page.weekRingSlot = state.activeSlot;
  page.weekSteps = state.steps;
  page.periodShiftQueue = state.queuedDelta;
  page.periodShiftCommitPending = state.shiftPending;
  page.weekSwiperSlot = state.swiperSlot;
  page.weekShiftTargetSlot = state.targetSlot;
  page.periodShiftActive =
    state.targetSlot === undefined && !state.shiftPending ? undefined : 'week';
}
function startCircularWeekSwiper(page: GuestPage, delta: -1 | 1): void {
  const state = readCircularWeekPagerState(page);
  const request = requestCalendarPeriodShift(state, delta);
  writeCircularWeekPagerState(page, state);
  if (!request.started) return;
  page.setData({ periodSwiperDuration: 260, weekSwiperCurrent: request.targetSlot });
}
function handleCircularWeekSwiperFinish(page: GuestPage, current: number): void {
  if (!isCalendarPeriodSlot(current)) return;
  const state = readCircularWeekPagerState(page);
  const committed = commitCalendarPeriodSwipe(state, current);
  writeCircularWeekPagerState(page, state);
  if (committed === undefined) return;
  commitPeriodShift(page, 'week', committed.delta);
}
function finishCircularWeekShift(page: GuestPage): void {
  const state = readCircularWeekPagerState(page);
  const settled = finishCalendarPeriodShift(state);
  writeCircularWeekPagerState(page, state);
  if (settled.adopt !== undefined) {
    // Adopt the queued week step so the ring stays aligned with the native swiper.
    commitPeriodShift(page, 'week', settled.adopt.delta);
    return;
  }
  if (settled.continues) {
    const delta = takeQueuedCalendarPeriodShift(state);
    writeCircularWeekPagerState(page, state);
    if (delta !== 0) {
      startCircularWeekSwiper(page, delta);
      return;
    }
  }
  page.setData({ periodSwiperDuration: 260 });
  void loadCalendar(page);
}
function continuePeriodShift(page: GuestPage, view: 'week' | 'list'): void {
  page.periodShiftActive = undefined;
  page.periodShiftCommitPending = false;
  const queued = page.periodShiftQueue;
  if (queued === 0) {
    page.setData({ periodSwiperDuration: 260 });
    void loadCalendar(page);
    return;
  }
  const delta: -1 | 1 = queued < 0 ? -1 : 1;
  page.periodShiftQueue = queued - delta;
  page.setData({ periodSwiperDuration: 260 }, () => startPeriodSwiper(page, view, delta));
}
function clearCalendar(page: GuestPage): void {
  clearEvents(page);
  page.calendar = undefined;
  page.holidays = undefined;
  page.setData({
    ...emptyView(),
    compactEvents: false,
    shiftCardExpansion: reconcileShiftCardExpansion(undefined, [], []),
    state: 'loading',
    detailExpansion: reconcileDetailExpansion(undefined, [], []),
    errorMessage: '',
    filterOpen: false,
    filterOpenField: '',
    filterMemberOptions: [],
    filterRoleOptions: [],
    filterShiftTypeOptions: [],
    filterMemberSummary: '全部成员',
    filterRoleSummary: '全部岗位',
    filterShiftTypeSummary: '全部班种',
  });
}
function resetGuestContext(page: GuestPage): void {
  page.contextGeneration += 1;
  clearCalendar(page);
  page.resolvedGroup = undefined;
  page.resolvingGroup = undefined;
  page.groupMonthShiftTypeId = undefined;
  page.groupDefaultView = undefined;
  page.displaySettingsRead = undefined;
  page.periodShiftActive = undefined;
  page.periodShiftCommitPending = false;
  page.periodShiftQueue = 0;
  page.monthResources.clear();
  page.holidayResources.clear();
  page.monthReads.clear();
  page.holidayReads.clear();
}
function current(page: GuestPage, serial: number): boolean {
  return page.visible && page.serial === serial;
}
function requestedMonths(page: GuestPage): readonly string[] {
  const activeMonth =
    page.data.viewMode === 'week' ? page.data.weekStart.slice(0, 7) : page.data.businessMonth;
  return page.data.viewMode === 'week'
    ? [
        ...new Set(
          [-2, -1, 0, 1, 2].flatMap((delta) =>
            getWeekBusinessMonths(addWeeks(page.data.weekStart, delta)),
          ),
        ),
      ]
    : [-2, -1, 0, 1, 2].map((delta) => addBusinessMonths(activeMonth, delta));
}
function readDisplaySettings(
  page: GuestPage,
  groupId: string,
  key: string,
  refresh = false,
): Promise<void> {
  if (page.groupMonthShiftTypeId !== undefined && !refresh) return Promise.resolve();
  if (page.displaySettingsRead) return page.displaySettingsRead;
  const generation = page.contextGeneration;
  const read = displaySettingsClient.getPublic(groupId, key).then((result) => {
    if (result.groupId !== groupId) throw new Error('Invalid guest display settings context');
    if (page.contextGeneration === generation) {
      const previousDefault = page.groupDefaultView;
      page.groupMonthShiftTypeId = result.groupDefaultMonthShiftTypeId;
      page.groupDefaultView = result.groupDefaultView;
      if (previousDefault === undefined || page.data.viewMode === previousDefault)
        page.setData({ viewMode: result.groupDefaultView });
    }
  });
  page.displaySettingsRead = read;
  void read.then(
    () => {
      if (page.displaySettingsRead === read) page.displaySettingsRead = undefined;
    },
    () => {
      if (page.displaySettingsRead === read) page.displaySettingsRead = undefined;
    },
  );
  return read;
}
function applyCachedWindow(page: GuestPage, months: readonly string[]): boolean {
  const activeMonth =
    page.data.viewMode === 'week' ? page.data.weekStart.slice(0, 7) : page.data.businessMonth;
  const active = page.monthResources.get(activeMonth);
  const years = [...new Set(months.map((value) => Number(value.slice(0, 4))))];
  const holidays = years.flatMap((year) => {
    const result = page.holidayResources.get(year);
    return result === undefined ? [] : [result];
  });
  if (!active || !page.holidayResources.has(Number(activeMonth.slice(0, 4)))) return false;
  page.calendar = {
    ...active,
    assignments: months.flatMap(
      (businessMonth) => page.monthResources.get(businessMonth)?.assignments ?? [],
    ),
  };
  page.holidays = {
    year: Number(activeMonth.slice(0, 4)),
    confirmed: holidays.every((value) => value.confirmed),
    dates: holidays.flatMap((value) => value.dates),
  };
  renderCalendar(page);
  page.setData({ state: 'ready', errorMessage: '' });
  return true;
}
async function resolveGuest(page: GuestPage, key: string) {
  if (page.resolvedGroup) return page.resolvedGroup;
  if (!page.resolvingGroup) {
    const generation = page.contextGeneration;
    page.resolvingGroup = client.resolveVisitor(key).then((group) => {
      if (page.contextGeneration === generation) page.resolvedGroup = group;
      return group;
    });
    void page.resolvingGroup.then(
      () => {
        page.resolvingGroup = undefined;
      },
      () => {
        page.resolvingGroup = undefined;
      },
    );
  }
  return page.resolvingGroup;
}
function readMonth(
  page: GuestPage,
  groupId: string,
  businessMonth: string,
  key: string,
  refresh = false,
): Promise<CalendarReadModel> {
  const cached = page.monthResources.get(businessMonth);
  if (cached && !refresh) return Promise.resolve(cached);
  const pending = page.monthReads.get(businessMonth);
  if (pending) return pending;
  const generation = page.contextGeneration;
  const read = createVisitorCalendarRequestContext()
    .then((context) =>
      client.getGuestCalendarDetailed(groupId, {
        businessMonth,
        clientContext: context.clientContext,
        ...(context.loginCode === undefined ? {} : { loginCode: context.loginCode }),
        visitorKey: key,
      }),
    )
    .then((result) => {
      if (result.calendar.groupId !== groupId || result.calendar.businessMonth !== businessMonth)
        throw new Error('Invalid guest calendar context');
      if (page.contextGeneration === generation)
        page.monthResources.set(businessMonth, result.calendar);
      return result.calendar;
    });
  page.monthReads.set(businessMonth, read);
  void read.then(
    () => page.monthReads.delete(businessMonth),
    () => page.monthReads.delete(businessMonth),
  );
  return read;
}
function readHolidays(page: GuestPage, year: number): Promise<HolidayReadModel> {
  const cached = page.holidayResources.get(year);
  if (cached) return Promise.resolve(cached);
  const pending = page.holidayReads.get(year);
  if (pending) return pending;
  const generation = page.contextGeneration;
  const read = client.getGuestHolidays(year).then((result) => {
    if (page.contextGeneration === generation) page.holidayResources.set(year, result);
    return result;
  });
  page.holidayReads.set(year, read);
  void read.then(
    () => page.holidayReads.delete(year),
    () => page.holidayReads.delete(year),
  );
  return read;
}
async function loadCalendar(page: GuestPage, refreshDisplaySettings = false): Promise<void> {
  if (!page.visible) return;
  const serial = ++page.serial;
  const key = page.visitorKey;
  if (!key) {
    resetGuestContext(page);
    page.setData({ state: 'error', errorMessage: '访客码无效，请向群管理员重新获取。' });
    return;
  }
  let months = requestedMonths(page);
  try {
    const group = await resolveGuest(page, key);
    if (!current(page, serial)) return;
    page.setData({ currentGroupId: group.groupId, currentGroupName: group.groupName });
    if (page.monthResources.size === 0 && page.holidayResources.size === 0) {
      const persisted = readGuestPublicCache(group.groupId);
      page.monthResources = persisted.months;
      page.holidayResources = persisted.holidays;
    }
    await readDisplaySettings(page, group.groupId, key, refreshDisplaySettings);
    if (!current(page, serial)) return;
    const activeMonth =
      page.data.viewMode === 'week' ? page.data.weekStart.slice(0, 7) : page.data.businessMonth;
    months = requestedMonths(page);
    await Promise.all([
      readMonth(page, group.groupId, activeMonth, key, true),
      readHolidays(page, Number(activeMonth.slice(0, 4))),
    ]);
    if (!current(page, serial)) return;
    applyCachedWindow(page, months);
    writeGuestPublicCache(group.groupId, page.monthResources, page.holidayResources);
    const years = [...new Set(months.map((value) => Number(value.slice(0, 4))))];
    await Promise.all([
      ...months
        .filter((value) => value !== activeMonth)
        .map((value) => readMonth(page, group.groupId, value, key)),
      ...years
        .filter((value) => value !== Number(activeMonth.slice(0, 4)))
        .map((value) => readHolidays(page, value)),
    ]);
    if (!current(page, serial)) return;
    applyCachedWindow(page, months);
    writeGuestPublicCache(group.groupId, page.monthResources, page.holidayResources);
  } catch (error) {
    if (!current(page, serial)) return;
    const status = (error as { status?: number })?.status;
    if (
      status === 403 ||
      status === 404 ||
      status === 410 ||
      (error as { code?: string })?.code === 'VISITOR_KEY_INVALID'
    ) {
      if (page.data.currentGroupId) clearGuestPublicCache(page.data.currentGroupId);
      resetGuestContext(page);
    } else if (applyCachedWindow(page, months)) {
      page.setData({ announcement: '网络暂不可用，正在显示最近一次公开排班。' });
      return;
    } else clearCalendar(page);
    page.setData({
      state: 'error',
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : status === 403 ||
              status === 404 ||
              status === 410 ||
              (error as { code?: string })?.code === 'VISITOR_KEY_INVALID'
            ? '访客码已失效或访问权限已撤销，请向群管理员重新获取。'
            : '访客排班暂时无法读取，请检查网络后重试。',
    });
  }
}
function renderCalendar(page: GuestPage): void {
  if (!page.calendar || !page.holidays) return;
  const filters = {
    membershipIds: page.data.filterMembershipIds,
    roleIds: page.data.filterRoleIds,
    shiftTypeIds: page.data.filterShiftTypeIds,
    onlyChanges: page.data.filterOnlyChanges,
  };
  const view = createWorkbenchViewModel(
    page.calendar,
    page.holidays,
    page.data.selectedDate,
    page.data.businessMonth,
    page.data.weekStart,
    filters,
    getTodayBusinessDate(),
    {
      nursePreset: isNurseCalendarGroup(page.data.currentGroupName),
      effectiveMonthShiftTypeId: page.groupMonthShiftTypeId ?? null,
      monthPreferencePending: page.groupMonthShiftTypeId === undefined,
    },
  );
  const options = (
    values: readonly { label: string; value: string }[],
    selected: readonly string[],
  ): Option[] => values.map((value) => ({ ...value, selected: selected.includes(value.value) }));
  const members = options(
    page.calendar.members.map((value) => ({ label: value.realName, value: value.membershipId })),
    filters.membershipIds,
  );
  const roles = options(
    page.calendar.roles.map((value) => ({ label: value.name, value: value.id })),
    filters.roleIds,
  );
  const shifts = options(
    page.calendar.shiftTypes.map((value) => ({
      label: `${value.name}（${value.abbreviation}）`,
      value: value.id,
    })),
    filters.shiftTypeIds,
  );
  const summary = (items: Option[], fallback: string) =>
    items
      .filter((value) => value.selected)
      .map((value) => value.label)
      .join('、') || fallback;
  const weekSignature = JSON.stringify(
    view.weekPanels.flatMap((panel) =>
      panel.days.map((day) => [
        day.businessDate,
        day.shiftGroups.map((group) => [
          group.key,
          group.duties.map((duty) => [duty.name, duty.markers]),
        ]),
      ]),
    ),
  );
  const cachedWeekHeight = page._weekHeightCache?.get(weekSignature);
  page._weekLayoutHeight =
    cachedWeekHeight ?? Math.max(112, (view.weekPanels[1]?.height ?? 112) + 20);
  if (cachedWeekHeight === undefined) {
    page._weekHeightCache ??= new Map();
    page._weekHeightCache.set(weekSignature, page._weekLayoutHeight);
    if (page._weekHeightCache.size > 24)
      page._weekHeightCache.delete(page._weekHeightCache.keys().next().value!);
  }
  page.setData({
    ...view,
    weekPanels: mapCalendarPeriodRing(view.weekPanels, page.weekRingSlot),
    compactEvents: view.selectedDetails.reduce((count, group) => count + group.rows.length, 0) > 1,
    shiftCardExpansion: reconcileShiftCardExpansion(
      page.data.shiftCardExpansion,
      [page.data.currentGroupId, page.data.selectedDate],
      view.selectedDetails,
    ),
    detailExpansion: reconcileDetailExpansion(
      page.data.detailExpansion,
      [page.data.currentGroupId, page.data.selectedDate],
      view.selectedDetails,
    ),
    ...createMonthRing(
      view.monthPanels.map((panel) => ({ ...panel, rowHeight: 62 })),
      view.monthPanels.map((panel) => (panel.cells.length / 7) * 62),
      page.monthRingSlot,
    ),
    gridHeight: ((view.monthPanels[1]?.cells.length ?? 35) / 7) * 62,
    weekGridHeight: page._weekLayoutHeight,
    selectedCountLabel: `${view.selectedDetails.length} 个班种`,
    filterMemberOptions: members,
    filterRoleOptions: roles,
    filterShiftTypeOptions: shifts,
    filterMemberSummary: summary(members, '全部成员'),
    filterRoleSummary: summary(roles, '全部岗位'),
    filterShiftTypeSummary: summary(shifts, '全部班种'),
    activeFilterCount:
      Number(filters.onlyChanges) +
      filters.membershipIds.length +
      filters.roleIds.length +
      filters.shiftTypeIds.length,
  });
}

function clearEvents(page: GuestPage): void {
  page.eventSerial++;
  page.eventAssignment = undefined;
  page.setData({
    shiftEventSheetOpen: false,
    shiftEventCards: [],
    shiftEventChangeChain: '',
    shiftEventErrorMessage: '',
    shiftEventMeta: '',
    shiftEventState: 'closed',
  });
}
async function loadEvents(page: GuestPage, assignment: CalendarDutyAssignment): Promise<void> {
  const key = page.visitorKey;
  if (!key || !page.visible || page.data.state !== 'ready') return;
  const serial = ++page.eventSerial;
  const calendarSerial = page.serial;
  const groupId = page.data.currentGroupId;
  const active = () =>
    current(page, calendarSerial) &&
    serial === page.eventSerial &&
    key === page.visitorKey &&
    groupId === page.data.currentGroupId &&
    page.data.shiftEventSheetOpen;
  page.eventAssignment = assignment;
  page.setData({
    shiftEventSheetOpen: true,
    shiftEventState: 'loading',
    shiftEventCards: [],
    shiftEventChangeChain: '',
    shiftEventErrorMessage: '',
    shiftEventMeta: `${assignment.businessDate} ${assignment.shiftTypeName} · ${assignment.scheduleRoleName}`,
  });
  try {
    const events: ScheduleEvent[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const result = await client.getGuestShiftEvents(groupId, assignment.id, key, {
        pageSize: 100,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (!active()) return;
      events.push(...result.events);
      cursor = result.nextCursor;
      if (cursor !== undefined && seen.has(cursor)) throw new Error('Invalid event pagination');
      if (cursor !== undefined) seen.add(cursor);
    } while (cursor !== undefined);
    const cards = createShiftEventCards(events, assignment);
    page.setData({
      shiftEventCards: cards,
      shiftEventChangeChain: getShiftEventChangeChain(events, assignment.id) ?? '',
      shiftEventState: cards.length ? 'ready' : 'empty',
    });
  } catch (error) {
    if (!active()) return;
    if (error instanceof ClientCapabilityDisabledError) {
      clearCalendar(page);
      page.setData({ state: 'error', errorMessage: error.message });
      return;
    }
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403 || status === 404 || status === 410) {
      clearCalendar(page);
      page.setData({
        state: 'error',
        errorMessage: '访客码失效、权限撤销或班次已不可见，请重新验证。',
      });
      return;
    }
    page.setData({
      shiftEventCards: [],
      shiftEventChangeChain: '',
      shiftEventState: 'error',
      shiftEventErrorMessage: '班次事件暂时无法读取，请检查网络后重试。',
    });
  }
}
