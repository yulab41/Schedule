import { createHash, randomUUID } from 'node:crypto';

import type {
  ApprovedLeaveRequestResult,
  ApproveLeaveRequestInput,
  CreateLeaveRequestInput,
  GroupLeaveReflowStrategy,
  LeaveAffectedAssignment,
  LeaveMemberStatisticsDelta,
  LeaveReflowConflict,
  LeaveReflowPreview,
  LeaveReflowStrategy,
  LeaveRequest,
  LeaveStatisticsDelta,
  PreviewLeaveRequestInput,
  RejectedLeaveRequestResult,
  RejectLeaveRequestInput,
  ScheduleGenerationVacancy,
  ScheduleGenerationWarning,
  UpdateGroupLeaveReflowStrategyInput,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  groupMemberships,
  groups,
  leaveRequests,
  memberScheduleRoles,
  rotationMembers,
  rotationRules,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import {
  createRotationBusinessKey,
  getChinaStandardTimeBusinessDate,
  intervalsOverlap,
  reflowLeaveAssignments,
  type LeaveReflowInterval,
  type ReflowAssignment,
  type ReflowMember,
  type ReflowRotationRule,
} from '@schedule/scheduling-domain';
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import { EventWriter } from '../events/event-writer.js';
import {
  GroupPermissionService,
  type ActiveGroup,
  type GroupAuthorization,
} from '../groups/permission-service.js';
import {
  isConflictBlockedError,
  writeConflictNotification,
} from '../notifications/conflict-notifier.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { toLatestData } from '../schedules/shared.js';

type LockedLeaveRequest = typeof leaveRequests.$inferSelect;
type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;
type LockedShiftAssignment = typeof shiftAssignments.$inferSelect;

interface LoadedRotationMember {
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly isActive: boolean;
  readonly memberScheduleRoleId: string;
  readonly membershipId: string;
  readonly position: number;
  readonly realName: string;
}

interface RotationRuleRow {
  readonly currentPosition: number;
  readonly id: string;
  readonly requiredMembersPerDay: number;
  readonly scheduleRoleId: string;
  readonly startDate: string;
  readonly startingMemberScheduleRoleId: string | null;
}

interface MemberRow {
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly memberScheduleRoleDeletedAt: Date | null;
  readonly memberScheduleRoleId: string;
  readonly membershipDeletedAt: Date | null;
  readonly membershipId: string;
  readonly membershipStatus: string;
  readonly position: number;
  readonly realName: string;
  readonly rotationRuleId: string;
  readonly userDeletedAt: Date | null;
  readonly userStatus: string;
}

interface ReflowContext {
  readonly assignments: readonly ReflowAssignment[];
  readonly domainResult: ReturnType<typeof reflowLeaveAssignments>;
  readonly memberNamesById: ReadonlyMap<string, string>;
  readonly periodById: ReadonlyMap<string, LockedSchedulePeriod>;
  readonly periods: readonly LockedSchedulePeriod[];
  readonly preview: LeaveReflowPreview;
  readonly rowByBusinessKey: ReadonlyMap<string, LockedShiftAssignment>;
}

export class LeaveService {
  private readonly eventWriter = new EventWriter();
  private readonly notificationWriter = new NotificationWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly statisticsService: StatisticsService;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.statisticsService = new StatisticsService(this.databaseClient);
  }

  public async submit(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateLeaveRequestInput,
  ): Promise<LeaveRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const startsAt = parseTimestamp(input.startsAt, '开始时间');
      const endsAt = parseTimestamp(input.endsAt, '结束时间');
      if (startsAt.valueOf() >= endsAt.valueOf()) {
        throw validationError('结束时间必须晚于开始时间。');
      }

      const existingLeaves = await transaction
        .select()
        .from(leaveRequests)
        .where(
          and(
            eq(leaveRequests.groupId, groupId),
            eq(leaveRequests.membershipId, authorization.membership.id),
            inArray(leaveRequests.status, ['pending', 'approved']),
            isNull(leaveRequests.deletedAt),
          ),
        );
      const overlappingLeave = existingLeaves.find((leave) =>
        intervalsOverlap(leave, { endsAt, startsAt }),
      );
      if (overlappingLeave !== undefined) {
        throw new ApiError({
          code: 'CONFLICT',
          latestData: {
            id: overlappingLeave.id,
            objectType: 'leave_request',
            overlappingLeaveRequestId: overlappingLeave.id,
            version: overlappingLeave.version,
          },
          statusCode: 409,
          userMessage: '该成员的请假时间与已有请假重叠，请先撤销或调整原申请。',
        });
      }

      const operationId = randomUUID();
      const leaveRequestId = randomUUID();
      await transaction.insert(leaveRequests).values({
        endsAt,
        groupId,
        id: leaveRequestId,
        isAllDay: input.isAllDay === true ? 1 : 0,
        leaveType: input.leaveType,
        membershipId: authorization.membership.id,
        reason: input.reason,
        reflowStrategy: authorization.group.leaveReflowStrategy,
        startsAt,
      });
      const submittedEventId = await this.eventWriter.append(transaction, {
        affectedMembershipIds: [authorization.membership.id],
        afterData: toLatestData({
          endsAt: endsAt.toISOString(),
          isAllDay: input.isAllDay === true,
          leaveType: input.leaveType,
          reflowStrategy: authorization.group.leaveReflowStrategy,
          startsAt: startsAt.toISOString(),
        }),
        eventStatus: 'completed',
        eventType: 'leave_request_submitted',
        groupId,
        initiatedByUserId: authorization.user.id,
        objectId: leaveRequestId,
        objectType: 'leave_request',
        operationId,
        operatorUserId: authorization.user.id,
        reason: input.reason,
      });
      await this.notificationWriter.append(transaction, {
        administratorRecipients: true,
        body: '成员提交了新的请假申请，请及时审批。',
        excludeRecipientUserIds: [authorization.user.id],
        groupId,
        notificationType: 'approval_pending',
        objectId: leaveRequestId,
        objectType: 'leave_request',
        payload: { requestType: 'leave' },
        scheduleEventId: submittedEventId,
        title: '新的请假申请待审批',
      });

      return this.readLeaveRequest(transaction, leaveRequestId);
    });
  }

  public async listMine(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly LeaveRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return this.readLeaveRequests(transaction, groupId, authorization.membership.id);
    });
  }

  public async listForApproval(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly LeaveRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageLeaves',
      );
      return this.readLeaveRequests(transaction, groupId);
    });
  }

  public async preview(
    identity: AuthenticatedIdentity,
    groupId: string,
    leaveRequestId: string,
    input: PreviewLeaveRequestInput,
  ): Promise<LeaveReflowPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const leaveRequest = await this.lockLeaveRequest(transaction, groupId, leaveRequestId);
      if (leaveRequest.membershipId !== authorization.membership.id) {
        await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageLeaves',
        );
      }
      if (leaveRequest.status !== 'pending') {
        throw new ApiError({
          code: 'CONFLICT',
          latestData: {
            id: leaveRequest.id,
            objectType: 'leave_request',
            status: leaveRequest.status,
            version: leaveRequest.version,
          },
          statusCode: 409,
          userMessage: '该请假申请已处理，无法再生成重排预览。',
        });
      }
      const strategy = input.strategy ?? leaveRequest.reflowStrategy;
      const context = await this.loadReflowContext(
        transaction,
        authorization.group,
        leaveRequest,
        strategy,
      );

      return context.preview;
    });
  }

  public async approve(
    identity: AuthenticatedIdentity,
    groupId: string,
    leaveRequestId: string,
    input: ApproveLeaveRequestInput,
  ): Promise<ApprovedLeaveRequestResult> {
    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageLeaves',
        );
        return withIdempotentOperation(
          transaction,
          {
            actorUserId: authorization.user.id,
            operationId: input.operationId,
            requestFingerprint: createApproveFingerprint({
              acknowledgeBlockers: input.acknowledgeBlockers === true,
              expectedPeriodVersions: input.expectedPeriodVersions,
              expectedRulesVersion: input.expectedRulesVersion,
              expectedVersion: input.expectedVersion,
              groupId,
              leaveRequestId,
              strategy: input.strategy ?? null,
            }),
            scope: 'leave_request_approve',
          },
          () => this.runApproval(transaction, authorization, leaveRequestId, input),
        );
      });
    } catch (error) {
      if (error instanceof ApiError && isConflictBlockedError(error)) {
        await writeConflictNotification(this.databaseClient, {
          groupId,
          identity,
          operationId: input.operationId,
          preview: error.latestData?.preview,
        });
      }
      throw error;
    }
  }

  public async reject(
    identity: AuthenticatedIdentity,
    groupId: string,
    leaveRequestId: string,
    input: RejectLeaveRequestInput,
  ): Promise<RejectedLeaveRequestResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageLeaves',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createHash('sha256')
            .update(
              JSON.stringify({
                expectedVersion: input.expectedVersion,
                groupId,
                leaveRequestId,
              }),
            )
            .digest('hex'),
          scope: 'leave_request_reject',
        },
        () => this.runRejection(transaction, authorization, leaveRequestId, input),
      );
    });
  }

  public async getGroupStrategy(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupLeaveReflowStrategy> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return { strategy: authorization.group.leaveReflowStrategy };
    });
  }

  public async updateGroupStrategy(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupLeaveReflowStrategyInput,
  ): Promise<GroupLeaveReflowStrategy> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageLeaves',
      );
      await transaction
        .update(groups)
        .set({
          leaveReflowStrategy: input.strategy,
          version: sql`${groups.version} + 1`,
        })
        .where(eq(groups.id, authorization.group.id));

      return { strategy: input.strategy };
    });
  }

  private async runApproval(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    leaveRequestId: string,
    input: ApproveLeaveRequestInput,
  ): Promise<ApprovedLeaveRequestResult> {
    const leaveRequest = await this.lockLeaveRequest(
      transaction,
      authorization.group.id,
      leaveRequestId,
    );
    if (leaveRequest.status !== 'pending') {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: {
          id: leaveRequest.id,
          objectType: 'leave_request',
          status: leaveRequest.status,
          version: leaveRequest.version,
        },
        statusCode: 409,
        userMessage: '该请假申请已处理，不能重复审批。',
      });
    }
    assertExpectedVersion({
      actualVersion: leaveRequest.version,
      expectedVersion: input.expectedVersion,
      id: leaveRequest.id,
      latestData: { status: leaveRequest.status, reflowStrategy: leaveRequest.reflowStrategy },
      objectType: 'leave_request',
      userMessage: '请假申请已被其他操作更新，请刷新后重新审批。',
    });
    if (authorization.group.rulesVersion !== input.expectedRulesVersion) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { rulesVersion: authorization.group.rulesVersion },
        statusCode: 409,
        userMessage: '排班规则已更新，请刷新后重新审批。',
      });
    }

    const strategy = input.strategy ?? leaveRequest.reflowStrategy;
    const context = await this.loadReflowContext(
      transaction,
      authorization.group,
      leaveRequest,
      strategy,
      true,
    );
    this.assertExpectedPeriodVersions(context.periods, input.expectedPeriodVersions);

    const hasBlockers =
      context.preview.conflicts.length > 0 || context.preview.vacancies.length > 0;
    if (hasBlockers && input.acknowledgeBlockers !== true) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({ preview: context.preview }),
        statusCode: 409,
        userMessage: '请假重排结果包含硬冲突或待处理空缺，确认后才能生效。',
      });
    }

    const adjustedByKey = new Map(
      context.domainResult.assignments.map((assignment) => [assignment.businessKey, assignment]),
    );
    const affectedRows: LockedShiftAssignment[] = [];
    for (const businessKey of context.domainResult.affectedBusinessKeys) {
      const row = context.rowByBusinessKey.get(businessKey);
      if (row === undefined) {
        continue;
      }
      const adjusted = adjustedByKey.get(businessKey);
      const nextMembershipId = adjusted?.plannedMembershipId ?? null;
      affectedRows.push(row);
      await transaction
        .update(shiftAssignments)
        .set({
          plannedMemberName:
            nextMembershipId === null
              ? null
              : (context.memberNamesById.get(nextMembershipId) ?? null),
          plannedMembershipId: nextMembershipId,
          startsAt: sql`${shiftAssignments.startsAt}`,
          version: sql`${shiftAssignments.version} + 1`,
        })
        .where(eq(shiftAssignments.id, row.id));
    }

    const decidedAt = new Date();
    await transaction
      .update(leaveRequests)
      .set({
        approverUserId: authorization.user.id,
        decidedAt,
        reflowStrategy: strategy,
        status: 'approved',
        version: sql`${leaveRequests.version} + 1`,
      })
      .where(eq(leaveRequests.id, leaveRequest.id));

    for (const [scheduleRoleId, position] of context.domainResult.nextCursorPositions) {
      await transaction
        .update(rotationRules)
        .set({
          currentPosition: position,
          version: sql`${rotationRules.version} + 1`,
        })
        .where(eq(rotationRules.scheduleRoleId, scheduleRoleId));
    }
    if (strategy === 'shift-forward' && context.domainResult.nextCursorPositions.size > 0) {
      await transaction
        .update(groups)
        .set({ rulesVersion: sql`${groups.rulesVersion} + 1` })
        .where(eq(groups.id, authorization.group.id));
    }

    const approvalEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [leaveRequest.membershipId],
      afterData: toLatestData({
        approverUserId: authorization.user.id,
        decidedAt: decidedAt.toISOString(),
        reflowStrategy: strategy,
        status: 'approved',
        version: leaveRequest.version + 1,
      }),
      beforeData: toLatestData({
        reflowStrategy: leaveRequest.reflowStrategy,
        status: leaveRequest.status,
        version: leaveRequest.version,
      }),
      eventStatus: 'completed',
      eventType: 'leave_request_approved',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      reason: leaveRequest.reason,
      ...(context.periods[0] === undefined ? {} : { schedulePeriodId: context.periods[0].id }),
    });
    await this.notificationWriter.append(transaction, {
      body: '您的请假申请已批准。',
      groupId: authorization.group.id,
      notificationType: 'leave_request_approved',
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      payload: { reflowStrategy: strategy },
      recipientMembershipIds: [leaveRequest.membershipId],
      scheduleEventId: approvalEventId,
      title: '请假申请已批准',
    });

    const coverEventIds: string[] = [];
    const reflowedMembershipIds: string[] = [];
    if (affectedRows.length > 0) {
      reflowedMembershipIds.push(
        ...new Set(
          [
            leaveRequest.membershipId,
            ...affectedRows.flatMap((row) => {
              const roleId = context.periodById.get(row.schedulePeriodId)?.scheduleRoleId ?? '';
              const adjusted = adjustedByKey.get(
                createRotationBusinessKey(roleId, row.businessDate, row.slotPosition),
              );
              return adjusted?.plannedMembershipId === null ||
                adjusted?.plannedMembershipId === undefined
                ? []
                : [adjusted.plannedMembershipId];
            }),
          ].filter((membershipId): membershipId is string => membershipId !== null),
        ),
      );
      for (const schedulePeriodId of [
        ...new Set(affectedRows.map((row) => row.schedulePeriodId)),
      ]) {
        const periodRows = affectedRows.filter((row) => row.schedulePeriodId === schedulePeriodId);
        const coverEventId = await this.eventWriter.append(transaction, {
          affectedMembershipIds: reflowedMembershipIds,
          affectedShiftIds: periodRows.map((row) => row.id),
          afterData: toLatestData({
            leaveRequestId: leaveRequest.id,
            reflowedShiftIds: periodRows.map((row) => row.id),
            strategy,
          }),
          eventStatus: 'completed',
          eventType: 'leave_cover_completed',
          groupId: authorization.group.id,
          initiatedByUserId: authorization.user.id,
          objectId: leaveRequest.id,
          objectType: 'leave_cover',
          operationId: input.operationId,
          operatorUserId: authorization.user.id,
          parentEventId: approvalEventId,
          schedulePeriodId,
        });
        coverEventIds.push(coverEventId);
      }
    }
    const firstCoverEventId = coverEventIds[0];
    if (reflowedMembershipIds.length > 0 && firstCoverEventId !== undefined) {
      await this.notificationWriter.append(transaction, {
        body: '请假重排后，您的班次已调整。',
        groupId: authorization.group.id,
        notificationType: 'schedule_changed',
        payload: { reason: 'leave_cover' },
        recipientMembershipIds: reflowedMembershipIds,
        scheduleEventId: firstCoverEventId,
        title: '排班已调整',
      });
    }
    for (const period of context.periods) {
      await this.statisticsService.refreshInTransaction(
        transaction,
        authorization.group.id,
        period.businessMonth,
      );
    }

    const updatedLeaveRequest = await this.readLeaveRequest(transaction, leaveRequest.id);
    return {
      leaveRequest: updatedLeaveRequest,
      operationId: input.operationId,
      preview: context.preview,
      status: 'approved',
      strategy,
    };
  }

  private async runRejection(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    leaveRequestId: string,
    input: RejectLeaveRequestInput,
  ): Promise<RejectedLeaveRequestResult> {
    const leaveRequest = await this.lockLeaveRequest(
      transaction,
      authorization.group.id,
      leaveRequestId,
    );
    if (leaveRequest.status !== 'pending') {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: {
          id: leaveRequest.id,
          objectType: 'leave_request',
          status: leaveRequest.status,
          version: leaveRequest.version,
        },
        statusCode: 409,
        userMessage: '该请假申请已处理，不能重复驳回。',
      });
    }
    assertExpectedVersion({
      actualVersion: leaveRequest.version,
      expectedVersion: input.expectedVersion,
      id: leaveRequest.id,
      latestData: { status: leaveRequest.status },
      objectType: 'leave_request',
      userMessage: '请假申请已被其他操作更新，请刷新后重新处理。',
    });

    const decidedAt = new Date();
    await transaction
      .update(leaveRequests)
      .set({
        approverUserId: authorization.user.id,
        decidedAt,
        status: 'rejected',
        version: sql`${leaveRequests.version} + 1`,
      })
      .where(eq(leaveRequests.id, leaveRequest.id));
    const rejectedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [leaveRequest.membershipId],
      afterData: toLatestData({
        approverUserId: authorization.user.id,
        decidedAt: decidedAt.toISOString(),
        status: 'rejected',
        version: leaveRequest.version + 1,
      }),
      beforeData: toLatestData({
        status: leaveRequest.status,
        version: leaveRequest.version,
      }),
      eventStatus: 'completed',
      eventType: 'leave_request_rejected',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      reason: leaveRequest.reason,
    });
    await this.notificationWriter.append(transaction, {
      body: '您的请假申请已被驳回。',
      groupId: authorization.group.id,
      notificationType: 'leave_request_rejected',
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      recipientMembershipIds: [leaveRequest.membershipId],
      scheduleEventId: rejectedEventId,
      title: '请假申请已驳回',
    });

    return {
      leaveRequest: await this.readLeaveRequest(transaction, leaveRequest.id),
      operationId: input.operationId,
      status: 'rejected',
    };
  }

  private async loadReflowContext(
    transaction: DatabaseTransaction,
    group: ActiveGroup,
    leaveRequest: LockedLeaveRequest,
    strategy: LeaveReflowStrategy,
    lockRows = false,
  ): Promise<ReflowContext> {
    const leaveStartDate = getChinaStandardTimeBusinessDate(leaveRequest.startsAt);
    const leaveEndDate = getChinaStandardTimeBusinessDate(leaveRequest.endsAt);
    const startMonth = `${leaveStartDate.slice(0, 7)}-01`;
    const endMonth = `${leaveEndDate.slice(0, 7)}-01`;

    let periodQuery = transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, group.id),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
          gte(schedulePeriods.businessMonth, startMonth),
          lte(schedulePeriods.businessMonth, endMonth),
        ),
      )
      .orderBy(asc(schedulePeriods.businessMonth), asc(schedulePeriods.scheduleRoleId));
    if (lockRows) {
      periodQuery = periodQuery.for('update') as typeof periodQuery;
    }
    const periods = await periodQuery;
    const periodById = new Map(periods.map((period) => [period.id, period]));
    const scheduleRoleIdByPeriodId = new Map(
      periods.map((period) => [period.id, period.scheduleRoleId] as const),
    );

    let assignments: readonly LockedShiftAssignment[];
    if (periods.length === 0) {
      assignments = [];
    } else {
      const periodIds = periods.map((period) => period.id);
      let assignmentQuery = transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(
            inArray(shiftAssignments.schedulePeriodId, periodIds),
            isNull(shiftAssignments.deletedAt),
          ),
        )
        .orderBy(asc(shiftAssignments.businessDate), asc(shiftAssignments.slotPosition));
      if (lockRows) {
        assignmentQuery = assignmentQuery.for('update') as typeof assignmentQuery;
      }
      assignments = await assignmentQuery;
    }

    const leaves = await transaction
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.groupId, group.id),
          eq(leaveRequests.status, 'approved'),
          isNull(leaveRequests.deletedAt),
          lte(leaveRequests.startsAt, leaveRequest.endsAt),
          gte(leaveRequests.endsAt, leaveRequest.startsAt),
        ),
      );
    const leaveIntervals: LeaveReflowInterval[] = leaves.map((leave) => ({
      endsAt: leave.endsAt,
      membershipId: leave.membershipId,
      startsAt: leave.startsAt,
    }));
    if (
      !leaveIntervals.some(
        (leave) =>
          leave.membershipId === leaveRequest.membershipId &&
          leave.startsAt.valueOf() === leaveRequest.startsAt.valueOf() &&
          leave.endsAt.valueOf() === leaveRequest.endsAt.valueOf(),
      )
    ) {
      leaveIntervals.push({
        endsAt: leaveRequest.endsAt,
        membershipId: leaveRequest.membershipId,
        startsAt: leaveRequest.startsAt,
      });
    }

    const roleIds = [...new Set(periods.map((period) => period.scheduleRoleId))].sort();
    const rotationRulesByRoleId = await this.loadRotationRules(transaction, group.id, roleIds);
    const membersByRuleId = await this.loadRotationMembers(
      transaction,
      [...rotationRulesByRoleId.values()].map((rule) => rule.id),
    );
    const memberNamesById = new Map<string, string>();
    for (const member of [...membersByRuleId.values()].flat()) {
      memberNamesById.set(member.membershipId, member.realName);
    }
    for (const assignment of assignments) {
      if (assignment.plannedMembershipId !== null && assignment.plannedMemberName !== null) {
        memberNamesById.set(assignment.plannedMembershipId, assignment.plannedMemberName);
      }
    }

    const domainRules = [...rotationRulesByRoleId.values()].map((rule) =>
      toDomainReflowRule(rule, membersByRuleId.get(rule.id) ?? []),
    );
    const domainAssignments = assignments.map((assignment): ReflowAssignment => {
      const scheduleRoleId = scheduleRoleIdByPeriodId.get(assignment.schedulePeriodId);
      if (scheduleRoleId === undefined) {
        throw new Error('The assignment references an unknown schedule period.');
      }
      return {
        businessDate: assignment.businessDate,
        businessKey: createRotationBusinessKey(
          scheduleRoleId,
          assignment.businessDate,
          assignment.slotPosition,
        ),
        endsAt: assignment.endsAt,
        plannedMembershipId: assignment.plannedMembershipId,
        scheduleRoleId,
        shiftTypeId: assignment.shiftTypeId,
        slotPosition: assignment.slotPosition,
        startsAt: assignment.startsAt,
      };
    });
    const domainResult = reflowLeaveAssignments({
      assignments: domainAssignments,
      leave: {
        endsAt: leaveRequest.endsAt,
        membershipId: leaveRequest.membershipId,
        startsAt: leaveRequest.startsAt,
      },
      leaves: leaveIntervals,
      rules: domainRules,
      strategy,
    });
    const rowByBusinessKey = new Map(
      assignments.map((assignment): [string, LockedShiftAssignment] => {
        const scheduleRoleId = scheduleRoleIdByPeriodId.get(assignment.schedulePeriodId);
        if (scheduleRoleId === undefined) {
          throw new Error('The assignment references an unknown schedule period.');
        }
        return [
          createRotationBusinessKey(
            scheduleRoleId,
            assignment.businessDate,
            assignment.slotPosition,
          ),
          assignment,
        ];
      }),
    );

    const preview = this.buildPreview({
      domainResult,
      group,
      leaveRequest,
      memberNamesById,
      periodById,
      periods,
      rowByBusinessKey,
      strategy,
    });

    return {
      assignments: domainAssignments,
      domainResult,
      memberNamesById,
      periodById,
      periods,
      preview,
      rowByBusinessKey,
    };
  }

  private buildPreview(input: {
    readonly domainResult: ReturnType<typeof reflowLeaveAssignments>;
    readonly group: ActiveGroup;
    readonly leaveRequest: LockedLeaveRequest;
    readonly memberNamesById: ReadonlyMap<string, string>;
    readonly periodById: ReadonlyMap<string, LockedSchedulePeriod>;
    readonly periods: readonly LockedSchedulePeriod[];
    readonly rowByBusinessKey: ReadonlyMap<string, LockedShiftAssignment>;
    readonly strategy: LeaveReflowStrategy;
  }): LeaveReflowPreview {
    const adjustedByKey = new Map(
      input.domainResult.assignments.map((assignment) => [assignment.businessKey, assignment]),
    );
    const affectedAssignments = input.domainResult.affectedBusinessKeys.flatMap(
      (businessKey): LeaveAffectedAssignment[] => {
        const row = input.rowByBusinessKey.get(businessKey);
        const adjusted = adjustedByKey.get(businessKey);
        if (row === undefined || adjusted === undefined) {
          return [];
        }
        const nextMembershipId = adjusted.plannedMembershipId;
        const nextMemberName =
          nextMembershipId === null ? undefined : input.memberNamesById.get(nextMembershipId);
        return [
          {
            assignmentId: row.id,
            businessDate: row.businessDate,
            endsAt: row.endsAt.toISOString(),
            ...(row.plannedMembershipId === null
              ? {}
              : { previousMemberId: row.plannedMembershipId }),
            ...(row.plannedMemberName === null
              ? {}
              : { previousMemberName: row.plannedMemberName }),
            ...(nextMembershipId === null ? {} : { nextMemberId: nextMembershipId }),
            ...(nextMemberName === undefined ? {} : { nextMemberName }),
            shiftTypeAbbreviation: row.shiftTypeAbbreviation,
            shiftTypeColor: row.shiftTypeColor,
            shiftTypeId: row.shiftTypeId,
            shiftTypeName: row.shiftTypeName,
            shiftTypeTextColor: row.shiftTypeTextColor,
            slotPosition: row.slotPosition,
            startsAt: row.startsAt.toISOString(),
          },
        ];
      },
    );

    return {
      affectedAssignments,
      conflicts: input.domainResult.conflicts.map((conflict): LeaveReflowConflict => {
        const memberName = input.memberNamesById.get(conflict.membershipId);
        return {
          assignmentBusinessKeys: conflict.assignmentBusinessKeys,
          code: conflict.code,
          ...(memberName === undefined ? {} : { memberName }),
          membershipId: conflict.membershipId,
        };
      }),
      continuousDutyWarnings: input.domainResult.continuousDutyWarnings.map(
        (warning): ScheduleGenerationWarning => {
          const memberName = input.memberNamesById.get(warning.membershipId);
          return {
            assignmentBusinessKeys: warning.assignmentBusinessKeys,
            code: warning.code,
            endsAt: warning.endsAt.toISOString(),
            membershipId: warning.membershipId,
            ...(memberName === undefined ? {} : { memberName }),
            startsAt: warning.startsAt.toISOString(),
          };
        },
      ),
      groupDefaultStrategy: input.group.leaveReflowStrategy,
      leaveRequestId: input.leaveRequest.id,
      leaveRequestVersion: input.leaveRequest.version,
      periodVersions: Object.fromEntries(
        input.periods.map((period) => [period.id, period.version]),
      ),
      rulesVersion: input.group.rulesVersion,
      statisticsDelta: buildStatisticsDelta(
        input.periods,
        input.rowByBusinessKey,
        input.domainResult.assignments,
        input.memberNamesById,
      ),
      strategy: input.strategy,
      vacancies: input.domainResult.vacancies.map((vacancy): ScheduleGenerationVacancy => ({
        assignmentBusinessKey: vacancy.assignmentBusinessKey,
        businessDate: vacancy.businessDate,
        code: vacancy.code,
        scheduleRoleId: vacancy.scheduleRoleId,
        slotPosition: vacancy.slotPosition,
      })),
    };
  }

  private assertExpectedPeriodVersions(
    periods: readonly LockedSchedulePeriod[],
    expectedPeriodVersions: Readonly<Record<string, number>>,
  ): void {
    const expectedByPeriod = new Map(Object.entries(expectedPeriodVersions));
    if (expectedByPeriod.size !== periods.length) {
      const current = Object.fromEntries(periods.map((period) => [period.id, period.version]));
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { periodVersions: current },
        statusCode: 409,
        userMessage: '受影响排班期间已变化，请刷新后重新审批。',
      });
    }

    for (const period of periods) {
      const expectedVersion = expectedByPeriod.get(period.id);
      if (expectedVersion !== period.version) {
        assertExpectedVersion({
          actualVersion: period.version,
          expectedVersion: expectedVersion ?? -1,
          id: period.id,
          latestData: { status: period.status },
          objectType: 'schedule_period',
          userMessage: '受影响排班期间已被其他操作更新，请刷新后重新审批。',
        });
      }
    }
  }

  private async loadRotationRules(
    transaction: DatabaseTransaction,
    groupId: string,
    scheduleRoleIds: readonly string[],
  ): Promise<ReadonlyMap<string, RotationRuleRow>> {
    if (scheduleRoleIds.length === 0) {
      return new Map();
    }
    const rows = await transaction
      .select({
        currentPosition: rotationRules.currentPosition,
        id: rotationRules.id,
        requiredMembersPerDay: rotationRules.requiredMembersPerDay,
        scheduleRoleId: scheduleRoles.id,
        startDate: rotationRules.startDate,
        startingMemberScheduleRoleId: rotationRules.startingMemberScheduleRoleId,
      })
      .from(scheduleRoles)
      .innerJoin(rotationRules, eq(rotationRules.scheduleRoleId, scheduleRoles.id))
      .where(
        and(
          eq(scheduleRoles.groupId, groupId),
          inArray(scheduleRoles.id, [...scheduleRoleIds]),
          isNull(scheduleRoles.deletedAt),
          isNull(rotationRules.deletedAt),
        ),
      );

    return new Map(
      rows.flatMap((row): [string, RotationRuleRow][] =>
        row.startDate === null
          ? []
          : [
              [
                row.scheduleRoleId,
                {
                  currentPosition: row.currentPosition,
                  id: row.id,
                  requiredMembersPerDay: row.requiredMembersPerDay,
                  scheduleRoleId: row.scheduleRoleId,
                  startDate: row.startDate,
                  startingMemberScheduleRoleId: row.startingMemberScheduleRoleId,
                },
              ],
            ],
      ),
    );
  }

  private async loadRotationMembers(
    transaction: DatabaseTransaction,
    rotationRuleIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly LoadedRotationMember[]>> {
    if (rotationRuleIds.length === 0) {
      return new Map();
    }
    const rows = await transaction
      .select({
        effectiveFrom: memberScheduleRoles.effectiveFrom,
        effectiveTo: memberScheduleRoles.effectiveTo,
        memberScheduleRoleDeletedAt: memberScheduleRoles.deletedAt,
        memberScheduleRoleId: rotationMembers.memberScheduleRoleId,
        membershipDeletedAt: groupMemberships.deletedAt,
        membershipId: memberScheduleRoles.membershipId,
        membershipStatus: groupMemberships.status,
        position: rotationMembers.position,
        realName: userProfiles.realName,
        rotationRuleId: rotationMembers.rotationRuleId,
        userDeletedAt: users.deletedAt,
        userStatus: users.status,
      })
      .from(rotationMembers)
      .innerJoin(
        memberScheduleRoles,
        eq(memberScheduleRoles.id, rotationMembers.memberScheduleRoleId),
      )
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          inArray(rotationMembers.rotationRuleId, [...rotationRuleIds]),
          isNull(rotationMembers.deletedAt),
        ),
      )
      .orderBy(asc(rotationMembers.rotationRuleId), asc(rotationMembers.position));
    const membersByRuleId = new Map<string, LoadedRotationMember[]>();
    for (const row of rows) {
      const members = membersByRuleId.get(row.rotationRuleId) ?? [];
      members.push(toLoadedRotationMember(row));
      membersByRuleId.set(row.rotationRuleId, members);
    }

    return membersByRuleId;
  }

  private async lockLeaveRequest(
    transaction: DatabaseTransaction,
    groupId: string,
    leaveRequestId: string,
  ): Promise<LockedLeaveRequest> {
    const [leaveRequest] = await transaction
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.id, leaveRequestId),
          eq(leaveRequests.groupId, groupId),
          isNull(leaveRequests.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (leaveRequest === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '请假申请不存在或不可用。',
      });
    }

    return leaveRequest;
  }

  private async readLeaveRequests(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId?: string,
  ): Promise<readonly LeaveRequest[]> {
    const rows = await transaction
      .select({
        leaveRequest: leaveRequests,
        realName: userProfiles.realName,
      })
      .from(leaveRequests)
      .innerJoin(groupMemberships, eq(groupMemberships.id, leaveRequests.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(leaveRequests.groupId, groupId),
          isNull(leaveRequests.deletedAt),
          ...(membershipId === undefined ? [] : [eq(leaveRequests.membershipId, membershipId)]),
        ),
      )
      .orderBy(asc(leaveRequests.createdAt), asc(leaveRequests.id));

    return rows.map((row) => toLeaveRequest(row.leaveRequest, row.realName));
  }

  private async readLeaveRequest(
    transaction: DatabaseTransaction,
    leaveRequestId: string,
  ): Promise<LeaveRequest> {
    const [row] = await transaction
      .select({
        leaveRequest: leaveRequests,
        realName: userProfiles.realName,
      })
      .from(leaveRequests)
      .innerJoin(groupMemberships, eq(groupMemberships.id, leaveRequests.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(and(eq(leaveRequests.id, leaveRequestId), isNull(leaveRequests.deletedAt)))
      .limit(1);
    if (row === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '请假申请不存在或不可用。',
      });
    }

    return toLeaveRequest(row.leaveRequest, row.realName);
  }
}

