import {
  buildMonthGrid,
  filterCalendarAssignments,
  formatShiftTimeRange,
  getAvailablePhoneActions,
  getBusinessMonthLabel,
  getCalendarMarkerDescription,
  getCalendarMarkerLabel,
  getDutyMemberName,
  getDutyMembershipId,
  getHolidayShortLabel,
  isPastBusinessDate,
  parseBusinessDate,
  parseBusinessMonth,
  sortCalendarAssignments,
} from './calendar-logic.js';
import type { CalendarAssignmentFilters, PhoneAction } from './calendar-logic.js';
import { formatChinaDateTime } from './calendar-views.js';
import type {
  CalendarChangeMarker,
  CalendarReadModel,
  ConfirmedHolidayDate,
  HolidayReadModel,
} from './types.js';

export type CalendarDataStatus = 'cached' | 'ready' | 'refreshing';
export type CalendarStateStatus = 'conflict' | 'error' | 'forbidden' | 'loading';
export type CalendarHolidayTone = 'neutral' | 'off-day' | 'workday';

export interface CalendarMarkerViewModel {
  readonly action: 'open-assignment-details';
  readonly actionId: string;
  readonly assignmentId: string;
  readonly borderToken: 'color-danger' | 'color-primary' | 'color-warning';
  readonly description: string;
  readonly fillToken: 'color-danger-light' | 'color-primary-light' | 'color-warning-light';
  readonly foregroundToken: 'color-danger' | 'color-primary' | 'color-warning';
  readonly label: '加' | '换' | '替';
  readonly type: CalendarChangeMarker;
}

export interface CalendarPhoneActionViewModel extends PhoneAction {
  readonly actionId: string;
  readonly assignmentId: string;
}

export interface CalendarAssignmentViewModel {
  readonly actualMemberName?: string | undefined;
  readonly assignmentId: string;
  readonly backgroundColor: string;
  readonly borderToken: 'color-border-strong';
  readonly businessDate: string;
  readonly compactShiftLabel: string;
  readonly foregroundColor: string;
  readonly markers: readonly CalendarMarkerViewModel[];
  readonly memberName: string;
  readonly membershipId?: string | undefined;
  readonly phoneActions: readonly CalendarPhoneActionViewModel[];
  readonly plannedMemberName?: string | undefined;
  readonly routeActionId: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly schedulePeriodId: string;
  readonly shiftTypeAbbreviation: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly slotPosition: number;
  readonly timeRange: string;
}

export interface CalendarHolidayViewModel {
  readonly borderToken: 'color-border' | 'color-danger' | 'color-primary' | 'color-warning';
  readonly description: string;
  readonly fillToken:
    'color-danger-light' | 'color-primary-light' | 'color-surface' | 'color-warning-light';
  readonly foregroundToken: 'color-danger' | 'color-primary' | 'color-text-muted' | 'color-warning';
  readonly holidayName: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
  readonly label: string;
  readonly tone: CalendarHolidayTone;
}

export interface CalendarDayViewModel {
  readonly assignments: readonly CalendarAssignmentViewModel[];
  readonly businessDate: string;
  readonly dayNumber: number;
  readonly holiday?: CalendarHolidayViewModel | undefined;
  readonly id: string;
  readonly isEmpty: boolean;
  readonly isPast: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly kind: 'day';
  readonly routeActionId: string;
  readonly weekdayLabel: string;
}

export interface CalendarPaddingDayViewModel {
  readonly id: string;
  readonly kind: 'padding';
}

export type CalendarDayCellViewModel = CalendarDayViewModel | CalendarPaddingDayViewModel;

export interface CalendarWeekViewModel {
  readonly days: readonly CalendarDayCellViewModel[];
  readonly id: string;
}

export interface CalendarFilterOption {
  readonly id: string;
  readonly label: string;
}

export interface CalendarFilterViewModel {
  readonly members: readonly CalendarFilterOption[];
  readonly onlyChanges: boolean;
  readonly roles: readonly CalendarFilterOption[];
  readonly selectedMembershipIds: readonly string[];
  readonly selectedRoleIds: readonly string[];
  readonly selectedShiftTypeIds: readonly string[];
  readonly shiftTypes: readonly CalendarFilterOption[];
}

