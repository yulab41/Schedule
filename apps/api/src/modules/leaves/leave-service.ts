import { LeaveAssignmentService } from './leave-assignment-service.js';
import { createHash, randomUUID } from 'node:crypto';

import type {
  ApprovedLeaveRequestResult,
  ApproveLeaveRequestInput,
  CreateLeaveRequestInput,
  LeaveAffectedShift,
  LeaveAffectedShiftsInput,
  LeaveApprovalPreview,
  LeaveRequest,
  LeaveRequestMutationInput,
  LeaveRequestMutationResult,
  PreviewLeaveRequestInput,
  RejectedLeaveRequestResult,
  RejectLeaveRequestInput,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  groupMemberships,
  leaveRequests,
  schedulePeriods,
  shiftAssignments,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import {
  getChinaStandardTimeBusinessDate,
  getChinaStandardTimeCalendarDate,
  intervalsOverlap,
  isPastBusinessDate,
  leaveOverlapsInterval,
} from '@schedule/scheduling-domain';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import type { GroupAuthorization } from '../groups/permission-service.js';
import {
  isConflictBlockedError,
  writeConflictNotification,
} from '../notifications/conflict-notifier.js';
import { toLatestData } from '../schedules/shared.js';
import { getCurrentDutyMembershipId } from '../workflows/workflow-conflict-service.js';
import { runAuthorizedMutation } from '../workflows/workflow-operation.js';
import { WorkflowServices } from '../workflows/workflow-services.js';

type LockedLeaveRequest = typeof leaveRequests.$inferSelect;
type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;
type LockedShiftAssignment = typeof shiftAssignments.$inferSelect;

export class LeaveService {
  private readonly services: WorkflowServices;
  private readonly assignments: LeaveAssignmentService;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.services = new WorkflowServices(databaseClient);
    this.assignments = new LeaveAssignmentService(this.services);
  }

  public async submit(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateLeaveRequestInput,
  ): Promise<LeaveRequest> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'viewScheduleConfiguration',
      permissionService: this.services.permissionService,
      requestFingerprint: createLeaveRequestFingerprint({
        endsAt: input.endsAt,
        groupId,
        isAllDay: input.isAllDay === true,
        leaveType: input.leaveType,
        reason: input.reason ?? null,
        startsAt: input.startsAt,
      }),
      run: async (transaction, authorization) => {
        const startsAt = parseTimestamp(input.startsAt, '开始时间');
        const endsAt = parseTimestamp(input.endsAt, '结束时间');
        assertLeaveStartsTodayOrLater(startsAt);
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

        const leaveRequestId = randomUUID();
        await transaction.insert(leaveRequests).values({
          endsAt,
          groupId,
          id: leaveRequestId,
          isAllDay: input.isAllDay === true ? 1 : 0,
          leaveType: input.leaveType,
          membershipId: authorization.membership.id,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          startsAt,
        });
        const submittedEventId = await this.services.eventWriter.append(transaction, {
          affectedMembershipIds: [authorization.membership.id],
          afterData: toLatestData({
            endsAt: endsAt.toISOString(),
            isAllDay: input.isAllDay === true,
            leaveType: input.leaveType,
            startsAt: startsAt.toISOString(),
          }),
          eventStatus: 'completed',
          eventType: 'leave_request_submitted',
          groupId,
          initiatedByUserId: authorization.user.id,
          objectId: leaveRequestId,
          objectType: 'leave_request',
          operationId: input.operationId,
          operatorUserId: authorization.user.id,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
        });
        await this.services.notificationWriter.append(transaction, {
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
      },
      scope: 'leave_request_create',
    });
  }

  public async affectedShifts(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: LeaveAffectedShiftsInput,
  ): Promise<readonly LeaveAffectedShift[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.services.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const startsAt = parseTimestamp(input.startsAt, '开始时间');
      const endsAt = parseTimestamp(input.endsAt, '结束时间');
      assertLeaveStartsTodayOrLater(startsAt);
      if (startsAt.valueOf() >= endsAt.valueOf()) {
        throw validationError('结束时间必须晚于开始时间。');
      }
      const assignments = await this.loadAffectedAssignments(
        transaction,
        authorization.group.id,
        authorization.membership.id,
        startsAt,
        endsAt,
        input.isAllDay === true ? 1 : 0,
      );
      return this.buildAffectedShiftList(
        transaction,
        authorization.group.id,
        authorization.membership.id,
        assignments,
      );
    });
  }

  public async listMine(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly LeaveRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.services.permissionService.requirePermission(
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
      await this.services.permissionService.requirePermission(
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
  ): Promise<LeaveApprovalPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.services.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const leaveRequest = await this.lockLeaveRequest(transaction, groupId, leaveRequestId);
      if (leaveRequest.membershipId !== authorization.membership.id) {
        await this.services.permissionService.requirePermission(
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
      assertLeaveStartsTodayOrLater(leaveRequest.startsAt);
      void input;
      return (await this.assignments.preview(transaction, authorization.group, leaveRequest))
        .preview;
    });
  }

  public async approve(
    identity: AuthenticatedIdentity,
    groupId: string,
    leaveRequestId: string,
    input: ApproveLeaveRequestInput,
  ): Promise<ApprovedLeaveRequestResult> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      onError: async (error) => {
        if (error instanceof ApiError && isConflictBlockedError(error)) {
          await writeConflictNotification(this.databaseClient, {
            groupId,
            identity,
            operationId: input.operationId,
            preview: error.latestData?.preview,
          });
        }
      },
      operationId: input.operationId,
      permission: 'manageLeaves',
      permissionService: this.services.permissionService,
      requestFingerprint: createApproveFingerprint({
        acknowledgeBlockers: input.acknowledgeBlockers === true,
        expectedPeriodVersions: input.expectedPeriodVersions,
        expectedAssignmentVersions: input.expectedAssignmentVersions,
        expectedRulesVersion: input.expectedRulesVersion,
        expectedVersion: input.expectedVersion,
        groupId,
        leaveRequestId,
      }),
      run: (transaction, authorization) =>
        this.runApproval(transaction, authorization, leaveRequestId, input),
      scope: 'leave_request_approve',
    });
  }

  public async reject(
    identity: AuthenticatedIdentity,
    groupId: string,
    leaveRequestId: string,
    input: RejectLeaveRequestInput,
  ): Promise<RejectedLeaveRequestResult> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'manageLeaves',
      permissionService: this.services.permissionService,
      requestFingerprint: createHash('sha256')
        .update(
          JSON.stringify({
            expectedVersion: input.expectedVersion,
            groupId,
            leaveRequestId,
          }),
        )
        .digest('hex'),
      run: (transaction, authorization) =>
        this.runRejection(transaction, authorization, leaveRequestId, input),
      scope: 'leave_request_reject',
    });
  }

  public async cancel(
    identity: AuthenticatedIdentity,
    groupId: string,
    leaveRequestId: string,
    input: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'viewScheduleConfiguration',
      permissionService: this.services.permissionService,
      requestFingerprint: createLeaveMutationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
        leaveRequestId,
      }),
      run: (transaction, authorization) =>
        this.runCancellation(transaction, identity, authorization, leaveRequestId, input),
      scope: 'leave_request_cancel',
    });
  }

  public async revoke(
    identity: AuthenticatedIdentity,
    groupId: string,
    leaveRequestId: string,
    input: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'viewScheduleConfiguration',
      permissionService: this.services.permissionService,
      requestFingerprint: createLeaveMutationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
        leaveRequestId,
      }),
      run: (transaction, authorization) =>
        this.runRevocation(transaction, identity, authorization, leaveRequestId, input),
      scope: 'leave_request_revoke',
    });
  }

  private async runApproval(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    leaveRequestId: string,
    input: ApproveLeaveRequestInput,
  ): Promise<ApprovedLeaveRequestResult> {
    const leave = await this.lockLeaveRequest(transaction, authorization.group.id, leaveRequestId);
    if (leave.status !== 'pending')
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        latestData: {
          id: leave.id,
          objectType: 'leave_request',
          status: leave.status,
          version: leave.version,
        },
        userMessage: '该请假申请已处理，不能重复审批。',
      });
    assertLeaveStartsTodayOrLater(leave.startsAt);
    assertExpectedVersion({
      actualVersion: leave.version,
      expectedVersion: input.expectedVersion,
      id: leave.id,
      objectType: 'leave_request',
    });
    if (authorization.group.rulesVersion !== input.expectedRulesVersion)
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        latestData: { rulesVersion: authorization.group.rulesVersion },
        userMessage: '排班配置已更新，请重新预览。',
      });
    const context = await this.assignments.preview(transaction, authorization.group, leave, true);
    this.assertExpectedPeriodVersions(context.periods, input.expectedPeriodVersions);
    this.assignments.assertAssignmentVersions(context, input.expectedAssignmentVersions);
    if (context.preview.workflowBlockers.length > 0)
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        latestData: toLatestData({ workflowBlockers: context.preview.workflowBlockers }),
        userMessage: context.preview.workflowBlockers.map((b) => b.message).join('；'),
      });
    if (context.assignments.length > 0 && input.acknowledgeBlockers !== true)
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        latestData: toLatestData({ preview: context.preview }),
        userMessage: '批准后将清空这些班次，请确认待安排空缺。',
      });
    const decidedAt = new Date();
    await transaction
      .update(leaveRequests)
      .set({
        approverUserId: authorization.user.id,
        decidedAt,
        status: 'approved',
        version: sql`${leaveRequests.version} + 1`,
      })
      .where(eq(leaveRequests.id, leave.id));
    const eventId = await this.services.eventWriter.append(transaction, {
      affectedMembershipIds: [leave.membershipId],
      beforeData: { status: leave.status, version: leave.version },
      afterData: { status: 'approved', version: leave.version + 1 },
      eventStatus: 'completed',
      eventType: 'leave_request_approved',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: leave.id,
      objectType: 'leave_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
    });
    await this.assignments.clear(
      transaction,
      authorization,
      leave,
      context,
      input.operationId,
      eventId,
    );
    await this.services.notificationWriter.append(transaction, {
      body: '您的请假申请已批准，受影响班次已设为待安排。',
      groupId: authorization.group.id,
      notificationType: 'leave_request_approved',
      objectId: leave.id,
      objectType: 'leave_request',
      recipientMembershipIds: [leave.membershipId],
      scheduleEventId: eventId,
      title: '请假申请已批准',
    });
    return {
      leaveRequest: await this.readLeaveRequest(transaction, leave.id),
      operationId: input.operationId,
      preview: context.preview,
      status: 'approved',
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
    const rejectedEventId = await this.services.eventWriter.append(transaction, {
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
      ...(leaveRequest.reason === null ? {} : { reason: leaveRequest.reason }),
    });
    await this.services.notificationWriter.append(transaction, {
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

  private async runCancellation(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    authorization: GroupAuthorization,
    leaveRequestId: string,
    input: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult> {
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
        userMessage: '只能取消待审批的请假申请。',
      });
    }
    const isOwner = leaveRequest.membershipId === authorization.membership.id;
    if (!isOwner) {
      await this.services.permissionService.requirePermission(
        transaction,
        identity,
        authorization.group.id,
        'manageLeaves',
      );
    }
    assertExpectedVersion({
      actualVersion: leaveRequest.version,
      expectedVersion: input.expectedVersion,
      id: leaveRequest.id,
      latestData: { status: leaveRequest.status },
      objectType: 'leave_request',
      userMessage: '请假申请已被其他操作更新，请刷新后重试。',
    });

    await transaction
      .update(leaveRequests)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        version: sql`${leaveRequests.version} + 1`,
      })
      .where(eq(leaveRequests.id, leaveRequest.id));
    const cancelledEventId = await this.services.eventWriter.append(transaction, {
      affectedMembershipIds: [leaveRequest.membershipId],
      afterData: toLatestData({
        status: 'cancelled',
        version: leaveRequest.version + 1,
      }),
      beforeData: toLatestData({
        status: leaveRequest.status,
        version: leaveRequest.version,
      }),
      eventStatus: 'completed',
      eventType: 'leave_request_cancelled',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(leaveRequest.reason === null ? {} : { reason: leaveRequest.reason }),
    });
    await this.services.notificationWriter.append(transaction, {
      body: '请假申请已取消。',
      groupId: authorization.group.id,
      notificationType: 'leave_request_cancelled',
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      recipientMembershipIds: [leaveRequest.membershipId],
      scheduleEventId: cancelledEventId,
      title: '请假申请已取消',
    });
    if (isOwner) {
      await this.services.notificationWriter.append(transaction, {
        administratorRecipients: true,
        body: '成员取消了请假申请。',
        excludeRecipientUserIds: [authorization.user.id],
        groupId: authorization.group.id,
        notificationType: 'leave_request_cancelled',
        objectId: leaveRequest.id,
        objectType: 'leave_request',
        scheduleEventId: cancelledEventId,
        title: '请假申请已取消',
      });
    }

    return {
      leaveRequestId: leaveRequest.id,
      operationId: input.operationId,
      status: 'cancelled',
    };
  }

  private async runRevocation(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    authorization: GroupAuthorization,
    leaveRequestId: string,
    input: LeaveRequestMutationInput,
  ): Promise<LeaveRequestMutationResult> {
    const leaveRequest = await this.lockLeaveRequest(
      transaction,
      authorization.group.id,
      leaveRequestId,
    );
    if (leaveRequest.status !== 'approved') {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: {
          id: leaveRequest.id,
          objectType: 'leave_request',
          status: leaveRequest.status,
          version: leaveRequest.version,
        },
        statusCode: 409,
        userMessage: '只能撤销已批准的请假申请。',
      });
    }
    const leaveStartDate = getChinaStandardTimeBusinessDate(leaveRequest.startsAt);
    if (isPastBusinessDate(leaveStartDate)) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: `该请假涉及已过日期（${leaveStartDate} 起），已过日期不可修改，无法撤销。`,
      });
    }
    const isOwner = leaveRequest.membershipId === authorization.membership.id;
    if (!isOwner) {
      await this.services.permissionService.requirePermission(
        transaction,
        identity,
        authorization.group.id,
        'manageLeaves',
      );
    }
    assertExpectedVersion({
      actualVersion: leaveRequest.version,
      expectedVersion: input.expectedVersion,
      id: leaveRequest.id,
      latestData: { status: leaveRequest.status },
      objectType: 'leave_request',
      userMessage: '请假申请已被其他操作更新，请刷新后重试。',
    });

    await transaction
      .update(leaveRequests)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        version: sql`${leaveRequests.version} + 1`,
      })
      .where(eq(leaveRequests.id, leaveRequest.id));
    const restoration = await this.assignments.restore(transaction, authorization, leaveRequest);
    const revokedEventId = await this.services.eventWriter.append(transaction, {
      affectedShiftIds: restoration.restoredAssignmentIds,
      affectedMembershipIds: [leaveRequest.membershipId],
      afterData: toLatestData({
        status: 'revoked',
        restoration,
        version: leaveRequest.version + 1,
      }),
      beforeData: toLatestData({
        status: leaveRequest.status,
        version: leaveRequest.version,
      }),
      eventStatus: 'completed',
      eventType: 'leave_request_revoked',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(leaveRequest.reason === null ? {} : { reason: leaveRequest.reason }),
    });
    await this.services.notificationWriter.append(transaction, {
      body: `请假已撤销，恢复 ${restoration.restoredAssignmentIds.length} 个未修改空缺；其余班次保留现状。`,
      groupId: authorization.group.id,
      notificationType: 'leave_request_revoked',
      objectId: leaveRequest.id,
      objectType: 'leave_request',
      recipientMembershipIds: [leaveRequest.membershipId],
      scheduleEventId: revokedEventId,
      title: '请假已撤销',
    });
    if (isOwner) {
      await this.services.notificationWriter.append(transaction, {
        administratorRecipients: true,
        body: '成员撤销了已批准的请假。',
        excludeRecipientUserIds: [authorization.user.id],
        groupId: authorization.group.id,
        notificationType: 'leave_request_revoked',
        objectId: leaveRequest.id,
        objectType: 'leave_request',
        scheduleEventId: revokedEventId,
        title: '请假已撤销',
      });
    }

    return {
      leaveRequestId: leaveRequest.id,
      operationId: input.operationId,
      status: 'revoked',
      restoration,
    };
  }

  private async loadAffectedAssignments(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId: string,
    startsAt: Date,
    endsAt: Date,
    isAllDay: boolean | number,
  ): Promise<readonly LockedShiftAssignment[]> {
    const periods = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, groupId),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
        ),
      );
    if (periods.length === 0) {
      return [];
    }
    const periodIds = periods.map((period) => period.id);
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
          sql`${shiftAssignments.startsAt} > ${new Date()}`,
        ),
      );

    return rows.filter(
      (assignment) =>
        getCurrentDutyMembershipId(assignment) === membershipId &&
        leaveOverlapsInterval({ endsAt, isAllDay, startsAt }, assignment),
    );
  }

  private async buildAffectedShiftList(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId: string,
    assignments: readonly LockedShiftAssignment[],
  ): Promise<readonly LeaveAffectedShift[]> {
    if (assignments.length === 0) {
      return [];
    }
    const coveredAssignmentIds =
      await this.services.workflowConflictService.findLeaveCoverageAssignmentIds(
        transaction,
        groupId,
        membershipId,
        assignments.map((assignment) => assignment.id),
      );

    return assignments.map((assignment) => ({
      assignmentId: assignment.id,
      businessDate: assignment.businessDate,
      isCovered: coveredAssignmentIds.has(assignment.id),
      shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
      shiftTypeName: assignment.shiftTypeName,
    }));
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

    const approverUserIds = [
      ...new Set(
        rows.flatMap((row) =>
          row.leaveRequest.approverUserId === null ? [] : [row.leaveRequest.approverUserId],
        ),
      ),
    ];
    const approverProfiles =
      approverUserIds.length === 0
        ? []
        : await transaction
            .select({ realName: userProfiles.realName, userId: userProfiles.userId })
            .from(userProfiles)
            .where(
              and(inArray(userProfiles.userId, approverUserIds), isNull(userProfiles.deletedAt)),
            );
    const approverNameByUserId = new Map(
      approverProfiles.map((profile) => [profile.userId, profile.realName]),
    );

    return rows.map((row) => toLeaveRequest(row.leaveRequest, row.realName, approverNameByUserId));
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

    const approverNameByUserId = new Map<string, string>();
    if (row.leaveRequest.approverUserId !== null) {
      const [approver] = await transaction
        .select({ realName: userProfiles.realName })
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.userId, row.leaveRequest.approverUserId),
            isNull(userProfiles.deletedAt),
          ),
        )
        .limit(1);
      if (approver !== undefined) {
        approverNameByUserId.set(row.leaveRequest.approverUserId, approver.realName);
      }
    }

    return toLeaveRequest(row.leaveRequest, row.realName, approverNameByUserId);
  }
}

