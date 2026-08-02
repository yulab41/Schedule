import type {
  StatisticsActualVsPlannedEntry,
  StatisticsMemberRow,
  StatisticsRoleCount,
  StatisticsShiftTypeCount,
  StatisticsSummary,
} from '@schedule/contracts';

const maximumActualVsPlannedEntries = 50;

export interface StatisticsAssignmentInput {
  readonly actualMemberId: string | null;
  readonly actualMemberName: string | null;
  readonly businessDate: string;
  readonly countsTowardStatistics: boolean;
  readonly id: string;
  readonly plannedMemberId: string | null;
  readonly plannedMemberName: string | null;
  readonly scheduleRoleId: string;
  readonly scheduleRoleName: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
}

export interface StatisticsHolidayInput {
  readonly date: string;
  readonly isOffDay: boolean;
  readonly isWorkday: boolean;
}

export interface StatisticsWorkflowCountInput {
  readonly deductionCount?: number;
  readonly leaveCoverCount?: number;
  readonly manualAdjustmentCount?: number;
  readonly membershipId: string;
  readonly overtimeCount?: number;
  readonly swapCount?: number;
}

export interface StatisticsMemberNameInput {
  readonly membershipId: string;
  readonly realName: string;
}

export interface StatisticsCalculationInput {
  readonly assignments: readonly StatisticsAssignmentInput[];
  readonly holidays: readonly StatisticsHolidayInput[];
  readonly memberNames: readonly StatisticsMemberNameInput[];
  readonly workflowCounts: readonly StatisticsWorkflowCountInput[];
}

export function calculateMonthStatistics(input: StatisticsCalculationInput): StatisticsSummary {
  const holidayByDate = new Map(input.holidays.map((holiday) => [holiday.date, holiday]));
  const memberNames = new Map(
    input.memberNames.map((member) => [member.membershipId, member.realName]),
  );
  const workflowByMembershipId = new Map(
    input.workflowCounts.map((workflow) => [workflow.membershipId, workflow]),
  );
  const membershipIds = new Set<string>();
  for (const assignment of input.assignments) {
    if (assignment.plannedMemberId !== null) {
      membershipIds.add(assignment.plannedMemberId);
    }
    if (assignment.actualMemberId !== null) {
      membershipIds.add(assignment.actualMemberId);
    }
  }
  for (const workflow of input.workflowCounts) {
    membershipIds.add(workflow.membershipId);
  }

  const members = [...membershipIds]
    .sort()
    .map((membershipId) =>
      buildMemberRow(
        membershipId,
        input.assignments,
        holidayByDate,
        workflowByMembershipId,
        memberNames,
      ),
    );
  const summary = buildSummary(members, input.assignments);

  return summary;
}

export function mergeMonthStatistics(months: readonly StatisticsSummary[]): StatisticsSummary {
  const membersById = new Map<string, StatisticsMemberRow>();
  const roleCounts = new Map<string, StatisticsRoleCount>();
  const shiftTypeCounts = new Map<string, StatisticsShiftTypeCount>();

  for (const month of months) {
    for (const member of month.members) {
      const existing = membersById.get(member.membershipId);
      membersById.set(
        member.membershipId,
        existing === undefined ? member : mergeMemberRows(existing, member),
      );
    }
    for (const role of month.byRole) {
      const existing = roleCounts.get(role.scheduleRoleId);
      roleCounts.set(role.scheduleRoleId, {
        actualCount: (existing?.actualCount ?? 0) + role.actualCount,
        plannedCount: (existing?.plannedCount ?? 0) + role.plannedCount,
        scheduleRoleId: role.scheduleRoleId,
        scheduleRoleName: role.scheduleRoleName,
      });
    }
    for (const shiftType of month.byShiftType) {
      const existing = shiftTypeCounts.get(shiftType.shiftTypeId);
      shiftTypeCounts.set(shiftType.shiftTypeId, {
        actualCount: (existing?.actualCount ?? 0) + shiftType.actualCount,
        plannedCount: (existing?.plannedCount ?? 0) + shiftType.plannedCount,
        shiftTypeId: shiftType.shiftTypeId,
        shiftTypeName: shiftType.shiftTypeName,
      });
    }
  }

  const members = [...membersById.values()].sort((first, second) =>
    first.membershipId.localeCompare(second.membershipId),
  );
  const byRole = [...roleCounts.values()].sort((first, second) =>
    first.scheduleRoleId.localeCompare(second.scheduleRoleId),
  );
  const byShiftType = [...shiftTypeCounts.values()].sort((first, second) =>
    first.shiftTypeId.localeCompare(second.shiftTypeId),
  );

  return {
    actualCount: sum(members.map((member) => member.actualCount)),
    byRole,
    byShiftType,
    countedActualCount: sum(members.map((member) => member.countedActualCount)),
    countedPlannedCount: sum(members.map((member) => member.countedPlannedCount)),
    deductionCount: sum(members.map((member) => member.deductionCount)),
    holidayCount: sum(members.map((member) => member.holidayCount)),
    leaveCoverCount: sum(members.map((member) => member.leaveCoverCount)),
    manualAdjustmentCount: sum(members.map((member) => member.manualAdjustmentCount)),
    members,
    netDutyAdjustment: sum(members.map((member) => member.netDutyAdjustment)),
    overtimeCount: sum(members.map((member) => member.overtimeCount)),
    plannedCount: sum(members.map((member) => member.plannedCount)),
    swapCount: sum(members.map((member) => member.swapCount)),
    weekendCount: sum(members.map((member) => member.weekendCount)),
  };
}