function appendUniqueFilterOptions(
  target: CalendarFilterOption[],
  seenIds: Set<string>,
  options: readonly CalendarFilterOption[],
): void {
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index]!;
    if (seenIds.has(option.id)) continue;
    seenIds.add(option.id);
    target.push(option);
  }
}

function appendUniqueSelectedIds(
  target: string[],
  seenIds: Set<string>,
  selectedIds: readonly string[],
): void {
  for (let index = 0; index < selectedIds.length; index += 1) {
    const id = selectedIds[index]!;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    target.push(id);
  }
}

export function mergeCalendarFilterViewModels(
  inputs: readonly CalendarFilterViewModel[],
): CalendarFilterViewModel {
  const members: CalendarFilterOption[] = [];
  const roles: CalendarFilterOption[] = [];
  const shiftTypes: CalendarFilterOption[] = [];
  const memberIds = new Set<string>();
  const roleIds = new Set<string>();
  const shiftTypeIds = new Set<string>();
  const selectedMembershipIds: string[] = [];
  const selectedRoleIds: string[] = [];
  const selectedShiftTypeIds: string[] = [];
  const seenSelectedMembershipIds = new Set<string>();
  const seenSelectedRoleIds = new Set<string>();
  const seenSelectedShiftTypeIds = new Set<string>();
  let onlyChanges = false;

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index]!;
    appendUniqueFilterOptions(members, memberIds, input.members);
    appendUniqueFilterOptions(roles, roleIds, input.roles);
    appendUniqueFilterOptions(shiftTypes, shiftTypeIds, input.shiftTypes);
    appendUniqueSelectedIds(
      selectedMembershipIds,
      seenSelectedMembershipIds,
      input.selectedMembershipIds,
    );
    appendUniqueSelectedIds(selectedRoleIds, seenSelectedRoleIds, input.selectedRoleIds);
    appendUniqueSelectedIds(
      selectedShiftTypeIds,
      seenSelectedShiftTypeIds,
      input.selectedShiftTypeIds,
    );
    if (input.onlyChanges) onlyChanges = true;
  }

  return {
    members,
    onlyChanges,
    roles,
    selectedMembershipIds,
    selectedRoleIds,
    selectedShiftTypeIds,
    shiftTypes,
  };
}

interface CalendarMonthBaseViewModel {
  readonly businessMonth: string;
  readonly monthLabel: string;
}

export interface CalendarMonthStateViewModel extends CalendarMonthBaseViewModel {
  readonly message: string;
  readonly status: CalendarStateStatus;
}

export interface CalendarMonthDataViewModel extends CalendarMonthBaseViewModel {
  readonly assignmentCount: number;
  readonly cacheSavedAt?: string | undefined;
  readonly filters: CalendarFilterViewModel;
  readonly isMonthEmpty: boolean;
  readonly isStale?: boolean | undefined;
  readonly status: CalendarDataStatus;
  readonly weekdayLabels: readonly ['一', '二', '三', '四', '五', '六', '日'];
  readonly weeks: readonly CalendarWeekViewModel[];
}

export type CalendarMonthViewModel = CalendarMonthDataViewModel | CalendarMonthStateViewModel;

