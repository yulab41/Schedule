import type { StatisticsSummary } from '@schedule/contracts';
import type { DatabaseTransaction } from '@schedule/database';
import {
  holidayCalendarVersions,
  holidayDates,
  scheduleEvents,
  swapRequests,
  dutyAdjustments,
  groupMemberships,
  userProfiles,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
} from '@schedule/database';
import {
  calculateEffectiveStatistics,
  toLegacyStatistics,
  type EffectiveStatistics,
  type StatisticsContribution,
  type StatisticsAssignmentInput,
  type StatisticsHolidayInput,
} from '@schedule/scheduling-domain';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

export interface MonthStatisticsResult {
  readonly computedAt: Date;
  readonly effective: EffectiveStatistics;
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

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const [swaps, duties] =
      assignmentIds.length === 0
        ? [[], []]
        : await Promise.all([
            transaction
              .select()
              .from(swapRequests)
              .where(
                and(
                  eq(swapRequests.groupId, groupId),
                  eq(swapRequests.status, 'completed'),
                  isNull(swapRequests.deletedAt),
                  or(
                    inArray(swapRequests.initiatorAssignmentId, assignmentIds),
                    inArray(swapRequests.targetAssignmentId, assignmentIds),
                  ),
                ),
              ),
            transaction
              .select()
              .from(dutyAdjustments)
              .where(
                and(
                  eq(dutyAdjustments.groupId, groupId),
                  eq(dutyAdjustments.status, 'completed'),
                  isNull(dutyAdjustments.deletedAt),
                  inArray(dutyAdjustments.coveredAssignmentId, assignmentIds),
                ),
              ),
          ]);
    // Include both sides of a cross-month swap when looking for baseline corrections.
    const relatedIds = [
      ...new Set([
        ...assignmentIds,
        ...swaps.flatMap((row) => [row.initiatorAssignmentId, row.targetAssignmentId]),
      ]),
    ];
    const backfills =
      relatedIds.length === 0
        ? []
        : await transaction
            .select({
              affectedShiftIds: scheduleEvents.affectedShiftIds,
              createdAt: scheduleEvents.occurredAt,
              afterData: scheduleEvents.afterData,
            })
            .from(scheduleEvents)
            .where(
              and(
                eq(scheduleEvents.groupId, groupId),
                eq(scheduleEvents.eventType, 'schedule_backfill_completed'),
                sql`JSON_OVERLAPS(${scheduleEvents.affectedShiftIds}, CAST(${JSON.stringify(relatedIds)} AS JSON))`,
              ),
            );
    const relatedMarkers =
      relatedIds.length === 0
        ? []
        : await transaction
            .select({ id: shiftAssignments.id, backfillAt: shiftAssignments.backfillAt })
            .from(shiftAssignments)
            .where(inArray(shiftAssignments.id, relatedIds));
    const correctedAt = new Map(
      relatedMarkers
        .filter((assignment) => assignment.backfillAt !== null)
        .map((assignment) => [assignment.id, assignment.backfillAt as Date]),
    );
    const correctedMembers = new Map<
      string,
      { id: string | null; name: string | null; at: number }
    >();
    for (const event of backfills)
      for (const id of event.affectedShiftIds) {
        if ((correctedAt.get(id)?.valueOf() ?? 0) < event.createdAt.valueOf())
          correctedAt.set(id, event.createdAt);
        if (
          event.afterData !== null &&
          'actualMembershipId' in event.afterData &&
          (correctedMembers.get(id)?.at ?? 0) <= event.createdAt.valueOf()
        )
          correctedMembers.set(id, {
            id:
              typeof event.afterData.actualMembershipId === 'string'
                ? event.afterData.actualMembershipId
                : null,
            name:
              typeof event.afterData.actualMemberName === 'string'
                ? event.afterData.actualMemberName
                : null,
            at: event.createdAt.valueOf(),
          });
      }
    const contributions: StatisticsContribution[] = [];
    for (const swap of swaps) {
      const completedAt = (swap.decidedAt ?? swap.createdAt).valueOf();
      if (
        [swap.initiatorAssignmentId, swap.targetAssignmentId].some(
          (id) => (correctedAt.get(id)?.valueOf() ?? 0) >= completedAt,
        )
      )
        continue;
      contributions.push(
        {
          id: swap.id,
          kind: 'swap',
          assignmentId: swap.targetAssignmentId,
          membershipId: swap.initiatorMembershipId,
        },
        {
          id: swap.id,
          kind: 'swap',
          assignmentId: swap.initiatorAssignmentId,
          membershipId: swap.targetMembershipId,
        },
      );
    }
    for (const duty of duties) {
      if (
        (correctedAt.get(duty.coveredAssignmentId)?.valueOf() ?? 0) >=
        (duty.decidedAt ?? duty.createdAt).valueOf()
      )
        continue;
      contributions.push(
        {
          id: duty.id,
          kind: 'overtime',
          assignmentId: duty.coveredAssignmentId,
          membershipId: duty.overtimeMembershipId,
        },
        {
          id: duty.id,
          kind: 'deduction',
          assignmentId: duty.coveredAssignmentId,
          membershipId: duty.deductedMembershipId,
        },
      );
    }

