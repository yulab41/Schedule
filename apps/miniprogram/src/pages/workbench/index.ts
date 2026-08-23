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
  createWorkbenchReadClient,
  readWorkbenchCache,
  WORKBENCH_GROUP_STORAGE_KEY,
  writeWorkbenchCache,
} from '../../platform/workbench-read.js';
import {
  createWorkbenchViewModel,
  getTodayBusinessDate,
  type WorkbenchFilters,
  type WorkbenchViewModel,
} from '../../features/workbench/workbench-model.js';

type WorkbenchState = 'empty' | 'error' | 'loading' | 'offline' | 'ready';
type WorkbenchView = 'list' | 'month' | 'week';

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
  readonly detail?: { readonly businessDate?: string; readonly checked?: boolean };
}

interface MonthChangeEvent {
  readonly detail: { readonly delta: -1 | 1 };
}

interface SwiperFinishEvent {
  readonly detail: { readonly current: number };
}

interface FilterOption {
  readonly label: string;
  readonly selected: boolean;
  readonly value: string;
}

interface WorkbenchPageData {
  readonly activeFilterCount: number;
  readonly announcement: string;
  readonly buildLabel: string;
  readonly businessMonth: string;
  readonly currentGroupId: string;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly canReLogin: boolean;
  readonly errorMessage: string;
  readonly filterIconAnimating: boolean;
  readonly filterMembershipIds: readonly string[];
  readonly filterMemberOptions: readonly FilterOption[];
  readonly filterOpen: boolean;
  readonly filterOnlyChanges: boolean;
  readonly filterRoleIds: readonly string[];
  readonly filterRoleOptions: readonly FilterOption[];
  readonly filterShiftTypeIds: readonly string[];
  readonly filterShiftTypeOptions: readonly FilterOption[];
  readonly groupOpen: boolean;
  readonly groups: readonly GroupSummary[];
  readonly gridHeight: number;
  readonly listPanels: WorkbenchViewModel['listPanels'];
  readonly listSwiperCurrent: number;
  readonly listSwiperHeight: number;
  readonly locateIconAnimating: boolean;
  readonly monthLabel: string;
  readonly monthPanels: WorkbenchViewModel['monthPanels'];
  readonly navMotion: string;
  readonly notificationAnimating: boolean;
  readonly offlineNotice: string;
  readonly periodSwiperDuration: number;
  readonly profileAnimating: boolean;
  readonly scrollTarget: string;
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
}

