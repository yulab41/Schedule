import type {
  StatisticsMetricsV2,
  StatisticsMemberV2,
  StatisticsRoleCount,
  StatisticsShiftTypeV2,
  StatisticsSummary,
  StatisticsSummaryV2,
} from '@schedule/contracts';
import type {
  StatisticsAssignmentInput,
  StatisticsHolidayInput,
  StatisticsMemberNameInput,
} from './calculate.js';

export const statisticsAlgorithmVersion = 2;
export interface StatisticsContribution {
  readonly id: string;
  readonly kind: 'swap' | 'overtime' | 'deduction';
  readonly assignmentId: string;
  readonly membershipId: string;
}
interface SwapContribution {
  readonly counted: boolean;
  readonly id: string;
  readonly membershipId: string;
  readonly shiftTypeId: string;
}
export interface EffectiveStatistics {
  readonly algorithmVersion: number;
  readonly summary: StatisticsSummaryV2;
  /** Internal snapshot metadata only; never returned to clients. */
  readonly swaps: readonly SwapContribution[];
}
const metricKeys = [
  'plannedCount',
  'actualCount',
  'weekendCount',
  'holidayCount',
  'swapCount',
  'overtimeCount',
  'deductionCount',
] as const;
function emptyMetrics(): StatisticsMetricsV2 {
  return {
    plannedCount: 0,
    actualCount: 0,
    weekendCount: 0,
    holidayCount: 0,
    swapCount: 0,
    overtimeCount: 0,
    deductionCount: 0,
  };
}
function emptySummary(): StatisticsSummaryV2 {
  return { ...emptyMetrics(), members: [], byRole: [], byShiftType: [] };
}