function buildStatisticsDelta(
  periods: readonly LockedSchedulePeriod[],
  rowByBusinessKey: ReadonlyMap<string, LockedShiftAssignment>,
  adjustedAssignments: readonly ReflowAssignment[],
  memberNamesById: ReadonlyMap<string, string>,
): LeaveStatisticsDelta {
  const roleByPeriodId = new Map(periods.map((period) => [period.id, period.scheduleRoleId]));
  const before = new Map<string, MutableStatistics>();
  const after = new Map<string, MutableStatistics>();
  for (const row of rowByBusinessKey.values()) {
    if (row.plannedMembershipId === null) {
      continue;
    }
    incrementStatistics(before, row.plannedMembershipId, row, roleByPeriodId);
  }
  for (const assignment of adjustedAssignments) {
    if (assignment.plannedMembershipId === null) {
      continue;
    }
    const row = rowByBusinessKey.get(assignment.businessKey);
    if (row === undefined) {
      continue;
    }
    incrementStatistics(after, assignment.plannedMembershipId, row, roleByPeriodId);
  }

  const membershipIds = [...new Set([...before.keys(), ...after.keys()])].sort((left, right) => {
    const leftName = memberNamesById.get(left) ?? '';
    const rightName = memberNamesById.get(right) ?? '';
    return leftName.localeCompare(rightName, 'zh-Hans-CN') || left.localeCompare(right);
  });
  const byMember: LeaveMemberStatisticsDelta[] = membershipIds
    .map((membershipId) => {
      const beforeStatistics = before.get(membershipId);
      const afterStatistics = after.get(membershipId);
      const assignmentDelta =
        (afterStatistics?.assignmentCount ?? 0) - (beforeStatistics?.assignmentCount ?? 0);
      const countedDelta =
        (afterStatistics?.countedAssignmentCount ?? 0) -
        (beforeStatistics?.countedAssignmentCount ?? 0);
      const weekendDelta =
        (afterStatistics?.weekendAssignmentCount ?? 0) -
        (beforeStatistics?.weekendAssignmentCount ?? 0);
      if (assignmentDelta === 0 && countedDelta === 0 && weekendDelta === 0) {
        return undefined;
      }
      return {
        assignmentDelta,
        countedDelta,
        membershipId,
        realName: memberNamesById.get(membershipId) ?? '',
        weekendDelta,
      };
    })
    .filter((delta): delta is LeaveMemberStatisticsDelta => delta !== undefined);

  return {
    byMember,
    totalAssignmentDelta: byMember.reduce((total, delta) => total + delta.assignmentDelta, 0),
    totalCountedDelta: byMember.reduce((total, delta) => total + delta.countedDelta, 0),
    totalWeekendDelta: byMember.reduce((total, delta) => total + delta.weekendDelta, 0),
  };
}

