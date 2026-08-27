export interface MyProfileDutyAssignmentLike {
  readonly actualMembershipId?: string | undefined;
  readonly businessDate: string;
  readonly endsAt: string;
  readonly id: string;
  readonly plannedMembershipId?: string | undefined;
  readonly scheduleRoleName: string;
  readonly shiftTypeName: string;
  readonly startsAt: string;
}

export interface MyProfileCalendarLike<
  Assignment extends MyProfileDutyAssignmentLike = MyProfileDutyAssignmentLike,
> {
  readonly assignments: readonly Assignment[];
}

export interface MyProfileMemberLike {
  readonly id: string;
  readonly isCurrentUser: boolean;
}

export interface MyProfileContactLike {
  readonly membershipId: string;
  readonly mobilePhone?: string | undefined;
  readonly shortPhone?: string | undefined;
}

export interface MyProfileStatisticsMemberLike {
  readonly actualCount: number;
  readonly holidayCount: number;
  readonly membershipId: string;
  readonly weekendCount: number;
}

export interface MyProfileStatisticsSummaryLike {
  readonly members: readonly MyProfileStatisticsMemberLike[];
}

export interface MyProfileMonthStatisticsLike {
  readonly summary: MyProfileStatisticsSummaryLike;
}

export interface MyProfileYearStatisticsLike {
  readonly months: readonly {
    readonly businessMonth: string;
    readonly summary: MyProfileStatisticsSummaryLike;
  }[];
  readonly summary: MyProfileStatisticsSummaryLike;
}

export interface MyProfileTrendPoint {
  readonly businessMonth: string;
  readonly count: number;
  readonly label: string;
}

export interface MyProfileOverview<
  Assignment extends MyProfileDutyAssignmentLike = MyProfileDutyAssignmentLike,
> {
  readonly membershipId?: string;
  readonly mobilePhone?: string;
  readonly monthCount?: number;
  readonly monthDelta?: number;
  readonly nextDuty?: Assignment;
  readonly shortPhone?: string;
  readonly specialDateCount?: number;
  readonly trend: readonly MyProfileTrendPoint[];
  readonly yearCount?: number;
}

export interface BuildMyProfileOverviewInput<
  Assignment extends MyProfileDutyAssignmentLike = MyProfileDutyAssignmentLike,
> {
  readonly businessDate: string;
  readonly businessMonth: string;
  readonly calendars: readonly MyProfileCalendarLike<Assignment>[];
  readonly contacts: readonly MyProfileContactLike[];
  readonly members: readonly MyProfileMemberLike[];
  readonly monthStatistics?: MyProfileMonthStatisticsLike;
  readonly now?: string;
  readonly yearStatistics?: MyProfileYearStatisticsLike;
}

export function buildMyProfileOverview<Assignment extends MyProfileDutyAssignmentLike>(
  input: BuildMyProfileOverviewInput<Assignment>,
): MyProfileOverview<Assignment> {
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
  const monthCount = monthRow?.actualCount;
  const nextDuty = findNextDuty(input, membershipId);

  return {
    membershipId,
    ...(contact?.mobilePhone === undefined ? {} : { mobilePhone: contact.mobilePhone }),
    ...(monthCount === undefined ? {} : { monthCount }),
    ...(previousCount === undefined || monthCount === undefined
      ? {}
      : { monthDelta: monthCount - previousCount }),
    ...(nextDuty === undefined ? {} : { nextDuty }),
    ...(contact?.shortPhone === undefined ? {} : { shortPhone: contact.shortPhone }),
    ...(monthRow === undefined
      ? {}
      : { specialDateCount: monthRow.weekendCount + monthRow.holidayCount }),
    trend,
    ...(yearRow === undefined ? {} : { yearCount: yearRow.actualCount }),
  };
}

export function emptyMyProfileOverview<
  Assignment extends MyProfileDutyAssignmentLike = MyProfileDutyAssignmentLike,
>(): MyProfileOverview<Assignment> {
  return { trend: [] };
}

function buildTrend(
  statistics: MyProfileYearStatisticsLike | undefined,
  membershipId: string,
  businessMonth: string,
  currentMonthCount: number | undefined,
): readonly MyProfileTrendPoint[] {
  if (statistics === undefined) return [];
  const months = new Map(statistics.months.map((month) => [month.businessMonth, month]));
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

function findNextDuty<Assignment extends MyProfileDutyAssignmentLike>(
  input: BuildMyProfileOverviewInput<Assignment>,
  membershipId: string,
): Assignment | undefined {
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
