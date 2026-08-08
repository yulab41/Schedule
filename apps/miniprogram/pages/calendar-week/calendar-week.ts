import type { CalendarDutyAssignment, CalendarDutyMember, GroupSummary } from '@schedule/contracts';

import { getCalendar, getLoggedInGuestCalendar, listGroups } from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import {
  addDays,
  buildDutyDetail,
  formatLocalDate,
  getWeekDays,
  getWeekLabel,
  getWeekStartDate,
  getWeekdayLabel,
  groupAssignmentsByDate,
  isWeekend,
  toMembersMap,
  type DutyDetail,
} from '../../utils/calendar.js';

interface WeekDayEntry {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessDate: string;
  readonly dayLabel: string;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly weekdayLabel: string;
}

interface WeekPageData {
  readonly days: readonly WeekDayEntry[];
  readonly dutyDetail: DutyDetail | undefined;
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly members: readonly CalendarDutyMember[];
  readonly membersMap: Record<string, CalendarDutyMember>;
  readonly selectedGroupId: string;
  readonly showDetail: boolean;
  readonly today: string;
  readonly weekLabel: string;
  readonly weekStart: string;
}

Page({
  data: {
    days: [],
    dutyDetail: undefined,
    errorMessage: '',
    groups: [],
    loading: false,
    members: [],
    membersMap: {},
    selectedGroupId: '',
    showDetail: false,
    today: '',
    weekLabel: '',
    weekStart: '',
  } as WeekPageData,

  onLoad(options: Record<string, string | undefined>) {
    const today = formatLocalDate(new Date());
    const weekStart =
      typeof options.weekStart === 'string' && options.weekStart.length > 0
        ? options.weekStart
        : getWeekStartDate(today);
    this.setData({
      today,
      weekLabel: getWeekLabel(weekStart),
      weekStart,
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
        await this.loadWeek();
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

  async loadWeek(): Promise<void> {
    const groupId = this.data.selectedGroupId;
    const weekStart = this.data.weekStart;
    if (groupId.length === 0 || weekStart.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const group = this.data.groups.find((item) => item.id === groupId);
      const dates = getWeekDays(weekStart);
      const months = [...new Set(dates.map((date) => date.slice(0, 7)))];
      const results = await Promise.all(
        months.map((businessMonth) =>
          group?.role === 'guest'
            ? getLoggedInGuestCalendar(groupId, businessMonth)
            : getCalendar(groupId, businessMonth),
        ),
      );
      const calendars = results.map((result) => ('calendar' in result ? result.calendar : result));
      const assignments = calendars.flatMap((calendar) => [...calendar.assignments]);
      const members = dedupeMembers(calendars.flatMap((calendar) => [...calendar.members]));
      const byDate = groupAssignmentsByDate(assignments);
      const days: WeekDayEntry[] = dates.map((businessDate) => ({
        assignments: byDate.get(businessDate) ?? [],
        businessDate,
        dayLabel: `${businessDate.slice(5, 7)}/${businessDate.slice(8, 10)}`,
        isToday: businessDate === this.data.today,
        isWeekend: isWeekend(businessDate),
        weekdayLabel: getWeekdayLabel(businessDate),
      }));
      this.setData({
        days,
        members,
        membersMap: toMembersMap(members),
        weekLabel: getWeekLabel(weekStart),
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

  changeWeek(event: WechatMiniprogram.TouchEvent): void {
    if (this.data.loading) {
      return;
    }
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (!Number.isInteger(delta)) {
      return;
    }
    const weekStart = addDays(this.data.weekStart, delta * 7);
    this.setData({ weekStart, weekLabel: getWeekLabel(weekStart) });
    void this.loadWeek();
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    this.setData({ selectedGroupId: groupId });
    setSelectedGroupId(groupId);
    void this.loadWeek();
  },

  openMonth(): void {
    wx.switchTab({ url: '/pages/calendar/calendar' });
  },

  openList(): void {
    if (this.data.selectedGroupId.length === 0) {
      return;
    }
    wx.redirectTo({
      url: `/pages/calendar-list/calendar-list?groupId=${this.data.selectedGroupId}&businessMonth=${this.data.weekStart.slice(0, 7)}`,
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

function dedupeMembers(members: readonly CalendarDutyMember[]): readonly CalendarDutyMember[] {
  const byId = new Map(members.map((member) => [member.membershipId, member]));
  return [...byId.values()];
}
