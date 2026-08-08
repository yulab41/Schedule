import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  GroupSummary,
  HolidayReadModel,
} from '@schedule/contracts';

import {
  getCalendar,
  getGuestHolidays,
  getHolidays,
  getLoggedInGuestCalendar,
  listGroups,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import {
  addBusinessMonths,
  buildMonthGrid,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
  type CalendarGridWeek,
} from '../../utils/calendar-logic.js';
import { groupAssignmentsByDate as groupByDate } from '../../utils/calendar-views.js';
import {
  buildCalendarWeeks,
  buildDutyDetail,
  buildHolidayMap,
  type CalendarGridWeekView,
} from '../../utils/calendar-grid-builder.js';
import { getChinaStandardTimeBusinessDate } from '../../utils/china-time.js';
import { syncTabBar } from '../../utils/tab-bar.js';

interface CalendarPageData {
  readonly assignmentsByDate: ReadonlyMap<string, readonly CalendarDutyAssignment[]>;
  readonly businessMonth: string;
  readonly dutyDetail: ReturnType<typeof buildDutyDetail> | undefined;
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly holidays: HolidayReadModel | undefined;
  readonly loading: boolean;
  readonly monthPages: readonly {
    readonly label: string;
    readonly month: string;
    readonly weeks: readonly CalendarGridWeekView[];
  }[];
  readonly members: readonly CalendarDutyAssignment[] extends never
    ? never
    : readonly {
        readonly isConfirmed: boolean;
        readonly membershipId: string;
        readonly mobilePhone?: string;
        readonly realName: string;
        readonly shortPhone?: string;
      }[];
  readonly monthLabel: string;
  readonly selectedGroupId: string;
  readonly showDetail: boolean;
  readonly swiperIndex: number;
  readonly today: string;
}

Page({
  data: {
    assignmentsByDate: new Map(),
    businessMonth: '',
    dutyDetail: undefined,
    errorMessage: '',
    groups: [],
    holidays: undefined,
    loading: false,
    members: [],
    monthPages: [],
    monthLabel: '',
    selectedGroupId: '',
    showDetail: false,
    swiperIndex: 1,
    today: '',
  } as CalendarPageData,

  onShow() {
    syncTabBar(this, 1);
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const today = getChinaStandardTimeBusinessDate(new Date());
    const businessMonth = this.data.businessMonth || getCurrentBusinessMonth(new Date());
    this.setData({ businessMonth, monthLabel: getBusinessMonthLabel(businessMonth), today });
    this.buildMonthWindow(businessMonth);
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      const selectedGroupId = selected?.id ?? '';
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
      }
      this.setData({ groups, selectedGroupId });
      if (selected === undefined) {
        this.setData({ monthPages: [] });
        return;
      }
      await this.loadCalendar(selected);
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '日历加载失败，请稍后重试。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadCalendar(selected: GroupSummary): Promise<void> {
    const businessMonth = this.data.businessMonth;
    const isGuest = selected.role === 'guest';
    const [calendarResult, holidayResult] = await Promise.all([
      isGuest
        ? getLoggedInGuestCalendar(selected.id, businessMonth)
        : getCalendar(selected.id, businessMonth),
      isGuest
        ? getGuestHolidays(Number(businessMonth.slice(0, 4)))
        : getHolidays(Number(businessMonth.slice(0, 4))),
    ]);
    const calendar: CalendarReadModel =
      'calendar' in calendarResult ? calendarResult.calendar : calendarResult;
    this.applyCalendar(calendar, holidayResult);
  },

  applyCalendar(calendar: CalendarReadModel, holidays: HolidayReadModel): void {
    const year = Number(calendar.businessMonth.slice(0, 4));
    const month = Number(calendar.businessMonth.slice(5, 7));
    const monthGrid = buildMonthGrid(year, month) as readonly CalendarGridWeek[];
    const assignmentsByDate = groupByDate(calendar.assignments);
    const holidayMap = buildHolidayMap(holidays.dates);
    this.setData({
      assignmentsByDate,
      businessMonth: calendar.businessMonth,
      holidays,
      members: calendar.members,
      monthLabel: getBusinessMonthLabel(calendar.businessMonth),
    });
    this.buildMonthWindow(
      calendar.businessMonth,
      buildCalendarWeeks(monthGrid, assignmentsByDate, holidayMap, this.data.today),
    );
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    const selected = this.data.groups.find((group) => group.id === groupId);
    if (selected === undefined) {
      return;
    }
    setSelectedGroupId(groupId);
    this.setData({ selectedGroupId: groupId });
    void this.loadCalendar(selected);
  },

  changeMonth(event: WechatMiniprogram.TouchEvent) {
    if (this.data.loading) {
      return;
    }
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (!Number.isInteger(delta)) {
      return;
    }
    const businessMonth = addBusinessMonths(this.data.businessMonth, delta);
    this.setData({ businessMonth, monthLabel: getBusinessMonthLabel(businessMonth) });
    this.buildMonthWindow(businessMonth);
    const selected = this.data.groups.find((group) => group.id === this.data.selectedGroupId);
    if (selected !== undefined) {
      void this.loadCalendar(selected);
    }
  },

  // swiper 翻页：只渲染当前月及前后各一个月；中间页始终是当前月，
  // 翻到相邻页后把该月设为中心并重新构建三页窗口，保证任意方向连续翻月。
  onSwiperChange(event: WechatMiniprogram.SwiperChange) {
    const current = Number(event.detail.current ?? 1);
    if (current === 1 || this.data.loading) {
      return;
    }
    const delta = current > 1 ? 1 : -1;
    const nextMonth =
      this.data.monthPages[current]?.month ?? addBusinessMonths(this.data.businessMonth, delta);
    this.setData({ businessMonth: nextMonth, monthLabel: getBusinessMonthLabel(nextMonth) });
    this.buildMonthWindow(nextMonth);
    const selected = this.data.groups.find((group) => group.id === this.data.selectedGroupId);
    if (selected !== undefined) {
      void this.loadCalendar(selected);
    }
  },

  buildMonthWindow(businessMonth: string, realWeeks?: readonly CalendarGridWeekView[]): void {
    const prevMonth = addBusinessMonths(businessMonth, -1);
    const nextMonth = addBusinessMonths(businessMonth, 1);
    const monthPages = [prevMonth, businessMonth, nextMonth].map((month) => ({
      // 相邻月先用“无排班占位网格”渲染（只渲染 3 页，性能可控），
      // 滑到该月后再用真实数据覆盖当前页。
      label: getBusinessMonthLabel(month),
      month,
      weeks: this.buildEmptyWeeks(month),
    }));
    if (realWeeks !== undefined) {
      monthPages[1] = { ...monthPages[1]!, weeks: realWeeks };
    }
    this.setData({
      monthPages,
      swiperIndex: 1,
    });
  },

  buildEmptyWeeks(businessMonth: string): readonly CalendarGridWeekView[] {
    const year = Number(businessMonth.slice(0, 4));
    const month = Number(businessMonth.slice(5, 7));
    const grid = buildMonthGrid(year, month) as readonly CalendarGridWeek[];
    return buildCalendarWeeks(grid, new Map(), {}, this.data.today);
  },

  handleCellTap(event: WechatMiniprogram.CustomEvent) {
    const businessDate = event.detail.businessDate;
    const assignments = this.data.assignmentsByDate.get(businessDate) ?? [];
    if (assignments.length === 0) {
      return;
    }
    const assignment = assignments[0]!;
    this.setData({
      dutyDetail: buildDutyDetail(assignment, this.data.members),
      showDetail: true,
    });
  },

  handleCall(event: WechatMiniprogram.CustomEvent) {
    const number = event.detail.number;
    if (typeof number === 'string' && number.length > 0) {
      wx.makePhoneCall({ phoneNumber: number });
    }
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  openWeek() {
    if (this.data.selectedGroupId.length === 0) {
      return;
    }
    wx.navigateTo({
      url: `/pages/calendar-week/calendar-week?groupId=${encodeURIComponent(
        this.data.selectedGroupId,
      )}&weekStart=${this.data.today}`,
    });
  },

  openList() {
    if (this.data.selectedGroupId.length === 0) {
      return;
    }
    wx.navigateTo({
      url: `/pages/calendar-list/calendar-list?groupId=${encodeURIComponent(
        this.data.selectedGroupId,
      )}&businessMonth=${this.data.businessMonth}`,
    });
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
