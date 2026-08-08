import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
} from '@schedule/contracts';

const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const businessMonthPattern = /^\d{4}-\d{2}$/u;

export interface DutyPhoneOption {
  readonly label: string;
  readonly number: string;
}

export interface DutyDetail {
  readonly markers: readonly string[];
  readonly memberName: string;
  readonly phoneOptions: readonly DutyPhoneOption[];
  readonly scheduleRoleName: string;
  readonly shiftTime: string;
  readonly shiftTypeName: string;
}

export interface DayListEntry {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly weekdayLabel: string;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function splitBusinessMonth(businessMonth: string): {
  readonly businessMonth: string;
  readonly month: number;
  readonly year: number;
} {
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  return {
    businessMonth,
    month: Number(monthText),
    year: Number(yearText),
  };
}

export function shiftBusinessMonth(businessMonth: string, delta: number): string {
  if (!businessMonthPattern.test(businessMonth) || !Number.isInteger(delta)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const absoluteMonth = Number(yearText) * 12 + (Number(monthText) - 1) + delta;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function formatMonthLabel(businessMonth: string): string {
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  return `${Number(yearText)}年${Number(monthText)}月`;
}

export function formatTime(value: string): string {
  return value.length >= 16 ? value.slice(11, 16) : value;
}

export function formatShiftTimeRange(assignment: CalendarDutyAssignment): string {
  return `${formatTime(assignment.startsAt)}–${formatTime(assignment.endsAt)}`;
}

export function getDutyMembershipId(assignment: CalendarDutyAssignment): string | undefined {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

export function getDutyMemberName(assignment: CalendarDutyAssignment): string {
  return assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定';
}

export function getWeekdayLabel(businessDate: string): string {
  const { day, month, year } = parseBusinessDate(businessDate);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return `周${['一', '二', '三', '四', '五', '六', '日'][weekday] ?? ''}`;
}

export function isWeekend(businessDate: string): boolean {
  const { day, month, year } = parseBusinessDate(businessDate);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return weekday === 5 || weekday === 6;
}

export function getWeekStartDate(businessDate: string): string {
  const { day, month, year } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return formatUtcDate(date);
}

export function getWeekDays(weekStart: string): readonly string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function addDays(businessDate: string, delta: number): string {
  const { day, month, year } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return formatUtcDate(date);
}

export function getWeekLabel(weekStart: string): string {
  const days = getWeekDays(weekStart);
  const start = parseBusinessDate(days[0] ?? weekStart);
  const end = parseBusinessDate(days[6] ?? weekStart);
  return `${start.year}年${start.month}月${start.day}日 – ${end.month}月${end.day}日`;
}

export function getCalendarMarkerLabel(marker: CalendarChangeMarker): string {
  switch (marker) {
    case 'swap':
      return '换';
    case 'leave-cover':
      return '替';
    case 'overtime':
      return '加';
  }
}

export function getCalendarMarkerDescription(marker: CalendarChangeMarker): string {
  switch (marker) {
    case 'swap':
      return '换班';
    case 'leave-cover':
      return '请假替班';
    case 'overtime':
      return '加班';
  }
}

export function groupAssignmentsByDate(
  assignments: readonly CalendarDutyAssignment[],
): ReadonlyMap<string, readonly CalendarDutyAssignment[]> {
  const byDate = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of assignments) {
    const list = byDate.get(assignment.businessDate) ?? [];
    list.push(assignment);
    byDate.set(assignment.businessDate, list);
  }
  for (const list of byDate.values()) {
    list.sort(
      (first, second) =>
        getShiftStartOrder(first) - getShiftStartOrder(second) ||
        first.scheduleRoleName.localeCompare(second.scheduleRoleName, 'zh-Hans-CN') ||
        first.slotPosition - second.slotPosition ||
        first.schedulePeriodId.localeCompare(second.schedulePeriodId),
    );
  }
  return byDate;
}

export function buildDayList(
  assignments: readonly CalendarDutyAssignment[],
  today: string,
): readonly DayListEntry[] {
  const byDate = groupAssignmentsByDate(assignments);
  return [...byDate.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([businessDate, dayAssignments]) => ({
      assignments: dayAssignments,
      businessDate,
      isToday: businessDate === today,
      weekdayLabel: getWeekdayLabel(businessDate),
    }));
}

export function buildDutyDetail(
  assignment: CalendarDutyAssignment,
  members: readonly CalendarDutyMember[],
): DutyDetail {
  const membershipId = getDutyMembershipId(assignment);
  const member = members.find((item) => item.membershipId === membershipId);
  return {
    markers: assignment.changeMarkers.map(getCalendarMarkerDescription),
    memberName: getDutyMemberName(assignment),
    phoneOptions: getConfirmedPhoneOptions(member),
    scheduleRoleName: assignment.scheduleRoleName,
    shiftTime: formatShiftTimeRange(assignment),
    shiftTypeName: assignment.shiftTypeName,
  };
}

export function getConfirmedPhoneOptions(
  member: CalendarDutyMember | undefined,
): readonly DutyPhoneOption[] {
  if (member === undefined || !member.isConfirmed) {
    return [];
  }
  const options: DutyPhoneOption[] = [];
  if (member.mobilePhone !== undefined && member.mobilePhone.length > 0) {
    options.push({ label: '长号', number: member.mobilePhone });
  }
  if (member.shortPhone !== undefined && member.shortPhone.length > 0) {
    options.push({ label: '短号', number: member.shortPhone });
  }
  return options;
}

export function toMembersMap(
  members: readonly CalendarDutyMember[],
): Record<string, CalendarDutyMember> {
  const map: Record<string, CalendarDutyMember> = {};
  for (const member of members) {
    map[member.membershipId] = member;
  }
  return map;
}

function getShiftStartOrder(assignment: CalendarDutyAssignment): number {
  const [hours = '0', minutes = '0'] = formatTime(assignment.startsAt).split(':');
  const shiftedMinutes = Number(hours) * 60 + Number(minutes);
  // 00:00（跨日凌晨班）按当日最后排序，使 A/P/N 按时间顺序显示。
  return shiftedMinutes === 0 ? 24 * 60 : shiftedMinutes;
}

function parseBusinessDate(value: string): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
} {
  const match = businessDatePattern.exec(value);
  if (match === null) {
    throw new Error('The business date must use the YYYY-MM-DD format.');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('The business date is not a real calendar date.');
  }
  return { day, month, year };
}

function formatUtcDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
