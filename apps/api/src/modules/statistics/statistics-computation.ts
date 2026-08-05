import type { StatisticsSummary } from '@schedule/contracts';
import type { DatabaseTransaction } from '@schedule/database';
import {
  holidayCalendarVersions,
  holidayDates,
  scheduleEvents,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
} from '@schedule/database';
import {
  calculateMonthStatistics,
  type StatisticsAssignmentInput,
  type StatisticsHolidayInput,
  type StatisticsWorkflowCountInput,
} from '@schedule/scheduling-domain';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

const workflowEventTypes = [
  'swap_completed',
  'duty_adjustment_completed',
  'duty_adjustment_revoked',
  'leave_cover_completed',
  'manual_schedule_template_applied',
  'schedule_backfill_completed',
] as const;

interface MutableWorkflowCounts {
  deduction: number;
  leaveCover: number;
  manualAdjustment: number;
  overtime: number;
  swap: number;
}

export interface MonthStatisticsResult {
  readonly computedAt: Date;
  readonly summary: StatisticsSummary;
}

export interface StatisticsComputationFilters {
  readonly membershipIds?: readonly string[];
  readonly roleIds?: readonly string[];
}

export class StatisticsComputation {
  public async computeMonth(
    transaction: DatabaseTransaction,
    groupId: string,
    businessMonth: string,
    filters: StatisticsComputationFilters = {},
  ): Promise<MonthStatisticsResult> {
    const periodConditions = [
      eq(schedulePeriods.groupId, groupId),
      eq(schedulePeriods.businessMonth, businessMonth),
      inArray(schedulePeriods.status, ['published', 'past']),
      isNull(schedulePeriods.deletedAt),
    ];
    if (filters.roleIds !== undefined && filters.roleIds.length > 0) {
      periodConditions.push(inArray(schedulePeriods.scheduleRoleId, [...filters.roleIds]));
    }
    const periods = await transaction
      .select()
      .from(schedulePeriods)
      .where(and(...periodConditions));
    const periodIds = periods.map((period) => period.id);
    let assignments =
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
    if (filters.membershipIds !== undefined && filters.membershipIds.length > 0) {
      const membershipSet = new Set(filters.membershipIds);
      assignments = assignments.filter(
        (assignment) =>
          (assignment.plannedMembershipId !== null &&
            membershipSet.has(assignment.plannedMembershipId)) ||
          (assignment.actualMembershipId !== null &&
            membershipSet.has(assignment.actualMembershipId)),
      );
    }
    const roleIds = [...new Set(periods.map((period) => period.scheduleRoleId))];
    const roles =
      roleIds.length === 0
        ? []
        : await transaction
            .select({ id: scheduleRoles.id, name: scheduleRoles.name })
            .from(scheduleRoles)
            .where(inArray(scheduleRoles.id, roleIds));
    const roleNames = new Map(roles.map((role) => [role.id, role.name]));
    const monthStart = businessMonth;
    const monthEnd = getMonthEnd(monthStart);
    const holidayRows = await transaction
      .select({
        calendarDate: holidayDates.calendarDate,
        isOffDay: holidayDates.isOffDay,
        isWorkday: holidayDates.isWorkday,
      })
      .from(holidayDates)
      .innerJoin(
        holidayCalendarVersions,
        eq(holidayCalendarVersions.id, holidayDates.calendarVersionId),
      )
      .where(
        and(
          eq(holidayCalendarVersions.status, 'confirmed'),
          isNull(holidayCalendarVersions.deletedAt),
          gte(holidayDates.calendarDate, monthStart),
          lte(holidayDates.calendarDate, monthEnd),
        ),
      );
    const holidays: readonly StatisticsHolidayInput[] = holidayRows.map((row) => ({
      date: row.calendarDate,
      isOffDay: row.isOffDay === 1,
      isWorkday: row.isWorkday === 1,
    }));

    const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
    const events = await transaction
      .select()
      .from(scheduleEvents)
      .where(
        and(
          eq(scheduleEvents.groupId, groupId),
          inArray(scheduleEvents.eventType, [...workflowEventTypes]),
        ),
      );
    const workflowCounts = buildWorkflowCounts(events, assignments, assignmentIds);

    const memberNames = new Map<string, string>();
    for (const assignment of assignments) {
      if (assignment.plannedMemberName !== null && assignment.plannedMembershipId !== null) {
        memberNames.set(assignment.plannedMembershipId, assignment.plannedMemberName);
      }
      if (assignment.actualMemberName !== null && assignment.actualMembershipId !== null) {
        memberNames.set(assignment.actualMembershipId, assignment.actualMemberName);
      }
    }
    const periodById = new Map(periods.map((period) => [period.id, period]));
    const domainAssignments: StatisticsAssignmentInput[] = assignments.map((assignment) => {
      const period = periodById.get(assignment.schedulePeriodId);
      return {
        actualMemberId: assignment.actualMembershipId,
        actualMemberName: assignment.actualMemberName,
        businessDate: assignment.businessDate,
        countsTowardStatistics: assignment.countsTowardStatistics === 1,
        id: assignment.id,
        plannedMemberId: assignment.plannedMembershipId,
        plannedMemberName: assignment.plannedMemberName,
        scheduleRoleId: period?.scheduleRoleId ?? '',
        scheduleRoleName: roleNames.get(period?.scheduleRoleId ?? '') ?? '',
        shiftTypeId: assignment.shiftTypeId,
        shiftTypeName: assignment.shiftTypeName,
      };
    });

    const summary = calculateMonthStatistics({
      assignments: domainAssignments,
      holidays,
      memberNames: [...memberNames].map(([membershipId, realName]) => ({
        membershipId,
        realName,
      })),
      workflowCounts,
    });

    return { computedAt: new Date(), summary };
  }
}