export interface BuildCalendarMonthViewModelInput {
  readonly calendar: CalendarReadModel;
  readonly cacheSavedAt?: string | undefined;
  readonly filters: CalendarAssignmentFilters;
  readonly holidays: HolidayReadModel;
  readonly isStale?: boolean | undefined;
  readonly status: CalendarDataStatus;
  readonly today: string;
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'] as const;

const defaultStateMessages: Readonly<Record<CalendarStateStatus, string>> = {
  conflict: '排班数据已变化，请刷新',
  error: '加载排班失败，请重试',
  forbidden: '无权查看该群组排班',
  loading: '正在加载排班',
};

function getWeekdayIndex(businessDate: string): number {
  const { year, month, day } = parseBusinessDate(businessDate);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function mapMarker(
  assignmentId: string,
  marker: CalendarChangeMarker,
  markerIndex: number,
): CalendarMarkerViewModel {
  return {
    action: 'open-assignment-details',
    actionId: `${assignmentId}:marker:${marker}:${markerIndex}`,
    assignmentId,
    borderToken: 'color-warning',
    description: getCalendarMarkerDescription(marker),
    fillToken: 'color-warning-light',
    foregroundToken: 'color-warning',
    label: getCalendarMarkerLabel(marker),
    type: marker,
  };
}

function mapHoliday(value: ConfirmedHolidayDate): CalendarHolidayViewModel {
  const tone: CalendarHolidayTone = value.isOffDay
    ? 'off-day'
    : value.isWorkday
      ? 'workday'
      : 'neutral';
  const tokens =
    tone === 'off-day'
      ? {
          borderToken: 'color-danger' as const,
          fillToken: 'color-danger-light' as const,
          foregroundToken: 'color-danger' as const,
        }
      : tone === 'workday'
        ? {
            borderToken: 'color-primary' as const,
            fillToken: 'color-primary-light' as const,
            foregroundToken: 'color-primary' as const,
          }
        : {
            borderToken: 'color-border' as const,
            fillToken: 'color-surface' as const,
            foregroundToken: 'color-text-muted' as const,
          };
  return {
    ...tokens,
    description: value.holidayName,
    holidayName: value.holidayName,
    isOffDay: value.isOffDay,
    isWorkday: value.isWorkday,
    label: value.isWorkday ? '班' : getHolidayShortLabel(value.holidayName),
    tone,
  };
}

function toFilterOptions(
  values: readonly { readonly id: string; readonly name: string }[],
): readonly CalendarFilterOption[] {
  return values.map(({ id, name }) => ({ id, label: name }));
}

function copySelectedIds(selectedIds: readonly string[] | undefined): readonly string[] {
  const result: string[] = [];
  if (selectedIds === undefined) return result;
  for (let index = 0; index < selectedIds.length; index += 1) {
    result.push(selectedIds[index]!);
  }
  return result;
}

function getFilterViewModel(
  calendar: CalendarReadModel,
  filters: CalendarAssignmentFilters,
): CalendarFilterViewModel {
  const roles = toFilterOptions(calendar.roles);
  const shiftTypes = calendar.shiftTypes.map(({ abbreviation, id, name }) => ({
    id,
    label: `${name}（${abbreviation}）`,
  }));
  const members = calendar.members.map(({ membershipId, realName }) => ({
    id: membershipId,
    label: realName,
  }));
  return {
    members,
    onlyChanges: filters.onlyChanges === true,
    roles,
    selectedMembershipIds: copySelectedIds(filters.membershipIds),
    selectedRoleIds: copySelectedIds(filters.roleIds),
    selectedShiftTypeIds: copySelectedIds(filters.shiftTypeIds),
    shiftTypes,
  };
}

export function createCalendarMonthStateViewModel(
  businessMonth: string,
  status: CalendarStateStatus,
  message?: string,
): CalendarMonthStateViewModel {
  parseBusinessMonth(businessMonth);
  return {
    businessMonth,
    message: message !== undefined && message.length > 0 ? message : defaultStateMessages[status],
    monthLabel: getBusinessMonthLabel(businessMonth),
    status,
  };
}

export function buildCalendarMonthViewModel(
  input: BuildCalendarMonthViewModelInput,
): CalendarMonthDataViewModel {
  const parsedMonth = parseBusinessMonth(input.calendar.businessMonth);
  parseBusinessDate(input.today);
  if (input.holidays.year !== parsedMonth.year) {
    throw new Error('Holiday data must belong to the calendar year.');
  }
  for (const assignment of input.calendar.assignments) {
    if (!assignment.businessDate.startsWith(`${input.calendar.businessMonth}-`)) {
      throw new Error('Assignment dates must belong to the rendered business month.');
    }
    parseBusinessDate(assignment.businessDate);
  }
  for (const holiday of input.holidays.dates) {
    if (parseBusinessDate(holiday.date).year !== input.holidays.year) {
      throw new Error('Holiday dates must belong to the holiday year.');
    }
  }

  const assignmentsByDate = new Map<string, CalendarAssignmentViewModel[]>();
  const membersById = new Map(
    input.calendar.members.map((member) => [member.membershipId, member]),
  );
  const shiftTypesById = new Map(
    input.calendar.shiftTypes.map((shiftType) => [shiftType.id, shiftType]),
  );
  const holidaysByDate = new Map(
    input.holidays.dates.map((holiday) => [holiday.date, mapHoliday(holiday)]),
  );
  const filteredAssignments = sortCalendarAssignments(
    filterCalendarAssignments(input.calendar.assignments, input.filters),
  );

  for (const assignment of filteredAssignments) {
    const membershipId = getDutyMembershipId(assignment);
    const member = membershipId === undefined ? undefined : membersById.get(membershipId);
    const shiftType = shiftTypesById.get(assignment.shiftTypeId);
    const baseTimeRange = formatShiftTimeRange(assignment);
    const crossesBusinessDate =
      formatChinaDateTime(assignment.startsAt).slice(0, 10) !==
      formatChinaDateTime(assignment.endsAt).slice(0, 10);
    const timeRange = crossesBusinessDate ? baseTimeRange.replace('–', '–次日') : baseTimeRange;
    const mapped: CalendarAssignmentViewModel = {
      actualMemberName: assignment.actualMemberName,
      assignmentId: assignment.id,
      backgroundColor: assignment.shiftTypeColor,
      borderToken: 'color-border-strong',
      businessDate: assignment.businessDate,
      compactShiftLabel: Array.from(assignment.shiftTypeAbbreviation)[0] ?? '',
      foregroundColor: assignment.shiftTypeTextColor,
      markers: assignment.changeMarkers.map((marker, index) =>
        mapMarker(assignment.id, marker, index),
      ),
      memberName: getDutyMemberName(assignment) ?? '待定',
      membershipId,
      phoneActions: getAvailablePhoneActions(member).map((action) => ({
        ...action,
        actionId: `${assignment.id}:phone:${action.label}`,
        assignmentId: assignment.id,
      })),
      plannedMemberName: assignment.plannedMemberName,
      routeActionId: `assignment:${assignment.id}`,
      roleId: assignment.scheduleRoleId,
      roleName: assignment.scheduleRoleName,
      schedulePeriodId: assignment.schedulePeriodId,
      shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
      shiftTypeId: assignment.shiftTypeId,
      shiftTypeName: assignment.shiftTypeName,
      slotPosition: assignment.slotPosition,
      timeRange: shiftType?.isAllDay === true ? `全天（${timeRange}）` : timeRange,
    };
    const entries = assignmentsByDate.get(assignment.businessDate) ?? [];
    entries.push(mapped);
    assignmentsByDate.set(assignment.businessDate, entries);
  }

  const weeks = buildMonthGrid(parsedMonth.year, parsedMonth.month).map((week, weekIndex) => ({
    days: week.map((cell, cellIndex): CalendarDayCellViewModel => {
      if (cell === null) {
        return {
          id: `cell:${input.calendar.businessMonth}:${weekIndex}:${cellIndex}`,
          kind: 'padding',
        };
      }
      if (!cell.businessDate.startsWith(`${input.calendar.businessMonth}-`)) {
        throw new Error('The generated month grid contains another business month.');
      }
      const { day } = parseBusinessDate(cell.businessDate);
      const weekdayIndex = getWeekdayIndex(cell.businessDate);
      const assignments = assignmentsByDate.get(cell.businessDate) ?? [];
      return {
        assignments,
        businessDate: cell.businessDate,
        dayNumber: day,
        holiday: holidaysByDate.get(cell.businessDate),
        id: cell.businessDate,
        isEmpty: assignments.length === 0,
        isPast: isPastBusinessDate(cell.businessDate, input.today),
        isToday: cell.businessDate === input.today,
        isWeekend: weekdayIndex >= 5,
        kind: 'day',
        routeActionId: `date:${cell.businessDate}`,
        weekdayLabel: `周${weekdayLabels[weekdayIndex]}`,
      };
    }),
    id: `week:${input.calendar.businessMonth}:${weekIndex}`,
  }));

  return {
    assignmentCount: filteredAssignments.length,
    ...((input.status === 'cached' || input.status === 'refreshing') &&
    input.cacheSavedAt !== undefined
      ? { cacheSavedAt: input.cacheSavedAt }
      : {}),
    businessMonth: input.calendar.businessMonth,
    filters: getFilterViewModel(input.calendar, input.filters),
    isMonthEmpty: filteredAssignments.length === 0,
    ...((input.status === 'cached' || input.status === 'refreshing') && input.isStale !== undefined
      ? { isStale: input.isStale }
      : {}),
    monthLabel: getBusinessMonthLabel(input.calendar.businessMonth),
    status: input.status,
    weekdayLabels,
    weeks,
  };
}
