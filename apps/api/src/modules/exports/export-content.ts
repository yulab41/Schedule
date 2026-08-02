import type { DatabaseTransaction } from '@schedule/database';
import { exportJobs, schedulePeriods, scheduleRoles, shiftAssignments } from '@schedule/database';
import { mergeMonthStatistics } from '@schedule/scheduling-domain';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import { StatisticsComputation } from '../statistics/statistics-computation.js';
import { buildScheduleCsv, buildStatisticsCsv } from './csv-builder.js';

type ExportJobRow = typeof exportJobs.$inferSelect;

export interface ExportContentResult {
  readonly content: string;
  readonly rowCount: number;
}

export async function buildExportContent(
  transaction: DatabaseTransaction,
  job: ExportJobRow,
): Promise<ExportContentResult> {
  return job.exportType === 'schedule'
    ? buildScheduleContent(transaction, job)
    : buildStatisticsContent(transaction, job);
}

async function buildScheduleContent(
  transaction: DatabaseTransaction,
  job: ExportJobRow,
): Promise<ExportContentResult> {
  const monthRange = getPeriodRange(job.periodType, job.period);
  const periodConditions = [
    eq(schedulePeriods.groupId, job.groupId),
    eq(schedulePeriods.status, 'published'),
    isNull(schedulePeriods.deletedAt),
    gte(schedulePeriods.businessMonth, monthRange.start),
    lte(schedulePeriods.businessMonth, monthRange.end),
  ];
  if (job.scheduleRoleId !== null) {
    periodConditions.push(eq(schedulePeriods.scheduleRoleId, job.scheduleRoleId));
  }
  const periods = await transaction
    .select()
    .from(schedulePeriods)
    .where(and(...periodConditions));
  const periodIds = periods.map((period) => period.id);
  const assignments =
    periodIds.length === 0
      ? []
      : await transaction
          .select()
          .from(shiftAssignments)
          .where(
            and(
              inArray(shiftAssignments.schedulePeriodId, periodIds),
              isNull(shiftAssignments.deletedAt),
            ),
          );
  const roleIds = [...new Set(periods.map((period) => period.scheduleRoleId))];
  const roles =
    roleIds.length === 0
      ? []
      : await transaction
          .select({ id: scheduleRoles.id, name: scheduleRoles.name })
          .from(scheduleRoles)
          .where(inArray(scheduleRoles.id, roleIds));
  const roleNames = new Map(roles.map((role) => [role.id, role.name]));
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const filteredAssignments =
    job.membershipId === null
      ? assignments
      : assignments.filter(
          (assignment) =>
            assignment.plannedMembershipId === job.membershipId ||
            assignment.actualMembershipId === job.membershipId,
        );
  const rows = filteredAssignments
    .sort(
      (first, second) =>
        first.businessDate.localeCompare(second.businessDate) ||
        first.slotPosition - second.slotPosition,
    )
    .map((assignment) => {
      const period = periodById.get(assignment.schedulePeriodId);
      return {
        actualMemberName: assignment.actualMemberName,
        businessDate: assignment.businessDate,
        crossesMidnight: assignment.crossesMidnight === 1,
        plannedMemberName: assignment.plannedMemberName,
        scheduleRoleName: roleNames.get(period?.scheduleRoleId ?? '') ?? '',
        shiftEndTime: (assignment.shiftEndTime as string).slice(0, 5),
        shiftStartTime: (assignment.shiftStartTime as string).slice(0, 5),
        shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
        shiftTypeName: assignment.shiftTypeName,
        slotPosition: assignment.slotPosition,
      };
    });

  return { content: buildScheduleCsv(rows), rowCount: rows.length };
}

async function buildStatisticsContent(
  transaction: DatabaseTransaction,
  job: ExportJobRow,
): Promise<ExportContentResult> {
  const computation = new StatisticsComputation();
  const months = getPeriodMonths(job.periodType, job.period);
  const summaries = await Promise.all(
    months.map((businessMonth) =>
      computation.computeMonth(transaction, job.groupId, businessMonth, {
        ...(job.scheduleRoleId === null ? {} : { roleIds: [job.scheduleRoleId] }),
        ...(job.membershipId === null ? {} : { membershipIds: [job.membershipId] }),
      }),
    ),
  );
  const summary = mergeMonthStatistics(summaries.map((month) => month.summary));

  return { content: buildStatisticsCsv(summary), rowCount: summary.members.length };
}

function getPeriodRange(
  periodType: 'month' | 'year',
  period: string,
): { readonly end: string; readonly start: string } {
  if (periodType === 'month') {
    return { end: getMonthEnd(`${period}-01`), start: `${period}-01` };
  }
  return { end: `${period}-12-31`, start: `${period}-01-01` };
}

function getPeriodMonths(periodType: 'month' | 'year', period: string): readonly string[] {
  if (periodType === 'month') {
    return [`${period}-01`];
  }
  return Array.from(
    { length: 12 },
    (_, index) => `${period}-${String(index + 1).padStart(2, '0')}-01`,
  );
}

function getMonthEnd(monthStart: string): string {
  const match = /^(\d{4})-(\d{2})-01$/u.exec(monthStart);
  if (match === null) {
    throw new Error(`Invalid business month ${monthStart}.`);
  }
  const nextMonth = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
  return new Date(nextMonth.valueOf() - 1).toISOString().slice(0, 10);
}
