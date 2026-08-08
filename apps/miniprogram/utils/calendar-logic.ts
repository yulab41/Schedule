import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
} from '@schedule/contracts';

import { getCurrentBusinessMonth, formatChinaStandardTime } from './china-time.js';

const businessMonthPattern = /^\d{4}-\d{2}$/u;

export interface CalendarGridCell {
  readonly businessDate: string;
}

export type CalendarGridWeek = readonly (CalendarGridCell | null)[];

export interface CalendarAssignmentFilters {
  readonly membershipIds?: readonly string[];
  readonly onlyChanges?: boolean;
  readonly roleIds?: readonly string[];
  readonly shiftTypeIds?: readonly string[];
}

export interface PhoneOption {
  readonly isConfirmed: boolean;
  readonly label: string;
  readonly number: string;
}

export { getCurrentBusinessMonth };

export function isPastBusinessDate(businessDate: string, today: string): boolean {
  return businessDate < today;
}

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

export function buildMonthGrid(year: number, month: number): readonly CalendarGridWeek[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('The calendar month must be a valid year and 1-12 month.');
  }

  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks: CalendarGridWeek[] = [];
  let week: (CalendarGridCell | null)[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    week.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    week.push({
      businessDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  while (week.length > 0 && week.length < 7) {
    week.push(null);
  }
  if (week.length > 0) {
    weeks.push(week);
  }

  return weeks;
}

export function getDutyMembershipId(assignment: CalendarDutyAssignment): string | undefined {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

export function getDutyMemberName(assignment: CalendarDutyAssignment): string | undefined {
  return assignment.actualMemberName ?? assignment.plannedMemberName;
}

export function filterCalendarAssignments(
  assignments: readonly CalendarDutyAssignment[],
  filters: CalendarAssignmentFilters,
): CalendarDutyAssignment[] {
  const roleIds = new Set(filters.roleIds ?? []);
  const shiftTypeIds = new Set(filters.shiftTypeIds ?? []);
  const membershipIds = new Set(filters.membershipIds ?? []);

  return assignments.filter((assignment) => {
    if (filters.onlyChanges === true && assignment.changeMarkers.length === 0) {
      return false;
    }
    if (roleIds.size > 0 && !roleIds.has(assignment.scheduleRoleId)) {
      return false;
    }
    if (shiftTypeIds.size > 0 && !shiftTypeIds.has(assignment.shiftTypeId)) {
      return false;
    }
    if (membershipIds.size > 0) {
      const dutyMembershipId = getDutyMembershipId(assignment);
      if (dutyMembershipId === undefined || !membershipIds.has(dutyMembershipId)) {
        return false;
      }
    }

    return true;
  });
}

export function getAvailablePhoneOptions(
  member: CalendarDutyMember | undefined,
): readonly PhoneOption[] {
  if (member === undefined) {
    return [];
  }

  const options: PhoneOption[] = [];
  if (member.mobilePhone !== undefined && member.mobilePhone.length > 0) {
    options.push({
      isConfirmed: member.isConfirmed,
      label: '长号',
      number: member.mobilePhone,
    });
  }
  if (member.shortPhone !== undefined && member.shortPhone.length > 0) {
    options.push({
      isConfirmed: member.isConfirmed,
      label: '短号',
      number: member.shortPhone,
    });
  }

  return options;
}

export function buildDialLink(number: string): string {
  if (number.length === 0) {
    throw new Error('A dial link requires a phone number.');
  }

  return `tel:${number}`;
}

export function formatShiftTimeRange(assignment: CalendarDutyAssignment): string {
  return `${formatChinaStandardTime(assignment.startsAt)}–${formatChinaStandardTime(assignment.endsAt)}`;
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

const holidayShortLabels: Readonly<Record<string, string>> = {
  元旦: '元旦',
  除夕: '除夕',
  春节: '春节',
  清明节: '清明',
  劳动节: '五一',
  端午节: '端午',
  中秋节: '中秋',
  国庆节: '国庆',
};

export function getHolidayShortLabel(holidayName: string): string {
  const known = holidayShortLabels[holidayName];
  if (known !== undefined) {
    return known;
  }

  return holidayName.length <= 4 ? holidayName : holidayName.slice(0, 4);
}

export interface LatestRequestTracker {
  begin(): number;
  isCurrent(version: number): boolean;
}

export function createLatestRequestTracker(): LatestRequestTracker {
  let latestVersion = 0;

  return {
    begin() {
      latestVersion += 1;
      return latestVersion;
    },
    isCurrent(version) {
      return version === latestVersion;
    },
  };
}
