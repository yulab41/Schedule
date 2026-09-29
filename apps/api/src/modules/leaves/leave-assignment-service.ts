import type { LeaveApprovalPreview } from '@schedule/contracts';
import {
  leaveRequests,
  schedulePeriods,
  shiftAssignments,
  type DatabaseTransaction,
} from '@schedule/database';
import {
  getChinaStandardTimeBusinessDate,
  leaveOverlapsInterval,
} from '@schedule/scheduling-domain';
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { ApiError } from '../../plugins/error-handler.js';
import type { ActiveGroup } from '../groups/permission-service.js';
import { getCurrentDutyMembershipId } from '../workflows/workflow-conflict-service.js';

type Assignment = typeof shiftAssignments.$inferSelect;
type Period = typeof schedulePeriods.$inferSelect;
type Leave = typeof leaveRequests.$inferSelect;
export interface LeaveApprovalContext {
  readonly assignments: readonly Assignment[];
  readonly periods: readonly Period[];
  readonly preview: LeaveApprovalPreview;
}

export class LeaveAssignmentService {
  public async preview(
    transaction: DatabaseTransaction,
    group: ActiveGroup,
    leave: Leave,
    lockRows = false,
  ): Promise<LeaveApprovalContext> {
    const firstMonth = `${getChinaStandardTimeBusinessDate(leave.startsAt).slice(0, 7)}-01`;
    const lastMonth = `${getChinaStandardTimeBusinessDate(leave.endsAt).slice(0, 7)}-01`;
    const overlap =
      leave.isAllDay === 1
        ? sql`(${shiftAssignments.businessDate} >= ${getChinaStandardTimeBusinessDate(leave.startsAt)} AND ${shiftAssignments.businessDate} < ${getChinaStandardTimeBusinessDate(leave.endsAt)}) OR (${shiftAssignments.endsAt} > ${new Date(`${getChinaStandardTimeBusinessDate(leave.startsAt)}T00:00:00+08:00`)} AND ${shiftAssignments.startsAt} < ${new Date(`${getChinaStandardTimeBusinessDate(leave.endsAt)}T00:00:00+08:00`)})`
        : sql`${shiftAssignments.endsAt} > ${leave.startsAt} AND ${shiftAssignments.startsAt} < ${leave.endsAt}`;
    let periodQuery = transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, group.id),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
          sql`EXISTS (SELECT 1 FROM ${shiftAssignments} WHERE ${shiftAssignments.schedulePeriodId} = ${schedulePeriods.id} AND ${shiftAssignments.deletedAt} IS NULL AND (${overlap}))`,
        ),
      )
      .orderBy(asc(schedulePeriods.id));
    if (lockRows) periodQuery = periodQuery.for('update') as typeof periodQuery;
    const periods = await periodQuery;
    let rows: Assignment[] = [];
    if (periods.length > 0) {
      let query = transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(
            inArray(
              shiftAssignments.schedulePeriodId,
              periods.map((p) => p.id),
            ),
            isNull(shiftAssignments.deletedAt),
          ),
        )
        .orderBy(asc(shiftAssignments.id));
      if (lockRows) query = query.for('update') as typeof query;
      rows = await query;
    }
    const now = Date.now();
    const assignments = rows.filter(
      (row) =>
        row.endsAt.valueOf() > now &&
        getCurrentDutyMembershipId(row) === leave.membershipId &&
        leaveOverlapsInterval(leave, row),
    );
    const [unpublished] = await transaction
      .select({ id: schedulePeriods.id })
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, group.id),
          inArray(schedulePeriods.status, ['draft', 'pending_publication']),
          isNull(schedulePeriods.deletedAt),
          gte(schedulePeriods.businessMonth, firstMonth),
          lte(schedulePeriods.businessMonth, lastMonth),
        ),
      )
      .limit(1);
    return {
      assignments,
      periods,
      preview: {
        affectedAssignments: assignments.map((a) => ({
          assignmentId: a.id,
          businessDate: a.businessDate,
          endsAt: a.endsAt.toISOString(),
          previousMemberId: leave.membershipId,
          previousMemberName: a.actualMemberName ?? a.plannedMemberName ?? '',
          shiftTypeAbbreviation: a.shiftTypeAbbreviation,
          shiftTypeColor: a.shiftTypeColor,
          shiftTypeId: a.shiftTypeId,
          shiftTypeName: a.shiftTypeName,
          shiftTypeTextColor: a.shiftTypeTextColor,
          slotPosition: a.slotPosition,
          startsAt: a.startsAt.toISOString(),
        })),
        affectedShiftCount: assignments.length,
        affectedShifts: assignments.map((a) => ({
          businessDate: a.businessDate,
          memberName: a.actualMemberName ?? a.plannedMemberName ?? '',
          shiftTypeAbbreviation: a.shiftTypeAbbreviation,
          shiftTypeName: a.shiftTypeName,
        })),
        assignmentVersions: Object.fromEntries(assignments.map((a) => [a.id, a.version])),
        leaveRequestId: leave.id,
        leaveRequestVersion: leave.version,
        overlapsUnpublishedPeriod: unpublished !== undefined,
        periodVersions: Object.fromEntries(periods.map((p) => [p.id, p.version])),
        rulesVersion: group.rulesVersion,
        statisticsDelta: {
          byMember: [],
          totalAssignmentDelta: 0,
          totalCountedDelta: 0,
          totalWeekendDelta: 0,
        },
        vacancies: [],
        workflowBlockers: [],
      },
    };
  }

  public assertAssignmentVersions(
    context: LeaveApprovalContext,
    expected: Readonly<Record<string, number>>,
  ): void {
    if (
      Object.keys(expected).length !== context.assignments.length ||
      context.assignments.some((a) => expected[a.id] !== a.version)
    ) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '受影响班次已变化，请重新预览后批准。',
      });
    }
  }
}
