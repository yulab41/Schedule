import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import {
  getNurseDutyState,
  nurseShiftCode,
  nurseShiftOrder,
  type DutyStateView,
} from './nurse-duty-state.js';
import {
  buildDayList,
  buildMonthDisplayGrid,
  filterCalendarAssignments,
  getBusinessMonthOf,
  getCurrentBusinessDate,
  getWeekDays,
  getWeekLabel,
  getWeekOfMonthLabel,
  getWeekdayLabel,
  isWeekend,
  truncateCalendarBadgeLabel,
  type CalendarAssignmentLike,
} from '@schedule/presentation-core';

import {
  getAdjacentCalendarPeriodSlot,
  mapCalendarPeriodRing,
  type CalendarPeriodSlot,
} from '../../components/calendar/calendar-period-pager.js';

export type WorkbenchRelativePanel = -1 | 0 | 1;
export type MonthSlot = CalendarPeriodSlot;
export interface WorkbenchFilters {
  readonly membershipIds: readonly string[];
  readonly onlyChanges: boolean;
  readonly roleIds: readonly string[];
  readonly shiftTypeIds: readonly string[];
}

export interface WorkbenchCell {
  readonly extraPersonCount: number;
  readonly shiftAbbreviation: string;
  readonly shiftBadgeStyle: string;
  readonly ariaLabel: string;
  readonly businessDate: string;
  readonly day: string;
  readonly holiday: string;
  readonly isBottomLeft: boolean;
  readonly isBottomRight: boolean;
  readonly isBottomRow: boolean;
  readonly isCurrentMonth: boolean;
  readonly isHoliday: boolean;
  readonly isWorkday: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly marker: string;
  readonly person: string;
}

export interface WorkbenchPanel {
  readonly rowHeight?: number;
  readonly cells: readonly WorkbenchCell[];
  readonly key: string;
  readonly relative: WorkbenchRelativePanel;
  readonly slot: MonthSlot;
}

export interface WorkbenchDetail extends DutyStateView {
  readonly key: string;
  readonly rows: readonly WorkbenchDetailRow[];
  readonly shiftAbbreviation: string;
  readonly shiftColor: string;
  readonly shiftName: string;
  readonly shiftTextColor: string;
  readonly shiftTint: string;
  readonly timeRange: string;
}

export interface WorkbenchDetailRow {
  readonly key: string;
  readonly membershipId: string;
  readonly markerDetails: readonly WorkbenchMarkerDetail[];
  readonly name: string;
  readonly phoneOptions: readonly WorkbenchPhoneOption[];
  readonly role: string;
  readonly status: 'changed' | 'pending' | 'scheduled';
  readonly statusLabel: string;
}

export interface WorkbenchMarkerDetail {
  readonly badge: string;
  readonly key: string;
  readonly label: string;
}

export interface WorkbenchPhoneOption {
  readonly label: '手机' | '短号';
  readonly number: string;
}

export interface WorkbenchDuty extends DutyStateView {
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
  readonly shiftGroups: readonly WorkbenchWeekShiftGroup[];
  readonly businessDate: string;
  readonly day: string;
  readonly duties: readonly WorkbenchDuty[];
  readonly holiday: string;
  readonly isHoliday: boolean;
  readonly isWorkday: boolean;
  readonly isPast: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly weekday: string;
}

export interface WorkbenchWeekPanel {
  readonly height: number;
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
  readonly isWorkday: boolean;
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
  readonly nextDutyBoundary: number;
  readonly listPanels: readonly WorkbenchListPanel[];
  readonly monthLabel: string;
  readonly monthPanels: readonly WorkbenchPanel[];
  readonly selectedDetails: readonly WorkbenchDetail[];
  readonly selectedLabel: string;
  readonly weekPanels: readonly WorkbenchWeekPanel[];
}

