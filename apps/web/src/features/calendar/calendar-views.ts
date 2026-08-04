import type { CalendarDutyAssignment } from '@schedule/contracts';
import { breakpointTokens } from '@schedule/ui-tokens';

import type { CalendarGridWeek } from './calendar-logic.js';

export type CalendarViewMode = 'list' | 'month' | 'week';

export type PointerPreference = 'coarse' | 'fine';

const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;
const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

export interface DayListEntry {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly weekdayLabel: string;
}

export function getBusinessDate(date: Date = new Date()): string {
  return new Date(date.valueOf() + chinaStandardTimeOffsetMilliseconds).toISOString().slice(0, 10);
}

export function getBusinessMonthOf(businessDate: string): string {
  return parseBusinessDate(businessDate).yearMonth;
}

export function parseBusinessDate(value: string): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
  readonly yearMonth: string;
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

  return { day, month, year, yearMonth: `${match[1]}-${match[2]}` };
}

function formatUtcDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getWeekStartDate(businessDate: string): string {
  const { day, month, year } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return formatUtcDate(date);
}

export function getWeekDays(businessDate: string): readonly string[] {
  const weekStart = getWeekStartDate(businessDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return formatUtcDate(date);
  });
}

export function addWeeks(businessDate: string, delta: number): string {
  if (!Number.isInteger(delta)) {
    throw new Error('The week delta must be an integer.');
  }

  const { day, month, year } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta * 7);
  return formatUtcDate(date);
}

export function getWeekLabel(businessDate: string): string {
  const days = getWeekDays(businessDate);
  const start = parseBusinessDate(days[0] ?? businessDate);
  const end = parseBusinessDate(days[6] ?? businessDate);
  return `${start.year}年${start.month}月${start.day}日 – ${end.month}月${end.day}日`;
}

export function getVisibleWeekForMonth(businessMonth: string, today: string): string {
  const todayMonth = getBusinessMonthOf(today);
  return todayMonth === businessMonth
    ? getWeekStartDate(today)
    : getWeekStartDate(`${businessMonth}-01`);
}

export function getWeekIndexForToday(
  weeks: readonly CalendarGridWeek[],
  today: string,
): number | undefined {
  const index = weeks.findIndex((week) => week.some((cell) => cell?.businessDate === today));
  return index === -1 ? undefined : index;
}

export function getPreferredViewMode(): CalendarViewMode {
  return 'month';
}

export function getViewportTier(viewportWidth: number): 'desktop' | 'mobile' | 'tablet' {
  if (viewportWidth >= breakpointTokens.desktop) {
    return 'desktop';
  }
  return viewportWidth >= breakpointTokens.mobile ? 'tablet' : 'mobile';
}

export function getWeekdayLabel(businessDate: string): string {
  const { day, month, year } = parseBusinessDate(businessDate);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return `周${['一', '二', '三', '四', '五', '六', '日'][weekday]}`;
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

function getShiftStartOrder(assignment: CalendarDutyAssignment): number {
  const shiftedMinutes = minutesInChinaStandardTime(assignment.startsAt);
  // 00:00（跨日凌晨班，如 N 班）按当日最后排序，使 A/P/N 按时间顺序显示。
  return shiftedMinutes === 0 ? 24 * 60 : shiftedMinutes;
}

function minutesInChinaStandardTime(value: string): number {
  const total = Date.parse(value) + chinaStandardTimeOffsetMilliseconds;
  const dayStart = Math.floor(total / 86_400_000) * 86_400_000;
  return Math.floor((total - dayStart) / 60_000);
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
