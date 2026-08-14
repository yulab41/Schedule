import type { StatisticsMemberRow, StatisticsSummary } from '@schedule/contracts';

export interface StatisticsSummaryItem {
  readonly emphasis: 'primary' | 'secondary';
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface StatisticsTableScrollMetrics {
  readonly clientWidth: number;
  readonly scrollLeft: number;
  readonly scrollWidth: number;
}

export interface StatisticsTableScrollState {
  readonly canScrollLeft: boolean;
  readonly canScrollRight: boolean;
  readonly isOverflowing: boolean;
  readonly progress: number;
}

const scrollBoundaryTolerance = 1;

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

export function getStatisticsSummaryItems(
  summary: StatisticsSummary,
): readonly StatisticsSummaryItem[] {
  return [
    { emphasis: 'primary', key: 'planned', label: '计划班次', value: String(summary.plannedCount) },
    { emphasis: 'primary', key: 'actual', label: '实际值班', value: String(summary.actualCount) },
    {
      emphasis: 'primary',
      key: 'counted',
      label: '计值班次',
      value: String(summary.countedActualCount),
    },
    {
      emphasis: 'secondary',
      key: 'weekend',
      label: '周末值班',
      value: String(summary.weekendCount),
    },
    {
      emphasis: 'secondary',
      key: 'holiday',
      label: '法定节假日',
      value: String(summary.holidayCount),
    },
    { emphasis: 'secondary', key: 'swap', label: '换班', value: String(summary.swapCount) },
    {
      emphasis: 'secondary',
      key: 'overtime-deduction',
      label: '加班 / 扣班',
      value: `${summary.overtimeCount} / ${summary.deductionCount}`,
    },
    {
      emphasis: 'secondary',
      key: 'net-adjustment',
      label: '加扣班净值',
      value: formatNetDutyAdjustment(summary.netDutyAdjustment),
    },
    {
      emphasis: 'secondary',
      key: 'leave-cover',
      label: '请假补位',
      value: String(summary.leaveCoverCount),
    },
    {
      emphasis: 'secondary',
      key: 'manual-adjustment',
      label: '人工调整',
      value: String(summary.manualAdjustmentCount),
    },
  ];
}

export function getStatisticsTableScrollState(
  metrics: StatisticsTableScrollMetrics,
): StatisticsTableScrollState {
  const maximumScroll = Math.max(0, metrics.scrollWidth - metrics.clientWidth);
  if (maximumScroll <= scrollBoundaryTolerance) {
    return {
      canScrollLeft: false,
      canScrollRight: false,
      isOverflowing: false,
      progress: 0,
    };
  }

  const scrollLeft = Math.min(maximumScroll, Math.max(0, metrics.scrollLeft));
  const canScrollLeft = scrollLeft > scrollBoundaryTolerance;
  const canScrollRight = maximumScroll - scrollLeft > scrollBoundaryTolerance;
  return {
    canScrollLeft,
    canScrollRight,
    isOverflowing: true,
    progress: canScrollLeft ? (canScrollRight ? scrollLeft / maximumScroll : 1) : 0,
  };
}

export function getStatisticsTableScrollHint(
  metricsOrState: StatisticsTableScrollMetrics | StatisticsTableScrollState,
): string {
  const state =
    'isOverflowing' in metricsOrState
      ? metricsOrState
      : getStatisticsTableScrollState(metricsOrState);
  if (!state.isOverflowing) {
    return '全部成员指标均已显示';
  }
  if (!state.canScrollLeft) {
    return '向左滑动查看其余指标，成员列保持固定';
  }
  if (!state.canScrollRight) {
    return '向右滑动返回成员姓名，成员列保持固定';
  }
  return '左右滑动查看全部指标，成员列保持固定';
}
