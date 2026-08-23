import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import {
  buildDayList,
  buildMonthDisplayGrid,
  filterCalendarAssignments,
  getBusinessMonthOf,
  getWeekDays,
  getWeekLabel,
  getWeekOfMonthLabel,
  getWeekdayLabel,
  isWeekend,
  type CalendarAssignmentLike,
} from '@schedule/presentation-core';

export type WorkbenchRelativePanel = -1 | 0 | 1;
export interface WorkbenchFilters {
  readonly membershipIds: readonly string[];
  readonly onlyChanges: boolean;
  readonly roleIds: readonly string[];
  readonly shiftTypeIds: readonly string[];
}

export interface WorkbenchCell {
  readonly ariaLabel: string;
  readonly businessDate: string;
  readonly day: string;
  readonly holiday: string;
  readonly isBottomLeft: boolean;
  readonly isBottomRight: boolean;
  readonly isBottomRow: boolean;
  readonly isCurrentMonth: boolean;
  readonly isHoliday: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly marker: string;
  readonly person: string;
}

export interface WorkbenchPanel {
  readonly cells: readonly WorkbenchCell[];
  readonly key: string;
  readonly relative: WorkbenchRelativePanel;
}

export interface WorkbenchDetail {
  readonly changeLabel: string;
  readonly color: string;
  readonly name: string;
  readonly note: string;
  readonly textColor: string;
  readonly title: string;
}

export interface WorkbenchDuty {
  readonly details: string;
  readonly key: string;
  readonly markers: readonly string[];
  readonly name: string;
  readonly phone: string;
  readonly shiftAbbreviation: string;
  readonly shiftColor: string;
  readonly shiftTextColor: string;
}

export interface WorkbenchWeekDay {
  readonly businessDate: string;
  readonly day: string;
  readonly duties: readonly WorkbenchDuty[];
  readonly holiday: string;
  readonly isHoliday: boolean;
  readonly isPast: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly weekday: string;
}

export interface WorkbenchWeekPanel {
  readonly days: readonly WorkbenchWeekDay[];
  readonly key: string;
  readonly rangeLabel: string;
  readonly relative: WorkbenchRelativePanel;
  readonly weekOrdinalLabel: string;
}

export interface WorkbenchListDay {
  readonly businessDate: string;
  readonly dateLabel: string;
  readonly duties: readonly WorkbenchDuty[];
  readonly dutyCountLabel: string;
  readonly holiday: string;
  readonly isHoliday: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly weekday: string;
}

export interface WorkbenchListPanel {
  readonly days: readonly WorkbenchListDay[];
  readonly dutyCount: number;
  readonly key: string;
  readonly monthLabel: string;
  readonly relative: WorkbenchRelativePanel;
}

export interface WorkbenchViewModel {
  readonly listPanels: readonly WorkbenchListPanel[];
  readonly monthLabel: string;
  readonly monthPanels: readonly WorkbenchPanel[];
  readonly selectedDetails: readonly WorkbenchDetail[];
  readonly selectedLabel: string;
  readonly weekPanels: readonly WorkbenchWeekPanel[];
}

export const emptyWorkbenchFilters: WorkbenchFilters = {
  membershipIds: [],
  onlyChanges: false,
  roleIds: [],
  shiftTypeIds: [],
};

const markerLabels: Readonly<Record<string, string>> = {
  'leave-cover': '请假补位',
  overtime: '加班',
  swap: '换班',
};

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'] as const;

export function getTodayBusinessDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function getHorizontalSwipeDelta(
  deltaX: number,
  deltaY: number,
  threshold = 36,
): -1 | 0 | 1 {
  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    Math.abs(deltaX) < threshold ||
    Math.abs(deltaX) <= Math.abs(deltaY)
  ) {
    return 0;
  }
  return deltaX < 0 ? 1 : -1;
}

export function sanitizeCalendarForCache(calendar: CalendarReadModel): CalendarReadModel {
  return {
    ...calendar,
    members: calendar.members.map((member) => {
      const sanitized = { ...member };
      delete sanitized.mobilePhone;
      return sanitized;
    }),
  };
}