interface WorkbenchPageInstance {
  data: WorkbenchPageData;
  calendar: CalendarReadModel | undefined;
  holidays: HolidayReadModel | undefined;
  monthLocateTarget: string | undefined;
  pendingListTarget: string | undefined;
  pendingScrollTarget: string | undefined;
  pendingWeekTarget: string | undefined;
  requestSerial: number;
  selectComponent(selector: string): { startProgrammaticShift?(delta: -1 | 1): void } | undefined;
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
    currentGroupId: '',
    currentGroupName: '正在读取群组',
    currentGroupRole: '',
    canReLogin: false,
    errorMessage: '',
    filterIconAnimating: false,
    filterMembershipIds: [],
    filterMemberOptions: [],
    filterOpen: false,
    filterOnlyChanges: false,
    filterRoleIds: [],
    filterRoleOptions: [],
    filterShiftTypeIds: [],
    filterShiftTypeOptions: [],
    groupOpen: false,
    groups: [],
    gridHeight: 270,
    listPanels: [],
    listSwiperCurrent: 1,
    listSwiperHeight: 120,
    locateIconAnimating: false,
    monthLabel: formatMonthLabel(initialMonth),
    monthPanels: [],
    navMotion: '',
    notificationAnimating: false,
    offlineNotice: '',
    periodSwiperDuration: 260,
    profileAnimating: false,
    scrollTarget: '',
    selectedDate: today,
    selectedDetails: [],
    selectedLabel: formatDateLabel(today),
    selectedCountLabel: '0 个班次',
    calendarNavAnimating: false,
    state: 'loading' as WorkbenchState,
    viewMode: 'month' as const,
    weekPanels: [],
    weekStart: getWeekStartDate(today),
    weekSwiperCurrent: 1,
    viewOptions: ['month', 'week', 'list'],
  } satisfies WorkbenchPageData,

  calendar: undefined,
  holidays: undefined,
  monthLocateTarget: undefined,
  pendingListTarget: undefined,
  pendingScrollTarget: undefined,
  pendingWeekTarget: undefined,
  requestSerial: 0,

  onLoad(this: WorkbenchPageInstance): void {
    void loadWorkbench(this);
  },

  handleGroupToggle(this: WorkbenchPageInstance): void {
    this.setData({ groupOpen: !this.data.groupOpen, filterOpen: false });
  },

  handleGroupSelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const groupId = event.currentTarget.dataset.groupId;
    if (groupId === undefined || groupId === this.data.currentGroupId) {
      this.setData({ groupOpen: false });
      return;
    }
    wx.setStorageSync(WORKBENCH_GROUP_STORAGE_KEY, groupId);
    this.calendar = undefined;
    this.holidays = undefined;
    this.setData({
      activeFilterCount: 0,
      businessMonth: initialMonth,
      currentGroupId: groupId,
      filterMembershipIds: [],
      filterOnlyChanges: false,
      filterRoleIds: [],
      filterShiftTypeIds: [],
      groupOpen: false,
      selectedDate: today,
      selectedLabel: formatDateLabel(today),
      weekStart: getWeekStartDate(today),
    });
    void loadWorkbench(this);
  },

  handleViewChange(this: WorkbenchPageInstance, event: TapEvent): void {
    const view = event.currentTarget.dataset.view;
    if (view !== 'month' && view !== 'week' && view !== 'list') return;
    const nextView = view as WorkbenchView;
    const nextWeekStart =
      nextView === 'week' ? getWeekStartDate(this.data.selectedDate) : this.data.weekStart;
    this.setData({
      announcement:
        nextView === 'month' ? '已切换到月视图。' : `${nextView === 'week' ? '周' : '列表'}视图。`,
      filterOpen: false,
      viewMode: nextView,
      weekStart: nextWeekStart,
    });
    if (nextView === 'week') void loadWorkbench(this);
    else refreshView(this);
  },

  handleFilterToggle(this: WorkbenchPageInstance): void {
    this.setData(
      {
        filterIconAnimating: false,
        filterOpen: true,
        groupOpen: false,
      },
      () => {
        this.setData({ filterIconAnimating: true });
      },
    );
  },

  handleFilterClose(this: WorkbenchPageInstance): void {
    this.setData({ announcement: '已关闭筛选。', filterOpen: false });
  },

  handleFilterApply(this: WorkbenchPageInstance): void {
    this.setData({ announcement: '已应用排班筛选。', filterOpen: false });
  },

  handleFilterClear(this: WorkbenchPageInstance): void {
    this.setData({
      activeFilterCount: 0,
      announcement: '已清除全部筛选。',
      filterMembershipIds: [],
      filterMemberOptions: setSelectedOptions(this.data.filterMemberOptions, []),
      filterOnlyChanges: false,
      filterRoleIds: [],
      filterRoleOptions: setSelectedOptions(this.data.filterRoleOptions, []),
      filterShiftTypeIds: [],
      filterShiftTypeOptions: setSelectedOptions(this.data.filterShiftTypeOptions, []),
    });
    refreshView(this);
  },

  handleOnlyChangesToggle(this: WorkbenchPageInstance): void {
    this.setData({ filterOnlyChanges: !this.data.filterOnlyChanges });
    syncFilterCount(this);
    refreshView(this);
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
    syncFilterCount(this);
    refreshView(this);
  },

  handleMonthChange(this: WorkbenchPageInstance, event: MonthChangeEvent): void {
    const businessMonth =
      this.monthLocateTarget ?? addBusinessMonths(this.data.businessMonth, event.detail.delta);
    this.monthLocateTarget = undefined;
    this.setData({
      announcement: event.detail.delta < 0 ? '已切换到上个月。' : '已切换到下个月。',
      businessMonth,
      selectedDate: retargetSelectedDateToMonth(this.data.selectedDate, businessMonth),
      weekStart: getWeekStartDate(`${businessMonth}-01`),
    });
    refreshView(this);
    void loadWorkbench(this);
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
        selectedDate: today,
        selectedLabel: formatDateLabel(today),
        scrollTarget: '',
      },
      () => {
        this.setData({ locateIconAnimating: true });
      },
    );

    if (this.data.viewMode === 'month' && this.data.businessMonth !== initialMonth) {
      this.monthLocateTarget = initialMonth;
      this.pendingScrollTarget = 'workbench-view-anchor';
      const direction: -1 | 1 = initialMonth < this.data.businessMonth ? -1 : 1;
      const month = this.selectComponent('#workbench-month');
      if (month?.startProgrammaticShift !== undefined) month.startProgrammaticShift(direction);
      else applyTodayLocation(this);
      return;
    }
    if (this.data.viewMode === 'week' && this.data.weekStart !== targetWeekStart) {
      this.pendingWeekTarget = targetWeekStart;
      this.pendingScrollTarget = 'workbench-view-anchor';
      startPeriodSwiper(this, 'week', targetWeekStart < this.data.weekStart ? -1 : 1);
      return;
    }
    if (this.data.viewMode === 'list' && this.data.businessMonth !== initialMonth) {
      this.pendingListTarget = initialMonth;
      this.pendingScrollTarget = `list-row-${today}`;
      startPeriodSwiper(this, 'list', initialMonth < this.data.businessMonth ? -1 : 1);
      return;
    }
    applyTodayLocation(this);
  },

  handleCalendarNav(this: WorkbenchPageInstance): void {
    this.setData({ calendarNavAnimating: false, scrollTarget: '' }, () => {
      this.setData({ calendarNavAnimating: true, scrollTarget: 'workbench-view-anchor' });
    });
  },

  handleWeekSwiperFinish(this: WorkbenchPageInstance, event: SwiperFinishEvent): void {
    const delta = getSwiperDelta(event.detail.current);
    if (delta === 0) return;
    shiftWeek(this, delta, this.pendingWeekTarget);
    this.pendingWeekTarget = undefined;
    recenterPeriodSwiper(this, 'week');
  },

  handleListSwiperFinish(this: WorkbenchPageInstance, event: SwiperFinishEvent): void {
    const delta = getSwiperDelta(event.detail.current);
    if (delta === 0) return;
    shiftListMonth(this, delta, this.pendingListTarget);
    this.pendingListTarget = undefined;
    recenterPeriodSwiper(this, 'list');
  },

  handleDateSelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const businessDate = event.detail?.businessDate;
    if (businessDate === undefined) return;
    this.setData({
      announcement: `已选择 ${formatDateLabel(businessDate)}。`,
      selectedDate: businessDate,
      selectedLabel: formatDateLabel(businessDate),
    });
    refreshView(this);
  },

  handleWeekDaySelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const businessDate = event.currentTarget.dataset.businessDate;
    if (businessDate === undefined) return;
    this.setData({
      announcement: `已选择 ${formatDateLabel(businessDate)}。`,
      selectedDate: businessDate,
      selectedLabel: formatDateLabel(businessDate),
    });
    refreshView(this);
  },

  handleListSelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const businessDate = event.currentTarget.dataset.businessDate;
    if (businessDate === undefined) return;
    this.setData({
      announcement: `已选择 ${formatDateLabel(businessDate)}。`,
      selectedDate: businessDate,
      selectedLabel: formatDateLabel(businessDate),
    });
    refreshView(this);
  },

  handleUnavailable(this: WorkbenchPageInstance, event: TapEvent): void {
    const label = event.currentTarget.dataset.label ?? '该项';
    const motion = event.currentTarget.dataset.motion ?? '';
    this.setData({ announcement: `${label}功能将在后续阶段开放。`, navMotion: '' }, () => {
      this.setData({ navMotion: motion });
    });
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
    void loadWorkbench(this);
  },

  handleOpenIdentity(this: WorkbenchPageInstance): void {
    wx.navigateTo({ url: '/pages/identity/index' });
  },
});

