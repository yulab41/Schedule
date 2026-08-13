import { parseBusinessDate, sortCalendarAssignments } from './calendar-logic.js';
import type { CalendarGridWeek } from './calendar-logic.js';
import type { CalendarDutyAssignment } from './types.js';

export interface DayListEntry {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly weekdayLabel: string;
}

function formatDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getWeekStartDate(businessDate: string): string {
  const { year, month, day } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return formatDate(date);
}

export function getWeekDays(businessDate: string): readonly string[] {
  const start = new Date(`${getWeekStartDate(businessDate)}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return formatDate(date);
  });
}

export function addWeeks(businessDate: string, delta: number): string {
  if (!Number.isInteger(delta)) {
    throw new Error('Week delta must be an integer.');
  }
  const { year, month, day } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta * 7);
  return formatDate(date);
}

export function getBusinessMonthOf(businessDate: string): string {
  parseBusinessDate(businessDate);
  return businessDate.slice(0, 7);
}

export function getBusinessMonthsForWeek(
  weekStart: string,
): readonly [string] | readonly [string, string] {
  const days = getWeekDays(weekStart);
  const firstMonth = getBusinessMonthOf(days[0]!);
  const lastMonth = getBusinessMonthOf(days[days.length - 1]!);
  return firstMonth === lastMonth ? [firstMonth] : [firstMonth, lastMonth];
}

export function getWeekLabel(businessDate: string): string {
  const days = getWeekDays(businessDate);
  const start = parseBusinessDate(days[0]!);
  const end = parseBusinessDate(days[days.length - 1]!);
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

export function getWeekdayLabel(businessDate: string): string {
  const { year, month, day } = parseBusinessDate(businessDate);
  return `周${['一', '二', '三', '四', '五', '六', '日'][(new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7]}`;
}

export function isWeekend(businessDate: string): boolean {
  const { year, month, day } = parseBusinessDate(businessDate);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return weekday >= 5;
}

export function buildDayList(
  assignments: readonly CalendarDutyAssignment[],
  today: string,
): readonly DayListEntry[] {
  const byDate = new Map<string, CalendarDutyAssignment[]>();
  for (const assignment of assignments) {
    const entries = byDate.get(assignment.businessDate) ?? [];
    entries.push(assignment);
    byDate.set(assignment.businessDate, entries);
  }
  return [...byDate.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([businessDate, values]) => ({
      assignments: sortCalendarAssignments(values),
      businessDate,
      isToday: businessDate === today,
      weekdayLabel: getWeekdayLabel(businessDate),
    }));
}

export function formatChinaDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Date-time must be valid.');
  }
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${formatDate(shifted)} ${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
    shifted.getUTCMinutes(),
  ).padStart(2, '0')}`;
}
