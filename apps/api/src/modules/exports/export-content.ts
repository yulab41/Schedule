import type { DatabaseTransaction } from '@schedule/database';
import {
  exportJobs,
  groupMemberships,
  leaveRequests,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  userProfiles,
} from '@schedule/database';
import { mergeMonthStatistics } from '@schedule/scheduling-domain';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import { StatisticsComputation } from '../statistics/statistics-computation.js';
import {
  buildScheduleCsv,
  buildScheduleTable,
  buildStatisticsCsv,
  buildStatisticsTable,
} from './csv-builder.js';
import { buildXlsx } from './xlsx-builder.js';
import { buildHeadNeckDocx, type HeadNeckDocxPage } from './docx-builder.js';
import { getHeadNeckDocxConfig } from './head-neck-docx-config.js';
import {
  buildHeadNeckRotationGrid,
  resolveHeadNeckDutyMembershipId,
} from './head-neck-docx-grid.js';

type ExportJobRow = typeof exportJobs.$inferSelect;

export interface ExportContentResult {
  readonly content: Buffer | string;
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
  if (job.fileFormat === 'docx') return buildHeadNeckScheduleDocxContent(transaction, job);
  const monthRange = getPeriodRange(job.periodType, job.period);
  const periodConditions = [
    eq(schedulePeriods.groupId, job.groupId),
    inArray(schedulePeriods.status, ['published', 'past']),
    isNull(schedulePeriods.deletedAt),
    gte(schedulePeriods.businessMonth, monthRange.start),
    lte(schedulePeriods.businessMonth, monthRange.end),
  ];
  const selectedRoleIds =
    job.scheduleRoleIds ?? (job.scheduleRoleId === null ? [] : [job.scheduleRoleId]);
  if (selectedRoleIds.length > 0) {
    periodConditions.push(inArray(schedulePeriods.scheduleRoleId, selectedRoleIds));
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
    (job.membershipIds ?? (job.membershipId === null ? [] : [job.membershipId])).length === 0
      ? assignments
      : assignments.filter((assignment) => {
          const membershipIds = job.membershipIds ?? [job.membershipId!];
          return (
            (assignment.plannedMembershipId !== null &&
              membershipIds.includes(assignment.plannedMembershipId)) ||
            (assignment.actualMembershipId !== null &&
              membershipIds.includes(assignment.actualMembershipId))
          );
        });
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

  return {
    content:
      job.fileFormat === 'xlsx'
        ? await buildXlsx(buildScheduleTable(rows), '排班')
        : buildScheduleCsv(rows),
    rowCount: rows.length,
  };
}

async function buildHeadNeckScheduleDocxContent(
  transaction: DatabaseTransaction,
  job: ExportJobRow,
): Promise<ExportContentResult> {
  const config = getHeadNeckDocxConfig(job.groupId);
  if (config === undefined) throw new Error('当前群组未配置 Word 排班导出。');
  const months = getPeriodMonths(job.periodType, job.period);
  const membershipIds = config.firstDutyMembershipIds;
  const members = await transaction
    .select({
      id: groupMemberships.id,
      name: userProfiles.realName,
      userId: groupMemberships.userId,
    })
    .from(groupMemberships)
    .innerJoin(userProfiles, eq(userProfiles.userId, groupMemberships.userId))
    .where(
      and(
        eq(groupMemberships.groupId, job.groupId),
        inArray(groupMemberships.id, [...new Set(membershipIds)]),
        eq(groupMemberships.status, 'active'),
        isNull(groupMemberships.deletedAt),
      ),
    );
  const names = new Map(members.map((member) => [member.id, member.name]));
  if (membershipIds.some((id) => !names.has(id)))
    throw new Error('Word 排班人员配置不完整，请联系管理员。');
  const canonicalByUserId = new Map(members.map((member) => [member.userId, member.id]));
  const membershipAliases = await transaction
    .select({ id: groupMemberships.id, userId: groupMemberships.userId })
    .from(groupMemberships)
    .where(
      and(
        eq(groupMemberships.groupId, job.groupId),
        inArray(groupMemberships.userId, [...canonicalByUserId.keys()]),
      ),
    );
  const canonicalByMembershipId = new Map(
    membershipAliases.map((membership) => [
      membership.id,
      canonicalByUserId.get(membership.userId)!,
    ]),
  );

  const pages: HeadNeckDocxPage[] = [];
  let rowCount = 0;
  for (const monthStart of months) {
    const businessMonth = monthStart.slice(0, 7);
    const end = getMonthEnd(`${businessMonth}-01`);
    const periods = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, job.groupId),
          eq(schedulePeriods.scheduleRoleId, config.firstDutyRoleId),
          inArray(schedulePeriods.status, ['published', 'past']),
          isNull(schedulePeriods.deletedAt),
          eq(schedulePeriods.businessMonth, `${businessMonth}-01`),
        ),
      );
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
    const leaves = await transaction
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.groupId, job.groupId),
          eq(leaveRequests.status, 'approved'),
          isNull(leaveRequests.deletedAt),
          inArray(leaveRequests.membershipId, [...canonicalByMembershipId.keys()]),
          lte(leaveRequests.startsAt, new Date(`${end}T15:59:59.999Z`)),
          gte(leaveRequests.endsAt, new Date(`${businessMonth}-01T00:00:00.000Z`)),
        ),
      );
    const normalizedAssignments = assignments.map((assignment) => {
      const membershipId = resolveHeadNeckDutyMembershipId(assignment, canonicalByMembershipId);
      if (membershipId === undefined) throw new Error('Word 排班包含未配置的一值人员。');
      return { businessDate: assignment.businessDate, membershipId };
    });
    const normalizedLeaves = leaves.map((leave) => ({
      ...leave,
      membershipId: canonicalByMembershipId.get(leave.membershipId)!,
    }));
    const grid = buildHeadNeckRotationGrid(config.firstDutyMembershipIds, normalizedAssignments);
    const firstDuty = grid.map((row) => {
      const memberLeaves = normalizedLeaves.filter(
        (leave) => leave.membershipId === row.membershipId,
      );
      const absenceTypes = [
        ...new Set(memberLeaves.map((leave) => leaveTypeLabel(leave.leaveType))),
      ];
      return {
        memberName: names.get(row.membershipId)!,
        tokens: row.tokens.map((token) =>
          typeof token === 'number'
            ? {
                text: token,
                weekend: isWeekend(`${businessMonth}-${String(token).padStart(2, '0')}`),
              }
            : token === '-'
              ? { text: '-' as const }
              : undefined,
        ),
        ...(absenceTypes.length === 0 ? {} : { absenceTypes }),
      };
    });
    rowCount += assignments.length;
    pages.push({
      firstDuty,
      month: Number(businessMonth.slice(5, 7)),
      roster: config.firstDutyMembershipIds.map((id) => ({
        first: names.get(id)!,
        second: config.secondDutyNameByFirstMembershipId[id]!,
      })),
      thirdDuty: config.thirdDutyNames,
      year: Number(businessMonth.slice(0, 4)),
    });
  }
  return { content: await buildHeadNeckDocx(pages), rowCount };
}

function isWeekend(businessDate: string): boolean {
  const day = new Date(`${businessDate}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function leaveTypeLabel(type: string): string {
  return (
    (
      {
        training: '进修',
        rotation: '轮转',
        sick: '病假',
        maternity: '产假',
        other: '请假',
      } as Record<string, string>
    )[type] ?? type
  );
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
        ...((job.scheduleRoleIds ?? (job.scheduleRoleId === null ? [] : [job.scheduleRoleId]))
          .length === 0
          ? {}
          : { roleIds: job.scheduleRoleIds ?? [job.scheduleRoleId!] }),
        ...((job.membershipIds ?? (job.membershipId === null ? [] : [job.membershipId])).length ===
        0
          ? {}
          : { membershipIds: job.membershipIds ?? [job.membershipId!] }),
      }),
    ),
  );
  const summary = mergeMonthStatistics(summaries.map((month) => month.summary));

  return {
    content:
      job.fileFormat === 'xlsx'
        ? await buildXlsx(buildStatisticsTable(summary), '统计')
        : buildStatisticsCsv(summary),
    rowCount: summary.members.length,
  };
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