async function loadWorkbench(page: WorkbenchPageInstance): Promise<void> {
  const requestSerial = page.requestSerial + 1;
  page.requestSerial = requestSerial;
  const hasLoadedData = page.calendar !== undefined && page.holidays !== undefined;
  page.setData({
    canReLogin: false,
    errorMessage: '',
    state: hasLoadedData ? page.data.state : 'loading',
  });
  try {
    const groups = await client.listGroups();
    if (!isCurrentRequest(page, requestSerial)) return;
    if (groups.length === 0) {
      page.setData({
        currentGroupId: '',
        currentGroupName: '暂无可查看的群组',
        groups,
        state: 'empty',
      });
      return;
    }
    const storedGroupId = wx.getStorageSync(WORKBENCH_GROUP_STORAGE_KEY);
    const selectedGroup = groups.find((group) => group.id === storedGroupId) ?? groups[0];
    if (selectedGroup === undefined) return;
    const groupChanged = page.data.currentGroupId !== selectedGroup.id;
    if (groupChanged) {
      page.setData({
        currentGroupId: selectedGroup.id,
        currentGroupName: selectedGroup.name,
        currentGroupRole: formatRole(selectedGroup.role),
      });
      wx.setStorageSync(WORKBENCH_GROUP_STORAGE_KEY, selectedGroup.id);
    }
    page.setData({ groups });

    const requestedMonths = getRequestedMonths(
      page.data.viewMode,
      page.data.businessMonth,
      page.data.weekStart,
    );
    const monthResults = await readMonths(page, selectedGroup.id, requestedMonths);
    if (!isCurrentRequest(page, requestSerial)) return;
    const activeMonth =
      page.data.viewMode === 'week' ? page.data.weekStart.slice(0, 7) : page.data.businessMonth;
    const activeResult =
      monthResults.find((result) => result.calendar.businessMonth === activeMonth) ??
      monthResults[0];
    if (activeResult === undefined) throw new Error('Calendar month data is unavailable.');
    page.calendar = {
      ...activeResult.calendar,
      assignments: monthResults.flatMap((result) => result.calendar.assignments),
    };
    page.holidays = mergeHolidays(monthResults, activeResult.holidays.year);
    page.setData({
      canReLogin: false,
      filterMemberOptions: createFilterOptions(
        page.calendar.members.map((member) => ({
          label: member.realName,
          value: member.membershipId,
        })),
        page.data.filterMembershipIds,
      ),
      filterRoleOptions: createFilterOptions(page.calendar.roles, page.data.filterRoleIds),
      filterShiftTypeOptions: createFilterOptions(
        page.calendar.shiftTypes.map((shiftType) => ({
          label: `${shiftType.name}（${shiftType.abbreviation}）`,
          value: shiftType.id,
        })),
        page.data.filterShiftTypeIds,
      ),
      offlineNotice: monthResults.some((result) => result.offline)
        ? '离线只读 · 显示最近一次成功读取的排班'
        : '',
      state: monthResults.some((result) => result.offline)
        ? 'offline'
        : activeResult.calendar.assignments.length === 0
          ? 'empty'
          : 'ready',
    });
    refreshView(page);
    if (page.pendingScrollTarget !== undefined) {
      const target = page.pendingScrollTarget;
      page.pendingScrollTarget = undefined;
      page.setData({ scrollTarget: '' }, () => page.setData({ scrollTarget: target }));
    }
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

async function readMonths(
  page: WorkbenchPageInstance,
  groupId: string,
  requestedMonths: readonly string[],
): Promise<
  readonly {
    readonly calendar: CalendarReadModel;
    readonly holidays: HolidayReadModel;
    readonly offline: boolean;
  }[]
> {
  const years = [...new Set(requestedMonths.map((month) => Number(month.slice(0, 4))))];
  const holidayResults = await Promise.all(
    years.map(async (year) => {
      try {
        return await client.getHolidays(year);
      } catch {
        return undefined;
      }
    }),
  );
  const holidayByYear = new Map(
    years.map((year, index) => [year, holidayResults[index] ?? emptyHoliday(year)]),
  );
  return Promise.all(
    requestedMonths.map(async (businessMonth) => {
      try {
        const calendar = await client.getCalendar(groupId, businessMonth);
        const holidays =
          holidayByYear.get(Number(businessMonth.slice(0, 4))) ??
          emptyHoliday(Number(businessMonth.slice(0, 4)));
        writeWorkbenchCache(groupId, businessMonth, calendar, holidays);
        return { calendar, holidays, offline: false };
      } catch (error) {
        const cached = readWorkbenchCache(groupId, businessMonth);
        if (cached !== undefined) return { ...cached, offline: true };
        throw error;
      }
    }),
  );
}

function refreshView(page: WorkbenchPageInstance): void {
  if (page.calendar === undefined || page.holidays === undefined) return;
  const filters: WorkbenchFilters = {
    membershipIds: page.data.filterMembershipIds,
    onlyChanges: page.data.filterOnlyChanges,
    roleIds: page.data.filterRoleIds,
    shiftTypeIds: page.data.filterShiftTypeIds,
  };
  const view = createWorkbenchViewModel(
    page.calendar,
    page.holidays,
    page.data.selectedDate,
    page.data.businessMonth,
    page.data.weekStart,
    filters,
  );
  page.setData({
    gridHeight: ((view.monthPanels[1]?.cells.length ?? 35) / 7) * 54,
    listPanels: view.listPanels,
    listSwiperHeight: Math.max(120, ...view.listPanels.map((panel) => 48 + panel.rows.length * 64)),
    monthLabel: view.monthLabel,
    monthPanels: view.monthPanels,
    selectedCountLabel: `${view.selectedDetails.length} 个班次`,
    selectedDetails: view.selectedDetails,
    selectedLabel: view.selectedLabel,
    weekPanels: view.weekPanels,
  });
}

function shiftWeek(page: WorkbenchPageInstance, delta: -1 | 1, targetWeekStart?: string): void {
  const weekStart = targetWeekStart ?? addWeeks(page.data.weekStart, delta);
  const selectedDate =
    targetWeekStart === undefined ? addWeeks(page.data.selectedDate, delta) : today;
  page.setData({
    announcement: delta < 0 ? '已切换到上一周。' : '已切换到下一周。',
    businessMonth: getBusinessMonthOf(weekStart),
    selectedDate,
    selectedLabel: formatDateLabel(selectedDate),
    weekStart,
  });
  refreshView(page);
  void loadWorkbench(page);
}

function shiftListMonth(
  page: WorkbenchPageInstance,
  delta: -1 | 1,
  targetBusinessMonth?: string,
): void {
  const businessMonth = targetBusinessMonth ?? addBusinessMonths(page.data.businessMonth, delta);
  const selectedDate =
    targetBusinessMonth === undefined
      ? retargetSelectedDateToMonth(page.data.selectedDate, businessMonth)
      : today;
  page.setData({
    announcement: delta < 0 ? '已切换到上个月。' : '已切换到下个月。',
    businessMonth,
    selectedDate,
    selectedLabel: formatDateLabel(selectedDate),
    weekStart: getWeekStartDate(`${businessMonth}-01`),
  });
  refreshView(page);
  void loadWorkbench(page);
}

function getRequestedMonths(
  view: WorkbenchView,
  businessMonth: string,
  weekStart: string,
): readonly string[] {
  if (view === 'week') {
    return [
      ...new Set(
        ([-1, 0, 1] as const).flatMap((relative) =>
          getWeekBusinessMonths(addWeeks(weekStart, relative)),
        ),
      ),
    ];
  }
  return [-1, 0, 1].map((relative) => addBusinessMonths(businessMonth, relative));
}

function getSwiperDelta(current: number): -1 | 0 | 1 {
  return current === 0 ? -1 : current === 2 ? 1 : 0;
}

function startPeriodSwiper(
  page: WorkbenchPageInstance,
  view: 'list' | 'week',
  delta: -1 | 1,
): void {
  page.setData({
    periodSwiperDuration: 260,
    ...(view === 'week'
      ? { weekSwiperCurrent: delta < 0 ? 0 : 2 }
      : { listSwiperCurrent: delta < 0 ? 0 : 2 }),
  });
}

function recenterPeriodSwiper(page: WorkbenchPageInstance, view: 'list' | 'week'): void {
  page.setData(
    {
      periodSwiperDuration: 0,
      ...(view === 'week' ? { weekSwiperCurrent: 1 } : { listSwiperCurrent: 1 }),
    },
    () => page.setData({ periodSwiperDuration: 260 }),
  );
}

function applyTodayLocation(page: WorkbenchPageInstance): void {
  page.setData({
    businessMonth: initialMonth,
    selectedDate: today,
    selectedLabel: formatDateLabel(today),
    weekStart: getWeekStartDate(today),
  });
  refreshView(page);
  const target = page.data.viewMode === 'list' ? `list-row-${today}` : 'workbench-view-anchor';
  page.setData({ scrollTarget: '' }, () => page.setData({ scrollTarget: target }));
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
  page.setData({
    [idsKey]: ids,
    [optionsKey]: setSelectedOptions(page.data[optionsKey], ids),
  } as Partial<WorkbenchPageData>);
}

function syncFilterCount(page: WorkbenchPageInstance): void {
  page.setData({
    activeFilterCount:
      Number(page.data.filterOnlyChanges) +
      Number(page.data.filterRoleIds.length > 0) +
      Number(page.data.filterShiftTypeIds.length > 0) +
      Number(page.data.filterMembershipIds.length > 0),
  });
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
  return page.requestSerial === requestSerial;
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

function formatMonthLabel(businessMonth: string): string {
  return `${Number(businessMonth.slice(0, 4))} 年 ${Number(businessMonth.slice(5, 7))} 月`;
}

function formatDateLabel(businessDate: string): string {
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][
    new Date(`${businessDate}T00:00:00Z`).getUTCDay()
  ];
  return `${Number(businessDate.slice(5, 7))} 月 ${Number(businessDate.slice(8, 10))} 日 · 星期${weekday}`;
}

function emptyHoliday(year: number): HolidayReadModel {
  return { confirmed: false, dates: [], year };
}

function getReadErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { readonly code?: string }).code;
    if (code === 'AUTH_REQUIRED') return '登录状态已失效，请重新登录。';
    if (code === 'NETWORK_ERROR') return '网络连接失败；没有可用的离线排班缓存。';
  }
  return '排班暂时无法加载，请检查网络连接后重试。';
}

function isAuthRequired(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: string }).code === 'AUTH_REQUIRED'
  );
}