export function calculateEffectiveStatistics(input: {
  readonly assignments: readonly StatisticsAssignmentInput[];
  readonly holidays: readonly StatisticsHolidayInput[];
  readonly memberNames: readonly StatisticsMemberNameInput[];
  readonly contributions: readonly StatisticsContribution[];
}): EffectiveStatistics {
  const summary = emptySummary();
  const members = new Map<string, StatisticsMemberV2>();
  const names = new Map(
    input.memberNames
      .filter((row) => row.realName.trim())
      .map((row) => [row.membershipId, row.realName]),
  );
  const holidays = new Map(input.holidays.map((row) => [row.date, row]));
  const assignments = new Map(input.assignments.map((row) => [row.id, row]));
  const member = (id: string, name?: string | null): StatisticsMemberV2 => {
    let row = members.get(id);
    if (row === undefined) {
      row = {
        ...emptyMetrics(),
        membershipId: id,
        realName: names.get(id) || name?.trim() || '已离群成员',
        byRole: [],
        byShiftType: [],
      };
      members.set(id, row);
    }
    return row;
  };
  for (const assignment of input.assignments) {
    const actual = assignment.actualMemberId ?? assignment.plannedMemberId;
    const identities = [
      {
        id: assignment.plannedMemberId,
        name: assignment.plannedMemberName,
        key: 'plannedCount' as const,
      },
      {
        id: actual,
        name: assignment.actualMemberName ?? assignment.plannedMemberName,
        key: 'actualCount' as const,
      },
    ];
    for (const identity of identities) {
      if (identity.id === null) continue;
      const row = member(identity.id, identity.name);
      const breakdown = shiftRow(row.byShiftType, assignment);
      const groupBreakdown = shiftRow(summary.byShiftType, assignment);
      breakdown[identity.key]++;
      groupBreakdown[identity.key]++;
      if (assignment.countsTowardStatistics) {
        row[identity.key]++;
        summary[identity.key]++;
        roleRow(row.byRole, assignment)[identity.key]++;
        roleRow(summary.byRole, assignment)[identity.key]++;
      }
      if (identity.key !== 'actualCount') continue;
      const holiday = holidays.get(assignment.businessDate);
      const weekday = new Date(`${assignment.businessDate}T00:00:00Z`).getUTCDay();
      const special =
        holiday?.isOffDay === true
          ? 'holidayCount'
          : holiday?.isWorkday !== true && (weekday === 0 || weekday === 6)
            ? 'weekendCount'
            : undefined;
      if (special !== undefined) {
        if (assignment.countsTowardStatistics) {
          row[special]++;
          summary[special]++;
        }
        breakdown[special]++;
        groupBreakdown[special]++;
      }
    }
  }
  const seen = new Set<string>();
  const swaps: SwapContribution[] = [];
  for (const contribution of input.contributions) {
    const assignment = assignments.get(contribution.assignmentId);
    if (assignment === undefined) continue;
    const key = JSON.stringify([
      contribution.kind,
      contribution.id,
      contribution.membershipId,
      contribution.assignmentId,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    const row = member(contribution.membershipId);
    const detail = shiftRow(row.byShiftType, assignment);
    const groupDetail = shiftRow(summary.byShiftType, assignment);
    if (contribution.kind === 'swap') {
      swaps.push({
        counted: assignment.countsTowardStatistics,
        id: contribution.id,
        membershipId: contribution.membershipId,
        shiftTypeId: assignment.shiftTypeId,
      });
    } else {
      const field = contribution.kind === 'overtime' ? 'overtimeCount' : 'deductionCount';
      if (assignment.countsTowardStatistics) {
        row[field]++;
        summary[field]++;
      }
      detail[field]++;
      groupDetail[field]++;
    }
  }
  summary.members = [...members.values()].sort((a, b) =>
    a.membershipId.localeCompare(b.membershipId),
  );
  applySwapCounts(summary, swaps);
  return { algorithmVersion: statisticsAlgorithmVersion, summary, swaps };
}

function shiftRow(
  rows: StatisticsShiftTypeV2[],
  assignment: StatisticsAssignmentInput,
): StatisticsShiftTypeV2 {
  let row = rows.find((item) => item.shiftTypeId === assignment.shiftTypeId);
  if (row === undefined) {
    row = {
      ...emptyMetrics(),
      shiftTypeId: assignment.shiftTypeId,
      shiftTypeName: assignment.shiftTypeName,
      countsTowardStatistics: assignment.countsTowardStatistics,
    };
    rows.push(row);
  } else row.countsTowardStatistics ||= assignment.countsTowardStatistics;
  return row;
}
function roleRow(
  rows: StatisticsRoleCount[],
  assignment: StatisticsAssignmentInput,
): StatisticsRoleCount {
  let row = rows.find((item) => item.scheduleRoleId === assignment.scheduleRoleId);
  if (row === undefined) {
    row = {
      plannedCount: 0,
      actualCount: 0,
      scheduleRoleId: assignment.scheduleRoleId,
      scheduleRoleName: assignment.scheduleRoleName,
    };
    rows.push(row);
  }
  return row;
}
function applySwapCounts(summary: StatisticsSummaryV2, swaps: readonly SwapContribution[]): void {
  summary.swapCount = new Set(swaps.filter((row) => row.counted).map((row) => row.id)).size;
  for (const shift of summary.byShiftType)
    shift.swapCount = new Set(
      swaps.filter((row) => row.shiftTypeId === shift.shiftTypeId).map((row) => row.id),
    ).size;
  for (const member of summary.members) {
    const contributions = swaps.filter((row) => row.membershipId === member.membershipId);
    member.swapCount = new Set(
      contributions.filter((row) => row.counted).map((row) => row.id),
    ).size;
    for (const shift of member.byShiftType)
      shift.swapCount = new Set(
        contributions.filter((row) => row.shiftTypeId === shift.shiftTypeId).map((row) => row.id),
      ).size;
  }
}

export function mergeEffectiveStatistics(
  months: readonly EffectiveStatistics[],
): EffectiveStatistics {
  const summary = emptySummary();
  const swaps: SwapContribution[] = [];
  for (const month of months) {
    addMetrics(summary, month.summary);
    mergeBreakdowns(summary, month.summary);
    swaps.push(...month.swaps);
    for (const member of month.summary.members) {
      let target = summary.members.find((row) => row.membershipId === member.membershipId);
      if (target === undefined) {
        target = {
          ...emptyMetrics(),
          membershipId: member.membershipId,
          realName: member.realName,
          byRole: [],
          byShiftType: [],
        };
        summary.members.push(target);
      }
      addMetrics(target, member);
      mergeBreakdowns(target, member);
    }
  }
  applySwapCounts(summary, swaps);
  return { algorithmVersion: statisticsAlgorithmVersion, summary, swaps };
}
function addMetrics(target: StatisticsMetricsV2, source: StatisticsMetricsV2): void {
  for (const key of metricKeys) target[key] += source[key];
}
function mergeBreakdowns(
  target: Pick<StatisticsSummaryV2, 'byRole' | 'byShiftType'>,
  source: Pick<StatisticsSummaryV2, 'byRole' | 'byShiftType'>,
): void {
  for (const role of source.byRole) {
    const row = target.byRole.find((item) => item.scheduleRoleId === role.scheduleRoleId);
    if (row === undefined) target.byRole.push({ ...role });
    else {
      row.actualCount += role.actualCount;
      row.plannedCount += role.plannedCount;
    }
  }
  for (const shift of source.byShiftType) {
    const row = target.byShiftType.find((item) => item.shiftTypeId === shift.shiftTypeId);
    if (row === undefined) target.byShiftType.push({ ...shift });
    else {
      addMetrics(row, shift);
      row.countsTowardStatistics ||= shift.countsTowardStatistics;
    }
  }
}

export function toLegacyStatistics(summary: StatisticsSummaryV2): StatisticsSummary {
  const legacyFields = (row: StatisticsMetricsV2) => ({
    countedActualCount: row.actualCount,
    countedPlannedCount: row.plannedCount,
    leaveCoverCount: 0,
    manualAdjustmentCount: 0,
    netDutyAdjustment: row.overtimeCount - row.deductionCount,
  });
  const shifts = (rows: readonly StatisticsShiftTypeV2[]) =>
    rows.map(({ shiftTypeId, shiftTypeName, actualCount, plannedCount }) => ({
      shiftTypeId,
      shiftTypeName,
      actualCount,
      plannedCount,
    }));
  return {
    ...summary,
    ...legacyFields(summary),
    byShiftType: shifts(summary.byShiftType),
    members: summary.members.map((row) => ({
      ...row,
      ...legacyFields(row),
      actualVsPlanned: [],
      deltaCount: row.actualCount - row.plannedCount,
      byShiftType: shifts(row.byShiftType),
    })),
  };
}
