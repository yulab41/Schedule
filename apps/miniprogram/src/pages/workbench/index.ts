import type { CalendarReadModel, GroupSummary, HolidayReadModel } from '@schedule/contracts';
import {
  addBusinessMonths,
  addWeeks,
  getBusinessMonthOf,
  getWeekBusinessMonths,
  getWeekStartDate,
  retargetSelectedDateToMonth,
} from '@schedule/presentation-core';

import { buildInfo } from '../../platform/build-info.js';
import {
  ClientCapabilityDisabledError,
  getClientCapabilitySnapshot,
  requireClientCapability,
} from '../../app/client-capability-store.js';
import {
  canUseWorkbenchOfflineFallback,
  clearWorkbenchGroupCaches,
  createWorkbenchReadClient,
  loadActiveThenAdjacent,
  readWorkbenchCache,
  readWorkbenchGroupSnapshot,
  readStoredWorkbenchGroupId,
  writeStoredWorkbenchGroupId,
  writeWorkbenchCache,
} from '../../platform/workbench-read.js';
import { getStoredWechatProfile } from '../../platform/wechat-identity.js';
import {
  createNativePerformanceProbe,
  formatNativePerformanceEvidence,
  type NativePerformanceProbe,
} from '../../platform/performance-probe.js';
import { recordMiniTelemetryPerformance } from '../../platform/telemetry.js';
import {
  createMonthRing,
  createWorkbenchViewModel,
  formatDateLabel,
  formatMonthLabel,
  getAdjacentMonthSlot,
  getTodayBusinessDate,
  type MonthSlot,
  type WorkbenchFilters,
  type WorkbenchViewModel,
} from '../../features/workbench/workbench-model.js';

type WorkbenchState = 'empty' | 'error' | 'loading' | 'offline' | 'ready';
type WorkbenchView = 'list' | 'month' | 'week';
type FilterField = '' | 'member' | 'role' | 'shift';
type FilterDropdownDirection = 'down' | 'up';

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
  readonly detail?: { readonly businessDate?: string; readonly checked?: boolean };
}

interface MonthChangeEvent {
  readonly detail: { readonly current: MonthSlot; readonly delta: -1 | 1 };
}

interface MonthSettledEvent {
  readonly detail: { readonly continues: boolean };
}

interface SwiperFinishEvent {
  readonly detail: { readonly current: number };
}

interface FilterOption {
  readonly label: string;
  readonly selected: boolean;
  readonly value: string;
}

interface MonthReadResult {
  readonly calendar: CalendarReadModel;
  readonly holidays: HolidayReadModel;
  readonly offline: boolean;
}

interface WorkbenchPageData {
  readonly activeFilterCount: number;
  readonly announcement: string;
  readonly buildLabel: string;
  readonly businessMonth: string;
  readonly canOpenGroupSettings: boolean;
  readonly currentGroupId: string;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly canReLogin: boolean;
  readonly errorMessage: string;
  readonly expandedDetailKey: string;
  readonly filterIconAnimating: boolean;
  readonly filterMembershipIds: readonly string[];
  readonly filterMemberOptions: readonly FilterOption[];
  readonly filterOpen: boolean;
  readonly filterDropdownDirection: FilterDropdownDirection;
  readonly filterOpenField: FilterField;
  readonly filterOnlyChanges: boolean;
  readonly filterRoleIds: readonly string[];
  readonly filterRoleOptions: readonly FilterOption[];
  readonly filterRoleSummary: string;
  readonly filterShiftTypeIds: readonly string[];
  readonly filterShiftTypeOptions: readonly FilterOption[];
  readonly filterShiftTypeSummary: string;
  readonly filterMemberSummary: string;
  readonly groupOpen: boolean;
  readonly groups: readonly GroupSummary[];
  readonly gridHeight: number;
  readonly listPanels: WorkbenchViewModel['listPanels'];
  readonly listScrollTarget: string;
  readonly listSwiperCurrent: number;
  readonly locateIconAnimating: boolean;
  readonly monthLabel: string;
  readonly monthPanelHeights: readonly number[];
  readonly monthPanels: WorkbenchViewModel['monthPanels'];
  readonly navMotion: string;
  readonly notificationAnimating: boolean;
  readonly offlineNotice: string;
  readonly periodSwiperDuration: number;
  readonly performanceEvidence: string;
  readonly profileAnimating: boolean;
  readonly scrollTarget: string;
  readonly shellActionsStyle: string;
  readonly shellHeaderHeight: number;
  readonly shellHeaderStyle: string;
  readonly selectedDate: string;
  readonly selectedDetails: WorkbenchViewModel['selectedDetails'];
  readonly selectedLabel: string;
  readonly selectedCountLabel: string;
  readonly calendarNavAnimating: boolean;
  readonly state: WorkbenchState;
  readonly viewMode: WorkbenchView;
  readonly weekPanels: WorkbenchViewModel['weekPanels'];
  readonly weekStart: string;
  readonly weekSwiperCurrent: number;
  readonly viewOptions: readonly WorkbenchView[];
  readonly workflowsEnabled: boolean;
}

interface WorkbenchPageInstance {
  _performanceDiagnosticsEnabled: boolean;
  _performanceProbe: NativePerformanceProbe | undefined;
  data: WorkbenchPageData;
  calendar: CalendarReadModel | undefined;
  holidays: HolidayReadModel | undefined;
  monthLocateTarget: string | undefined;
  monthRingSlot: MonthSlot;
  monthResources: Map<string, MonthReadResult>;
  hasShown: boolean;
  isVisible: boolean;
  pendingListTarget: string | undefined;
  pendingScrollTarget: string | undefined;
  pendingWeekTarget: string | undefined;
  periodShiftActive: 'list' | 'week' | undefined;
  periodShiftCommitPending: boolean;
  periodShiftQueue: number;
  requestSerial: number;
  selectComponent(selector: string):
    | {
        continueQueuedShift?(): void;
        finishPeriodShift?(): void;
        startProgrammaticShift?(delta: -1 | 1, targetHeight?: number): void;
      }
    | undefined;
  setData(patch: Partial<WorkbenchPageData>, callback?: () => void): void;
}

const client = createWorkbenchReadClient();
const today = getTodayBusinessDate();
const initialMonth = today.slice(0, 7);

