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
  type WorkbenchMember,
} from '../../platform/workbench-read.js';
import {
  createWorkbenchViewModel,
  getTodayBusinessDate,
  type WorkbenchFilter,
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

interface WorkbenchPageData {
  readonly activeFilter: WorkbenchFilter;
  readonly activeFilterLabel: string;
  readonly announcement: string;
  readonly buildLabel: string;
  readonly businessMonth: string;
  readonly currentGroupId: string;
  readonly currentGroupName: string;
  readonly currentGroupRole: string;
  readonly canReLogin: boolean;
  readonly errorMessage: string;
  readonly filterOpen: boolean;
  readonly groupOpen: boolean;
  readonly groups: readonly GroupSummary[];
  readonly gridHeight: number;
  readonly listRows: WorkbenchViewModel['listRows'];
  readonly monthLabel: string;
  readonly monthPanels: WorkbenchViewModel['monthPanels'];
  readonly offlineNotice: string;
  readonly selectedDate: string;
  readonly selectedDetails: WorkbenchViewModel['selectedDetails'];
  readonly selectedLabel: string;
  readonly selectedCountLabel: string;
  readonly state: WorkbenchState;
  readonly viewMode: WorkbenchView;
  readonly weekDays: WorkbenchViewModel['weekDays'];
  readonly weekRangeLabel: string;
  readonly weekStart: string;
  readonly viewOptions: readonly WorkbenchView[];
  readonly filterOptions: readonly WorkbenchFilter[];
}

interface WorkbenchPageInstance {
  data: WorkbenchPageData;
  calendar?: CalendarReadModel;
  groupMembers: readonly WorkbenchMember[];
  holidays?: HolidayReadModel;
  requestSerial: number;
  setData(patch: Partial<WorkbenchPageData>): void;
}

const client = createWorkbenchReadClient();
const today = getTodayBusinessDate();
const initialMonth = today.slice(0, 7);

Page({
  data: {
    activeFilter: 'all' as const,
    activeFilterLabel: '全部班次',
    announcement: '',
    buildLabel: buildInfo.buildLabel,
    businessMonth: initialMonth,
    currentGroupId: '',
    currentGroupName: '正在读取群组',
    currentGroupRole: '',
    canReLogin: false,
    errorMessage: '',
    filterOpen: false,
    groupOpen: false,
    groups: [],
    gridHeight: 270,
    listRows: [],
    monthLabel: formatMonthLabel(initialMonth),
    monthPanels: [],
    offlineNotice: '',
    selectedDate: today,
    selectedDetails: [],
    selectedLabel: formatDateLabel(today),
    selectedCountLabel: '0 个班次',
    state: 'loading' as WorkbenchState,
    viewMode: 'month' as const,
    weekDays: [],
    weekRangeLabel: '',
    weekStart: getWeekStartDate(today),
    viewOptions: ['month', 'week', 'list'],
    filterOptions: ['all', 'mine', 'changes'],
  } satisfies WorkbenchPageData,

  groupMembers: [],
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
    this.setData({
      businessMonth: initialMonth,
      currentGroupId: groupId,
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
    this.setData({ filterOpen: !this.data.filterOpen, groupOpen: false });
  },

  handleFilterSelect(this: WorkbenchPageInstance, event: TapEvent): void {
    const filter = event.currentTarget.dataset.filter;
    if (filter !== 'all' && filter !== 'mine' && filter !== 'changes') return;
    const labels: Readonly<Record<WorkbenchFilter, string>> = {
      all: '全部班次',
      changes: '只看有变更的班次',
      mine: '只看我的排班',
    };
    this.setData({
      activeFilter: filter,
      activeFilterLabel: labels[filter],
      announcement: `已应用筛选：${labels[filter]}。`,
      filterOpen: false,
    });
    refreshView(this);
  },

  handleMonthChange(this: WorkbenchPageInstance, event: MonthChangeEvent): void {
    const businessMonth = addBusinessMonths(this.data.businessMonth, event.detail.delta);
    this.setData({
      announcement: event.detail.delta < 0 ? '已切换到上个月。' : '已切换到下个月。',
      businessMonth,
      selectedDate: retargetSelectedDateToMonth(this.data.selectedDate, businessMonth),
      weekStart: getWeekStartDate(`${businessMonth}-01`),
    });
    void loadWorkbench(this);
  },

  handleWeekChange(this: WorkbenchPageInstance, event: TapEvent): void {
    const delta = event.currentTarget.dataset.delta === '-1' ? -1 : 1;
    const weekStart = addWeeks(this.data.weekStart, delta);
    const selectedDate = addWeeks(this.data.selectedDate, delta);
    this.setData({
      announcement: delta < 0 ? '已切换到上一周。' : '已切换到下一周。',
      businessMonth: getBusinessMonthOf(weekStart),
      selectedDate,
      selectedLabel: formatDateLabel(selectedDate),
      weekStart,
    });
    void loadWorkbench(this);
  },

  handleListMonthChange(this: WorkbenchPageInstance, event: TapEvent): void {
    const delta = event.currentTarget.dataset.delta === '-1' ? -1 : 1;
    const businessMonth = addBusinessMonths(this.data.businessMonth, delta);
    const selectedDate = retargetSelectedDateToMonth(this.data.selectedDate, businessMonth);
    this.setData({
      announcement: delta < 0 ? '已切换到上个月。' : '已切换到下个月。',
      businessMonth,
      selectedDate,
      selectedLabel: formatDateLabel(selectedDate),
      weekStart: getWeekStartDate(`${businessMonth}-01`),
    });
    void loadWorkbench(this);
  },

  handleLocateToday(this: WorkbenchPageInstance): void {
    this.setData({
      announcement: this.data.viewMode === 'week' ? '已定位到本周。' : '已定位到今天。',
      businessMonth: initialMonth,
      selectedDate: today,
      selectedLabel: formatDateLabel(today),
      weekStart: getWeekStartDate(today),
    });
    void loadWorkbench(this);
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
    this.setData({ announcement: `${label}功能将在后续阶段开放。` });
  },

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
  page.setData({ canReLogin: false, errorMessage: '', state: 'loading' });
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
    const [monthResults, memberResults] = await Promise.all([
      readMonths(page, selectedGroup.id, requestedMonths),
      client.getMembers(selectedGroup.id).catch(() => []),
    ]);
    if (!isCurrentRequest(page, requestSerial)) return;
    page.groupMembers = memberResults;
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
    page.holidays = activeResult.holidays;
    page.setData({
      canReLogin: false,
      offlineNotice: monthResults.some((result) => result.offline)
        ? '离线只读 · 显示最近一次成功读取的排班'
        : '',
      state: monthResults.some((result) => result.offline)
        ? 'offline'
        : page.calendar.assignments.length === 0
          ? 'empty'
          : 'ready',
    });
    refreshView(page);
  } catch (error) {
    if (!isCurrentRequest(page, requestSerial)) return;
    const message = getReadErrorMessage(error);
    page.setData({ canReLogin: isAuthRequired(error), errorMessage: message, state: 'error' });
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
  const currentMembershipId = page.groupMembers.find((member) => member.isCurrentUser)?.id ?? '';
  const view = createWorkbenchViewModel(
    page.calendar,
    page.holidays,
    page.data.selectedDate,
    page.data.businessMonth,
    page.data.weekStart,
    page.data.activeFilter,
    currentMembershipId,
  );
  page.setData({
    gridHeight: ((view.monthPanels[1]?.cells.length ?? 35) / 7) * 54,
    listRows: view.listRows,
    monthLabel: view.monthLabel,
    monthPanels: view.monthPanels,
    selectedCountLabel: `${view.selectedDetails.length} 个班次`,
    selectedDetails: view.selectedDetails,
    selectedLabel: view.selectedLabel,
    weekDays: view.weekDays,
    weekRangeLabel: view.weekRangeLabel,
  });
}

function getRequestedMonths(
  view: WorkbenchView,
  businessMonth: string,
  weekStart: string,
): readonly string[] {
  return view === 'week' ? getWeekBusinessMonths(weekStart) : [businessMonth];
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
