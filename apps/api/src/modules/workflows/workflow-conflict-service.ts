import type { DatabaseTransaction } from '@schedule/database';
import {
  dutyAdjustments,
  groupMemberships,
  leaveRequests,
  memberScheduleRoles,
  schedulePeriods,
  shiftAssignments,
  swapRequests,
  users,
} from '@schedule/database';
import { and, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm';
import { intervalsOverlap, leaveOverlapsInterval } from '@schedule/scheduling-domain';

export type WorkflowConflictCode =
  | 'MEMBER_NOT_ELIGIBLE'
  | 'MEMBER_LEAVE_OVERLAP'
  | 'MEMBER_TIME_OVERLAP'
  | 'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST'
  | 'ASSIGNMENT_HAS_ACTIVE_DUTY_ADJUSTMENT'
  | 'ASSIGNMENT_HAS_PENDING_DUTY_ADJUSTMENT';

export interface WorkflowConflict {
  readonly assignmentId?: string;
  readonly code: WorkflowConflictCode;
  readonly membershipId: string;
  readonly message: string;
}

export interface LaterAssignmentWorkflow {
  readonly id: string;
  readonly kind: 'duty_adjustment' | 'swap';
}

type LockedShiftAssignment = typeof shiftAssignments.$inferSelect;

export function getCurrentDutyMembershipId(assignment: LockedShiftAssignment): string | null {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

export class WorkflowConflictService {
  public async findMemberEligibilityConflicts(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId: string,
    receivedAssignment: LockedShiftAssignment,
    receivedRoleId: string,
    ownAssignmentId: string,
    lockRows: boolean,
  ): Promise<readonly WorkflowConflict[]> {
    const conflicts: WorkflowConflict[] = [];

    let roleQuery = transaction
      .select({
        effectiveFrom: memberScheduleRoles.effectiveFrom,
        effectiveTo: memberScheduleRoles.effectiveTo,
        membershipDeletedAt: groupMemberships.deletedAt,
        membershipStatus: groupMemberships.status,
        userDeletedAt: users.deletedAt,
        userStatus: users.status,
      })
      .from(memberScheduleRoles)
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .where(
        and(
          eq(memberScheduleRoles.scheduleRoleId, receivedRoleId),
          eq(memberScheduleRoles.membershipId, membershipId),
          isNull(memberScheduleRoles.deletedAt),
        ),
      )
      .limit(1);
    if (lockRows) {
      roleQuery = roleQuery.for('update') as typeof roleQuery;
    }
    const [roleMember] = await roleQuery;
    const isInRole =
      roleMember !== undefined &&
      roleMember.membershipStatus === 'active' &&
      roleMember.userStatus === 'active' &&
      roleMember.membershipDeletedAt === null &&
      roleMember.userDeletedAt === null &&
      (roleMember.effectiveFrom === null ||
        roleMember.effectiveFrom <= receivedAssignment.businessDate) &&
      (roleMember.effectiveTo === null ||
        roleMember.effectiveTo >= receivedAssignment.businessDate);
    if (!isInRole) {
      conflicts.push({
        assignmentId: receivedAssignment.id,
        code: 'MEMBER_NOT_ELIGIBLE',
        membershipId,
        message: '该成员不在班次的排班角色中或不在生效区间。',
      });
    }

    const leaves = await transaction
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.groupId, groupId),
          eq(leaveRequests.membershipId, membershipId),
          inArray(leaveRequests.status, ['pending', 'approved']),
          isNull(leaveRequests.deletedAt),
        ),
      );
    const overlappingLeave = leaves.find((leave) =>
      leaveOverlapsInterval(leave, receivedAssignment),
    );
    if (overlappingLeave !== undefined) {
      conflicts.push({
        assignmentId: receivedAssignment.id,
        code: 'MEMBER_LEAVE_OVERLAP',
        membershipId,
        message: '该成员在班次时间内有待处理或已批准请假。',
      });
    }

    const conflictingAssignments = await this.findMemberTimeConflicts(
      transaction,
      groupId,
      membershipId,
      ownAssignmentId,
      receivedAssignment,
    );
    const conflictingAssignment = conflictingAssignments[0];
    if (conflictingAssignment !== undefined) {
      conflicts.push({
        assignmentId: conflictingAssignment.id,
        code: 'MEMBER_TIME_OVERLAP',
        membershipId,
        message: '该成员在班次时间内另有排班。',
      });
    }

    return conflicts;
  }

  public async findSwapAssignmentConflicts(
    transaction: DatabaseTransaction,
    groupId: string,
    assignmentIds: readonly string[],
    lockRows: boolean,
  ): Promise<readonly WorkflowConflict[]> {
    const conflicts: WorkflowConflict[] = [];

    let swapQuery = transaction
      .select()
      .from(swapRequests)
      .where(
        and(
          eq(swapRequests.groupId, groupId),
          inArray(swapRequests.status, ['pending_target', 'pending_approval']),
          or(
            inArray(swapRequests.initiatorAssignmentId, [...assignmentIds]),
            inArray(swapRequests.targetAssignmentId, [...assignmentIds]),
          ),
          isNull(swapRequests.deletedAt),
        ),
      );
    if (lockRows) {
      swapQuery = swapQuery.for('update') as typeof swapQuery;
    }
    const activeSwaps = await swapQuery;
    for (const request of activeSwaps) {
      conflicts.push({
        assignmentId: assignmentIds.includes(request.initiatorAssignmentId)
          ? request.initiatorAssignmentId
          : request.targetAssignmentId,
        code: 'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST',
        membershipId: request.initiatorMembershipId,
        message: '其中一个班次已有待处理的换班申请，请先处理后再发起新换班。',
      });
    }

    let dutyQuery = transaction
      .select()
      .from(dutyAdjustments)
      .where(
        and(
          eq(dutyAdjustments.groupId, groupId),
          inArray(dutyAdjustments.status, ['pending_target', 'pending_approval']),
          inArray(dutyAdjustments.coveredAssignmentId, [...assignmentIds]),
          isNull(dutyAdjustments.deletedAt),
        ),
      );
    if (lockRows) {
      dutyQuery = dutyQuery.for('update') as typeof dutyQuery;
    }
    const pendingAdjustments = await dutyQuery;
    for (const adjustment of pendingAdjustments) {
      conflicts.push({
        assignmentId: adjustment.coveredAssignmentId,
        code: 'ASSIGNMENT_HAS_PENDING_DUTY_ADJUSTMENT',
        membershipId: adjustment.overtimeMembershipId,
        message: '其中一个班次已有待处理的加扣班申请，请先处理后再发起换班。',
      });
    }

    return conflicts;
  }

  public async findDutyAdjustmentAssignmentConflicts(
    transaction: DatabaseTransaction,
    groupId: string,
    coveredAssignmentId: string,
    excludingDutyAdjustmentId: string | undefined,
    lockRows: boolean,
  ): Promise<readonly WorkflowConflict[]> {
    const conflicts: WorkflowConflict[] = [];

    let swapQuery = transaction
      .select()
      .from(swapRequests)
      .where(
        and(
          eq(swapRequests.groupId, groupId),
          inArray(swapRequests.status, ['pending_target', 'pending_approval']),
          or(
            eq(swapRequests.initiatorAssignmentId, coveredAssignmentId),
            eq(swapRequests.targetAssignmentId, coveredAssignmentId),
          ),
          isNull(swapRequests.deletedAt),
        ),
      );
    if (lockRows) {
      swapQuery = swapQuery.for('update') as typeof swapQuery;
    }
    const activeSwaps = await swapQuery;
    for (const request of activeSwaps) {
      conflicts.push({
        assignmentId: coveredAssignmentId,
        code: 'ASSIGNMENT_HAS_ACTIVE_SWAP_REQUEST',
        membershipId: request.initiatorMembershipId,
        message: '该班次已有待处理的换班申请，请刷新后重试。',
      });
    }

    let dutyQuery = transaction
      .select()
      .from(dutyAdjustments)
      .where(
        and(
          eq(dutyAdjustments.groupId, groupId),
          inArray(dutyAdjustments.status, ['pending_target', 'pending_approval', 'completed']),
          eq(dutyAdjustments.coveredAssignmentId, coveredAssignmentId),
          isNull(dutyAdjustments.deletedAt),
          ...(excludingDutyAdjustmentId === undefined
            ? []
            : [ne(dutyAdjustments.id, excludingDutyAdjustmentId)]),
        ),
      );
    if (lockRows) {
      dutyQuery = dutyQuery.for('update') as typeof dutyQuery;
    }
    const activeAdjustments = await dutyQuery;
    for (const adjustment of activeAdjustments) {
      conflicts.push({
        assignmentId: coveredAssignmentId,
        code: 'ASSIGNMENT_HAS_ACTIVE_DUTY_ADJUSTMENT',
        membershipId: adjustment.overtimeMembershipId,
        message: '该班次已有一组待处理或生效中的加扣班关系，请先撤销后再代值。',
      });
    }

    return conflicts;
  }

  public async findLaterAssignmentWorkflows(
    transaction: DatabaseTransaction,
    groupId: string,
    assignmentId: string,
    afterCreatedAt: Date,
    excludingDutyAdjustmentId?: string,
  ): Promise<readonly LaterAssignmentWorkflow[]> {
    const laterSwaps = await transaction
      .select({ id: swapRequests.id })
      .from(swapRequests)
      .where(
        and(
          eq(swapRequests.groupId, groupId),
          inArray(swapRequests.status, ['pending_target', 'pending_approval', 'completed']),
          or(
            eq(swapRequests.initiatorAssignmentId, assignmentId),
            eq(swapRequests.targetAssignmentId, assignmentId),
          ),
          gt(swapRequests.createdAt, afterCreatedAt),
          isNull(swapRequests.deletedAt),
        ),
      );
    const laterAdjustments = await transaction
      .select({ id: dutyAdjustments.id })
      .from(dutyAdjustments)
      .where(
        and(
          eq(dutyAdjustments.groupId, groupId),
          inArray(dutyAdjustments.status, ['pending_target', 'pending_approval', 'completed']),
          eq(dutyAdjustments.coveredAssignmentId, assignmentId),
          gt(dutyAdjustments.createdAt, afterCreatedAt),
          isNull(dutyAdjustments.deletedAt),
          ...(excludingDutyAdjustmentId === undefined
            ? []
            : [ne(dutyAdjustments.id, excludingDutyAdjustmentId)]),
        ),
      );

    return [
      ...laterSwaps.map((row): LaterAssignmentWorkflow => ({ id: row.id, kind: 'swap' })),
      ...laterAdjustments.map((row): LaterAssignmentWorkflow => ({
        id: row.id,
        kind: 'duty_adjustment',
      })),
    ];
  }

  private async findMemberTimeConflicts(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId: string,
    ownAssignmentId: string,
    receivedAssignment: LockedShiftAssignment,
  ): Promise<readonly LockedShiftAssignment[]> {
    const periods = await transaction
      .select({ id: schedulePeriods.id })
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, groupId),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
        ),
      );
    const periodIds = periods.map((period) => period.id);
    if (periodIds.length === 0) {
      return [];
    }
    const rows = await transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(
          inArray(shiftAssignments.schedulePeriodId, periodIds),
          or(
            eq(shiftAssignments.actualMembershipId, membershipId),
            eq(shiftAssignments.plannedMembershipId, membershipId),
          ),
          isNull(shiftAssignments.deletedAt),
        ),
      );

    return rows.filter(
      (assignment) =>
        assignment.id !== ownAssignmentId &&
        getCurrentDutyMembershipId(assignment) === membershipId &&
        intervalsOverlap(assignment, receivedAssignment),
    );
  }
}
