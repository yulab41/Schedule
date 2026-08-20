import type {
  CalendarDutyAssignment,
  CalendarReadModel,
  GroupMember,
  GroupMemberContact,
  MonthStatisticsSnapshot,
  YearStatistics,
} from '@schedule/contracts';

export interface MyProfileTrendPoint {
  readonly businessMonth: string;
  readonly count: number;
  readonly label: string;
}

export interface MyProfileOverview {
  readonly membershipId?: string;
  readonly mobilePhone?: string;
  readonly monthCount: number;
  readonly monthDelta?: number;
  readonly nextDuty?: CalendarDutyAssignment;
  readonly shortPhone?: string;
  readonly specialDateCount: number;
  readonly trend: readonly MyProfileTrendPoint[];
  readonly yearCount: number;
}

export interface BuildMyProfileOverviewInput {
  readonly businessDate: string;
  readonly businessMonth: string;
  readonly calendars: readonly CalendarReadModel[];
  readonly contacts: readonly GroupMemberContact[];
  readonly members: readonly GroupMember[];
  readonly monthStatistics?: MonthStatisticsSnapshot;
  readonly now?: string;
  readonly yearStatistics?: YearStatistics;
}

export function buildMyProfileOverview(input: BuildMyProfileOverviewInput): MyProfileOverview {
  const membershipId = input.members.find((member) => member.isCurrentUser)?.id;
  if (membershipId === undefined) return emptyMyProfileOverview();

  const contact = input.contacts.find((candidate) => candidate.membershipId === membershipId);
  const monthRow = input.monthStatistics?.summary.members.find(
    (row) => row.membershipId === membershipId,
  );
  const yearRow = input.yearStatistics?.summary.members.find(
    (row) => row.membershipId === membershipId,
  );
  const trend = buildTrend(
    input.yearStatistics,
    membershipId,
    input.businessMonth,
    monthRow?.actualCount,
  );
  const previousCount = trend.at(-2)?.count;
  const monthCount = monthRow?.actualCount ?? trend.at(-1)?.count ?? 0;
  const nextDuty = findNextDuty(input, membershipId);

  return {
    membershipId,
    ...(contact?.mobilePhone === undefined ? {} : { mobilePhone: contact.mobilePhone }),
    monthCount,
    ...(previousCount === undefined ? {} : { monthDelta: monthCount - previousCount }),
    ...(nextDuty === undefined ? {} : { nextDuty }),
    ...(contact?.shortPhone === undefined ? {} : { shortPhone: contact.shortPhone }),
    specialDateCount: (monthRow?.weekendCount ?? 0) + (monthRow?.holidayCount ?? 0),
    trend,
    yearCount: yearRow?.actualCount ?? 0,
  };
}

export function emptyMyProfileOverview(): MyProfileOverview {
  return {
    monthCount: 0,
    specialDateCount: 0,
    trend: [],
    yearCount: 0,
  };
}

function buildTrend(
  statistics: YearStatistics | undefined,
  membershipId: string,
  businessMonth: string,
  currentMonthCount: number | undefined,
): readonly MyProfileTrendPoint[] {
  if (statistics === undefined && currentMonthCount === undefined) return [];
  const months = new Map(statistics?.months.map((month) => [month.businessMonth, month]));
  return [-3, -2, -1, 0].map((offset) => {
    const month = shiftBusinessMonth(businessMonth, offset);
    const statisticsMonth = months.get(month);
    const count =
      offset === 0 && currentMonthCount !== undefined
        ? currentMonthCount
        : (statisticsMonth?.summary.members.find((row) => row.membershipId === membershipId)
            ?.actualCount ?? 0);
    return {
      businessMonth: month,
      count,
      label: `${Number(month.slice(5, 7))}月`,
    };
  });
}

function shiftBusinessMonth(businessMonth: string, offset: number): string {
  const year = Number(businessMonth.slice(0, 4));
  const month = Number(businessMonth.slice(5, 7));
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function findNextDuty(
  input: BuildMyProfileOverviewInput,
  membershipId: string,
): CalendarDutyAssignment | undefined {
  const now = Date.parse(input.now ?? new Date().toISOString());
  return input.calendars
    .flatMap((calendar) => calendar.assignments)
    .filter((assignment) => {
      const isCurrentMember =
        assignment.actualMembershipId === membershipId ||
        (assignment.actualMembershipId === undefined &&
          assignment.plannedMembershipId === membershipId);
      const endsAt = Date.parse(assignment.endsAt);
      return (
        isCurrentMember &&
        assignment.businessDate >= input.businessDate &&
        (!Number.isFinite(now) || !Number.isFinite(endsAt) || endsAt > now)
      );
    })
    .sort((left, right) =>
      `${left.businessDate}:${left.startsAt}`.localeCompare(
        `${right.businessDate}:${right.startsAt}`,
      ),
    )[0];
}
