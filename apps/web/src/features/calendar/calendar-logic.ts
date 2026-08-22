import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
} from '@schedule/contracts';
import type { CalendarGridCell, CalendarGridWeek } from '@schedule/presentation-core';
import { formatChinaStandardTime } from '@schedule/scheduling-domain';

export {
  addBusinessMonths,
  filterCalendarAssignments,
  getBusinessMonthLabel,
  getDutyMemberName,
  getDutyMembershipId,
  isPastBusinessDate,
  type CalendarAssignmentFilters,
  type CalendarGridCell,
  type CalendarGridWeek,
} from '@schedule/presentation-core';

export function isCalendarGridCellSelected(
  cell: CalendarGridCell | null,
  selectedDate: string | undefined,
): boolean {
  return cell !== null && selectedDate !== undefined && cell.businessDate === selectedDate;
}

export interface PhoneOption {
  readonly isConfirmed: boolean;
  readonly label: string;
  readonly number: string;
}

export { getCurrentBusinessMonth } from '@schedule/scheduling-domain';

export function buildMonthGrid(year: number, month: number): readonly CalendarGridWeek[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('The calendar month must be a valid year and 1-12 month.');
  }

  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks: CalendarGridWeek[] = [];
  let week: (CalendarGridCell | null)[] = [];

  for (let index = 0; index < firstWeekday; index += 1) week.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    week.push({
      businessDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  while (week.length > 0 && week.length < 7) week.push(null);
  if (week.length > 0) weeks.push(week);
  return weeks;
}

export function getAvailablePhoneOptions(
  member: CalendarDutyMember | undefined,
): readonly PhoneOption[] {
  if (member === undefined) return [];

  const options: PhoneOption[] = [];
  if (member.mobilePhone !== undefined && member.mobilePhone.length > 0) {
    options.push({ isConfirmed: member.isConfirmed, label: '长号', number: member.mobilePhone });
  }
  if (member.shortPhone !== undefined && member.shortPhone.length > 0) {
    options.push({ isConfirmed: member.isConfirmed, label: '短号', number: member.shortPhone });
  }
  return options;
}

export function buildDialLink(number: string): string {
  if (number.length === 0) throw new Error('A dial link requires a phone number.');
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
  if (known !== undefined) return known;
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