Page({
  data: {
    activeFilterCount: 0,
    announcement: '',
    buildLabel: buildInfo.buildLabel,
    businessMonth: initialMonth,
    canOpenGroupSettings: false,
    currentGroupId: '',
    currentGroupName: '正在读取群组',
    currentGroupRole: '',
    canReLogin: false,
    errorMessage: '',
    expandedDetailKey: '',
    filterIconAnimating: false,
    filterMembershipIds: [],
    filterMemberOptions: [],
    filterOpen: false,
    filterDropdownDirection: 'down' as FilterDropdownDirection,
    filterOpenField: '' as FilterField,
    filterOnlyChanges: false,
    filterRoleIds: [],
    filterRoleOptions: [],
    filterRoleSummary: '全部岗位',
    filterShiftTypeIds: [],
    filterShiftTypeOptions: [],
    filterShiftTypeSummary: '全部班种',
    filterMemberSummary: '全部成员',
    groupOpen: false,
    groups: [],
    gridHeight: 270,
    listPanels: [],
    listScrollTarget: '',
    listSwiperCurrent: 1,
    locateIconAnimating: false,
    monthLabel: formatMonthLabel(initialMonth),
    monthPanelHeights: [270, 270, 270],
    monthPanels: [],
    navMotion: '',
    notificationAnimating: false,
    offlineNotice: '',
    periodSwiperDuration: 260,
    performanceEvidence: '',
    profileAnimating: false,
    scrollTarget: '',
    shellActionsStyle: 'right:10px;top:16px;bottom:auto;',
    shellHeaderHeight: 64,
    shellHeaderStyle: 'height:64px;min-height:64px;padding-top:8px;padding-right:102px;',
    selectedDate: today,
    selectedDetails: [],
    selectedLabel: formatDateLabel(today),
    selectedCountLabel: '0 个班种',
    calendarNavAnimating: false,
    state: 'loading' as WorkbenchState,
    viewMode: 'month' as const,
    weekPanels: [],
    weekStart: getWeekStartDate(today),
    weekSwiperCurrent: 1,
    viewOptions: ['month', 'week', 'list'],
    workflowsEnabled: false,
  } satisfies WorkbenchPageData,

  calendar: undefined,
  holidays: undefined,
  monthLocateTarget: undefined,
  monthRingSlot: 1,
  monthResources: new Map<string, MonthReadResult>(),
  hasShown: false,
  isVisible: true,
  pendingListTarget: undefined,
  pendingScrollTarget: undefined,
  pendingWeekTarget: undefined,
  periodShiftActive: undefined,
  periodShiftCommitPending: false,
  periodShiftQueue: 0,
  requestSerial: 0,
  _performanceDiagnosticsEnabled: false,
  _performanceProbe: undefined,

  onLoad(this: WorkbenchPageInstance, options: { readonly performance?: string } = {}): void {
    this.isVisible = true;
    this._performanceDiagnosticsEnabled = options.performance === '1';
    this._performanceProbe = createNativePerformanceProbe();
    this._performanceProbe.start('core-ready');
    this.setData(createShellLayoutPatch());
    void loadWorkbenchWithCapability(this);
  },

  onShow(this: WorkbenchPageInstance): void {
    this.isVisible = true;
    const isInitialShow = !this.hasShown;
    this.hasShown = true;
    if (!isInitialShow) this._performanceProbe?.start('foreground-ready');
    void requireClientCapability('core')
      .then(() => {
        syncWorkflowsCapability(this);
        if (isInitialShow) return;
        return loadWorkbench(this, { forceRefresh: true });
      })
      .catch((error: unknown) => setWorkbenchCapabilityError(this, error));
  },

  onHide(this: WorkbenchPageInstance): void {
    this.isVisible = false;
    this.requestSerial += 1;
    this.setData({ expandedDetailKey: '', filterOpen: false, groupOpen: false });
  },

  onUnload(this: WorkbenchPageInstance): void {
    this.isVisible = false;
    this.requestSerial += 1;
  },

  handleGroupToggle(this: WorkbenchPageInstance): void {
    this.setData({ groupOpen: !this.data.groupOpen, filterOpen: false, filterOpenField: '' });
  },

  handleGroupSelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const groupId = event.currentTarget.dataset.groupId;
    if (groupId === undefined || groupId === this.data.currentGroupId) {
      this.setData({ groupOpen: false });
      return;
    }
    const ownerId = getStoredWechatProfile()?.id;
    if (ownerId === undefined) return;
    writeStoredWorkbenchGroupId(ownerId, groupId);
    this.calendar = undefined;
    this.holidays = undefined;
    this.monthRingSlot = 1;
    this.monthResources.clear();
    this.setData({
      activeFilterCount: 0,
      businessMonth: initialMonth,
      currentGroupId: groupId,
      filterMembershipIds: [],
      filterMemberSummary: '全部成员',
      filterOpenField: '',
      filterOnlyChanges: false,
      filterRoleIds: [],
      filterRoleSummary: '全部岗位',
      filterShiftTypeIds: [],
      filterShiftTypeSummary: '全部班种',
      groupOpen: false,
      selectedDate: today,
      selectedLabel: formatDateLabel(today),
      weekStart: getWeekStartDate(today),
    });
    void loadWorkbenchWithCapability(this);
  },

  handleOpenGroupSettings(this: WorkbenchPageInstance): void {
    if (!this.data.canOpenGroupSettings || this.data.currentGroupId === '') return;
    const groupId = encodeURIComponent(this.data.currentGroupId);
    this.setData({ groupOpen: false });
    wx.navigateTo({
      url: `/subpackages/organization/pages/group-settings/index?groupId=${groupId}`,
    });
  },

  handleViewChange(this: WorkbenchPageInstance, event: TapEvent): void {
    const view = event.currentTarget.dataset.view;
    if (view !== 'month' && view !== 'week' && view !== 'list') return;
    const nextView = view as WorkbenchView;
    if (nextView === this.data.viewMode) return;
    const nextWeekStart =
      nextView === 'week' ? getWeekStartDate(this.data.selectedDate) : this.data.weekStart;
    const period = {
      businessMonth: this.data.businessMonth,
      selectedDate: this.data.selectedDate,
      weekStart: nextWeekStart,
    };
    this.monthRingSlot = 1;
    this.periodShiftActive = undefined;
    this.periodShiftCommitPending = false;
    this.periodShiftQueue = 0;
    this.setData({
      ...createViewPatch(this, period),
      announcement:
        nextView === 'month' ? '已切换到月视图。' : `${nextView === 'week' ? '周' : '列表'}视图。`,
      filterOpen: false,
      filterOpenField: '',
      listSwiperCurrent: 1,
      locateIconAnimating: false,
      periodSwiperDuration: 260,
      viewMode: nextView,
      weekStart: nextWeekStart,
      weekSwiperCurrent: 1,
    });
    if (nextView === 'week') void refreshWorkbenchWindow(this);
  },

  handleFilterToggle(this: WorkbenchPageInstance): void {
    this.setData(
      {
        filterIconAnimating: false,
        filterOpen: true,
        filterOpenField: '',
        groupOpen: false,
      },
      () => {
        this.setData({ filterIconAnimating: true });
      },
    );
  },

  handleFilterClose(this: WorkbenchPageInstance): void {
    this.setData({ announcement: '已关闭筛选。', filterOpen: false, filterOpenField: '' });
  },

  handleFilterApply(this: WorkbenchPageInstance): void {
    this.setData({ announcement: '已应用排班筛选。', filterOpen: false, filterOpenField: '' });
  },

  handleFilterFieldToggle(this: WorkbenchPageInstance, event: TapEvent): void {
    const field = event.currentTarget.dataset.field;
    if (field !== 'member' && field !== 'role' && field !== 'shift') return;
    if (this.data.filterOpenField === field) {
      this.setData({ filterOpenField: '' });
      return;
    }
    this.setData(
      {
        filterDropdownDirection: field === 'member' ? 'up' : 'down',
        filterOpenField: field,
      },
      () => resolveFilterDropdownDirection(this, field),
    );
  },

  handleFilterClear(this: WorkbenchPageInstance): void {
    this.setData(
      {
        activeFilterCount: 0,
        announcement: '已清除全部筛选。',
        filterMembershipIds: [],
        filterMemberOptions: setSelectedOptions(this.data.filterMemberOptions, []),
        filterMemberSummary: '全部成员',
        filterOpenField: '',
        filterOnlyChanges: false,
        filterRoleIds: [],
        filterRoleOptions: setSelectedOptions(this.data.filterRoleOptions, []),
        filterRoleSummary: '全部岗位',
        filterShiftTypeIds: [],
        filterShiftTypeOptions: setSelectedOptions(this.data.filterShiftTypeOptions, []),
        filterShiftTypeSummary: '全部班种',
      },
      () => refreshView(this),
    );
  },

  handleOnlyChangesToggle(this: WorkbenchPageInstance): void {
    this.setData({ filterOnlyChanges: !this.data.filterOnlyChanges }, () => {
      syncFilterPresentation(this);
      refreshView(this);
    });
  },

  handleFilterOptionToggle(this: WorkbenchPageInstance, event: TapEvent): void {
    const kind = event.currentTarget.dataset.kind;
    const value = event.currentTarget.dataset.value;
    if (value === undefined) return;
    if (kind === 'role') toggleFilterOption(this, 'filterRoleIds', 'filterRoleOptions', value);
    else if (kind === 'shift') {
      toggleFilterOption(this, 'filterShiftTypeIds', 'filterShiftTypeOptions', value);
    } else if (kind === 'member') {
      toggleFilterOption(this, 'filterMembershipIds', 'filterMemberOptions', value);
    } else return;
  },

  handleMonthChange(this: WorkbenchPageInstance, event: MonthChangeEvent): void {
    const locateTarget = this.monthLocateTarget;
    const businessMonth =
      locateTarget ?? addBusinessMonths(this.data.businessMonth, event.detail.delta);
    this.monthLocateTarget = undefined;
    const selectedDate =
      locateTarget === undefined
        ? retargetSelectedDateToMonth(this.data.selectedDate, businessMonth)
        : today;
    const period = {
      businessMonth,
      selectedDate,
      weekStart: getWeekStartDate(`${businessMonth}-01`),
    };
    this.monthRingSlot = event.detail.current;
    const viewPatch = createViewPatch(this, period);
    const finalPatch: Partial<WorkbenchPageData> = {
      ...viewPatch,
      ...period,
      announcement:
        locateTarget !== undefined
          ? '已定位到今天。'
          : event.detail.delta < 0
            ? '已切换到上个月。'
            : '已切换到下个月。',
    };
    this.setData(finalPatch, () => {
      const month = this.selectComponent('#workbench-month');
      if (month?.finishPeriodShift !== undefined) month.finishPeriodShift();
      else finishMonthShift(this, false);
    });
  },

  handleMonthSettled(this: WorkbenchPageInstance, event: MonthSettledEvent): void {
    finishMonthShift(this, event.detail.continues);
  },

  handleWeekChange(this: WorkbenchPageInstance, event: TapEvent): void {
    const delta = event.currentTarget.dataset.delta === '-1' ? -1 : 1;
    startPeriodSwiper(this, 'week', delta);
  },

  handleListMonthChange(this: WorkbenchPageInstance, event: TapEvent): void {
    const delta = event.currentTarget.dataset.delta === '-1' ? -1 : 1;
    startPeriodSwiper(this, 'list', delta);
  },

  handleLocateToday(this: WorkbenchPageInstance): void {
    const targetWeekStart = getWeekStartDate(today);
    this.setData(
      {
        announcement: this.data.viewMode === 'week' ? '已定位到本周。' : '已定位到今天。',
        locateIconAnimating: false,
        scrollTarget: '',
      },
      () => {
        this.setData({ locateIconAnimating: true });
      },
    );

    if (this.data.viewMode === 'month' && this.data.businessMonth !== initialMonth) {
      this.monthLocateTarget = initialMonth;
      this.pendingScrollTarget = 'workbench-content-top';
      const direction: -1 | 1 = initialMonth < this.data.businessMonth ? -1 : 1;
      startLocateTransition(this, 'month', direction, {
        businessMonth: initialMonth,
        selectedDate: today,
        weekStart: targetWeekStart,
      });
      return;
    }
    if (this.data.viewMode === 'week' && this.data.weekStart !== targetWeekStart) {
      this.pendingWeekTarget = targetWeekStart;
      this.pendingScrollTarget = 'workbench-content-top';
      startLocateTransition(this, 'week', targetWeekStart < this.data.weekStart ? -1 : 1, {
        businessMonth: initialMonth,
        selectedDate: today,
        weekStart: targetWeekStart,
      });
      return;
    }
    if (this.data.viewMode === 'list' && this.data.businessMonth !== initialMonth) {
      this.pendingListTarget = initialMonth;
      this.pendingScrollTarget = `list-day-${today}`;
      startLocateTransition(this, 'list', initialMonth < this.data.businessMonth ? -1 : 1, {
        businessMonth: initialMonth,
        selectedDate: today,
        weekStart: targetWeekStart,
      });
      return;
    }
    applyTodayLocation(this);
  },

  handleCalendarNav(this: WorkbenchPageInstance): void {
    this.setData({ calendarNavAnimating: false, scrollTarget: '' }, () => {
      this.setData({ calendarNavAnimating: true, scrollTarget: 'workbench-content-top' });
    });
  },

  handleWeekSwiperFinish(this: WorkbenchPageInstance, event: SwiperFinishEvent): void {
    const delta = getSwiperDelta(event.detail.current);
    if (delta === 0 || this.periodShiftCommitPending) return;
    const target = this.pendingWeekTarget;
    this.pendingWeekTarget = undefined;
    this.periodShiftActive = 'week';
    this.periodShiftCommitPending = true;
    commitPeriodShift(this, 'week', delta, target);
  },

  handleListSwiperFinish(this: WorkbenchPageInstance, event: SwiperFinishEvent): void {
    const delta = getSwiperDelta(event.detail.current);
    if (delta === 0 || this.periodShiftCommitPending) return;
    const target = this.pendingListTarget;
    this.pendingListTarget = undefined;
    this.periodShiftActive = 'list';
    this.periodShiftCommitPending = true;
    commitPeriodShift(this, 'list', delta, target);
  },

  handleDateSelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const businessDate = event.detail?.businessDate;
    if (businessDate === undefined) return;
    selectBusinessDate(this, businessDate);
  },

  handleWeekDaySelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const businessDate = event.currentTarget.dataset.businessDate;
    if (businessDate === undefined) return;
    selectBusinessDate(this, businessDate);
  },

  handleListSelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const businessDate = event.currentTarget.dataset.businessDate;
    if (businessDate === undefined) return;
    selectBusinessDate(this, businessDate);
  },

  handleListCall(this: WorkbenchPageInstance, event: TapEvent): void {
    const phoneNumber = event.currentTarget.dataset.phone;
    if (phoneNumber === undefined || phoneNumber.length === 0) return;
    wx.makePhoneCall({
      fail: () => this.setData({ announcement: '未能发起通话。' }),
      phoneNumber,
    });
  },

  handleDetailPhoneToggle(this: WorkbenchPageInstance, event: TapEvent): void {
    const key = event.currentTarget.dataset.key;
    if (key === undefined || key.length === 0) return;
    this.setData({ expandedDetailKey: this.data.expandedDetailKey === key ? '' : key });
  },

  handleUnavailable(this: WorkbenchPageInstance, event: TapEvent): void {
    const label = event.currentTarget.dataset.label ?? '该项';
    const motion = event.currentTarget.dataset.motion ?? '';
    this.setData({ announcement: `${label}功能将在后续阶段开放。`, navMotion: '' }, () => {
      this.setData({ navMotion: motion });
    });
  },

  handleLeaveNav(this: WorkbenchPageInstance): void {
    this.setData({ navMotion: '' }, () => this.setData({ navMotion: 'leave' }));
    void openLeaveWorkflow(this);
  },

  handleSwapNav(this: WorkbenchPageInstance): void {
    this.setData({ navMotion: '' }, () => this.setData({ navMotion: 'swap' }));
    void openSwapWorkflow(this);
  },

  handleDutyNav(this: WorkbenchPageInstance): void {
    this.setData({ navMotion: '' }, () => this.setData({ navMotion: 'duty' }));
    void openDutyWorkflow(this);
  },

  handleNotification(this: WorkbenchPageInstance): void {
    this.setData({ notificationAnimating: false }, () => {
      this.setData({ announcement: '通知功能将在后续阶段开放。', notificationAnimating: true });
    });
  },

  handleProfile(this: WorkbenchPageInstance): void {
    this.setData({ profileAnimating: false }, () => {
      this.setData({ profileAnimating: true });
      wx.navigateTo({ url: '/pages/identity/index' });
    });
  },

  preventSheetTouchMove(): void {},

  handleRetry(this: WorkbenchPageInstance): void {
    void loadWorkbenchWithCapability(this);
  },

  handleOpenIdentity(this: WorkbenchPageInstance): void {
    wx.navigateTo({ url: '/pages/identity/index' });
  },
});

