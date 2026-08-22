const businessMonthPattern = /^\d{4}-\d{2}$/u;
const businessDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;

export interface CalendarAssignmentLike {
  readonly actualMemberName?: string | undefined;
  readonly actualMembershipId?: string | undefined;
  readonly businessDate: string;
  readonly changeMarkers: readonly unknown[];
  readonly plannedMemberName?: string | undefined;
  readonly plannedMembershipId?: string | undefined;
  readonly schedulePeriodId: string;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly shiftTypeId: string;
  readonly slotPosition: number;
  readonly startsAt: string;
}

export interface CalendarAssignmentFilters {
  readonly membershipIds?: readonly string[];
  readonly onlyChanges?: boolean;
  readonly roleIds?: readonly string[];
  readonly shiftTypeIds?: readonly string[];
}

export interface CalendarGridCell {
  readonly businessDate: string;
}

export type CalendarGridWeek = readonly (CalendarGridCell | null)[];

export type CalendarViewMode = 'list' | 'month' | 'week';

export interface DayListEntry<Assignment extends CalendarAssignmentLike> {
  readonly assignments: readonly Assignment[];
  readonly businessDate: string;
  readonly isToday: boolean;
  readonly weekdayLabel: string;
}

export interface DefaultSelectedDateInput<
  Assignment extends Pick<CalendarAssignmentLike, 'businessDate'>,
> {
  readonly assignments: readonly Assignment[];
  readonly businessMonth: string;
  readonly today: string;
}

export interface HolidayDateLike {
  readonly holidayName: string;
  readonly isOffDay: boolean;
}

export interface MonthDisplayCell {
  readonly businessDate: string;
  readonly isOutsideMonth: boolean;
}

export type MonthDisplayWeek = readonly MonthDisplayCell[];

export function addBusinessMonths(businessMonth: string, delta: number): string {
  if (!businessMonthPattern.test(businessMonth) || !Number.isInteger(delta)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }

  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const absoluteMonth = Number(yearText) * 12 + (Number(monthText) - 1) + delta;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function getBusinessMonthLabel(businessMonth: string): string {
  if (!businessMonthPattern.test(businessMonth)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }

  const [yearText = '', monthText = ''] = businessMonth.split('-');
  return `${Number(yearText)}年${Number(monthText)}月`;
}

export function isPastBusinessDate(businessDate: string, today: string): boolean {
  return businessDate < today;
}

export function getDutyMembershipId(
  assignment: Pick<CalendarAssignmentLike, 'actualMembershipId' | 'plannedMembershipId'>,
): string | undefined {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

export function getDutyMemberName(
  assignment: Pick<CalendarAssignmentLike, 'actualMemberName' | 'plannedMemberName'>,
): string | undefined {
  return assignment.actualMemberName ?? assignment.plannedMemberName;
}

export function filterCalendarAssignments<Assignment extends CalendarAssignmentLike>(
  assignments: readonly Assignment[],
  filters: CalendarAssignmentFilters,
): Assignment[] {
  const roleIds = new Set(filters.roleIds ?? []);
  const shiftTypeIds = new Set(filters.shiftTypeIds ?? []);
  const membershipIds = new Set(filters.membershipIds ?? []);

  return assignments.filter((assignment) => {
    if (filters.onlyChanges === true && assignment.changeMarkers.length === 0) return false;
    if (roleIds.size > 0 && !roleIds.has(assignment.scheduleRoleId)) return false;
    if (shiftTypeIds.size > 0 && !shiftTypeIds.has(assignment.shiftTypeId)) return false;
    if (membershipIds.size > 0) {
      const dutyMembershipId = getDutyMembershipId(assignment);
      if (dutyMembershipId === undefined || !membershipIds.has(dutyMembershipId)) return false;
    }
    return true;
  });
}

export function buildMonthDisplayGrid(businessMonth: string): readonly MonthDisplayWeek[] {
  if (!businessMonthPattern.test(businessMonth)) {
    throw new Error('The business month must use the YYYY-MM format.');
  }

  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('The calendar month must be a valid year and 1-12 month.');
  }

  const firstDay = Date.UTC(year, month - 1, 1);
  const mondayFirstOffset = (new Date(firstDay).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekCount = Math.ceil((mondayFirstOffset + daysInMonth) / 7);
  const gridStart = firstDay - mondayFirstOffset * 86_400_000;
  const cells = Array.from({ length: weekCount * 7 }, (_, index): MonthDisplayCell => {
    const businessDate = formatUtcBusinessDate(gridStart + index * 86_400_000);
    return {
      businessDate,
      isOutsideMonth: !businessDate.startsWith(`${businessMonth}-`),
    };
  });

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    cells.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
}

export function getBusinessMonthOf(businessDate: string): string {
  return parseBusinessDate(businessDate).yearMonth;
}

export function getDefaultSelectedDate<
  Assignment extends Pick<CalendarAssignmentLike, 'businessDate'>,
>({ assignments, businessMonth, today }: DefaultSelectedDateInput<Assignment>): string {
  parseBusinessDate(`${businessMonth}-01`);
  if (getBusinessMonthOf(today) === businessMonth) return today;

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
  if (match === null) throw new Error('The business date must use the YYYY-MM-DD format.');

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

export function getMultiDayHolidayDates<Holiday extends HolidayDateLike>(
  holidays: ReadonlyMap<string, Holiday>,
): ReadonlySet<string> {
  const dates = [...holidays.entries()]
    .filter(([, holiday]) => holiday.isOffDay)
    .sort(([first], [second]) => first.localeCompare(second));
  const multiDayDates = new Set<string>();
  let run: [string, Holiday][] = [];

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

export function getCalendarPanelMonths(businessMonth: string): readonly string[] {
  return [addBusinessMonths(businessMonth, -1), businessMonth, addBusinessMonths(businessMonth, 1)];
}

export function getCalendarPanelWeeks(weekStart: string): readonly string[] {
  const currentWeek = getWeekStartDate(weekStart);
  return [addWeeks(currentWeek, -1), currentWeek, addWeeks(currentWeek, 1)];
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
  if (!Number.isInteger(delta)) throw new Error('The week delta must be an integer.');
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
  return getBusinessMonthOf(today) === businessMonth
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

export function groupAssignmentsByDate<Assignment extends CalendarAssignmentLike>(
  assignments: readonly Assignment[],
): ReadonlyMap<string, readonly Assignment[]> {
  const byDate = new Map<string, Assignment[]>();
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

export function buildDayList<Assignment extends CalendarAssignmentLike>(
  assignments: readonly Assignment[],
  today: string,
): readonly DayListEntry<Assignment>[] {
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

function addBusinessDays(businessDate: string, delta: number): string {
  const { day, month, year } = parseBusinessDate(businessDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return formatUtcDate(date);
}

function formatUtcBusinessDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatUtcDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
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

function getShiftStartOrder(assignment: Pick<CalendarAssignmentLike, 'startsAt'>): number {
  const shiftedMinutes = minutesInChinaStandardTime(assignment.startsAt);
  // 跨日凌晨班的 00:00 放到业务日末尾，保持 Web 既有 A/P/N 展示顺序。
  return shiftedMinutes === 0 ? 24 * 60 : shiftedMinutes;
}

function minutesInChinaStandardTime(value: string): number {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) throw new Error('The timestamp must be valid.');
  const shifted = new Date(timestamp.valueOf() + chinaStandardTimeOffsetMilliseconds)
    .toISOString()
    .slice(11, 16);
  const [hours = '0', minutes = '0'] = shifted.split(':');
  return Number(hours) * 60 + Number(minutes);
}
