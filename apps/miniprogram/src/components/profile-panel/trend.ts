import { addBusinessMonths, type MyProfileYearStatisticsLike } from '@schedule/presentation-core';

export function profileTrendYears(businessMonth: string): readonly number[] {
  return [
    ...new Set(
      [addBusinessMonths(businessMonth, -11), businessMonth].map((month) =>
        Number(month.slice(0, 4)),
      ),
    ),
  ];
}

export function buildProfileYearTrend(
  businessMonth: string,
  membershipId: string,
  statistics: readonly MyProfileYearStatisticsLike[],
  currentMonthCount?: number,
) {
  const months = new Map(
    statistics.flatMap((year) => year.months).map((month) => [month.businessMonth, month]),
  );
  return Array.from({ length: 12 }, (_, index) => {
    const month = addBusinessMonths(businessMonth, index - 11);
    const row = months.get(month);
    const count =
      index === 11 && currentMonthCount !== undefined
        ? currentMonthCount
        : row === undefined
          ? undefined
          : (row.summary.members.find((member) => member.membershipId === membershipId)
              ?.actualCount ?? 0);
    return { businessMonth: month, count, label: String(Number(month.slice(5))) };
  });
}