function buildMemberRow(
  membershipId: string,
  assignments: readonly StatisticsAssignmentInput[],
  holidayByDate: ReadonlyMap<string, StatisticsHolidayInput>,
  workflowByMembershipId: ReadonlyMap<string, StatisticsWorkflowCountInput>,
  memberNames: ReadonlyMap<string, string>,
): StatisticsMemberRow {
  const memberAssignments = assignments.filter(
    (assignment) =>
      assignment.plannedMemberId === membershipId ||
      getEffectiveActualMemberId(assignment) === membershipId,
  );
  const plannedAssignments = memberAssignments.filter(
    (assignment) => assignment.plannedMemberId === membershipId,
  );
  const actualAssignments = memberAssignments.filter(
    (assignment) => getEffectiveActualMemberId(assignment) === membershipId,
  );
  const countedPlanned = plannedAssignments.filter(
    (assignment) => assignment.countsTowardStatistics,
  );
  const countedActual = actualAssignments.filter((assignment) => assignment.countsTowardStatistics);
  const weekendCount = countedActual.filter((assignment) =>
    isWeekendWithoutHoliday(assignment.businessDate, holidayByDate),
  ).length;
  const holidayCount = countedActual.filter(
    (assignment) => holidayByDate.get(assignment.businessDate)?.isOffDay === true,
  ).length;
  const workflow = workflowByMembershipId.get(membershipId);
  const swapCount = workflow?.swapCount ?? 0;
  const overtimeCount = workflow?.overtimeCount ?? 0;
  const deductionCount = workflow?.deductionCount ?? 0;
  const leaveCoverCount = workflow?.leaveCoverCount ?? 0;
  const manualAdjustmentCount = workflow?.manualAdjustmentCount ?? 0;

  return {
    actualCount: actualAssignments.length,
    actualVsPlanned: buildActualVsPlanned(memberAssignments, membershipId),
    byRole: buildRoleCounts(memberAssignments),
    byShiftType: buildShiftTypeCounts(memberAssignments),
    countedActualCount: countedActual.length,
    countedPlannedCount: countedPlanned.length,
    deductionCount,
    deltaCount: actualAssignments.length - plannedAssignments.length,
    holidayCount,
    leaveCoverCount,
    manualAdjustmentCount,
    membershipId,
    netDutyAdjustment: overtimeCount - deductionCount,
    overtimeCount,
    plannedCount: plannedAssignments.length,
    realName: memberNames.get(membershipId) ?? '',
    swapCount,
    weekendCount,
  };
}

function buildActualVsPlanned(
  assignments: readonly StatisticsAssignmentInput[],
  membershipId: string,
): readonly StatisticsActualVsPlannedEntry[] {
  return assignments
    .filter(
      (assignment) =>
        assignment.actualMemberId === membershipId &&
        assignment.actualMemberId !== assignment.plannedMemberId,
    )
    .slice(0, maximumActualVsPlannedEntries)
    .map((assignment) => ({
      businessDate: assignment.businessDate,
      shiftTypeName: assignment.shiftTypeName,
      ...(assignment.plannedMemberId === null
        ? {}
        : { plannedMemberId: assignment.plannedMemberId }),
      ...(assignment.plannedMemberName === null
        ? {}
        : { plannedMemberName: assignment.plannedMemberName }),
      ...(assignment.actualMemberName === null
        ? {}
        : { actualMemberName: assignment.actualMemberName }),
      actualMemberId: membershipId,
    }));
}

function buildRoleCounts(
  assignments: readonly StatisticsAssignmentInput[],
): readonly StatisticsRoleCount[] {
  const counts = new Map<string, { actual: number; planned: number; name: string }>();
  for (const assignment of assignments) {
    const entry = counts.get(assignment.scheduleRoleId) ?? {
      actual: 0,
      name: assignment.scheduleRoleName,
      planned: 0,
    };
    if (assignment.plannedMemberId !== null) {
      entry.planned += 1;
    }
    if (getEffectiveActualMemberId(assignment) !== null) {
      entry.actual += 1;
    }
    counts.set(assignment.scheduleRoleId, entry);
  }

  return [...counts.entries()]
    .sort(([firstId], [secondId]) => firstId.localeCompare(secondId))
    .map(([scheduleRoleId, entry]) => ({
      actualCount: entry.actual,
      plannedCount: entry.planned,
      scheduleRoleId,
      scheduleRoleName: entry.name,
    }));
}