function toLeaveRequest(
  leaveRequest: LockedLeaveRequest,
  realName: string,
  approverNameByUserId: ReadonlyMap<string, string>,
): LeaveRequest {
  const decidedByMemberName =
    leaveRequest.approverUserId === null
      ? undefined
      : approverNameByUserId.get(leaveRequest.approverUserId);
  return {
    ...(leaveRequest.approverUserId === null
      ? {}
      : {
          approverUserId: leaveRequest.approverUserId,
          ...(decidedByMemberName === undefined ? {} : { decidedByMemberName }),
        }),
    createdAt: leaveRequest.createdAt.toISOString(),
    ...(leaveRequest.decidedAt === null ? {} : { decidedAt: leaveRequest.decidedAt.toISOString() }),
    endsAt: leaveRequest.endsAt.toISOString(),
    groupId: leaveRequest.groupId,
    id: leaveRequest.id,
    isAllDay: leaveRequest.isAllDay === 1,
    ...(leaveRequest.status === 'approved' ? { isRevocable: true } : {}),
    leaveType: leaveRequest.leaveType,
    memberName: realName,
    membershipId: leaveRequest.membershipId,
    ...(leaveRequest.reason === null ? {} : { reason: leaveRequest.reason }),
    startsAt: leaveRequest.startsAt.toISOString(),
    status: leaveRequest.status,
    version: leaveRequest.version,
  };
}