function buildWorkflowCounts(
  events: readonly (typeof scheduleEvents.$inferSelect)[],
  assignments: readonly (typeof shiftAssignments.$inferSelect)[],
  assignmentIds: ReadonlySet<string>,
): readonly StatisticsWorkflowCountInput[] {
  const counts = new Map<string, MutableWorkflowCounts>();
  const add = (membershipId: string, field: keyof MutableWorkflowCounts, amount: number): void => {
    const entry = counts.get(membershipId) ?? {
      deduction: 0,
      leaveCover: 0,
      manualAdjustment: 0,
      overtime: 0,
      swap: 0,
    };
    entry[field] += amount;
    counts.set(membershipId, entry);
  };

  for (const event of events) {
    if (!event.affectedShiftIds.some((shiftId) => assignmentIds.has(shiftId))) {
      continue;
    }
    if (event.eventType === 'swap_completed') {
      const changedShiftIds = new Set(
        event.affectedShiftIds.filter((shiftId) => assignmentIds.has(shiftId)),
      );
      for (const assignment of assignments) {
        if (changedShiftIds.has(assignment.id) && assignment.actualMembershipId !== null) {
          add(assignment.actualMembershipId, 'swap', 1);
        }
      }
    } else if (event.eventType === 'duty_adjustment_completed') {
      const overtimeMemberId = readActualMemberId(event.afterData);
      const deductedMemberId = event.affectedMembershipIds.find(
        (membershipId) => membershipId !== overtimeMemberId,
      );
      if (overtimeMemberId !== undefined) {
        add(overtimeMemberId, 'overtime', 1);
      }
      if (deductedMemberId !== undefined) {
        add(deductedMemberId, 'deduction', 1);
      }
    } else if (event.eventType === 'duty_adjustment_revoked') {
      const restoredMemberId = readActualMemberId(event.afterData);
      const overtimeMemberId = event.affectedMembershipIds.find(
        (membershipId) => membershipId !== restoredMemberId,
      );
      if (restoredMemberId !== undefined) {
        add(restoredMemberId, 'deduction', -1);
      }
      if (overtimeMemberId !== undefined) {
        add(overtimeMemberId, 'overtime', -1);
      }
    } else if (event.eventType === 'leave_cover_completed') {
      for (const membershipId of event.affectedMembershipIds) {
        add(membershipId, 'leaveCover', 1);
      }
    } else if (event.eventType === 'manual_schedule_template_applied') {
      for (const membershipId of event.affectedMembershipIds) {
        add(membershipId, 'manualAdjustment', 1);
      }
    } else if (event.eventType === 'schedule_backfill_completed') {
      for (const membershipId of event.affectedMembershipIds) {
        add(membershipId, 'manualAdjustment', 1);
      }
    }
  }

  return [...counts.entries()].map(([membershipId, entry]) => ({
    deductionCount: Math.max(0, entry.deduction),
    leaveCoverCount: Math.max(0, entry.leaveCover),
    manualAdjustmentCount: Math.max(0, entry.manualAdjustment),
    membershipId,
    overtimeCount: Math.max(0, entry.overtime),
    swapCount: Math.max(0, entry.swap),
  }));
}

function readActualMemberId(afterData: Record<string, unknown> | null): string | undefined {
  if (afterData === null || typeof afterData.actualMemberId !== 'string') {
    return undefined;
  }
  return afterData.actualMemberId;
}

function getMonthEnd(monthStart: string): string {
  const match = /^(\d{4})-(\d{2})-01$/u.exec(monthStart);
  if (match === null) {
    throw new Error(`Invalid business month ${monthStart}.`);
  }
  const nextMonth = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
  const end = new Date(nextMonth.valueOf() - 1);
  return end.toISOString().slice(0, 10);
}
