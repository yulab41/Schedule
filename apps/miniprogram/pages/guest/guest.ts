import type { CalendarReadModel, GuestCalendarReadModel } from '@schedule/contracts';

import { getGuestCalendar, getGuestHolidays, resolveGuestGroup } from '../../api/endpoints.js';
import {
  addBusinessMonths,
  buildMonthGrid,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
  type CalendarGridWeek,
} from '../../utils/calendar-logic.js';
import { groupAssignmentsByDate } from '../../utils/calendar-views.js';
import {
  buildCalendarWeeks,
  buildDutyDetail,
  buildHolidayMap,
  type CalendarGridWeekView,
} from '../../utils/calendar-grid-builder.js';
import { getChinaStandardTimeBusinessDate } from '../../utils/china-time.js';

interface GuestPageData {
  readonly assignmentsByDate: Map<string, readonly unknown[]>;
  readonly businessMonth: string;
  readonly dutyDetail: ReturnType<typeof buildDutyDetail> | undefined;
  readonly errorMessage: string;
  readonly groupName: string;
  readonly members: readonly {
    readonly isConfirmed: boolean;
    readonly membershipId: string;
    readonly mobilePhone?: string;
    readonly realName: string;
    readonly shortPhone?: string;
  }[];
  readonly monthLabel: string;
  readonly showDetail: boolean;
  readonly today: string;
  readonly visitorKey: string;
  readonly weeks: readonly CalendarGridWeekView[];
}

Page({
  data: {
    assignmentsByDate: new Map(),
    businessMonth: '',
    dutyDetail: undefined,
    errorMessage: '',
    groupName: '',
    members: [],
    monthLabel: '',
    showDetail: false,
    today: '',
    visitorKey: '',
    weeks: [],
  } as GuestPageData,

  onLoad(options: Record<string, string | undefined>) {
    const scene = options.scene ?? '';
    const visitorKey = extractVisitorKey(scene);
    if (visitorKey.length === 0) {
      this.setData({ errorMessage: '二维码参数无效，请重新扫码。' });
      return;
    }
    const today = getChinaStandardTimeBusinessDate(new Date());
    const businessMonth = getCurrentBusinessMonth(new Date());
    this.setData({
      businessMonth,
      monthLabel: getBusinessMonthLabel(businessMonth),
      today,
      visitorKey,
    });
    void this.loadGuest(visitorKey, businessMonth);
  },

  async loadGuest(visitorKey: string, businessMonth: string): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const resolved = await resolveGuestGroup(visitorKey);
      const [calendarResult, holidays] = await Promise.all([
        getGuestCalendar(resolved.groupId, visitorKey, businessMonth),
        getGuestHolidays(Number(businessMonth.slice(0, 4))),
      ]);
      const calendar: CalendarReadModel =
        (calendarResult as GuestCalendarReadModel).calendar ?? calendarResult;
      const year = Number(businessMonth.slice(0, 4));
      const month = Number(businessMonth.slice(5, 7));
      const monthGrid = buildMonthGrid(year, month) as readonly CalendarGridWeek[];
      const assignmentsByDate = groupAssignmentsByDate(calendar.assignments);
      this.setData({
        assignmentsByDate: assignmentsByDate as unknown as Map<string, readonly unknown[]>,
        groupName: resolved.groupName,
        members: calendar.members,
        weeks: buildCalendarWeeks(
          monthGrid,
          assignmentsByDate,
          buildHolidayMap(holidays.dates),
          this.data.today,
        ),
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '访客排班加载失败，请重新扫码。') });
    }
  },

  changeMonth(event: WechatMiniprogram.TouchEvent) {
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    const businessMonth = addBusinessMonths(this.data.businessMonth, delta);
    this.setData({ businessMonth, monthLabel: getBusinessMonthLabel(businessMonth) });
    if (this.data.visitorKey.length > 0) {
      void this.loadGuest(this.data.visitorKey, businessMonth);
    }
  },

  handleCellTap(event: WechatMiniprogram.CustomEvent) {
    const businessDate = event.detail.businessDate;
    const assignments = this.data.assignmentsByDate.get(businessDate) ?? [];
    const first = assignments[0] as
      | {
          readonly id: string;
          readonly changeMarkers: readonly string[];
          readonly endsAt: string;
          readonly plannedMemberName?: string;
          readonly actualMemberName?: string;
          readonly plannedMembershipId?: string;
          readonly actualMembershipId?: string;
          readonly schedulePeriodId: string;
          readonly scheduleRoleId: string;
          readonly scheduleRoleName: string;
          readonly shiftTypeAbbreviation: string;
          readonly shiftTypeColor: string;
          readonly shiftTypeId: string;
          readonly shiftTypeName: string;
          readonly shiftTypeTextColor: string;
          readonly slotPosition: number;
          readonly startsAt: string;
        }
      | undefined;
    if (first === undefined) {
      return;
    }
    this.setData({
      dutyDetail: buildDutyDetail(first as never, this.data.members),
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
});

function extractVisitorKey(scene: string): string {
  const decoded = decodeURIComponent(scene);
  const vMatch = /(?:^|&)v=([0-9a-f]{32})/iu.exec(decoded);
  if (vMatch !== null) {
    return vMatch[1]!.toLowerCase();
  }
  const plain = /^[0-9a-f]{32}$/iu.exec(decoded.trim());
  return plain === null ? '' : plain[0]!.toLowerCase();
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