interface MutableStatistics {
  assignmentCount: number;
  countedAssignmentCount: number;
  weekendAssignmentCount: number;
}

function incrementStatistics(
  statisticsByMember: Map<string, MutableStatistics>,
  membershipId: string,
  row: LockedShiftAssignment,
  roleByPeriodId: ReadonlyMap<string, string>,
): void {
  const statistics = statisticsByMember.get(membershipId) ?? {
    assignmentCount: 0,
    countedAssignmentCount: 0,
    weekendAssignmentCount: 0,
  };
  statistics.assignmentCount += 1;
  statistics.countedAssignmentCount += row.countsTowardStatistics === 1 ? 1 : 0;
  const roleId = roleByPeriodId.get(row.schedulePeriodId);
  if (roleId !== undefined && isWeekendBusinessDate(row.businessDate)) {
    statistics.weekendAssignmentCount += 1;
  }
  statisticsByMember.set(membershipId, statistics);
}

function isWeekendBusinessDate(businessDate: string): boolean {
  const day = new Date(`${businessDate}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function toDomainReflowRule(
  rule: RotationRuleRow,
  members: readonly LoadedRotationMember[],
): ReflowRotationRule {
  const startingMember = members.find(
    (member) => member.memberScheduleRoleId === rule.startingMemberScheduleRoleId,
  );
  return {
    members: members.map((member): ReflowMember => ({
      ...(member.effectiveFrom === undefined ? {} : { effectiveFrom: member.effectiveFrom }),
      ...(member.effectiveTo === undefined ? {} : { effectiveTo: member.effectiveTo }),
      isActive: member.isActive,
      membershipId: member.membershipId,
      position: member.position,
    })),
    requiredMembersPerDay: rule.requiredMembersPerDay,
    rotationStartDate: rule.startDate,
    scheduleRoleId: rule.scheduleRoleId,
    ...(startingMember === undefined ? {} : { startingMembershipId: startingMember.membershipId }),
  };
}

function toLoadedRotationMember(row: MemberRow): LoadedRotationMember {
  return {
    ...(row.effectiveFrom === null ? {} : { effectiveFrom: row.effectiveFrom }),
    ...(row.effectiveTo === null ? {} : { effectiveTo: row.effectiveTo }),
    isActive:
      row.membershipStatus === 'active' &&
      row.userStatus === 'active' &&
      row.memberScheduleRoleDeletedAt === null &&
      row.membershipDeletedAt === null &&
      row.userDeletedAt === null,
    memberScheduleRoleId: row.memberScheduleRoleId,
    membershipId: row.membershipId,
    position: row.position,
    realName: row.realName,
  };
}

function toLeaveRequest(leaveRequest: LockedLeaveRequest, realName: string): LeaveRequest {
  return {
    ...(leaveRequest.approverUserId === null
      ? {}
      : { approverUserId: leaveRequest.approverUserId }),
    createdAt: leaveRequest.createdAt.toISOString(),
    ...(leaveRequest.decidedAt === null ? {} : { decidedAt: leaveRequest.decidedAt.toISOString() }),
    endsAt: leaveRequest.endsAt.toISOString(),
    groupId: leaveRequest.groupId,
    id: leaveRequest.id,
    isAllDay: leaveRequest.isAllDay === 1,
    leaveType: leaveRequest.leaveType,
    memberName: realName,
    membershipId: leaveRequest.membershipId,
    reason: leaveRequest.reason,
    reflowStrategy: leaveRequest.reflowStrategy,
    startsAt: leaveRequest.startsAt.toISOString(),
    status: leaveRequest.status,
    version: leaveRequest.version,
  };
}

function createApproveFingerprint(input: {
  readonly acknowledgeBlockers: boolean;
  readonly expectedPeriodVersions: Readonly<Record<string, number>>;
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly groupId: string;
  readonly leaveRequestId: string;
  readonly strategy: string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...input,
        expectedPeriodVersions: Object.fromEntries(
          Object.entries(input.expectedPeriodVersions).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
      }),
    )
    .digest('hex');
}

function parseTimestamp(value: string, fieldName: string): Date {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) {
    throw validationError(`${fieldName}必须是有效的时间。`);
  }
  return timestamp;
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}
