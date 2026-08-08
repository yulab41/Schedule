import type { CalendarDutyAssignment, CalendarDutyMember, GroupSummary } from '@schedule/contracts';

import { getCalendar, getLoggedInGuestCalendar, listGroups } from '../../api/endpoints.js';
import { getWeekDays, getWeekLabel, groupAssignmentsByDate } from '../../utils/calendar-views.js';
import {
  buildDutyDetail,
  buildShiftCardViews,
  formatWeekdayLine,
} from '../../utils/calendar-grid-builder.js';
import { getChinaStandardTimeBusinessDate } from '../../utils/china-time.js';

interface WeekDayView {
  readonly assignments: ReturnType<typeof buildShiftCardViews>;
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly label: string;
}

interface CalendarWeekPageData {
  readonly days: readonly WeekDayView[];
  readonly dutyDetail: ReturnType<typeof buildDutyDetail> | undefined;
  readonly errorMessage: string;
  readonly loading: boolean;
  readonly members: readonly CalendarDutyMember[];
  readonly rawByDay: readonly (readonly CalendarDutyAssignment[])[];
  readonly showDetail: boolean;
  readonly weekLabel: string;
}

Page({
  data: {
    days: [],
    dutyDetail: undefined,
    errorMessage: '',
    loading: false,
    members: [],
    rawByDay: [],
    showDetail: false,
    weekLabel: '',
  } as CalendarWeekPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId ?? '';
    const weekStart = options.weekStart ?? '';
    if (groupId.length > 0 && weekStart.length > 0) {
      this.setData({ weekLabel: getWeekLabel(weekStart) });
      void this.loadWeek(groupId, weekStart);
    }
  },

  async loadWeek(groupId: string, weekStart: string): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = groups.find((group: GroupSummary) => group.id === groupId);
      const days = getWeekDays(weekStart);
      const months = [...new Set(days.map((day) => day.slice(0, 7)))];
      const calendars = await Promise.all(
        months.map((month) =>
          selected?.role === 'guest'
            ? getLoggedInGuestCalendar(groupId, month)
            : getCalendar(groupId, month),
        ),
      );
      const assignments = calendars.flatMap(
        (result) => ('calendar' in result ? result.calendar : result).assignments,
      );
      const members = calendars.flatMap(
        (result) => ('calendar' in result ? result.calendar : result).members,
      );
      const byDate = groupAssignmentsByDate(assignments);
      const todayDate = getChinaStandardTimeBusinessDate(new Date());
      const rawByDay = days.map((businessDate) => byDate.get(businessDate) ?? []);
      const dayViews = days.map((businessDate) => ({
        assignments: buildShiftCardViews(byDate.get(businessDate) ?? []),
        businessDate,
        isToday: businessDate === todayDate,
        label: formatWeekdayLine(businessDate),
      }));
      this.setData({ days: dayViews, members, rawByDay });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '周视图加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleAssignmentTap(event: WechatMiniprogram.CustomEvent) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    const dayIndex = Number(event.currentTarget.dataset.day ?? -1);
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
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