async function loadWorkbench(
  page: WorkbenchPageInstance,
  options: { readonly forceRefresh?: boolean } = {},
): Promise<void> {
  const requestSerial = page.requestSerial + 1;
  page.requestSerial = requestSerial;
  const ownerId = getStoredWechatProfile()?.id;
  const hasLoadedData = page.calendar !== undefined && page.holidays !== undefined;
  page.setData({
    canReLogin: false,
    errorMessage: '',
    state: hasLoadedData ? page.data.state : 'loading',
  });
  try {
    if (ownerId === undefined) {
      throw { code: 'AUTH_REQUIRED', status: 401 };
    }
    let groups: readonly GroupSummary[];
    let groupSnapshotOffline = false;
    try {
      groups = await client.listGroups();
    } catch (error) {
      if (!canUseWorkbenchOfflineFallback(error)) throw error;
      const cachedGroups = readWorkbenchGroupSnapshot(ownerId);
      if (cachedGroups === undefined) throw error;
      groups = cachedGroups;
      groupSnapshotOffline = true;
    }
    if (!isCurrentRequest(page, requestSerial)) return;
    if (groups.length === 0) {
      page.setData({
        canOpenGroupSettings: false,
        currentGroupId: '',
        currentGroupName: '暂无可查看的群组',
        groups,
        state: 'empty',
      });
      return;
    }
    const storedGroupId = readStoredWorkbenchGroupId(ownerId);
    const selectedGroup = groups.find((group) => group.id === storedGroupId) ?? groups[0];
    if (selectedGroup === undefined) return;
    const groupChanged = page.data.currentGroupId !== selectedGroup.id;
    if (groupChanged) {
      if (page.data.currentGroupId !== '') page.monthResources.clear();
      page.setData({
        currentGroupId: selectedGroup.id,
        currentGroupName: selectedGroup.name,
        currentGroupRole: formatRole(selectedGroup.role),
      });
      writeStoredWorkbenchGroupId(ownerId, selectedGroup.id);
    }
    page.setData({ canOpenGroupSettings: selectedGroup.role !== 'guest', groups });

    const requestedMonths = getRequestedMonths(
      page.data.viewMode,
      page.data.businessMonth,
      page.data.weekStart,
    );
    const activeMonth = getActiveBusinessMonth(page);
    const staged = loadActiveThenAdjacent(requestedMonths, activeMonth, (businessMonth) =>
      readMonth(page, ownerId, selectedGroup.id, businessMonth, requestSerial, {
        forceRefresh: options.forceRefresh === true,
      }),
    );
    const activeResult = await staged.active;
    if (!isCurrentRequest(page, requestSerial)) return;
    if (!applyMonthWindow(page, [activeResult], requestedMonths)) {
      throw new Error('Calendar month data is unavailable.');
    }
    const filterMemberOptions = createFilterOptions(
      page.calendar.members.map((member) => ({
        label: member.realName,
        value: member.membershipId,
      })),
      page.data.filterMembershipIds,
    );
    const filterRoleOptions = createFilterOptions(page.calendar.roles, page.data.filterRoleIds);
    const filterShiftTypeOptions = createFilterOptions(
      page.calendar.shiftTypes.map((shiftType) => ({
        label: `${shiftType.name}（${shiftType.abbreviation}）`,
        value: shiftType.id,
      })),
      page.data.filterShiftTypeIds,
    );
    page.setData(
      {
        ...createViewPatch(page),
        canReLogin: false,
        filterMemberOptions,
        filterMemberSummary: getFilterSummary(
          filterMemberOptions,
          page.data.filterMembershipIds,
          '全部成员',
        ),
        filterRoleOptions,
        filterRoleSummary: getFilterSummary(filterRoleOptions, page.data.filterRoleIds, '全部岗位'),
        filterShiftTypeOptions,
        filterShiftTypeSummary: getFilterSummary(
          filterShiftTypeOptions,
          page.data.filterShiftTypeIds,
          '全部班种',
        ),
        offlineNotice:
          groupSnapshotOffline || activeResult.offline
            ? '离线只读 · 显示最近一次成功读取的排班'
            : '',
        state: groupSnapshotOffline || activeResult.offline ? 'offline' : 'ready',
      },
      () => {
        completeCoreReadyProbe(page);
        flushPendingScrollTarget(page);
      },
    );
    void staged.adjacent
      .then((adjacentResults) => {
        if (!isCurrentRequest(page, requestSerial) || adjacentResults.length === 0) return;
        if (!applyMonthWindow(page, adjacentResults, requestedMonths)) return;
        page.setData(createViewPatch(page));
      })
      .catch((error: unknown) => failClosedAfterBackgroundRead(page, requestSerial, error));
  } catch (error) {
    if (!isCurrentRequest(page, requestSerial)) return;
    const message = getReadErrorMessage(error);
    page.setData({
      canReLogin: isAuthRequired(error),
      errorMessage: message,
      state: 'error',
    });
  }
}