export function mergeCalendarShiftTypes(
  activeCalendar: Pick<CalendarReadModel, 'shiftTypes'>,
  calendars: readonly Pick<CalendarReadModel, 'shiftTypes'>[],
): CalendarReadModel['shiftTypes'] {
  const merged = new Map(activeCalendar.shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
  for (const calendar of calendars) {
    for (const shiftType of calendar.shiftTypes) {
      if (!merged.has(shiftType.id)) merged.set(shiftType.id, shiftType);
    }
  }
  return [...merged.values()];
}

export interface WorkbenchWeekShiftGroup {
  readonly textColor: string;
  readonly key: string;
  readonly abbreviation: string;
  readonly color: string;
  readonly tint: string;
  readonly duties: readonly WorkbenchDuty[];
}
export interface WorkbenchDisplayOptions {
  readonly monthPreferencePending?: boolean;
  readonly nursePreset?: boolean;
  readonly effectiveMonthShiftTypeId?: string | null;
  readonly now?: Date;
}

export interface MonthRing {
  readonly monthPanelHeights: readonly number[];
  readonly monthPanels: readonly WorkbenchPanel[];
}

export const emptyWorkbenchFilters: WorkbenchFilters = {
  membershipIds: [],
  onlyChanges: false,
  roleIds: [],
  shiftTypeIds: [],
};

export const getAdjacentMonthSlot = getAdjacentCalendarPeriodSlot;

export function createMonthRing(
  logicalPanels: readonly WorkbenchPanel[],
  logicalHeights: readonly number[],
  activeSlot: MonthSlot,
): MonthRing {
  const panelByRelative = new Map(logicalPanels.map((panel) => [panel.relative, panel]));
  const heightByRelative = new Map(
    logicalPanels.map((panel, index) => [panel.relative, logicalHeights[index]]),
  );
  const previousPanel = panelByRelative.get(-1);
  const currentPanel = panelByRelative.get(0);
  const nextPanel = panelByRelative.get(1);
  const previousHeight = heightByRelative.get(-1);
  const currentHeight = heightByRelative.get(0);
  const nextHeight = heightByRelative.get(1);
  if (
    previousPanel === undefined ||
    currentPanel === undefined ||
    nextPanel === undefined ||
    previousHeight === undefined ||
    currentHeight === undefined ||
    nextHeight === undefined
  ) {
    return {
      monthPanelHeights: logicalHeights,
      monthPanels: logicalPanels.map((panel, slot) => ({ ...panel, slot: slot as MonthSlot })),
    };
  }
  const monthPanels = mapCalendarPeriodRing(logicalPanels, activeSlot);
  const monthPanelHeights = monthPanels.map(
    (panel) => heightByRelative.get(panel.relative) ?? currentHeight,
  );
  return { monthPanelHeights, monthPanels };
}

const detailMarkerBadges: Readonly<Record<string, string>> = {
  'leave-cover': '替',
  overtime: '加',
  swap: '换',
};

const detailMarkerLabels: Readonly<Record<string, string>> = {
  'leave-cover': '请假替班',
  overtime: '加班',
  swap: '换班',
};

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'] as const;

export function getTodayBusinessDate(now: Date = new Date()): string {
  return getCurrentBusinessDate(now);
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
  options: WorkbenchDisplayOptions = {},
): WorkbenchViewModel {
  const now = options.now ?? new Date();
  const order = new Map(calendar.shiftTypes.map((shift, index) => [shift.id, index]));
  const rank = (assignment: CalendarReadModel['assignments'][number]): number => {
    const code =
      nurseShiftCode(assignment.shiftTypeName) ?? nurseShiftCode(assignment.shiftTypeAbbreviation);
    const nurseIndex = code === undefined ? -1 : nurseShiftOrder.indexOf(code);
    return options.nursePreset && nurseIndex >= 0
      ? nurseIndex
      : 6 + (order.get(assignment.shiftTypeId) ?? order.size);
  };
  const holidayByDate = new Map(holidays.dates.map((holiday) => [holiday.date, holiday]));
  const filtered = filterCalendarAssignments(calendar.assignments, {
    membershipIds: filters.membershipIds,
    onlyChanges: filters.onlyChanges,
    roleIds: filters.roleIds,
    shiftTypeIds: filters.shiftTypeIds,
  });
  const assignments = options.nursePreset
    ? [...filtered].sort((a, b) => rank(a) - rank(b) || a.slotPosition - b.slotPosition)
    : filtered;
  const duty = (assignment: CalendarReadModel['assignments'][number]) =>
    createDuty(assignment, memberById, options.nursePreset === true, now);
  const monthLabel = formatMonthLabel(businessMonth);
  const memberById = new Map(calendar.members.map((member) => [member.membershipId, member]));
  const allDayShiftTypeIds = new Set(
    calendar.shiftTypes.filter((shiftType) => shiftType.isAllDay).map((shiftType) => shiftType.id),
  );
  const monthPanels = ([-1, 0, 1] as const).map((relative) => {
    const panelMonth = addMonth(businessMonth, relative);
    return {
      cells: createMonthCells(
        panelMonth,
        options.monthPreferencePending
          ? []
          : [...assignments].sort((a, b) => rank(a) - rank(b) || a.slotPosition - b.slotPosition),
        holidayByDate,
        relative === 0 ? selectedDate : '',
        today,
        allDayShiftTypeIds,
        options.effectiveMonthShiftTypeId,
      ),
      key: panelMonth,
      relative,
      slot: (relative + 1) as MonthSlot,
    } satisfies WorkbenchPanel;
  });
  const weekPanels = ([-1, 0, 1] as const).map((relative) => {
    const panelWeekStart = addWeek(weekStart, relative);
    const weekDates = getWeekDays(panelWeekStart);
    const days = weekDates.map((businessDate) => {
      const dayAssignments = assignments.filter(
        (assignment) => assignment.businessDate === businessDate,
      );
      const holiday = holidayByDate.get(businessDate);
      return {
        businessDate,
        day: businessDate.slice(8),
        duties: dayAssignments.map(duty),
        shiftGroups: createWeekShiftGroups(dayAssignments, duty),
        holiday: holiday?.isOffDay === true ? holiday.holidayName.slice(0, 2) : '',
        isHoliday: holiday?.isOffDay === true,
        isWorkday: holiday?.isWorkday === true,
        isPast: businessDate < today,
        isSelected: relative === 0 && businessDate === selectedDate,
        isToday: businessDate === today,
        isWeekend: isWeekend(businessDate),
        weekday: getWeekdayLabel(businessDate).slice(1),
      } satisfies WorkbenchWeekDay;
    });
    return {
      days,
      height: Math.max(
        112,
        ...days.map(
          (day) =>
            30 +
            day.shiftGroups.reduce(
              (sum, group) =>
                sum +
                28 +
                group.duties.reduce(
                  (size, row) =>
                    size +
                    Math.max(1, Math.ceil(Array.from(row.name).length / 3)) * 16 +
                    (row.markers.length > 0 ? 16 : 0),
                  0,
                ),
              0,
            ),
        ),
      ),
      key: panelWeekStart,
      rangeLabel: getWeekLabel(panelWeekStart),
      relative,
      weekOrdinalLabel: getWeekOfMonthLabel(panelWeekStart),
    } satisfies WorkbenchWeekPanel;
  });
  const selectedDetails = createSelectedDetails(
    assignments.filter((assignment) => assignment.businessDate === selectedDate),
    memberById,
    options.nursePreset
      ? [...new Set(assignments.map((a) => a.shiftTypeId))]
      : calendar.shiftTypes.map((shiftType) => shiftType.id),
    options.nursePreset === true,
    now,
  );
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
          duties: (options.nursePreset
            ? [...entry.assignments].sort(
                (a, b) => rank(a) - rank(b) || a.slotPosition - b.slotPosition,
              )
            : entry.assignments
          ).map(duty),
          dutyCountLabel: `${entry.assignments.length} 班`,
          holiday: holiday?.isOffDay === true ? holiday.holidayName : '',
          isHoliday: holiday?.isOffDay === true,
          isWorkday: holiday?.isWorkday === true,
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
    nextDutyBoundary: assignments.reduce((next, assignment) => {
      const boundary = getNurseDutyState(
        assignment,
        options.nursePreset === true,
        now,
      ).nextBoundary;
      return boundary > 0 && (next === 0 || boundary < next) ? boundary : next;
    }, 0),
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
  nursePreset: boolean,
  now: Date,
): WorkbenchDuty {
  const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId ?? '';
  const member = memberById.get(membershipId);
  return {
    ...getNurseDutyState(assignment, nursePreset, now),
    details: `${assignment.shiftTypeName} · ${formatClock(assignment.startsAt)}–${formatClock(assignment.endsAt)} · ${assignment.scheduleRoleName}`,
    key: assignment.id,
    markers: createMarkerList(assignment.changeMarkers),
    name: getAssignmentName(assignment),
    phone: member?.mobilePhone ?? member?.shortPhone ?? '',
    shiftAbbreviation: truncateCalendarBadgeLabel(assignment.shiftTypeAbbreviation),
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
  allDayShiftTypeIds: ReadonlySet<string>,
  preferredShiftTypeId?: string | null,
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
    const firstAssignment = preferredShiftTypeId
      ? (dayAssignments.find((assignment) => assignment.shiftTypeId === preferredShiftTypeId) ??
        dayAssignments[0])
      : dayAssignments[0];
    const marker = firstAssignment === undefined ? '' : createMarker(firstAssignment.changeMarkers);
    const count =
      firstAssignment === undefined
        ? 0
        : dayAssignments.filter(
            (assignment) => assignment.shiftTypeId === firstAssignment.shiftTypeId,
          ).length;
    const person = firstAssignment === undefined ? '' : getAssignmentName(firstAssignment);
    const state = [holiday?.holidayName ?? '', person, marker].filter(Boolean).join('，');
    return {
      extraPersonCount: Math.max(0, count - 1),
      shiftAbbreviation:
        firstAssignment === undefined || allDayShiftTypeIds.has(firstAssignment.shiftTypeId)
          ? ''
          : firstAssignment.shiftTypeAbbreviation,
      shiftBadgeStyle:
        firstAssignment === undefined || allDayShiftTypeIds.has(firstAssignment.shiftTypeId)
          ? ''
          : `color:${firstAssignment.shiftTypeTextColor};background:${firstAssignment.shiftTypeColor}`,
      ariaLabel: state.length > 0 ? `${cell.businessDate}，${state}` : cell.businessDate,
      businessDate: cell.businessDate,
      day: cell.businessDate.slice(8),
      holiday: holiday?.isOffDay === true ? holiday.holidayName.slice(0, 2) : '',
      isBottomLeft: index === grid.length - 7,
      isBottomRight: index === grid.length - 1,
      isBottomRow: index >= grid.length - 7,
      isCurrentMonth: !cell.isOutsideMonth,
      isHoliday: holiday?.isOffDay === true,
      isWorkday: holiday?.isWorkday === true,
      isSelected: !cell.isOutsideMonth && cell.businessDate === selectedDate,
      isToday: cell.businessDate === today,
      isWeekend: isWeekend(cell.businessDate),
      marker,
      person,
    } satisfies WorkbenchCell;
  });
}

