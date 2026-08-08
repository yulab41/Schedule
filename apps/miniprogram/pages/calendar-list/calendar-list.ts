import type { CalendarDutyMember, GroupSummary } from '@schedule/contracts';

import { getCalendar, getLoggedInGuestCalendar, listGroups } from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import {
  buildDayList,
  buildDutyDetail,
  formatLocalDate,
  formatMonthLabel,
  getWeekStartDate,
  shiftBusinessMonth,
  splitBusinessMonth,
  toMembersMap,
  type DayListEntry,
  type DutyDetail,
} from '../../utils/calendar.js';

interface ListPageData {
  readonly businessMonth: string;
  readonly days: readonly ListDayRow[];
  readonly dutyDetail: DutyDetail | undefined;
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly members: readonly CalendarDutyMember[];
  readonly membersMap: Record<string, CalendarDutyMember>;
  readonly monthLabel: string;
  readonly selectedGroupId: string;
  readonly showDetail: boolean;
  readonly today: string;
}

interface ListDayRow extends DayListEntry {
  readonly dateLabel: string;
}

Page({
  data: {
    businessMonth: '',
    days: [],
    dutyDetail: undefined,
    errorMessage: '',
    groups: [],
    loading: false,
    members: [],
    membersMap: {},
    monthLabel: '',
    selectedGroupId: '',
    showDetail: false,
    today: '',
  } as ListPageData,

  onLoad(options: Record<string, string | undefined>) {
    const today = formatLocalDate(new Date());
    const businessMonth =
      typeof options.businessMonth === 'string' && /^\d{4}-\d{2}$/u.test(options.businessMonth)
        ? options.businessMonth
        : today.slice(0, 7);
    this.setData({
      businessMonth,
      monthLabel: formatMonthLabel(businessMonth),
      today,
    });
    void this.loadGroups(options.groupId);
  },

  async loadGroups(preferredId: string | undefined): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, preferredId);
      this.setData({
        groups,
        selectedGroupId: selected?.id ?? '',
      });
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
        await this.loadMonth();
      } else {
        this.setData({ days: [] });
      }
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '群组数据加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMonth(): Promise<void> {
    const groupId = this.data.selectedGroupId;
    const businessMonth = this.data.businessMonth;
    if (groupId.length === 0 || businessMonth.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const group = this.data.groups.find((item) => item.id === groupId);
      const result =
        group?.role === 'guest'
          ? await getLoggedInGuestCalendar(groupId, businessMonth)
          : await getCalendar(groupId, businessMonth);
      const calendar = 'calendar' in result ? result.calendar : result;
      this.setData({
        days: buildDayList(calendar.assignments, this.data.today).map((day) => ({
          ...day,
          dateLabel: day.businessDate.slice(5),
        })),
        members: calendar.members,
        membersMap: toMembersMap(calendar.members),
      });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '日历加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  changeMonth(event: WechatMiniprogram.TouchEvent): void {
    if (this.data.loading) {
      return;
    }
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (!Number.isInteger(delta)) {
      return;
    }
    const businessMonth = shiftBusinessMonth(this.data.businessMonth, delta);
    this.setData({
      businessMonth,
      monthLabel: formatMonthLabel(businessMonth),
    });
    void this.loadMonth();
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    this.setData({ selectedGroupId: groupId });
    setSelectedGroupId(groupId);
    void this.loadMonth();
  },

  openMonth(): void {
    wx.switchTab({ url: '/pages/calendar/calendar' });
  },

  openWeek(): void {
    if (this.data.selectedGroupId.length === 0) {
      return;
    }
    const { businessMonth, month, year } = splitBusinessMonth(this.data.businessMonth);
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const weekStart =
      this.data.today.slice(0, 7) === businessMonth
        ? getWeekStartDate(this.data.today)
        : getWeekStartDate(firstDay);
    wx.redirectTo({
      url: `/pages/calendar-week/calendar-week?groupId=${this.data.selectedGroupId}&weekStart=${weekStart}`,
    });
  },

  handleDutyTap(event: WechatMiniprogram.CustomEvent) {
    const assignmentId = event.detail.assignmentId;
    if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
      return;
    }
    const assignment = this.data.days
      .flatMap((day) => day.assignments)
      .find((item) => item.id === assignmentId);
    if (assignment === undefined) {
      return;
    }
    this.setData({
      dutyDetail: buildDutyDetail(assignment, this.data.members),
      showDetail: true,
    });
  },

  handleCall(event: WechatMiniprogram.CustomEvent) {
    const phoneNumber = event.detail.number;
    if (typeof phoneNumber === 'string' && phoneNumber.length > 0) {
      wx.makePhoneCall({ phoneNumber });
    }
  },

  closeDetail(): void {
    this.setData({ showDetail: false });
  },
});