function completeCoreReadyProbe(page: WorkbenchPageInstance): void {
  const coreMeasurement = page._performanceProbe?.complete('core-ready');
  const foregroundMeasurement = page._performanceProbe?.complete('foreground-ready');
  const measurement = coreMeasurement ?? foregroundMeasurement;
  if (measurement === undefined) return;
  recordMiniTelemetryPerformance('workbench', measurement.metric, measurement.durationMs);
  if (!page._performanceDiagnosticsEnabled) return;
  page.setData({
    performanceEvidence: formatNativePerformanceEvidence(measurement, {
      label: coreMeasurement === undefined ? '前台恢复' : '工作台可交互',
      requiredSamples: 5,
      thresholdMs: 2500,
    }),
  });
}

async function loadWorkbenchWithCapability(
  page: WorkbenchPageInstance,
  options: { readonly forceRefresh?: boolean } = {},
): Promise<void> {
  try {
    await requireClientCapability('core');
    syncWorkflowsCapability(page);
    await loadWorkbench(page, options);
  } catch (error) {
    setWorkbenchCapabilityError(page, error);
  }
}

function setWorkbenchCapabilityError(page: WorkbenchPageInstance, error: unknown): void {
  if (!(error instanceof ClientCapabilityDisabledError)) return;
  page.requestSerial += 1;
  page.setData({
    canReLogin: false,
    errorMessage: error.message,
    offlineNotice: '',
    state: 'error',
    workflowsEnabled: false,
  });
}

