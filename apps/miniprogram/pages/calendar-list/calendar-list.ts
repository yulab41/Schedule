import type { CalendarDutyAssignment, CalendarDutyMember, GroupSummary } from '@schedule/contracts';

import { getCalendar, getLoggedInGuestCalendar, listGroups } from '../../api/endpoints.js';
import { buildDayList } from '../../utils/calendar-views.js';
import { buildDutyDetail, buildShiftCardViews } from '../../utils/calendar-grid-builder.js';
import { getChinaStandardTimeBusinessDate } from '../../utils/china-time.js';

interface DayView {
  readonly assignments: ReturnType<typeof buildShiftCardViews>;
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly label: string;
}

interface CalendarListPageData {
  readonly dates: readonly string[];
  readonly days: readonly DayView[];
  readonly dutyDetail: ReturnType<typeof buildDutyDetail> | undefined;
  readonly errorMessage: string;
  readonly members: readonly CalendarDutyMember[];
  readonly rawByDay: readonly (readonly CalendarDutyAssignment[])[];
  readonly selectedDate: string;
  readonly showDetail: boolean;
}

Page({
  data: {
    dates: [],
    days: [],
    dutyDetail: undefined,
    errorMessage: '',
    members: [],
    rawByDay: [],
    selectedDate: '',
    showDetail: false,
  } as CalendarListPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId ?? '';
    const businessMonth = options.businessMonth ?? '';
    if (groupId.length > 0 && businessMonth.length > 0) {
      const dates = buildMonthDates(businessMonth);
      const today = getChinaStandardTimeBusinessDate(new Date());
      this.setData({
        dates,
        selectedDate: dates.includes(today) ? today : (dates[0] ?? ''),
      });
      void this.loadList(groupId, businessMonth);
    }
  },

  async loadList(groupId: string, businessMonth: string): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const groups = await listGroups();
      const selected = groups.find((group: GroupSummary) => group.id === groupId);
      const result =
        selected?.role === 'guest'
          ? await getLoggedInGuestCalendar(groupId, businessMonth)
          : await getCalendar(groupId, businessMonth);
      const calendar = 'calendar' in result ? result.calendar : result;
      const today = getChinaStandardTimeBusinessDate(new Date());
      const days = buildDayList(calendar.assignments, today).map((day) => ({
        assignments: buildShiftCardViews(day.assignments),
        businessDate: day.businessDate,
        isToday: day.isToday,
        label: `${day.weekdayLabel} ${day.businessDate.slice(5)}`,
      }));
      const rawByDay = buildDayList(calendar.assignments, today).map(
        (day) => day.assignments as readonly CalendarDutyAssignment[],
      );
      this.setData({ days, members: calendar.members, rawByDay });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '列表加载失败。') });
    }
  },

  handleAssignmentTap(event: WechatMiniprogram.TouchEvent) {
    const dayIndex = Number(event.currentTarget.dataset.day ?? -1);
    const index = Number(event.currentTarget.dataset.index ?? -1);
    const view = this.data.days[dayIndex]?.assignments[index];
    if (view === undefined) {
      return;
    }
    const raw = this.data.rawByDay[dayIndex]?.[index];
    if (raw !== undefined) {
      this.setData({
        dutyDetail: buildDutyDetail(raw, this.data.members),
        showDetail: true,
      });
    }
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

  handleDateChange(event: WechatMiniprogram.CustomEvent) {
    const date = event.detail.date;
    if (typeof date !== 'string' || date.length === 0) {
      return;
    }
    this.setData({ selectedDate: date });
    // 平滑滚动到对应日期卡片；低版本基础库不支持 selector 时降级为不滚动
    wx.pageScrollTo({
      duration: 280,
      selector: `#day-${date}`,
    });
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

function buildMonthDates(businessMonth: string): readonly string[] {
  const year = Number(businessMonth.slice(0, 4));
  const month = Number(businessMonth.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: daysInMonth },
    (_, index) => `${businessMonth}-${String(index + 1).padStart(2, '0')}`,
  );
}
