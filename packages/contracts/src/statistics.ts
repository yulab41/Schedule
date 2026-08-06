import { z } from 'zod';

export const statisticsRoleCountSchema = z
  .object({
    actualCount: z.number(),
    plannedCount: z.number(),
    scheduleRoleId: z.string(),
    scheduleRoleName: z.string(),
  })
  .passthrough();
export type StatisticsRoleCount = z.infer<typeof statisticsRoleCountSchema>;

export const statisticsShiftTypeCountSchema = z
  .object({
    actualCount: z.number(),
    plannedCount: z.number(),
    shiftTypeId: z.string(),
    shiftTypeName: z.string(),
  })
  .passthrough();
export type StatisticsShiftTypeCount = z.infer<typeof statisticsShiftTypeCountSchema>;

export interface StatisticsActualVsPlannedEntry {
  readonly actualMemberId?: string;
  readonly actualMemberName?: string;
  readonly businessDate: string;
  readonly plannedMemberId?: string;
  readonly plannedMemberName?: string;
  readonly shiftTypeName: string;
}

export const statisticsMemberRowSchema = z
  .object({
    actualCount: z.number(),
    // 旧守卫只校验 actualVsPlanned 为数组；导出类型保留完整契约。
    actualVsPlanned: z.custom<readonly StatisticsActualVsPlannedEntry[]>((value) =>
      Array.isArray(value),
    ),
    byRole: z.readonly(z.array(statisticsRoleCountSchema)),
    byShiftType: z.readonly(z.array(statisticsShiftTypeCountSchema)),
    countedActualCount: z.number(),
    countedPlannedCount: z.number(),
    deductionCount: z.number(),
    deltaCount: z.number(),
    holidayCount: z.number(),
    leaveCoverCount: z.number(),
    manualAdjustmentCount: z.number(),
    membershipId: z.string(),
    netDutyAdjustment: z.number(),
    overtimeCount: z.number(),
    plannedCount: z.number(),
    realName: z.string(),
    swapCount: z.number(),
    weekendCount: z.number(),
  })
  .passthrough();
export type StatisticsMemberRow = z.infer<typeof statisticsMemberRowSchema>;

export const statisticsSummarySchema = z
  .object({
    actualCount: z.number(),
    byRole: z.readonly(z.array(statisticsRoleCountSchema)),
    byShiftType: z.readonly(z.array(statisticsShiftTypeCountSchema)),
    countedActualCount: z.number(),
    countedPlannedCount: z.number(),
    deductionCount: z.number(),
    holidayCount: z.number(),
    leaveCoverCount: z.number(),
    manualAdjustmentCount: z.number(),
    members: z.readonly(z.array(statisticsMemberRowSchema)),
    netDutyAdjustment: z.number(),
    overtimeCount: z.number(),
    plannedCount: z.number(),
    swapCount: z.number(),
    weekendCount: z.number(),
  })
  .passthrough();
export type StatisticsSummary = z.infer<typeof statisticsSummarySchema>;

export const monthStatisticsSnapshotSchema = z
  .object({
    businessMonth: z.string(),
    computedAt: z.string(),
    groupId: z.string(),
    summary: statisticsSummarySchema,
    version: z.number(),
  })
  .passthrough();
export type MonthStatisticsSnapshot = z.infer<typeof monthStatisticsSnapshotSchema>;

export const yearStatisticsSchema = z
  .object({
    months: z.readonly(
      z.array(
        z
          .object({
            businessMonth: z.string(),
            summary: statisticsSummarySchema,
          })
          .passthrough(),
      ),
    ),
    summary: statisticsSummarySchema,
    year: z.number(),
  })
  .passthrough();
export type YearStatistics = z.infer<typeof yearStatisticsSchema>;

export const statisticsRecalculateCheckResultSchema = z
  .object({
    businessMonth: z.string(),
    matched: z.boolean(),
    mismatches: z.readonly(z.array(z.string())),
    recomputed: statisticsSummarySchema,
    snapshot: statisticsSummarySchema,
    snapshotVersion: z.number(),
  })
  .passthrough();
export type StatisticsRecalculateCheckResult = z.infer<
  typeof statisticsRecalculateCheckResultSchema
>;