async function openLeaveWorkflow(page: WorkbenchPageInstance): Promise<void> {
  try {
    await requireClientCapability('workflows');
    syncWorkflowsCapability(page);
    const group = page.data.groups.find((candidate) => candidate.id === page.data.currentGroupId);
    if (group === undefined || group.role === 'guest') {
      page.setData({ announcement: '当前群组不能提交或审批请假。' });
      return;
    }
    const groupId = encodeURIComponent(group.id);
    wx.navigateTo({
      fail: () => page.setData({ announcement: '请假页面暂时无法打开，请稍后重试。' }),
      url: `/subpackages/workflows/pages/leave/index?groupId=${groupId}`,
    });
  } catch (error) {
    syncWorkflowsCapability(page);
    page.setData({
      announcement:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : '请假页面暂时无法打开，请稍后重试。',
    });
  }
}

function syncWorkflowsCapability(page: WorkbenchPageInstance): void {
  const capability = getClientCapabilitySnapshot();
  page.setData({ workflowsEnabled: capability.global && capability.workflows });
}

async function openSwapWorkflow(page: WorkbenchPageInstance): Promise<void> {
  try {
    await requireClientCapability('workflows');
    syncWorkflowsCapability(page);
    const group = page.data.groups.find((candidate) => candidate.id === page.data.currentGroupId);
    if (group === undefined || group.role === 'guest') {
      page.setData({ announcement: '当前群组不能发起或处理换班。' });
      return;
    }
    const groupId = encodeURIComponent(group.id);
    wx.navigateTo({
      fail: () => page.setData({ announcement: '换班页面暂时无法打开，请稍后重试。' }),
      url: `/subpackages/workflows/pages/swap/index?groupId=${groupId}`,
    });
  } catch (error) {
    syncWorkflowsCapability(page);
    page.setData({
      announcement:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : '换班页面暂时无法打开，请稍后重试。',
    });
  }
}

async function openDutyWorkflow(page: WorkbenchPageInstance): Promise<void> {
  try {
    await requireClientCapability('workflows');
    syncWorkflowsCapability(page);
    const group = page.data.groups.find((candidate) => candidate.id === page.data.currentGroupId);
    if (group === undefined || group.role === 'guest') {
      page.setData({ announcement: '当前群组不能发起或处理加扣班。' });
      return;
    }
    const groupId = encodeURIComponent(group.id);
    wx.navigateTo({
      fail: () => page.setData({ announcement: '加扣班页面暂时无法打开，请稍后重试。' }),
      url: `/subpackages/workflows/pages/duty/index?groupId=${groupId}`,
    });
  } catch (error) {
    syncWorkflowsCapability(page);
    page.setData({
      announcement:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : '加扣班页面暂时无法打开，请稍后重试。',
    });
  }
}

async function readMonth(
  page: WorkbenchPageInstance,
  ownerId: string,
  groupId: string,
  businessMonth: string,
  requestSerial: number,
  options: { readonly forceRefresh: boolean },
): Promise<MonthReadResult> {
  const existing = page.monthResources.get(businessMonth);
  if (!options.forceRefresh && existing?.offline === false) return existing;

  const [calendarResult, holidayResult] = await Promise.allSettled([
    client.getCalendar(groupId, businessMonth),
    client.getHolidays(Number(businessMonth.slice(0, 4))),
  ]);
  if (calendarResult.status === 'rejected') {
    if (getErrorStatus(calendarResult.reason) === 403) clearWorkbenchGroupCaches(ownerId, groupId);
    if (!canUseWorkbenchOfflineFallback(calendarResult.reason)) throw calendarResult.reason;
    const cached = readWorkbenchCache(ownerId, groupId, businessMonth);
    if (cached !== undefined) return { ...cached, offline: true } satisfies MonthReadResult;
    throw calendarResult.reason;
  }
  if (
    holidayResult.status === 'rejected' &&
    !canUseWorkbenchOfflineFallback(holidayResult.reason)
  ) {
    throw holidayResult.reason;
  }
  const holidays =
    holidayResult.status === 'fulfilled'
      ? holidayResult.value
      : (readWorkbenchCache(ownerId, groupId, businessMonth)?.holidays ??
        emptyHoliday(Number(businessMonth.slice(0, 4))));
  const offline = holidayResult.status === 'rejected';
  if (!offline && isCurrentRequest(page, requestSerial)) {
    writeWorkbenchCache(ownerId, groupId, businessMonth, calendarResult.value, holidays);
  }
  return { calendar: calendarResult.value, holidays, offline };
}

