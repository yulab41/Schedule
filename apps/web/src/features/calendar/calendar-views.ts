import type { CalendarDutyAssignment, ConfirmedHolidayDate } from '@schedule/contracts';
import {
  formatChinaStandardTime,
  getChinaStandardTimeBusinessDate,
} from '@schedule/scheduling-domain';
import { breakpointTokens } from '@schedule/ui-tokens';

import { addBusinessMonths, type CalendarGridWeek } from './calendar-logic.js';

export type CalendarViewMode = 'list' | 'month' | 'week';

export type PointerPreference = 'coarse' | 'fine';

export interface DefaultSelectedDateInput {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessMonth: string;
  readonly today: string;
}

export interface SwipeDelta {
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface SwipeRelease extends SwipeDelta {
  readonly elapsedMs: number;
  readonly viewportWidth: number;
}

export interface SwipeSettleInput {
  readonly deltaX: number;
  readonly direction: SwipeMonthIntent;
  readonly elapsedMs: number;
  readonly reducedMotion: boolean;
  readonly viewportWidth: number;
}

export type SwipeMonthIntent = -1 | 0 | 1;

const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

export interface DayListEntry {
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly weekdayLabel: string;
}

export function getBusinessDate(date: Date = new Date()): string {
  return getChinaStandardTimeBusinessDate(date);
}

export function getBusinessMonthOf(businessDate: string): string {
  return parseBusinessDate(businessDate).yearMonth;
}

export function getDefaultSelectedDate({
  assignments,
  businessMonth,
  today,
}: DefaultSelectedDateInput): string {
  parseBusinessDate(`${businessMonth}-01`);
  if (getBusinessMonthOf(today) === businessMonth) {
    return today;
  }

  const firstScheduledDate = assignments
    .map((assignment) => assignment.businessDate)
    .filter((businessDate) => businessDate.startsWith(`${businessMonth}-`))
    .sort((first, second) => first.localeCompare(second))[0];

  return firstScheduledDate ?? `${businessMonth}-01`;
}

export function retargetSelectedDateToMonth(
  selectedDate: string,
  targetBusinessMonth: string,
): string {
  const { day } = parseBusinessDate(selectedDate);
  const { month, year } = parseBusinessDate(`${targetBusinessMonth}-01`);
  const targetDay = Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${targetBusinessMonth}-${String(targetDay).padStart(2, '0')}`;
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

function addBusinessDays(businessDate: string, delta: number): string {
  const { day, month, year } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return formatUtcDate(date);
}

export function getMultiDayHolidayDates(
  holidays: ReadonlyMap<string, ConfirmedHolidayDate>,
): ReadonlySet<string> {
  const dates = [...holidays.entries()]
    .filter(([, holiday]) => holiday.isOffDay)
    .sort(([first], [second]) => first.localeCompare(second));
  const multiDayDates = new Set<string>();
  let run: [string, ConfirmedHolidayDate][] = [];

  function commitRun(): void {
    if (run.length > 1) {
      for (const [businessDate] of run) multiDayDates.add(businessDate);
    }
  }

  for (const entry of dates) {
    const previous = run.at(-1);
    if (
      previous !== undefined &&
      previous[1].holidayName === entry[1].holidayName &&
      addBusinessDays(previous[0], 1) === entry[0]
    ) {
      run.push(entry);
    } else {
      commitRun();
      run = [entry];
    }
  }
  commitRun();

  return multiDayDates;
}

export function getSwipeMonthIntent({ deltaX, deltaY }: SwipeDelta): SwipeMonthIntent {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  if (horizontalDistance < 56 || horizontalDistance < verticalDistance * 1.2) {
    return 0;
  }

  return deltaX < 0 ? 1 : -1;
}

export function getCalendarPanelMonths(businessMonth: string): readonly string[] {
  return [addBusinessMonths(businessMonth, -1), businessMonth, addBusinessMonths(businessMonth, 1)];
}

export function getCalendarPanelWeeks(weekStart: string): readonly string[] {
  const currentWeek = getWeekStartDate(weekStart);
  return [addWeeks(currentWeek, -1), currentWeek, addWeeks(currentWeek, 1)];
}

export function getSwipeNavigationIntent({
  deltaX,
  deltaY,
  elapsedMs,
  viewportWidth,
}: SwipeRelease): SwipeMonthIntent {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  if (horizontalDistance < 18 || horizontalDistance < verticalDistance * 1.15) {
    return 0;
  }

  const distanceThreshold = Math.min(88, Math.max(56, viewportWidth * 0.2));
  const velocity = horizontalDistance / Math.max(elapsedMs, 16);
  const isFlick = horizontalDistance >= 20 && velocity >= 0.55;
  if (horizontalDistance < distanceThreshold && !isFlick) {
    return 0;
  }

  return deltaX < 0 ? 1 : -1;
}

export function getSwipeSettleDuration({
  deltaX,
  direction,
  elapsedMs,
  reducedMotion,
  viewportWidth,
}: SwipeSettleInput): number {
  if (reducedMotion) {
    return 0;
  }

  const distance = Math.min(Math.abs(deltaX), viewportWidth);
  const velocity = distance / Math.max(elapsedMs, 16);
  if (direction === 0) {
    return Math.round(Math.min(380, Math.max(280, 300 + distance * 0.25 - velocity * 60)));
  }

  const remainingDistance = Math.max(0, viewportWidth - distance);
  return Math.round(
    Math.min(380, Math.max(180, remainingDistance / Math.max(1.2, velocity * 1.5))),
  );
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

export function getWeekBusinessMonths(businessDate: string): readonly string[] {
  return [...new Set(getWeekDays(businessDate).map((date) => getBusinessMonthOf(date)))];
}

function getWeekOrdinalForMonth(weekStart: string, year: number, month: number): number {
  const firstWeekStart = getWeekStartDate(`${year}-${String(month).padStart(2, '0')}-01`);
  const startTime = Date.parse(`${weekStart}T00:00:00.000Z`);
  const firstStartTime = Date.parse(`${firstWeekStart}T00:00:00.000Z`);
  return Math.floor((startTime - firstStartTime) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function getWeekMonthPartLabel(weekStart: string, businessDate: string): string {
  const { month, year } = parseBusinessDate(businessDate);
  return `${month}月第${getWeekOrdinalForMonth(weekStart, year, month)}周`;
}

export function getWeekOfMonthLabel(businessDate: string): string {
  const weekStart = getWeekStartDate(businessDate);
  const days = getWeekDays(weekStart);
  const firstDay = days[0] ?? weekStart;
  const lastDay = days[6] ?? weekStart;
  const firstMonth = getBusinessMonthOf(firstDay);
  const lastMonth = getBusinessMonthOf(lastDay);
  const firstLabel = getWeekMonthPartLabel(weekStart, firstDay);
  return firstMonth === lastMonth
    ? firstLabel
    : `${firstLabel}-${getWeekMonthPartLabel(weekStart, lastDay)}`;
}

export function truncateCalendarBadgeLabel(value: string): string {
  return Array.from(value.trim()).slice(0, 2).join('');
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

export function isWeekend(businessDate: string): boolean {
  const { day, month, year } = parseBusinessDate(businessDate);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return weekday === 5 || weekday === 6;
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
  const [hours = '0', minutes = '0'] = formatChinaStandardTime(value).split(':');
  return Number(hours) * 60 + Number(minutes);
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

export function getListDateScrollTop(input: {
  readonly currentScrollY: number;
  readonly elementTop: number;
  readonly stickyOffset: number;
  readonly viewportHeight: number;
}): number {
  const availableHeight = Math.max(0, input.viewportHeight - input.stickyOffset);
  return Math.max(
    0,
    input.currentScrollY + input.elementTop - input.stickyOffset - availableHeight / 3,
  );
}
