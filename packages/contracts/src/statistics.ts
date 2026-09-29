import { z } from 'zod';

export const statisticsRoleCountSchema = z
  .object({
    actualCount: z.number(),
    plannedCount: z.number(),
    scheduleRoleId: z.string(),
    scheduleRoleName: z.string(),
  })
  .strict();
export type StatisticsRoleCount = z.infer<typeof statisticsRoleCountSchema>;

export const statisticsShiftTypeCountSchema = z
  .object({
    actualCount: z.number(),
    plannedCount: z.number(),
    shiftTypeId: z.string(),
    shiftTypeName: z.string(),
  })
  .strict();
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
  .strict();
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
  .strict();
export type StatisticsSummary = z.infer<typeof statisticsSummarySchema>;

export const monthStatisticsSnapshotSchema = z
  .object({
    businessMonth: z.string(),
    computedAt: z.string(),
    groupId: z.string(),
    summary: statisticsSummarySchema,
    version: z.number(),
  })
  .strict();
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
          .strict(),
      ),
    ),
    summary: statisticsSummarySchema,
    year: z.number(),
  })
  .strict();
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
  .strict();
export type StatisticsRecalculateCheckResult = z.infer<
  typeof statisticsRecalculateCheckResultSchema
>;

export const statisticsMetricsV2Schema = z
  .object({
    plannedCount: z.number(),
    actualCount: z.number(),
    weekendCount: z.number(),
    holidayCount: z.number(),
    swapCount: z.number(),
    overtimeCount: z.number(),
    deductionCount: z.number(),
  })
  .strict();
export type StatisticsMetricsV2 = z.infer<typeof statisticsMetricsV2Schema>;
export const statisticsShiftTypeV2Schema = statisticsMetricsV2Schema
  .extend({
    shiftTypeId: z.string(),
    shiftTypeName: z.string(),
    countsTowardStatistics: z.boolean(),
  })
  .strict();
export type StatisticsShiftTypeV2 = z.infer<typeof statisticsShiftTypeV2Schema>;
export const statisticsMemberV2Schema = statisticsMetricsV2Schema
  .extend({
    membershipId: z.string(),
    realName: z.string(),
    byRole: z.array(statisticsRoleCountSchema),
    byShiftType: z.array(statisticsShiftTypeV2Schema),
  })
  .strict();
export type StatisticsMemberV2 = z.infer<typeof statisticsMemberV2Schema>;
export const statisticsSummaryV2Schema = statisticsMetricsV2Schema
  .extend({
    members: z.array(statisticsMemberV2Schema),
    byRole: z.array(statisticsRoleCountSchema),
    byShiftType: z.array(statisticsShiftTypeV2Schema),
  })
  .strict();
export type StatisticsSummaryV2 = z.infer<typeof statisticsSummaryV2Schema>;
export const monthStatisticsV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    businessMonth: z.string(),
    computedAt: z.string(),
    groupId: z.string(),
    version: z.number(),
    summary: statisticsSummaryV2Schema,
  })
  .strict();
export type MonthStatisticsV2 = z.infer<typeof monthStatisticsV2Schema>;
export const yearStatisticsV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    year: z.number(),
    summary: statisticsSummaryV2Schema,
    months: z.array(
      z.object({ businessMonth: z.string(), summary: statisticsSummaryV2Schema }).strict(),
    ),
  })
  .strict();
export type YearStatisticsV2 = z.infer<typeof yearStatisticsV2Schema>;
