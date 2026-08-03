import type { ScheduleWorkflowImpact } from '@schedule/contracts';
import {
  dutyAdjustments,
  groupMemberships,
  shiftAssignments,
  swapRequests,
  userProfiles,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { EventWriter } from '../events/event-writer.js';

export const scheduleChangeRevocationReason = '排班变更';

interface WorkflowRows {
  readonly assignments: readonly (typeof shiftAssignments.$inferSelect)[];
  readonly dutyRows: readonly (typeof dutyAdjustments.$inferSelect)[];
  readonly memberNamesById: ReadonlyMap<string, string>;
  readonly swapRows: readonly (typeof swapRequests.$inferSelect)[];
}

export class ScheduleWorkflowInvalidationService {
  private readonly eventWriter = new EventWriter();

  public async listImpacts(
    transaction: DatabaseTransaction,
    periodIds: readonly string[],
    lockRows = false,
  ): Promise<readonly ScheduleWorkflowImpact[]> {
    const rows = await this.loadRows(transaction, periodIds, lockRows);
    return buildImpacts(rows);
  }

  public async invalidate(
    transaction: DatabaseTransaction,
    input: {
      readonly actorUserId: string;
      readonly groupId: string;
      readonly operationId: string;
      readonly periodIds: readonly string[];
    },
  ): Promise<readonly ScheduleWorkflowImpact[]> {
    const rows = await this.loadRows(transaction, input.periodIds, true);
    const impacts = buildImpacts(rows);
    if (input.periodIds.length === 0) {
      return impacts;
    }

    const decidedAt = new Date();
    for (const request of rows.swapRows) {
      const affectedAssignments = rows.assignments.filter(
        (assignment) =>
          assignment.id === request.initiatorAssignmentId ||
          assignment.id === request.targetAssignmentId,
      );
      await transaction
        .update(swapRequests)
        .set({
          decidedAt,
          revocationReason: scheduleChangeRevocationReason,
          status: 'revoked',
          version: sql`${swapRequests.version} + 1`,
        })
        .where(eq(swapRequests.id, request.id));
      const assignmentsByPeriod = new Map<string, typeof affectedAssignments>();
      for (const assignment of affectedAssignments) {
        assignmentsByPeriod.set(assignment.schedulePeriodId, [
          ...(assignmentsByPeriod.get(assignment.schedulePeriodId) ?? []),
          assignment,
        ]);
      }
      for (const [schedulePeriodId, periodAssignments] of assignmentsByPeriod) {
        await this.eventWriter.append(transaction, {
          affectedMembershipIds: [request.initiatorMembershipId, request.targetMembershipId],
          affectedShiftIds: periodAssignments.map((assignment) => assignment.id),
          afterData: {
            revocationReason: scheduleChangeRevocationReason,
            status: 'revoked',
            version: request.version + 1,
          },
          beforeData: { status: request.status, version: request.version },
          eventStatus: 'completed',
          eventType: 'swap_revoked',
          groupId: input.groupId,
          initiatedByUserId: input.actorUserId,
          objectId: request.id,
          objectType: 'swap_request',
          operationId: input.operationId,
          operatorUserId: input.actorUserId,
          reason: scheduleChangeRevocationReason,
          schedulePeriodId,
        });
      }
    }

    for (const adjustment of rows.dutyRows) {
      const assignment = rows.assignments.find(
        (candidate) => candidate.id === adjustment.coveredAssignmentId,
      );
      await transaction
        .update(dutyAdjustments)
        .set({
          decidedAt,
          revocationReason: scheduleChangeRevocationReason,
          status: 'revoked',
          version: sql`${dutyAdjustments.version} + 1`,
        })
        .where(eq(dutyAdjustments.id, adjustment.id));
      await this.eventWriter.append(transaction, {
        affectedMembershipIds: [adjustment.deductedMembershipId, adjustment.overtimeMembershipId],
        affectedShiftIds: [adjustment.coveredAssignmentId],
        afterData: {
          revocationReason: scheduleChangeRevocationReason,
          status: 'revoked',
          version: adjustment.version + 1,
        },
        beforeData: { status: adjustment.status, version: adjustment.version },
        eventStatus: 'completed',
        eventType: 'duty_adjustment_revoked',
        groupId: input.groupId,
        initiatedByUserId: input.actorUserId,
        objectId: adjustment.id,
        objectType: 'duty_adjustment',
        operationId: input.operationId,
        operatorUserId: input.actorUserId,
        reason: scheduleChangeRevocationReason,
        ...(assignment === undefined ? {} : { schedulePeriodId: assignment.schedulePeriodId }),
      });
    }

    const workflowAssignmentIds = [
      ...new Set([
        ...rows.swapRows.flatMap((request) => [
          request.initiatorAssignmentId,
          request.targetAssignmentId,
        ]),
        ...rows.dutyRows.map((adjustment) => adjustment.coveredAssignmentId),
      ]),
    ];
    if (workflowAssignmentIds.length > 0) {
      await transaction
        .update(shiftAssignments)
        .set({
          actualMemberName: sql`${shiftAssignments.plannedMemberName}`,
          actualMembershipId: sql`${shiftAssignments.plannedMembershipId}`,
          version: sql`${shiftAssignments.version} + 1`,
        })
        .where(
          and(
            inArray(shiftAssignments.id, workflowAssignmentIds),
            isNull(shiftAssignments.deletedAt),
          ),
        );
    }

    return impacts;
  }

  private async loadRows(
    transaction: DatabaseTransaction,
    periodIds: readonly string[],
    lockRows: boolean,
  ): Promise<WorkflowRows> {
    const uniquePeriodIds = [...new Set(periodIds)];
    if (uniquePeriodIds.length === 0) {
      return { assignments: [], dutyRows: [], memberNamesById: new Map(), swapRows: [] };
    }

    let assignmentQuery = transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(
          inArray(shiftAssignments.schedulePeriodId, uniquePeriodIds),
          isNull(shiftAssignments.deletedAt),
        ),
      );
    if (lockRows) {
      assignmentQuery = assignmentQuery.for('update') as typeof assignmentQuery;
    }
    const assignments = await assignmentQuery;
    const assignmentIds = assignments.map((assignment) => assignment.id);
    if (assignmentIds.length === 0) {
      return { assignments, dutyRows: [], memberNamesById: new Map(), swapRows: [] };
    }

    let swapQuery = transaction
      .select()
      .from(swapRequests)
      .where(
        and(
          or(
            inArray(swapRequests.initiatorAssignmentId, assignmentIds),
            inArray(swapRequests.targetAssignmentId, assignmentIds),
          ),
          inArray(swapRequests.status, ['pending_target', 'pending_approval', 'completed']),
          isNull(swapRequests.deletedAt),
        ),
      );
    let dutyQuery = transaction
      .select()
      .from(dutyAdjustments)
      .where(
        and(
          inArray(dutyAdjustments.coveredAssignmentId, assignmentIds),
          inArray(dutyAdjustments.status, ['pending_target', 'pending_approval', 'completed']),
          isNull(dutyAdjustments.deletedAt),
        ),
      );
    if (lockRows) {
      swapQuery = swapQuery.for('update') as typeof swapQuery;
      dutyQuery = dutyQuery.for('update') as typeof dutyQuery;
    }
    const [swapRows, dutyRows] = await Promise.all([swapQuery, dutyQuery]);
    const relatedAssignmentIds = [
      ...new Set([
        ...swapRows.flatMap((request) => [
          request.initiatorAssignmentId,
          request.targetAssignmentId,
        ]),
        ...dutyRows.map((adjustment) => adjustment.coveredAssignmentId),
      ]),
    ].filter((id) => !assignmentIds.includes(id));
    let relatedAssignments: (typeof shiftAssignments.$inferSelect)[] = [];
    if (relatedAssignmentIds.length > 0) {
      let relatedAssignmentQuery = transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(
            inArray(shiftAssignments.id, relatedAssignmentIds),
            isNull(shiftAssignments.deletedAt),
          ),
        );
      if (lockRows) {
        relatedAssignmentQuery = relatedAssignmentQuery.for(
          'update',
        ) as typeof relatedAssignmentQuery;
      }
      relatedAssignments = await relatedAssignmentQuery;
    }
    const membershipIds = [
      ...new Set([
        ...swapRows.flatMap((request) => [
          request.initiatorMembershipId,
          request.targetMembershipId,
        ]),
        ...dutyRows.flatMap((adjustment) => [
          adjustment.deductedMembershipId,
          adjustment.overtimeMembershipId,
        ]),
      ]),
    ];
    const members =
      membershipIds.length === 0
        ? []
        : await transaction
            .select({ id: groupMemberships.id, realName: userProfiles.realName })
            .from(groupMemberships)
            .innerJoin(userProfiles, eq(userProfiles.userId, groupMemberships.userId))
            .where(inArray(groupMemberships.id, membershipIds));

    return {
      assignments: [...assignments, ...relatedAssignments],
      dutyRows,
      memberNamesById: new Map(members.map((member) => [member.id, member.realName])),
      swapRows,
    };
  }
}

