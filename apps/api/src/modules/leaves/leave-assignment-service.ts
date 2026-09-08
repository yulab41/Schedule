import type { LeaveApprovalPreview, LeaveRestorationResult } from '@schedule/contracts';
import {
  groupMemberships,
  leaveRequests,
  scheduleEvents,
  schedulePeriods,
  shiftAssignments,
  type DatabaseTransaction,
} from '@schedule/database';
import {
  createAssignmentBusinessKey,
  getChinaStandardTimeBusinessDate,
  leaveOverlapsInterval,
} from '@schedule/scheduling-domain';
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { ApiError } from '../../plugins/error-handler.js';
import type { ActiveGroup, GroupAuthorization } from '../groups/permission-service.js';
import { updateShiftAssignments } from '../schedules/shift-assignment-writer.js';
import { getCurrentDutyMembershipId } from '../workflows/workflow-conflict-service.js';
import type { WorkflowServices } from '../workflows/workflow-services.js';
import {
  isEmptyClearedAssignmentSnapshot,
  readClearedAssignmentSnapshots,
  restorationSkipReason,
} from './leave-restoration.js';

type Assignment = typeof shiftAssignments.$inferSelect;
type Period = typeof schedulePeriods.$inferSelect;
type Leave = typeof leaveRequests.$inferSelect;
export interface LeaveApprovalContext {
  readonly assignments: readonly Assignment[];
  readonly periods: readonly Period[];
  readonly preview: LeaveApprovalPreview;
}