function createLeaveMutationFingerprint(input: {
  readonly expectedVersion: number;
  readonly groupId: string;
  readonly leaveRequestId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function createLeaveRequestFingerprint(input: {
  readonly endsAt: string;
  readonly groupId: string;
  readonly isAllDay: boolean;
  readonly leaveType: string;
  readonly reason: string | null;
  readonly startsAt: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function createApproveFingerprint(input: {
  readonly acknowledgeBlockers: boolean;
  readonly expectedPeriodVersions: Readonly<Record<string, number>>;
  readonly expectedAssignmentVersions: Readonly<Record<string, number>>;
  readonly expectedRulesVersion: number;
  readonly expectedVersion: number;
  readonly groupId: string;
  readonly leaveRequestId: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...input,
        expectedAssignmentVersions: Object.fromEntries(
          Object.entries(input.expectedAssignmentVersions).sort(([a], [b]) => a.localeCompare(b)),
        ),
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

function assertLeaveStartsTodayOrLater(startsAt: Date): void {
  if (isLeaveStartBeforeChinaToday(startsAt)) {
    const today = getChinaStandardTimeCalendarDate(new Date());
    throw validationError(`开始日期最早只能是当天（${today}）。`);
  }
}

export function isLeaveStartBeforeChinaToday(startsAt: Date, now: Date = new Date()): boolean {
  return getChinaStandardTimeCalendarDate(startsAt) < getChinaStandardTimeCalendarDate(now);
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}