async function refreshWorkbenchWindow(page: WorkbenchPageInstance): Promise<void> {
  const groupId = page.data.currentGroupId;
  if (groupId === '') return;
  const requestedMonths = getRequestedMonths(
    page.data.viewMode,
    page.data.businessMonth,
    page.data.weekStart,
  );
  const ownerId = getStoredWechatProfile()?.id;
  if (ownerId === undefined) return;
  const requestSerial = page.requestSerial + 1;
  page.requestSerial = requestSerial;
  try {
    const activeMonth = getActiveBusinessMonth(page);
    const staged = loadActiveThenAdjacent(requestedMonths, activeMonth, (businessMonth) =>
      readMonth(page, ownerId, groupId, businessMonth, requestSerial, { forceRefresh: false }),
    );
    const activeResult = await staged.active;
    if (!isCurrentRequest(page, requestSerial) || page.data.currentGroupId !== groupId) return;
    if (!applyMonthWindow(page, [activeResult], requestedMonths)) return;
    page.setData({
      ...createViewPatch(page),
      canReLogin: false,
      errorMessage: '',
      offlineNotice: activeResult.offline ? '离线只读 · 显示最近一次成功读取的排班' : '',
      state: activeResult.offline ? 'offline' : 'ready',
    });
    void staged.adjacent
      .then((adjacentResults) => {
        if (!isCurrentRequest(page, requestSerial) || page.data.currentGroupId !== groupId) return;
        if (adjacentResults.length === 0) return;
        if (!applyMonthWindow(page, adjacentResults, requestedMonths)) return;
        page.setData(createViewPatch(page));
      })
      .catch((error: unknown) => failClosedAfterBackgroundRead(page, requestSerial, error));
  } catch (error) {
    if (!isCurrentRequest(page, requestSerial)) return;
    page.setData({
      canReLogin: isAuthRequired(error),
      errorMessage: getReadErrorMessage(error),
      state: 'error',
    });
  }
}

function applyMonthWindow(
  page: WorkbenchPageInstance,
  monthResults: readonly MonthReadResult[],
  requestedMonths: readonly string[],
): page is WorkbenchPageInstance & { calendar: CalendarReadModel; holidays: HolidayReadModel } {
  const merged = new Map(page.monthResources);
  for (const result of monthResults) merged.set(result.calendar.businessMonth, result);
  page.monthResources = new Map(
    requestedMonths.flatMap((businessMonth) => {
      const result = merged.get(businessMonth);
      return result === undefined ? [] : [[businessMonth, result] as const];
    }),
  );
  const activeMonth =
    page.data.viewMode === 'week' ? page.data.weekStart.slice(0, 7) : page.data.businessMonth;
  const activeResult = merged.get(activeMonth) ?? monthResults[0];
  if (activeResult === undefined) return false;
  const loadedResults = [...page.monthResources.values()];
  page.calendar = {
    ...activeResult.calendar,
    assignments: loadedResults.flatMap((result) => result.calendar.assignments),
  };
  page.holidays = mergeHolidays(loadedResults, activeResult.holidays.year);
  return true;
}

function refreshView(page: WorkbenchPageInstance): void {
  page.setData(createViewPatch(page));
}

function createViewPatch(
  page: WorkbenchPageInstance,
  period: Pick<WorkbenchPageData, 'businessMonth' | 'selectedDate' | 'weekStart'> = page.data,
): Partial<WorkbenchPageData> {
  if (page.calendar === undefined || page.holidays === undefined) return {};
  const filters: WorkbenchFilters = {
    membershipIds: page.data.filterMembershipIds,
    onlyChanges: page.data.filterOnlyChanges,
    roleIds: page.data.filterRoleIds,
    shiftTypeIds: page.data.filterShiftTypeIds,
  };
  const view = createWorkbenchViewModel(
    page.calendar,
    page.holidays,
    period.selectedDate,
    period.businessMonth,
    period.weekStart,
    filters,
  );
  const logicalMonthPanelHeights = view.monthPanels.map((panel) => (panel.cells.length / 7) * 54);
  const monthRing = createMonthRing(view.monthPanels, logicalMonthPanelHeights, page.monthRingSlot);
  return {
    gridHeight: ((view.monthPanels[1]?.cells.length ?? 35) / 7) * 54,
    listPanels: view.listPanels,
    monthLabel: view.monthLabel,
    ...monthRing,
    selectedCountLabel: `${view.selectedDetails.length} 个班种`,
    selectedDetails: view.selectedDetails,
    selectedLabel: view.selectedLabel,
    weekPanels: view.weekPanels,
  };
}

function finishMonthShift(page: WorkbenchPageInstance, continues: boolean): void {
  flushPendingScrollTarget(page);
  const month = page.selectComponent('#workbench-month');
  if (continues && month?.continueQueuedShift !== undefined) {
    month.continueQueuedShift();
    return;
  }
  void refreshWorkbenchWindow(page);
}

function commitPeriodShift(
  page: WorkbenchPageInstance,
  view: 'list' | 'week',
  delta: -1 | 1,
  target?: string,
): void {
  const weekStart =
    view === 'week'
      ? (target ?? addWeeks(page.data.weekStart, delta))
      : getWeekStartDate(`${target ?? addBusinessMonths(page.data.businessMonth, delta)}-01`);
  const businessMonth =
    view === 'week'
      ? getBusinessMonthOf(weekStart)
      : (target ?? addBusinessMonths(page.data.businessMonth, delta));
  const selectedDate =
    target !== undefined
      ? today
      : view === 'week'
        ? addWeeks(page.data.selectedDate, delta)
        : retargetSelectedDateToMonth(page.data.selectedDate, businessMonth);
  const period = { businessMonth, selectedDate, weekStart };
  page.setData(
    {
      ...createViewPatch(page, period),
      announcement:
        view === 'week'
          ? delta < 0
            ? '已切换到上一周。'
            : '已切换到下一周。'
          : delta < 0
            ? '已切换到上个月。'
            : '已切换到下个月。',
      businessMonth,
      listSwiperCurrent: view === 'list' ? 1 : page.data.listSwiperCurrent,
      periodSwiperDuration: 0,
      selectedDate,
      weekStart,
      weekSwiperCurrent: view === 'week' ? 1 : page.data.weekSwiperCurrent,
    },
    () => {
      flushPendingScrollTarget(page);
      continuePeriodShift(page, view);
    },
  );
}