function createSelectedDetails(
  assignments: readonly CalendarReadModel['assignments'][number][],
  memberById: ReadonlyMap<string, CalendarReadModel['members'][number]>,
  shiftTypeOrder: readonly string[],
  nursePreset: boolean,
  now: Date,
): readonly WorkbenchDetail[] {
  const grouped = new Map<string, CalendarReadModel['assignments'][number][]>();
  for (const assignment of assignments) {
    const current = grouped.get(assignment.shiftTypeId);
    if (current === undefined) grouped.set(assignment.shiftTypeId, [assignment]);
    else current.push(assignment);
  }
  const orderByShiftTypeId = new Map(
    shiftTypeOrder.map((shiftTypeId, index) => [shiftTypeId, index] as const),
  );
  return [...grouped.entries()]
    .flatMap(([shiftTypeId, rows]) => {
      const first = rows[0];
      if (first === undefined) return [];
      return [
        {
          ...getNurseDutyState(first, nursePreset, now),
          key: shiftTypeId,
          rows: rows.map((assignment) => createDetailRow(assignment, memberById)),
          shiftAbbreviation: first.shiftTypeAbbreviation,
          shiftColor: first.shiftTypeColor,
          shiftName: first.shiftTypeName,
          shiftTextColor: first.shiftTypeTextColor,
          shiftTint: createColorTint(first.shiftTypeColor),
          timeRange: `${formatClock(first.startsAt)}–${formatClock(first.endsAt)}`,
        } satisfies WorkbenchDetail,
      ];
    })
    .sort((left, right) => {
      const timeComparison = left.timeRange.localeCompare(right.timeRange);
      if (!nursePreset && timeComparison !== 0) return timeComparison;
      return (
        (orderByShiftTypeId.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
        (orderByShiftTypeId.get(right.key) ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

function createWeekShiftGroups(
  assignments: readonly CalendarReadModel['assignments'][number][],
  create: (assignment: CalendarReadModel['assignments'][number]) => WorkbenchDuty,
): readonly WorkbenchWeekShiftGroup[] {
  const groups = new Map<string, CalendarReadModel['assignments'][number][]>();
  for (const assignment of assignments) {
    const rows = groups.get(assignment.shiftTypeId) ?? [];
    rows.push(assignment);
    groups.set(assignment.shiftTypeId, rows);
  }
  return [...groups.entries()].map(([key, rows]) => ({
    key,
    abbreviation: rows[0]!.shiftTypeAbbreviation,
    color: rows[0]!.shiftTypeColor,
    textColor: rows[0]!.shiftTypeTextColor,
    tint: createColorTint(rows[0]!.shiftTypeColor),
    duties: rows.map(create),
  }));
}

function createDetailRow(
  assignment: CalendarReadModel['assignments'][number],
  memberById: ReadonlyMap<string, CalendarReadModel['members'][number]>,
): WorkbenchDetailRow {
  const membershipId = assignment.actualMembershipId ?? assignment.plannedMembershipId;
  const member = membershipId === undefined ? undefined : memberById.get(membershipId);
  const status = getDetailStatus(assignment, membershipId);
  return {
    key: assignment.id,
    markerDetails: assignment.changeMarkers.map((marker) => ({
      badge: detailMarkerBadges[marker] ?? marker,
      key: marker,
      label: detailMarkerLabels[marker] ?? marker,
    })),
    membershipId: membershipId ?? '',
    name: assignment.actualMemberName ?? assignment.plannedMemberName ?? '待安排',
    phoneOptions: createPhoneOptions(member),
    role: assignment.scheduleRoleName,
    status,
    statusLabel: status === 'changed' ? '有变更' : status === 'pending' ? '待安排' : '已排班',
  };
}

function createPhoneOptions(
  member: CalendarReadModel['members'][number] | undefined,
): readonly WorkbenchPhoneOption[] {
  if (member === undefined) return [];
  const options: WorkbenchPhoneOption[] = [];
  if (member.shortPhone !== undefined && /^\+?\d[\d ()-]*$/u.test(member.shortPhone)) {
    options.push({ label: '短号', number: member.shortPhone });
  }
  if (member.mobilePhone !== undefined && /^\+?\d[\d ()-]*$/u.test(member.mobilePhone)) {
    options.push({ label: '手机', number: member.mobilePhone });
  }
  return options;
}

function getDetailStatus(
  assignment: CalendarReadModel['assignments'][number],
  membershipId: string | undefined,
): WorkbenchDetailRow['status'] {
  if (
    membershipId === undefined &&
    assignment.actualMemberName === undefined &&
    assignment.plannedMemberName === undefined
  ) {
    return 'pending';
  }
  if (
    assignment.changeMarkers.length > 0 ||
    (assignment.actualMembershipId !== undefined &&
      assignment.actualMembershipId !== assignment.plannedMembershipId)
  ) {
    return 'changed';
  }
  return 'scheduled';
}

function createColorTint(color: string): string {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.094)`;
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

function getAssignmentName(assignment: CalendarAssignmentLike): string {
  return assignment.actualMemberName ?? assignment.plannedMemberName ?? '待分配';
}

function formatClock(value: string): string {
  const shifted = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

export function formatDateLabel(businessDate: string): string {
  return `${Number(businessDate.slice(5, 7))}月${Number(businessDate.slice(8, 10))}日 周${weekdayLabels[(new Date(`${businessDate}T00:00:00Z`).getUTCDay() + 6) % 7]}`;
}

export function formatMonthLabel(businessMonth: string): string {
  return `${Number(businessMonth.slice(0, 4))} 年 ${Number(businessMonth.slice(5, 7))} 月`;
}

function addMonth(businessMonth: string, offset: number): string {
  const year = Number(businessMonth.slice(0, 4));
  const month = Number(businessMonth.slice(5, 7)) - 1 + offset;
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