export function createWorkbenchViewModel(
  calendar: CalendarReadModel,
  holidays: HolidayReadModel,
  selectedDate: string,
  businessMonth: string,
  weekStart: string,
  filters: WorkbenchFilters = emptyWorkbenchFilters,
  today = getTodayBusinessDate(),
): WorkbenchViewModel {
  const holidayByDate = new Map(holidays.dates.map((holiday) => [holiday.date, holiday]));
  const assignments = filterCalendarAssignments(calendar.assignments, {
    membershipIds: filters.membershipIds,
    onlyChanges: filters.onlyChanges,
    roleIds: filters.roleIds,
    shiftTypeIds: filters.shiftTypeIds,
  });
  const monthLabel = formatMonthLabel(businessMonth);
  const memberById = new Map(calendar.members.map((member) => [member.membershipId, member]));
  const monthPanels = ([-1, 0, 1] as const).map((relative) => {
    const panelMonth = addMonth(businessMonth, relative);
    return {
      cells: createMonthCells(
        panelMonth,
        assignments,
        holidayByDate,
        relative === 0 ? selectedDate : '',
        today,
      ),
      key: panelMonth,
      relative,
    } satisfies WorkbenchPanel;
  });
  const weekPanels = ([-1, 0, 1] as const).map((relative) => {
    const panelWeekStart = addWeek(weekStart, relative);
    const weekDates = getWeekDays(panelWeekStart);
    return {
      days: weekDates.map((businessDate) => {
        const dayAssignments = assignments.filter(
          (assignment) => assignment.businessDate === businessDate,
        );
        const holiday = holidayByDate.get(businessDate);
        return {
          businessDate,
          day: businessDate.slice(8),
          duties: dayAssignments.map((assignment) => createDuty(assignment, memberById)),
          holiday: holiday?.isOffDay === true ? holiday.holidayName.slice(0, 2) : '',
          isHoliday: holiday?.isOffDay === true,
          isPast: businessDate < today,
          isSelected: relative === 0 && businessDate === selectedDate,
          isToday: businessDate === today,
          isWeekend: isWeekend(businessDate),
          weekday: getWeekdayLabel(businessDate).slice(1),
        } satisfies WorkbenchWeekDay;
      }),
      key: panelWeekStart,
      rangeLabel: getWeekLabel(panelWeekStart),
      relative,
      weekOrdinalLabel: getWeekOfMonthLabel(panelWeekStart),
    } satisfies WorkbenchWeekPanel;
  });
  const memberConfirmed = new Map(
    calendar.members.map((member) => [member.membershipId, member.isConfirmed]),
  );
  const selectedDetails = assignments
    .filter((assignment) => assignment.businessDate === selectedDate)
    .map((assignment) => createDetail(assignment, memberConfirmed));
  const listPanels = ([-1, 0, 1] as const).map((relative) => {
    const panelMonth = addMonth(businessMonth, relative);
    const dayList = buildDayList(assignments, today).filter(
      (entry) => getBusinessMonthOf(entry.businessDate) === panelMonth,
    );
    return {
      days: dayList.map((entry) => {
        const holiday = holidayByDate.get(entry.businessDate);
        return {
          businessDate: entry.businessDate,
          dateLabel: entry.businessDate.slice(5),
          duties: entry.assignments.map((assignment) => createDuty(assignment, memberById)),
          dutyCountLabel: `${entry.assignments.length} 班`,
          holiday: holiday?.isOffDay === true ? holiday.holidayName : '',
          isHoliday: holiday?.isOffDay === true,
          isToday: entry.businessDate === today,
          isWeekend: isWeekend(entry.businessDate),
          weekday: entry.weekdayLabel,
        } satisfies WorkbenchListDay;
      }),
      dutyCount: dayList.reduce((total, entry) => total + entry.assignments.length, 0),
      key: panelMonth,
      monthLabel: formatMonthLabel(panelMonth),
      relative,
    } satisfies WorkbenchListPanel;
  });

  return {
    listPanels,
    monthLabel,
    monthPanels,
    selectedDetails,
    selectedLabel: formatDateLabel(selectedDate),
    weekPanels,
  };
}

function createDuty(
  assignment: CalendarReadModel['assignments'][number],
  memberById: ReadonlyMap<string, CalendarReadModel['members'][number]>,
): WorkbenchDuty {
  const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId ?? '';
  const member = memberById.get(membershipId);
  return {
    details: `${assignment.shiftTypeName} · ${formatClock(assignment.startsAt)}–${formatClock(assignment.endsAt)} · ${assignment.scheduleRoleName}`,
    key: assignment.id,
    markers: createMarkerList(assignment.changeMarkers),
    name: getAssignmentName(assignment),
    phone: member?.mobilePhone ?? member?.shortPhone ?? '',
    shiftAbbreviation: assignment.shiftTypeAbbreviation,
    shiftColor: assignment.shiftTypeColor,
    shiftTextColor: assignment.shiftTypeTextColor,
  };
}

function addWeek(weekStart: string, offset: number): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset * 7);
  return date.toISOString().slice(0, 10);
}