export class LeaveAssignmentService {
  public constructor(private readonly services: WorkflowServices) {}

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
        ? sql`${shiftAssignments.businessDate} >= ${getChinaStandardTimeBusinessDate(leave.startsAt)} AND ${shiftAssignments.businessDate} < ${getChinaStandardTimeBusinessDate(leave.endsAt)}`
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
        row.startsAt.valueOf() > now &&
        getCurrentDutyMembershipId(row) === leave.membershipId &&
        leaveOverlapsInterval(leave, row),
    );
    const roles = new Map(periods.map((p) => [p.id, p.scheduleRoleId]));
    const completedBlockers = await this.services.workflowConflictService.findLeaveWorkflowBlockers(
      transaction,
      group.id,
      leave.membershipId,
      leave.startsAt,
      leave.endsAt,
      leave.isAllDay,
    );
    const pendingBlockers =
      assignments.length === 0
        ? []
        : await this.services.workflowConflictService.findSwapAssignmentConflicts(
            transaction,
            group.id,
            assignments.map((a) => a.id),
            lockRows,
          );
    const workflowBlockers = [
      ...new Map(
        [...completedBlockers, ...pendingBlockers].map(({ assignmentId, message }) => [
          `${assignmentId}:${message}`,
          { assignmentId, message },
        ]),
      ).values(),
    ];
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
    const counted = assignments.filter((a) => a.countsTowardStatistics === 1).length;
    const weekend = assignments.filter((a) => {
      const d = new Date(`${a.businessDate}T00:00:00Z`).getUTCDay();
      return d === 0 || d === 6;
    }).length;
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
          byMember:
            assignments.length === 0
              ? []
              : [
                  {
                    membershipId: leave.membershipId,
                    realName:
                      assignments[0]?.actualMemberName ?? assignments[0]?.plannedMemberName ?? '',
                    assignmentDelta: -assignments.length,
                    countedDelta: -counted,
                    weekendDelta: -weekend,
                  },
                ],
          totalAssignmentDelta: -assignments.length,
          totalCountedDelta: -counted,
          totalWeekendDelta: -weekend,
        },
        vacancies: assignments.map((a) => ({
          assignmentBusinessKey: createAssignmentBusinessKey(
            roles.get(a.schedulePeriodId) ?? '',
            a.businessDate,
            a.slotPosition,
          ),
          businessDate: a.businessDate,
          code: 'NO_ELIGIBLE_MEMBER',
          scheduleRoleId: roles.get(a.schedulePeriodId) ?? '',
          slotPosition: a.slotPosition,
        })),
        workflowBlockers,
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

  public async clear(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    leave: Leave,
    context: LeaveApprovalContext,
    operationId: string,
    approvalEventId: string,
  ): Promise<void> {
    if (context.assignments.length === 0) {
      await this.services.eventWriter.append(transaction, {
        affectedMembershipIds: [leave.membershipId],
        affectedShiftIds: [],
        beforeData: { snapshotSchemaVersion: 1, assignments: [] },
        afterData: { clearedVersions: {} },
        eventStatus: 'completed',
        eventType: 'leave_assignments_cleared',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: leave.id,
        objectType: 'leave_request',
        operationId,
        operatorUserId: authorization.user.id,
        parentEventId: approvalEventId,
      });
      return;
    }
    for (const period of context.periods) {
      const rows = context.assignments.filter((a) => a.schedulePeriodId === period.id);
      if (rows.length === 0) continue;
      for (const row of rows) {
        if (row.startsAt.valueOf() <= Date.now())
          throw new ApiError({
            code: 'CONFLICT',
            statusCode: 409,
            userMessage: '班次已开始，请重新预览。',
          });
        await updateShiftAssignments(transaction, eq(shiftAssignments.id, row.id), {
          plannedMembershipId: null,
          plannedMemberName: null,
          actualMembershipId: null,
          actualMemberName: null,
        });
      }
      await this.services.eventWriter.append(transaction, {
        affectedMembershipIds: [leave.membershipId],
        affectedShiftIds: rows.map((a) => a.id),
        beforeData: {
          snapshotSchemaVersion: 1,
          assignments: rows.map((a) => ({
            id: a.id,
            schedulePeriodId: a.schedulePeriodId,
            version: a.version,
            plannedMembershipId: a.plannedMembershipId,
            plannedMemberName: a.plannedMemberName,
            actualMembershipId: a.actualMembershipId,
            actualMemberName: a.actualMemberName,
          })),
        },
        afterData: { clearedVersions: Object.fromEntries(rows.map((a) => [a.id, a.version + 1])) },
        eventStatus: 'completed',
        eventType: 'leave_assignments_cleared',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: leave.id,
        objectType: 'leave_request',
        operationId,
        operatorUserId: authorization.user.id,
        parentEventId: approvalEventId,
        schedulePeriodId: period.id,
      });
      await this.services.statisticsService.refreshInTransaction(
        transaction,
        authorization.group.id,
        period.businessMonth,
      );
    }
  }

  public async restore(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    leave: Leave,
  ): Promise<LeaveRestorationResult> {
    const events = await transaction
      .select()
      .from(scheduleEvents)
      .where(
        and(
          eq(scheduleEvents.groupId, authorization.group.id),
          eq(scheduleEvents.objectId, leave.id),
          eq(scheduleEvents.objectType, 'leave_request'),
          eq(scheduleEvents.eventType, 'leave_assignments_cleared'),
          eq(scheduleEvents.eventStatus, 'completed'),
        ),
      )
      .orderBy(asc(scheduleEvents.id));
    const restoredAssignmentIds: string[] = [];
    const skippedAssignments: { assignmentId: string; reason: string }[] = [];
    if (events.length === 0)
      return { restoredAssignmentIds, skippedAssignments, restorationUnavailable: true };
    const snapshots = events.flatMap((event) => {
      const parsed = readClearedAssignmentSnapshots(event.beforeData, event.afterData);
      if (
        parsed.length === 0 &&
        !isEmptyClearedAssignmentSnapshot(event.beforeData, event.afterData)
      )
        skippedAssignments.push(
          ...event.affectedShiftIds.map((assignmentId) => ({
            assignmentId,
            reason: 'snapshot_unavailable',
          })),
        );
      return parsed;
    });
    const periodIds = [...new Set(snapshots.map((s) => s.schedulePeriodId))].sort();
    const periods =
      periodIds.length === 0
        ? []
        : await transaction
            .select()
            .from(schedulePeriods)
            .where(
              and(
                eq(schedulePeriods.groupId, authorization.group.id),
                inArray(schedulePeriods.id, periodIds),
              ),
            )
            .orderBy(asc(schedulePeriods.id))
            .for('update');
    const periodById = new Map(periods.map((p) => [p.id, p]));
    const ids = [...new Set(snapshots.map((s) => s.id))].sort();
    const rows =
      ids.length === 0
        ? []
        : await transaction
            .select()
            .from(shiftAssignments)
            .where(inArray(shiftAssignments.id, ids))
            .orderBy(asc(shiftAssignments.id))
            .for('update');
    const rowsById = new Map(rows.map((a) => [a.id, a]));
    const refreshedMonths = new Set<string>();
    for (const snapshot of snapshots.sort((a, b) => a.id.localeCompare(b.id))) {
      const row = rowsById.get(snapshot.id),
        period = periodById.get(snapshot.schedulePeriodId);
      let reason = restorationSkipReason(snapshot, row, period, new Date());
      if (row !== undefined && period !== undefined && reason === undefined) {
        const snapshotMemberIds = [
          ...new Set(
            [snapshot.actualMembershipId, snapshot.plannedMembershipId].filter(
              (id): id is string => id !== null,
            ),
          ),
        ].sort();
        const members =
          snapshotMemberIds.length === 0
            ? []
            : await transaction
                .select({ id: groupMemberships.id })
                .from(groupMemberships)
                .where(
                  and(
                    eq(groupMemberships.groupId, authorization.group.id),
                    inArray(groupMemberships.id, snapshotMemberIds),
                  ),
                )
                .orderBy(asc(groupMemberships.id))
                .for('update');
        if (members.length !== snapshotMemberIds.length) reason = 'snapshot_member_missing';
        const membershipId = snapshot.actualMembershipId ?? snapshot.plannedMembershipId;
        if (membershipId === null) reason = 'snapshot_unavailable';
        else if (reason === undefined) {
          const conflicts =
            await this.services.workflowConflictService.findMemberEligibilityConflicts(
              transaction,
              authorization.group.id,
              membershipId,
              row,
              period.scheduleRoleId,
              row.id,
              true,
            );
          const workflows =
            await this.services.workflowConflictService.findDutyAdjustmentAssignmentConflicts(
              transaction,
              authorization.group.id,
              row.id,
              undefined,
              true,
            );
          if (conflicts.length > 0 || workflows.length > 0) reason = 'member_or_workflow_conflict';
        }
      }
      if (reason === undefined && row !== undefined && row.startsAt.valueOf() <= Date.now())
        reason = 'already_started';
      if (reason !== undefined || row === undefined || period === undefined) {
        skippedAssignments.push({
          assignmentId: snapshot.id,
          reason: reason ?? 'assignment_missing',
        });
        continue;
      }
      await updateShiftAssignments(transaction, eq(shiftAssignments.id, row.id), {
        plannedMembershipId: snapshot.plannedMembershipId,
        plannedMemberName: snapshot.plannedMemberName,
        actualMembershipId: snapshot.actualMembershipId,
        actualMemberName: snapshot.actualMemberName,
      });
      restoredAssignmentIds.push(row.id);
      // A duplicated snapshot can never restore the same row twice.
      rowsById.delete(row.id);
      refreshedMonths.add(period.businessMonth);
    }
    for (const month of refreshedMonths)
      await this.services.statisticsService.refreshInTransaction(
        transaction,
        authorization.group.id,
        month,
      );
    return {
      restoredAssignmentIds,
      skippedAssignments,
      restorationUnavailable:
        snapshots.length === 0 &&
        !(
          events.length === 1 &&
          isEmptyClearedAssignmentSnapshot(events[0]?.beforeData, events[0]?.afterData)
        ),
    };
  }
}