function getRequestedMonths(
  view: WorkbenchView,
  businessMonth: string,
  weekStart: string,
): readonly string[] {
  const requestedMonths = new Set<string>([initialMonth]);
  if (view === 'week') {
    for (const relative of [-1, 0, 1] as const) {
      for (const month of getWeekBusinessMonths(addWeeks(weekStart, relative))) {
        requestedMonths.add(month);
      }
    }
  } else {
    for (const relative of [-2, -1, 0, 1, 2] as const) {
      requestedMonths.add(addBusinessMonths(businessMonth, relative));
    }
  }
  return [...requestedMonths];
}

function getSwiperDelta(current: number): -1 | 0 | 1 {
  return current === 0 ? -1 : current === 2 ? 1 : 0;
}

function startPeriodSwiper(
  page: WorkbenchPageInstance,
  view: 'list' | 'week',
  delta: -1 | 1,
): void {
  const current = view === 'week' ? page.data.weekSwiperCurrent : page.data.listSwiperCurrent;
  if (page.periodShiftActive !== undefined || current !== 1) {
    page.periodShiftQueue = clampPeriodShiftQueue(page.periodShiftQueue + delta);
    return;
  }
  page.periodShiftActive = view;
  page.setData({
    periodSwiperDuration: 260,
    ...(view === 'week'
      ? { weekSwiperCurrent: delta < 0 ? 0 : 2 }
      : { listSwiperCurrent: delta < 0 ? 0 : 2 }),
  });
}

function continuePeriodShift(page: WorkbenchPageInstance, view: 'list' | 'week'): void {
  page.periodShiftActive = undefined;
  page.periodShiftCommitPending = false;
  const queuedDelta = page.periodShiftQueue;
  if (queuedDelta === 0) {
    page.setData({ periodSwiperDuration: 260 });
    void refreshWorkbenchWindow(page);
    return;
  }
  const delta: -1 | 1 = queuedDelta < 0 ? -1 : 1;
  page.periodShiftQueue = queuedDelta - delta;
  page.setData({ periodSwiperDuration: 260 }, () => startPeriodSwiper(page, view, delta));
}

function clampPeriodShiftQueue(value: number): number {
  return Math.max(-6, Math.min(6, value));
}

function startLocateTransition(
  page: WorkbenchPageInstance,
  view: WorkbenchView,
  delta: -1 | 1,
  period: Pick<WorkbenchPageData, 'businessMonth' | 'selectedDate' | 'weekStart'>,
): void {
  const patch = createViewPatch(page, period);
  const targetIndex: 0 | 2 = delta < 0 ? 0 : 2;
  if (view === 'month') {
    const monthTargetSlot = getAdjacentMonthSlot(page.monthRingSlot, delta);
    const targetPanel = patch.monthPanels?.[page.monthRingSlot];
    const targetHeight = patch.gridHeight;
    if (
      targetPanel === undefined ||
      targetHeight === undefined ||
      page.data.monthPanels.length !== 3
    ) {
      applyTodayLocation(page);
      return;
    }
    const monthPanels = [...page.data.monthPanels];
    const monthPanelHeights = [...page.data.monthPanelHeights];
    monthPanels[monthTargetSlot] = { ...targetPanel, relative: delta, slot: monthTargetSlot };
    monthPanelHeights[monthTargetSlot] = targetHeight;
    page.setData({ monthPanelHeights, monthPanels }, () => {
      const month = page.selectComponent('#workbench-month');
      if (month?.startProgrammaticShift !== undefined) {
        month.startProgrammaticShift(delta, targetHeight);
      } else {
        applyTodayLocation(page);
      }
    });
    return;
  }

  if (view === 'week') {
    const targetPanel = patch.weekPanels?.[1];
    if (targetPanel === undefined || page.data.weekPanels.length !== 3) {
      applyTodayLocation(page);
      return;
    }
    const weekPanels = [...page.data.weekPanels];
    weekPanels[targetIndex] = { ...targetPanel, relative: delta };
    page.setData({ weekPanels }, () => startPeriodSwiper(page, 'week', delta));
    return;
  }

  const targetPanel = patch.listPanels?.[1];
  if (targetPanel === undefined || page.data.listPanels.length !== 3) {
    applyTodayLocation(page);
    return;
  }
  const listPanels = [...page.data.listPanels];
  listPanels[targetIndex] = { ...targetPanel, relative: delta };
  page.setData({ listPanels }, () => startPeriodSwiper(page, 'list', delta));
}

function selectBusinessDate(page: WorkbenchPageInstance, businessDate: string): void {
  const period = {
    businessMonth: page.data.businessMonth,
    selectedDate: businessDate,
    weekStart: page.data.weekStart,
  };
  page.setData({
    ...createViewPatch(page, period),
    announcement: `已选择 ${formatDateLabel(businessDate)}。`,
    expandedDetailKey: '',
    selectedDate: businessDate,
  });
}

function applyTodayLocation(page: WorkbenchPageInstance): void {
  page.monthLocateTarget = undefined;
  page.pendingListTarget = undefined;
  page.pendingScrollTarget = undefined;
  page.pendingWeekTarget = undefined;
  const period = {
    businessMonth: initialMonth,
    selectedDate: today,
    weekStart: getWeekStartDate(today),
  };
  page.setData(
    {
      ...createViewPatch(page, period),
      ...period,
    },
    () => {
      const target = page.data.viewMode === 'list' ? `list-day-${today}` : 'workbench-content-top';
      scrollToTarget(page, target);
    },
  );
}

function flushPendingScrollTarget(page: WorkbenchPageInstance): void {
  const target = page.pendingScrollTarget;
  if (target === undefined) return;
  page.pendingScrollTarget = undefined;
  scrollToTarget(page, target);
}

function scrollToTarget(page: WorkbenchPageInstance, target: string): void {
  if (target.startsWith('list-day-')) {
    page.setData({ listScrollTarget: '' }, () => page.setData({ listScrollTarget: target }));
    return;
  }
  page.setData({ scrollTarget: '' }, () => page.setData({ scrollTarget: target }));
}

function resolveFilterDropdownDirection(
  page: WorkbenchPageInstance,
  field: Exclude<FilterField, ''>,
): void {
  const optionCount =
    field === 'role'
      ? page.data.filterRoleOptions.length
      : field === 'shift'
        ? page.data.filterShiftTypeOptions.length
        : page.data.filterMemberOptions.length;
  const optionsHeight = Math.min(148, Math.max(46, optionCount * 44 + 2));
  wx.createSelectorQuery()
    .select(`#filter-${field}-trigger`)
    .boundingClientRect()
    .select('.filter-sheet')
    .boundingClientRect()
    .exec((results) => {
      if (page.data.filterOpenField !== field) return;
      const trigger = results[0];
      const sheet = results[1];
      if (trigger === undefined || trigger === null || sheet === undefined || sheet === null)
        return;
      const spaceBelow = sheet.bottom - 68 - trigger.bottom;
      const spaceAbove = trigger.top - sheet.top - 54;
      page.setData({
        filterDropdownDirection:
          spaceBelow >= optionsHeight || spaceBelow >= spaceAbove ? 'down' : 'up',
      });
    });
}

