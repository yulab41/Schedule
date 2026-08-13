import type { CalendarChangeMarker, CalendarDutyAssignment, CalendarDutyMember } from './types.js';

const monthPattern = /^(\d{4})-(\d{2})$/u;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const chinaStandardTimeOffset = 8 * 60 * 60 * 1000;

export interface CalendarGridCell {
  readonly businessDate: string;
}

export type CalendarGridWeek = readonly (CalendarGridCell | null)[];

export interface CalendarAssignmentFilters {
  readonly membershipIds?: readonly string[] | undefined;
  readonly onlyChanges?: boolean | undefined;
  readonly roleIds?: readonly string[] | undefined;
  readonly shiftTypeIds?: readonly string[] | undefined;
}

export interface PhoneAction {
  readonly kind: 'copy' | 'dial';
  readonly label: '短号' | '长号';
  readonly number: string;
}

export function parseBusinessMonth(value: string): {
  readonly year: number;
  readonly month: number;
} {
  const match = monthPattern.exec(value);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  if (match === null || month < 1 || month > 12) {
    throw new Error('The business month must use a real YYYY-MM value.');
  }
  return { year, month };
}

export function parseBusinessDate(value: string): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
} {
  const match = datePattern.exec(value);
  if (match === null) {
    throw new Error('The business date must use YYYY-MM-DD.');
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
    throw new Error('The business date is not real.');
  }
  return { year, month, day };
}

function formatDate(value: Date): string {
  return `${String(value.getUTCFullYear()).padStart(4, '0')}-${String(
    value.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

export function getCurrentBusinessDate(now = new Date()): string {
  return formatDate(new Date(now.getTime() + chinaStandardTimeOffset));
}

export function getCurrentBusinessMonth(now = new Date()): string {
  return getCurrentBusinessDate(now).slice(0, 7);
}

export function isPastBusinessDate(businessDate: string, today: string): boolean {
  return businessDate < today;
}

export function addBusinessMonths(value: string, delta: number): string {
  const { year, month } = parseBusinessMonth(value);
  if (!Number.isInteger(delta)) {
    throw new Error('The month delta must be an integer.');
  }
  const absolute = year * 12 + month - 1 + delta;
  return `${String(Math.floor(absolute / 12)).padStart(4, '0')}-${String(
    (absolute % 12) + 1,
  ).padStart(2, '0')}`;
}

export function getBusinessMonthLabel(businessMonth: string): string {
  const { year, month } = parseBusinessMonth(businessMonth);
  return `${year}年${month}月`;
}

export function buildMonthGrid(year: number, month: number): readonly CalendarGridWeek[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid month.');
  }
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (CalendarGridCell | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      businessDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
        day,
      ).padStart(2, '0')}`,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
}

export function getDutyMembershipId(value: CalendarDutyAssignment): string | undefined {
  return value.actualMembershipId ?? value.plannedMembershipId;
}

export function getDutyMemberName(value: CalendarDutyAssignment): string | undefined {
  return value.actualMemberName ?? value.plannedMemberName;
}

export function filterCalendarAssignments(
  values: readonly CalendarDutyAssignment[],
  filters: CalendarAssignmentFilters,
): CalendarDutyAssignment[] {
  const roles = new Set(filters.roleIds ?? []);
  const shifts = new Set(filters.shiftTypeIds ?? []);
  const members = new Set(filters.membershipIds ?? []);

  return values.filter((value) => {
    if (filters.onlyChanges === true && value.changeMarkers.length === 0) {
      return false;
    }
    if (roles.size > 0 && !roles.has(value.scheduleRoleId)) {
      return false;
    }
    if (shifts.size > 0 && !shifts.has(value.shiftTypeId)) {
      return false;
    }
    const membershipId = getDutyMembershipId(value);
    return members.size === 0 || (membershipId !== undefined && members.has(membershipId));
  });
}

export function formatChinaStandardTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid instant.');
  }
  const shifted = new Date(date.getTime() + chinaStandardTimeOffset);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(
    shifted.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

function getAssignmentStartMinutes(value: CalendarDutyAssignment): number {
  const [hoursText = '0', minutesText = '0'] = formatChinaStandardTime(value.startsAt).split(':');
  const startMinutes = Number(hoursText) * 60 + Number(minutesText);
  return startMinutes === 0 ? 24 * 60 : startMinutes;
}

export function sortCalendarAssignments(
  values: readonly CalendarDutyAssignment[],
): CalendarDutyAssignment[] {
  return values
    .map((value, index) => ({ value, index }))
    .sort(
      (first, second) =>
        first.value.businessDate.localeCompare(second.value.businessDate) ||
        getAssignmentStartMinutes(first.value) - getAssignmentStartMinutes(second.value) ||
        first.value.scheduleRoleName.localeCompare(second.value.scheduleRoleName, 'zh-Hans-CN') ||
        first.value.slotPosition - second.value.slotPosition ||
        first.value.schedulePeriodId.localeCompare(second.value.schedulePeriodId) ||
        first.index - second.index,
    )
    .map(({ value }) => value);
}

export function formatShiftTimeRange(value: CalendarDutyAssignment): string {
  return `${formatChinaStandardTime(value.startsAt)}–${formatChinaStandardTime(value.endsAt)}`;
}

export function getCalendarMarkerLabel(marker: CalendarChangeMarker): '加' | '换' | '替' {
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

export function getHolidayShortLabel(value: string): string {
  return Array.from(holidayShortLabels[value] ?? value)
    .slice(0, 2)
    .join('');
}

export function getAvailablePhoneActions(
  member: CalendarDutyMember | undefined,
): readonly PhoneAction[] {
  if (member === undefined) {
    return [];
  }
  const kind = member.isConfirmed ? 'dial' : 'copy';
  const actions: PhoneAction[] = [];
  if (member.mobilePhone !== undefined && member.mobilePhone.length > 0) {
    actions.push({ kind, label: '长号', number: member.mobilePhone });
  }
  if (member.shortPhone !== undefined && member.shortPhone.length > 0) {
    actions.push({ kind, label: '短号', number: member.shortPhone });
  }
  return actions;
}
