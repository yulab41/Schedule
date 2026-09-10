import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import {
  addBusinessMonths,
  addWeeks,
  getWeekStartDate,
  getWeekBusinessMonths,
  retargetSelectedDateToMonth,
} from '@schedule/presentation-core';
import { createRuntimeCalendarReadClient } from '../../platform/client-core-calendar.js';
import { sanitizeGuestCalendar } from '../../platform/workbench-read.js';
import { getStoredWechatProfile } from '../../platform/wechat-identity.js';
import { ClientCapabilityDisabledError } from '../../app/client-capability-store.js';
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
  visible: boolean;
  shown: boolean;
  monthRingSlot: MonthSlot;
  setData(patch: Partial<Data>, callback?: () => void): void;
  selectComponent(
    selector: string,
  ): { finishPeriodShift?(): void; continueQueuedShift?(): void } | undefined;
}
Page({
  data: initialData(),
  serial: 0,
  visible: true,
  shown: false,
  monthRingSlot: 1,
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
    if (this.shown) void loadCalendar(this);
    this.shown = true;
  },
  onHide(this: GuestPage): void {
    this.visible = false;
    this.serial += 1;
    clearCalendar(this);
  },
  onUnload(this: GuestPage): void {
    this.visible = false;
    this.serial += 1;
    this.visitorKey = undefined;
    clearCalendar(this);
  },
  handleRetry(this: GuestPage): void {
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
    this.setData({ viewMode: view, filterOpen: false });
    this.monthRingSlot = 1;
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
    event: { detail: { delta: -1 | 1; current: MonthSlot } },
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
    changePeriod(this, 'week', event.currentTarget.dataset['delta'] === '-1' ? -1 : 1);
  },
  handleListMonthChange(this: GuestPage, event: Tap): void {
    changePeriod(this, 'list', event.currentTarget.dataset['delta'] === '-1' ? -1 : 1);
  },
  handleWeekSwiperFinish(this: GuestPage, event: { detail: { current: number } }): void {
    if (event.detail.current !== 1) changePeriod(this, 'week', event.detail.current === 0 ? -1 : 1);
  },
  handleListSwiperFinish(this: GuestPage, event: { detail: { current: number } }): void {
    if (event.detail.current !== 1) changePeriod(this, 'list', event.detail.current === 0 ? -1 : 1);
  },
  handleLocateToday(this: GuestPage): void {
    const today = getTodayBusinessDate();
    this.monthRingSlot = 1;
    this.setData({
      selectedDate: today,
      businessMonth: today.slice(0, 7),
      weekStart: getWeekStartDate(today),
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
function changePeriod(page: GuestPage, view: 'week' | 'list', delta: -1 | 1): void {
  const weekStart = view === 'week' ? addWeeks(page.data.weekStart, delta) : page.data.weekStart;
  const month =
    view === 'week' ? weekStart.slice(0, 7) : addBusinessMonths(page.data.businessMonth, delta);
  page.setData({
    businessMonth: month,
    weekStart,
    selectedDate:
      view === 'week' ? weekStart : retargetSelectedDateToMonth(page.data.selectedDate, month),
    weekSwiperCurrent: 1,
    listSwiperCurrent: 1,
  });
  page.monthRingSlot = 1;
  void loadCalendar(page);
}
function clearCalendar(page: GuestPage): void {
  page.calendar = undefined;
  page.holidays = undefined;
  page.setData({
    ...emptyView(),
    state: 'loading',
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
function current(page: GuestPage, serial: number): boolean {
  return page.visible && page.serial === serial;
}
async function loadCalendar(page: GuestPage): Promise<void> {
  if (!page.visible) return;
  const serial = ++page.serial;
  const key = page.visitorKey;
  clearCalendar(page);
  if (!key) {
    page.setData({ state: 'error', errorMessage: '访客码无效，请向群管理员重新获取。' });
    return;
  }
  const month =
    page.data.viewMode === 'week' ? page.data.weekStart.slice(0, 7) : page.data.businessMonth;
  try {
    const group = await client.resolveVisitor(key);
    if (!current(page, serial)) return;
    page.setData({ currentGroupId: group.groupId, currentGroupName: group.groupName });
    const months =
      page.data.viewMode === 'week'
        ? [
            ...new Set(
              [-1, 0, 1].flatMap((delta) =>
                getWeekBusinessMonths(addWeeks(page.data.weekStart, delta)),
              ),
            ),
          ]
        : [addBusinessMonths(month, -1), month, addBusinessMonths(month, 1)];
    const read = async (businessMonth: string) => {
      const result = await client.getGuestCalendar(group.groupId, businessMonth, key);
      if (
        result.calendar.groupId !== group.groupId ||
        result.calendar.businessMonth !== businessMonth
      )
        throw new Error('Invalid guest calendar context');
      return sanitizeGuestCalendar(result.calendar);
    };
    // Commit the active month first; the remaining requests never persist credentials or calendars.
    const active = await read(month);
    if (!current(page, serial)) return;
    const years = [...new Set(months.map((value) => Number(value.slice(0, 4))))];
    const holidays = await Promise.all(years.map((year) => client.getGuestHolidays(year)));
    if (!current(page, serial)) return;
    page.calendar = active;
    page.holidays = {
      year: Number(month.slice(0, 4)),
      confirmed: holidays.every((value) => value.confirmed),
      dates: holidays.flatMap((value) => value.dates),
    };
    renderCalendar(page);
    page.setData({ state: 'ready' });
    const adjacent = await Promise.all(months.filter((value) => value !== month).map(read));
    if (!current(page, serial)) return;
    page.calendar = {
      ...active,
      assignments: [active, ...adjacent].flatMap((value) => value.assignments),
    };
    renderCalendar(page);
  } catch (error) {
    if (!current(page, serial)) return;
    clearCalendar(page);
    const status = (error as { status?: number })?.status;
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
    onlyChanges: false,
  };
  const view = createWorkbenchViewModel(
    page.calendar,
    page.holidays,
    page.data.selectedDate,
    page.data.businessMonth,
    page.data.weekStart,
    filters,
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
  page.setData({
    ...view,
    ...createMonthRing(
      view.monthPanels,
      view.monthPanels.map((panel) => (panel.cells.length / 7) * 54),
      page.monthRingSlot,
    ),
    gridHeight: ((view.monthPanels[1]?.cells.length ?? 35) / 7) * 54,
    selectedCountLabel: `${view.selectedDetails.length} 个班种`,
    filterMemberOptions: members,
    filterRoleOptions: roles,
    filterShiftTypeOptions: shifts,
    filterMemberSummary: summary(members, '全部成员'),
    filterRoleSummary: summary(roles, '全部岗位'),
    filterShiftTypeSummary: summary(shifts, '全部班种'),
    activeFilterCount:
      filters.membershipIds.length + filters.roleIds.length + filters.shiftTypeIds.length,
  });
}
