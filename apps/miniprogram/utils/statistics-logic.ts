import type { StatisticsMemberRow, StatisticsSummary } from '@schedule/contracts';

export function formatStatisticsMonthLabel(businessMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/u.exec(businessMonth);
  if (match === null) {
    return businessMonth;
  }
  return `${match[1]}年${Number(match[2])}月`;
}

export function formatNetDutyAdjustment(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

export function sortMembersByActualCount(
  members: readonly StatisticsMemberRow[],
): StatisticsMemberRow[] {
  return [...members].sort(
    (first, second) =>
      second.actualCount - first.actualCount ||
      first.realName.localeCompare(second.realName, 'zh-Hans-CN'),
  );
}

export function getMemberActualVsPlannedCount(member: StatisticsMemberRow): number {
  return member.actualVsPlanned.length;
}

export function summarizeRecalculateMismatches(mismatches: readonly string[]): string {
  if (mismatches.length === 0) {
    return '重算结果与快照一致。';
  }
  return `发现 ${mismatches.length} 处不一致：${mismatches.join('；')}`;
}

export function getSummaryCardValue(
  summary: StatisticsSummary,
  key: keyof StatisticsSummary,
): number {
  return summary[key] as number;
}