function buildImpacts(rows: WorkflowRows): ScheduleWorkflowImpact[] {
  const assignmentDates = new Map(
    rows.assignments.map((assignment) => [assignment.id, assignment.businessDate]),
  );
  return [
    ...rows.swapRows.map((request): ScheduleWorkflowImpact => ({
      businessDates: [
        ...new Set(
          [
            assignmentDates.get(request.initiatorAssignmentId),
            assignmentDates.get(request.targetAssignmentId),
          ].filter((date): date is string => date !== undefined),
        ),
      ].sort(),
      id: request.id,
      kind: 'swap',
      memberNames: [
        rows.memberNamesById.get(request.initiatorMembershipId) ?? '未知成员',
        rows.memberNamesById.get(request.targetMembershipId) ?? '未知成员',
      ],
      status: request.status,
    })),
    ...rows.dutyRows.map((adjustment): ScheduleWorkflowImpact => ({
      businessDates: [assignmentDates.get(adjustment.coveredAssignmentId)].filter(
        (date): date is string => date !== undefined,
      ),
      id: adjustment.id,
      kind: 'duty_adjustment',
      memberNames: [
        rows.memberNamesById.get(adjustment.deductedMembershipId) ?? '未知成员',
        rows.memberNamesById.get(adjustment.overtimeMembershipId) ?? '未知成员',
      ],
      status: adjustment.status,
    })),
  ].sort((first, second) =>
    (first.businessDates[0] ?? '').localeCompare(second.businessDates[0] ?? ''),
  );
}