function buildShiftTypeCounts(
  assignments: readonly StatisticsAssignmentInput[],
): readonly StatisticsShiftTypeCount[] {
  const counts = new Map<string, { actual: number; planned: number; name: string }>();
  for (const assignment of assignments) {
    const entry = counts.get(assignment.shiftTypeId) ?? {
      actual: 0,
      name: assignment.shiftTypeName,
      planned: 0,
    };
    if (assignment.plannedMemberId !== null) {
      entry.planned += 1;
    }
    if (getEffectiveActualMemberId(assignment) !== null) {
      entry.actual += 1;
    }
    counts.set(assignment.shiftTypeId, entry);
  }

  return [...counts.entries()]
    .sort(([firstId], [secondId]) => firstId.localeCompare(secondId))
    .map(([shiftTypeId, entry]) => ({
      actualCount: entry.actual,
      plannedCount: entry.planned,
      shiftTypeId,
      shiftTypeName: entry.name,
    }));
}

function buildSummary(
  members: readonly StatisticsMemberRow[],
  assignments: readonly StatisticsAssignmentInput[],
): StatisticsSummary {
  return {
    actualCount: sum(members.map((member) => member.actualCount)),
    byRole: buildRoleCounts(assignments),
    byShiftType: buildShiftTypeCounts(assignments),
    countedActualCount: sum(members.map((member) => member.countedActualCount)),
    countedPlannedCount: sum(members.map((member) => member.countedPlannedCount)),
    deductionCount: sum(members.map((member) => member.deductionCount)),
    holidayCount: sum(members.map((member) => member.holidayCount)),
    leaveCoverCount: sum(members.map((member) => member.leaveCoverCount)),
    manualAdjustmentCount: sum(members.map((member) => member.manualAdjustmentCount)),
    members,
    netDutyAdjustment: sum(members.map((member) => member.netDutyAdjustment)),
    overtimeCount: sum(members.map((member) => member.overtimeCount)),
    plannedCount: sum(members.map((member) => member.plannedCount)),
    swapCount: sum(members.map((member) => member.swapCount)),
    weekendCount: sum(members.map((member) => member.weekendCount)),
  };
}

function isWeekendWithoutHoliday(
  businessDate: string,
  holidayByDate: ReadonlyMap<string, StatisticsHolidayInput>,
): boolean {
  const holiday = holidayByDate.get(businessDate);
  if (holiday !== undefined && (holiday.isOffDay || holiday.isWorkday)) {
    return false;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(businessDate);
  if (match === null) {
    return false;
  }
  const day = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  ).getUTCDay();
  return day === 0 || day === 6;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function getEffectiveActualMemberId(assignment: StatisticsAssignmentInput): string | null {
  return assignment.actualMemberId ?? assignment.plannedMemberId;
}

function mergeMemberRows(
  first: StatisticsMemberRow,
  second: StatisticsMemberRow,
): StatisticsMemberRow {
  return {
    actualCount: first.actualCount + second.actualCount,
    actualVsPlanned: [...first.actualVsPlanned, ...second.actualVsPlanned].slice(
      0,
      maximumActualVsPlannedEntries,
    ),
    byRole: mergeCountsByKey(first.byRole, second.byRole, (role) => role.scheduleRoleId),
    byShiftType: mergeCountsByKey(
      first.byShiftType,
      second.byShiftType,
      (shiftType) => shiftType.shiftTypeId,
    ),
    countedActualCount: first.countedActualCount + second.countedActualCount,
    countedPlannedCount: first.countedPlannedCount + second.countedPlannedCount,
    deductionCount: first.deductionCount + second.deductionCount,
    deltaCount: first.deltaCount + second.deltaCount,
    holidayCount: first.holidayCount + second.holidayCount,
    leaveCoverCount: first.leaveCoverCount + second.leaveCoverCount,
    manualAdjustmentCount: first.manualAdjustmentCount + second.manualAdjustmentCount,
    membershipId: first.membershipId,
    netDutyAdjustment: first.netDutyAdjustment + second.netDutyAdjustment,
    overtimeCount: first.overtimeCount + second.overtimeCount,
    plannedCount: first.plannedCount + second.plannedCount,
    realName: first.realName.length > 0 ? first.realName : second.realName,
    swapCount: first.swapCount + second.swapCount,
    weekendCount: first.weekendCount + second.weekendCount,
  };
}

function mergeCountsByKey<
  Count extends { readonly actualCount: number; readonly plannedCount: number },
>(first: readonly Count[], second: readonly Count[], getKey: (count: Count) => string): Count[] {
  const counts = new Map<string, Count>();
  for (const count of [...first, ...second]) {
    const key = getKey(count);
    const existing = counts.get(key);
    counts.set(key, {
      ...count,
      actualCount: (existing?.actualCount ?? 0) + count.actualCount,
      plannedCount: (existing?.plannedCount ?? 0) + count.plannedCount,
    } as Count);
  }
  return [...counts.values()];
}
