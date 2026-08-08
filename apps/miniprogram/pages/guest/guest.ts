import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  GuestCalendarReadModel,
} from '@schedule/contracts';

import { getGuestCalendar, resolveGuestGroup } from '../../api/endpoints.js';

interface GuestDutyDetail {
  readonly memberName: string;
  readonly phoneLabel: string;
  readonly scheduleRoleName: string;
  readonly shiftTime: string;
  readonly shiftTypeName: string;
}

interface GuestPageData {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessMonth: string;
  readonly dutyDetail: GuestDutyDetail | undefined;
  readonly errorMessage: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly loading: boolean;
  readonly members: readonly CalendarDutyMember[];
  readonly month: number;
  readonly monthLabel: string;
  readonly showDetail: boolean;
  readonly today: string;
  readonly visitorKey: string;
  readonly year: number;
}

Page({
  data: {
    assignments: [],
    businessMonth: '',
    dutyDetail: undefined,
    errorMessage: '',
    groupId: '',
    groupName: '',
    loading: false,
    members: [],
    month: 0,
    monthLabel: '',
    showDetail: false,
    today: '',
    visitorKey: '',
    year: 0,
  } as GuestPageData,

  onLoad(options: Record<string, string | undefined>) {
    const scene = options.scene;
    const visitorKey = parseVisitorKey(scene);
    if (visitorKey === undefined) {
      this.setData({ errorMessage: '请扫描群组小程序码后查看排班日历。' });
      return;
    }
    const today = formatLocalDate(new Date());
    const { businessMonth, month, year } = splitBusinessMonth(today);
    this.setData({
      businessMonth,
      month,
      monthLabel: formatMonthLabel(businessMonth),
      today,
      visitorKey,
      year,
    });
    void this.loadCalendar();
  },

  async loadCalendar(): Promise<void> {
    if (this.data.visitorKey.length === 0 || this.data.businessMonth.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      let groupId = this.data.groupId;
      if (groupId.length === 0) {
        const resolved = await resolveGuestGroup(this.data.visitorKey);
        groupId = resolved.groupId;
        this.setData({ groupId, groupName: resolved.groupName });
      }
      const result = await getGuestCalendar(groupId, this.data.visitorKey, this.data.businessMonth);
      this.applyCalendar(result);
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

  applyCalendar(result: GuestCalendarReadModel): void {
    const { businessMonth, month, year } = splitBusinessMonth(result.calendar.businessMonth);
    this.setData({
      assignments: result.calendar.assignments,
      businessMonth,
      groupName: result.groupName,
      members: result.calendar.members,
      month,
      monthLabel: formatMonthLabel(result.calendar.businessMonth),
      year,
    });
  },

  changeMonth(event: WechatMiniprogram.TouchEvent): void {
    if (this.data.loading) {
      return;
    }
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (!Number.isInteger(delta)) {
      return;
    }
    const { businessMonth, month, year } = shiftBusinessMonth(this.data.businessMonth, delta);
    this.setData({
      businessMonth,
      month,
      monthLabel: formatMonthLabel(businessMonth),
      year,
    });
    void this.loadCalendar();
  },

  handleDutyTap(event: WechatMiniprogram.TouchEvent) {
    const assignmentId = event.detail.assignmentId;
    if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
      return;
    }
    const assignment = this.data.assignments.find((item) => item.id === assignmentId);
    if (assignment === undefined) {
      return;
    }
    const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId;
    const member = this.data.members.find((item) => item.membershipId === membershipId);
    const memberName = assignment.actualMemberName ?? assignment.plannedMemberName ?? '';
    const phoneLabel = buildPhoneLabel(member);
    this.setData({
      dutyDetail: {
        memberName,
        phoneLabel,
        scheduleRoleName: assignment.scheduleRoleName,
        shiftTime: `${formatTime(assignment.startsAt)}–${formatTime(assignment.endsAt)}`,
        shiftTypeName: assignment.shiftTypeName,
      },
      showDetail: true,
    });
  },

  closeDetail(): void {
    this.setData({ showDetail: false });
  },

  noop(): void {
    // Intentionally empty: stops tap propagation from the modal body.
  },
});

function parseVisitorKey(scene: string | undefined): string | undefined {
  if (scene === undefined || scene.length === 0) {
    return undefined;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(scene);
  } catch {
    decoded = scene;
  }
  const raw = decoded.startsWith('v=') ? decoded.slice(2) : decoded;
  return /^[0-9a-f]{32}$/iu.test(raw) ? raw : undefined;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function splitBusinessMonth(businessMonth: string): {
  readonly businessMonth: string;
  readonly month: number;
  readonly year: number;
} {
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return {
    businessMonth,
    month,
    year,
  };
}

function shiftBusinessMonth(
  businessMonth: string,
  delta: number,
): {
  readonly businessMonth: string;
  readonly month: number;
  readonly year: number;
} {
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const absoluteMonth = Number(yearText) * 12 + (Number(monthText) - 1) + delta;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  return {
    businessMonth: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
    month,
    year,
  };
}

function formatMonthLabel(businessMonth: string): string {
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  return `${Number(yearText)}年${Number(monthText)}月`;
}

function formatTime(value: string): string {
  return value.length >= 16 ? value.slice(11, 16) : value;
}

function buildPhoneLabel(member: CalendarDutyMember | undefined): string {
  if (member === undefined || !member.isConfirmed) {
    return '联系方式未确认';
  }
  const numbers: string[] = [];
  if (member.mobilePhone !== undefined && member.mobilePhone.length > 0) {
    numbers.push(`长号 ${member.mobilePhone}`);
  }
  if (member.shortPhone !== undefined && member.shortPhone.length > 0) {
    numbers.push(`短号 ${member.shortPhone}`);
  }
  return numbers.length > 0 ? numbers.join('，') : '联系方式未确认';
}