    const memberNames = new Map<string, string>();
    for (const assignment of assignments) {
      if (assignment.plannedMemberName !== null && assignment.plannedMembershipId !== null) {
        memberNames.set(assignment.plannedMembershipId, assignment.plannedMemberName);
      }
      if (assignment.actualMemberName !== null && assignment.actualMembershipId !== null) {
        memberNames.set(assignment.actualMembershipId, assignment.actualMemberName);
      }
    }
    const knownIds = [
      ...new Set([
        ...memberNames.keys(),
        ...assignments
          .flatMap((row) => [row.plannedMembershipId, row.actualMembershipId])
          .filter((id): id is string => id !== null),
        ...contributions.map((entry) => entry.membershipId),
      ]),
    ];
    if (knownIds.length > 0) {
      const profiles = await transaction
        .select({ membershipId: groupMemberships.id, realName: userProfiles.realName })
        .from(groupMemberships)
        .innerJoin(userProfiles, eq(userProfiles.userId, groupMemberships.userId))
        .where(inArray(groupMemberships.id, knownIds));
      for (const profile of profiles)
        if (profile.realName.trim()) memberNames.set(profile.membershipId, profile.realName);
    }
    const periodById = new Map(periods.map((period) => [period.id, period]));
    const domainAssignments: StatisticsAssignmentInput[] = assignments.map((assignment) => {
      const period = periodById.get(assignment.schedulePeriodId);
      const correction = correctedMembers.get(assignment.id);
      return {
        actualMemberId: assignment.actualMembershipId,
        actualMemberName: assignment.actualMemberName,
        businessDate: assignment.businessDate,
        countsTowardStatistics: assignment.countsTowardStatistics === 1,
        id: assignment.id,
        plannedMemberId:
          correction !== undefined
            ? correction.id
            : correctedAt.has(assignment.id)
              ? assignment.actualMembershipId
              : assignment.plannedMembershipId,
        plannedMemberName:
          correction !== undefined
            ? correction.name
            : correctedAt.has(assignment.id)
              ? assignment.actualMemberName
              : assignment.plannedMemberName,
        scheduleRoleId: period?.scheduleRoleId ?? '',
        scheduleRoleName: roleNames.get(period?.scheduleRoleId ?? '') ?? '',
        shiftTypeId: assignment.shiftTypeId,
        shiftTypeName: assignment.shiftTypeName,
      };
    });

    const effective = calculateEffectiveStatistics({
      assignments: domainAssignments,
      holidays,
      memberNames: [...memberNames].map(([membershipId, realName]) => ({
        membershipId,
        realName,
      })),
      contributions,
    });

    return { computedAt: new Date(), summary: toLegacyStatistics(effective.summary), effective };
  }
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