function createShellLayoutPatch(): Pick<
  WorkbenchPageData,
  'shellActionsStyle' | 'shellHeaderHeight' | 'shellHeaderStyle'
> {
  const windowInfo = wx.getWindowInfo();
  const capsule = wx.getMenuButtonBoundingClientRect();
  const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? windowInfo.safeArea?.top ?? 0);
  const hasCapsule =
    capsule.width > 0 &&
    capsule.height > 0 &&
    capsule.left > 0 &&
    capsule.right <= windowInfo.windowWidth;
  const contentTop = statusBarHeight + 8;
  const shellHeaderHeight = Math.ceil(statusBarHeight + 64);
  const actionsTop = hasCapsule ? Math.max(statusBarHeight + 4, capsule.top - 4) : contentTop;
  const actionsRight = hasCapsule ? windowInfo.windowWidth - capsule.left + 4 : 10;
  const headerRightPadding = actionsRight + 90;
  return {
    shellActionsStyle: `right:${actionsRight}px;top:${actionsTop}px;bottom:auto;`,
    shellHeaderHeight,
    shellHeaderStyle: `height:${shellHeaderHeight}px;min-height:${shellHeaderHeight}px;padding-top:${contentTop}px;padding-right:${headerRightPadding}px;`,
  };
}

function toggleFilterOption(
  page: WorkbenchPageInstance,
  idsKey: 'filterMembershipIds' | 'filterRoleIds' | 'filterShiftTypeIds',
  optionsKey: 'filterMemberOptions' | 'filterRoleOptions' | 'filterShiftTypeOptions',
  value: string,
): void {
  const current = page.data[idsKey];
  const ids = current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value];
  page.setData(
    {
      [idsKey]: ids,
      [optionsKey]: setSelectedOptions(page.data[optionsKey], ids),
    } as Partial<WorkbenchPageData>,
    () => {
      syncFilterPresentation(page);
      refreshView(page);
    },
  );
}

function syncFilterPresentation(page: WorkbenchPageInstance): void {
  page.setData({
    activeFilterCount:
      Number(page.data.filterOnlyChanges) +
      Number(page.data.filterRoleIds.length > 0) +
      Number(page.data.filterShiftTypeIds.length > 0) +
      Number(page.data.filterMembershipIds.length > 0),
    filterMemberSummary: getFilterSummary(
      page.data.filterMemberOptions,
      page.data.filterMembershipIds,
      '全部成员',
    ),
    filterRoleSummary: getFilterSummary(
      page.data.filterRoleOptions,
      page.data.filterRoleIds,
      '全部岗位',
    ),
    filterShiftTypeSummary: getFilterSummary(
      page.data.filterShiftTypeOptions,
      page.data.filterShiftTypeIds,
      '全部班种',
    ),
  });
}

function getFilterSummary(
  options: readonly FilterOption[],
  selectedIds: readonly string[],
  emptyLabel: string,
): string {
  if (selectedIds.length === 0) return emptyLabel;
  const labels = options
    .filter((option) => selectedIds.includes(option.value))
    .map((option) => option.label);
  if (labels.length === 0) return `${selectedIds.length} 项`;
  return labels.length === 1 ? (labels[0] ?? emptyLabel) : `${labels[0]}等 ${labels.length} 项`;
}

function createFilterOptions(
  source: readonly {
    readonly id?: string;
    readonly label?: string;
    readonly name?: string;
    readonly value?: string;
  }[],
  selectedIds: readonly string[],
): readonly FilterOption[] {
  return source.flatMap((item) => {
    const value = item.value ?? item.id;
    const label = item.label ?? item.name;
    return value === undefined || label === undefined
      ? []
      : [{ label, selected: selectedIds.includes(value), value }];
  });
}

function setSelectedOptions(
  options: readonly FilterOption[],
  selectedIds: readonly string[],
): readonly FilterOption[] {
  return options.map((option) => ({ ...option, selected: selectedIds.includes(option.value) }));
}

function mergeHolidays(
  results: readonly { readonly holidays: HolidayReadModel }[],
  activeYear: number,
): HolidayReadModel {
  const dates = new Map<string, HolidayReadModel['dates'][number]>();
  for (const result of results) {
    for (const holiday of result.holidays.dates) dates.set(holiday.date, holiday);
  }
  return {
    confirmed: results.every((result) => result.holidays.confirmed),
    dates: [...dates.values()],
    year: activeYear,
  };
}

function isCurrentRequest(page: WorkbenchPageInstance, requestSerial: number): boolean {
  return page.isVisible && page.requestSerial === requestSerial;
}

function getActiveBusinessMonth(page: WorkbenchPageInstance): string {
  return page.data.viewMode === 'week' ? page.data.weekStart.slice(0, 7) : page.data.businessMonth;
}

function getErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? (error as { readonly status?: number }).status
    : undefined;
}

function failClosedAfterBackgroundRead(
  page: WorkbenchPageInstance,
  requestSerial: number,
  error: unknown,
): void {
  if (!isCurrentRequest(page, requestSerial)) return;
  page.calendar = undefined;
  page.holidays = undefined;
  page.monthResources.clear();
  page.setData({
    canReLogin: isAuthRequired(error),
    errorMessage: getReadErrorMessage(error),
    state: 'error',
  });
}

function formatRole(role: GroupSummary['role']): string {
  return role === 'owner'
    ? '群主'
    : role === 'administrator'
      ? '管理员'
      : role === 'guest'
        ? '访客'
        : '成员';
}

function emptyHoliday(year: number): HolidayReadModel {
  return { confirmed: false, dates: [], year };
}

function getReadErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { readonly code?: string }).code;
    if (code === 'AUTH_REQUIRED' || code === 'AUTHENTICATION_REQUIRED')
      return '登录状态已失效，请重新登录。';
    if (code === 'NETWORK_ERROR') return '网络连接失败；没有可用的离线排班缓存。';
  }
  if (getErrorStatus(error) === 401) return '登录状态已失效，请重新登录。';
  return '排班暂时无法加载，请检查网络连接后重试。';
}

function isAuthRequired(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (('code' in error &&
      ((error as { readonly code?: string }).code === 'AUTH_REQUIRED' ||
        (error as { readonly code?: string }).code === 'AUTHENTICATION_REQUIRED')) ||
      ('status' in error && (error as { readonly status?: number }).status === 401))
  );
}
