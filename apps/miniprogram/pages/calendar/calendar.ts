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

interface CalendarPageData {
  readonly assignmentsByDate: ReadonlyMap<string, readonly CalendarDutyAssignment[]>;
  readonly businessMonth: string;
  readonly dutyDetail: ReturnType<typeof buildDutyDetail> | undefined;
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly holidays: HolidayReadModel | undefined;
  readonly loading: boolean;
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
  readonly today: string;
  readonly weeks: readonly CalendarGridWeekView[];
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
    monthLabel: '',
    selectedGroupId: '',
    showDetail: false,
    today: '',
    weeks: [],
  } as CalendarPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const today = getChinaStandardTimeBusinessDate(new Date());
    const businessMonth = this.data.businessMonth || getCurrentBusinessMonth(new Date());
    this.setData({ businessMonth, monthLabel: getBusinessMonthLabel(businessMonth), today });
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
        this.setData({ weeks: [] });
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
      weeks: buildCalendarWeeks(monthGrid, assignmentsByDate, holidayMap, this.data.today),
    });
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
    const selected = this.data.groups.find((group) => group.id === this.data.selectedGroupId);
    if (selected !== undefined) {
      void this.loadCalendar(selected);
    }
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
