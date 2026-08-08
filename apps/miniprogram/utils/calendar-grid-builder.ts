import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';

import {
  getCalendarMarkerDescription,
  getCalendarMarkerLabel,
  getDutyMemberName,
  getHolidayShortLabel,
  type CalendarGridWeek,
} from './calendar-logic.js';
import { formatShiftTimeRange, getDutyMembershipId } from './calendar-logic.js';
import { formatChinaStandardTime } from './china-time.js';
import { isWeekend, getWeekdayLabel, parseBusinessDate } from './calendar-views.js';

export interface CalendarGridCellView {
  readonly assignments: readonly {
    readonly abbreviation: string;
    readonly color: string;
    readonly id: string;
    readonly markers: readonly string[];
    readonly textColor: string;
  }[];
  readonly businessDate: string;
  readonly dayNumber: string;
  readonly holidayLabel: string;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly memberName: string;
}

export interface CalendarGridWeekView {
  readonly cells: readonly (CalendarGridCellView | null)[];
}

export interface ShiftCardView {
  readonly id: string;
  readonly markerTexts: readonly string[];
  readonly memberName: string;
  readonly shiftTime: string;
  readonly shiftTypeColor: string;
  readonly shiftTypeName: string;
  readonly scheduleRoleName: string;
  readonly businessDate: string;
}

export function buildHolidayMap(
  dates: readonly ConfirmedHolidayDate[] | undefined,
): Record<string, { readonly label: string }> {
  const map: Record<string, { readonly label: string }> = {};
  for (const date of dates ?? []) {
    map[date.date] = { label: getHolidayShortLabel(date.holidayName) };
  }
  return map;
}

export function buildCalendarWeeks(
  weeks: readonly CalendarGridWeek[],
  assignmentsByDate: ReadonlyMap<string, readonly CalendarDutyAssignment[]>,
  holidayMap: Record<string, { readonly label: string }>,
  today: string,
): readonly CalendarGridWeekView[] {
  return weeks.map((week) => ({
    cells: week.map((cell) => {
      if (cell === null) {
        return null;
      }
      const { day } = parseBusinessDate(cell.businessDate);
      const assignments = (assignmentsByDate.get(cell.businessDate) ?? []).map((assignment) => ({
        abbreviation: assignment.shiftTypeAbbreviation,
        color: assignment.shiftTypeColor,
        id: assignment.id,
        markers: assignment.changeMarkers.map(getCalendarMarkerLabel),
        textColor: assignment.shiftTypeTextColor,
      }));
      return {
        assignments,
        businessDate: cell.businessDate,
        dayNumber: String(day),
        holidayLabel: holidayMap[cell.businessDate]?.label ?? '',
        isToday: cell.businessDate === today,
        isWeekend: isWeekend(cell.businessDate),
        memberName: assignments.map((assignment) => assignment.abbreviation).join(' '),
      };
    }),
  }));
}

export function buildShiftCardViews(
  assignments: readonly CalendarDutyAssignment[],
): readonly ShiftCardView[] {
  return assignments.map((assignment) => ({
    businessDate: assignment.businessDate,
    id: assignment.id,
    markerTexts: assignment.changeMarkers.map(getCalendarMarkerDescription),
    memberName: getDutyMemberName(assignment) ?? '待定',
    scheduleRoleName: assignment.scheduleRoleName,
    shiftTime: formatShiftTimeRange(assignment),
    shiftTypeColor: assignment.shiftTypeColor,
    shiftTypeName: assignment.shiftTypeName,
  }));
}

export function formatWeekdayLine(businessDate: string): string {
  return `${getWeekdayLabel(businessDate)} ${businessDate.slice(5)}`;
}

export function buildDutyDetail(
  assignment: CalendarDutyAssignment,
  members: readonly CalendarDutyMember[],
): {
  readonly markers: readonly string[];
  readonly memberName: string;
  readonly phoneOptions: readonly { readonly label: string; readonly number: string }[];
  readonly scheduleRoleName: string;
  readonly shiftTime: string;
  readonly shiftTypeName: string;
} {
  const membershipId = getDutyMembershipId(assignment);
  const member = members.find((item) => item.membershipId === membershipId);
  const phoneOptions: { readonly label: string; readonly number: string }[] = [];
  if (member?.isConfirmed === true) {
    if (member.mobilePhone !== undefined && member.mobilePhone.length > 0) {
      phoneOptions.push({ label: '长号', number: member.mobilePhone });
    }
    if (member.shortPhone !== undefined && member.shortPhone.length > 0) {
      phoneOptions.push({ label: '短号', number: member.shortPhone });
    }
  }
  return {
    markers: assignment.changeMarkers.map(getCalendarMarkerDescription),
    memberName: getDutyMemberName(assignment) ?? '待定',
    phoneOptions,
    scheduleRoleName: assignment.scheduleRoleName,
    shiftTime: formatShiftTimeRange(assignment),
    shiftTypeName: assignment.shiftTypeName,
  };
}

export function formatShiftClock(startsAt: string, endsAt: string): string {
  return `${formatChinaStandardTime(startsAt)}–${formatChinaStandardTime(endsAt)}`;
}