function createMonthCells(
  businessMonth: string,
  assignments: readonly CalendarReadModel['assignments'][number][],
  holidayByDate: ReadonlyMap<string, HolidayReadModel['dates'][number]>,
  selectedDate: string,
  today: string,
): readonly WorkbenchCell[] {
  const assignmentsByDate = new Map<string, CalendarReadModel['assignments'][number][]>();
  for (const assignment of assignments) {
    const current = assignmentsByDate.get(assignment.businessDate) ?? [];
    current.push(assignment);
    assignmentsByDate.set(assignment.businessDate, current);
  }
  const grid = buildMonthDisplayGrid(businessMonth).flat();
  return grid.map((cell, index) => {
    const holiday = holidayByDate.get(cell.businessDate);
    const dayAssignments = assignmentsByDate.get(cell.businessDate) ?? [];
    const firstAssignment = dayAssignments[0];
    const marker = firstAssignment === undefined ? '' : createMarker(firstAssignment.changeMarkers);
    const person = firstAssignment === undefined ? '' : getAssignmentName(firstAssignment);
    const state = [holiday?.holidayName ?? '', person, marker].filter(Boolean).join('，');
    return {
      ariaLabel: state.length > 0 ? `${cell.businessDate}，${state}` : cell.businessDate,
      businessDate: cell.businessDate,
      day: cell.businessDate.slice(8),
      holiday: holiday?.isOffDay === true ? holiday.holidayName.slice(0, 2) : '',
      isBottomLeft: index === grid.length - 7,
      isBottomRight: index === grid.length - 1,
      isBottomRow: index >= grid.length - 7,
      isCurrentMonth: !cell.isOutsideMonth,
      isHoliday: holiday?.isOffDay === true,
      isSelected: !cell.isOutsideMonth && cell.businessDate === selectedDate,
      isToday: cell.businessDate === today,
      isWeekend: isWeekend(cell.businessDate),
      marker,
      person,
    } satisfies WorkbenchCell;
  });
}

function createDetail(
  assignment: CalendarReadModel['assignments'][number],
  memberConfirmed: ReadonlyMap<string, boolean>,
): WorkbenchDetail {
  return {
    changeLabel: createChangeLabel(assignment.changeMarkers),
    color: assignment.shiftTypeColor,
    name: getAssignmentName(assignment),
    note: createAssignmentNote(assignment, memberConfirmed),
    textColor: assignment.shiftTypeTextColor,
    title: `${assignment.shiftTypeName} · ${getAssignmentName(assignment)}`,
  };
}

function createAssignmentNote(
  assignment: CalendarReadModel['assignments'][number],
  memberConfirmed: ReadonlyMap<string, boolean>,
): string {
  const status = memberConfirmed.get(
    assignment.actualMembershipId ?? assignment.plannedMembershipId ?? '',
  )
    ? '已确认'
    : '待确认';
  const changeLabel = createChangeLabel(assignment.changeMarkers);
  return `${formatClock(assignment.startsAt)}–${formatClock(assignment.endsAt)} · ${changeLabel || status}`;
}

function createMarker(markers: readonly string[]): string {
  if (markers.includes('swap')) return '换';
  if (markers.includes('leave-cover')) return '补';
  if (markers.includes('overtime')) return '加';
  return '';
}

function createMarkerList(markers: readonly string[]): readonly string[] {
  return markers.map((marker) => {
    if (marker === 'swap') return '换';
    if (marker === 'leave-cover') return '补';
    if (marker === 'overtime') return '加';
    return marker;
  });
}

function createChangeLabel(markers: readonly string[]): string {
  return markers.map((marker) => markerLabels[marker] ?? marker).join(' · ');
}

function getAssignmentName(assignment: CalendarAssignmentLike): string {
  return assignment.actualMemberName ?? assignment.plannedMemberName ?? '待认领';
}

function formatClock(value: string): string {
  const shifted = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

function formatDateLabel(businessDate: string): string {
  return `${Number(businessDate.slice(5, 7))}月${Number(businessDate.slice(8, 10))}日 · 周${weekdayLabels[(new Date(`${businessDate}T00:00:00Z`).getUTCDay() + 6) % 7]}`;
}

function formatMonthLabel(businessMonth: string): string {
  return `${Number(businessMonth.slice(0, 4))} 年 ${Number(businessMonth.slice(5, 7))} 月`;
}

function addMonth(businessMonth: string, offset: number): string {
  const year = Number(businessMonth.slice(0, 4));
  const month = Number(businessMonth.slice(5, 7)) - 1 + offset;
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
