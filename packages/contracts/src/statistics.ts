export interface StatisticsRoleCount {
  readonly actualCount: number;
  readonly plannedCount: number;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
}

export interface StatisticsShiftTypeCount {
  readonly actualCount: number;
  readonly plannedCount: number;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
}

export interface StatisticsActualVsPlannedEntry {
  readonly actualMemberId?: string;
  readonly actualMemberName?: string;
  readonly businessDate: string;
  readonly plannedMemberId?: string;
  readonly plannedMemberName?: string;
  readonly shiftTypeName: string;
}

export interface StatisticsMemberRow {
  readonly actualCount: number;
  readonly actualVsPlanned: readonly StatisticsActualVsPlannedEntry[];
  readonly byRole: readonly StatisticsRoleCount[];
  readonly byShiftType: readonly StatisticsShiftTypeCount[];
  readonly countedActualCount: number;
  readonly countedPlannedCount: number;
  readonly deductionCount: number;
  readonly deltaCount: number;
  readonly holidayCount: number;
  readonly leaveCoverCount: number;
  readonly manualAdjustmentCount: number;
  readonly membershipId: string;
  readonly netDutyAdjustment: number;
  readonly overtimeCount: number;
  readonly plannedCount: number;
  readonly realName: string;
  readonly swapCount: number;
  readonly weekendCount: number;
}

export interface StatisticsSummary {
  readonly actualCount: number;
  readonly byRole: readonly StatisticsRoleCount[];
  readonly byShiftType: readonly StatisticsShiftTypeCount[];
  readonly countedActualCount: number;
  readonly countedPlannedCount: number;
  readonly deductionCount: number;
  readonly holidayCount: number;
  readonly leaveCoverCount: number;
  readonly manualAdjustmentCount: number;
  readonly members: readonly StatisticsMemberRow[];
  readonly netDutyAdjustment: number;
  readonly overtimeCount: number;
  readonly plannedCount: number;
  readonly swapCount: number;
  readonly weekendCount: number;
}

export interface MonthStatisticsSnapshot {
  readonly businessMonth: string;
  readonly computedAt: string;
  readonly groupId: string;
  readonly summary: StatisticsSummary;
  readonly version: number;
}

export interface YearStatistics {
  readonly months: readonly {
    readonly businessMonth: string;
    readonly summary: StatisticsSummary;
  }[];
  readonly summary: StatisticsSummary;
  readonly year: number;
}

export interface StatisticsRecalculateCheckResult {
  readonly businessMonth: string;
  readonly matched: boolean;
  readonly mismatches: readonly string[];
  readonly recomputed: StatisticsSummary;
  readonly snapshot: StatisticsSummary;
  readonly snapshotVersion: number;
}
