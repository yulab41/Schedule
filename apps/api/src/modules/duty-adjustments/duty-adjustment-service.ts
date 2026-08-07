import { createHash, randomUUID } from 'node:crypto';

import type {
  CreateDirectDutyAdjustmentInput,
  CreateDutyAdjustmentRequestInput,
  DutyAdjustmentConflict,
  DutyAdjustmentAssignmentSummary,
  DutyAdjustmentMutationInput,
  DutyAdjustmentPairInput,
  DutyAdjustmentPreview,
  DutyAdjustmentRequest,
  DutyAdjustmentStatus,
  GroupDutyAdjustmentSettings,
  MemberSwapSettings,
  RevokeDutyAdjustmentInput,
  UpdateGroupDutyAdjustmentSettingsInput,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  dutyAdjustments,
  groupMemberships,
  groups,
  schedulePeriods,
  shiftAssignments,
  userProfiles,
  withTransaction,
} from '@schedule/database';
import { isPastBusinessDate } from '@schedule/scheduling-domain';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import { EventWriter } from '../events/event-writer.js';
import { GroupMemberReader, type GroupMemberRow } from '../groups/group-member-reader.js';
import {
  GroupPermissionService,
  type ActiveGroup,
  type GroupAuthorization,
} from '../groups/permission-service.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { updateShiftAssignments } from '../schedules/shift-assignment-writer.js';
import { toLatestData } from '../schedules/shared.js';
import {
  getCurrentDutyMembershipId,
  WorkflowConflictService,
  type WorkflowConflict,
} from '../workflows/workflow-conflict-service.js';
import { allocateWorkflowSequence } from '../workflows/workflow-sequence-allocator.js';
import { WorkflowSelfHealingService } from '../workflows/workflow-self-healing-service.js';

type LockedDutyAdjustment = typeof dutyAdjustments.$inferSelect;
type LockedShiftAssignment = typeof shiftAssignments.$inferSelect;
type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;

interface DutyAdjustmentContext {
  readonly activeWorkflowConflicts: readonly DutyAdjustmentConflict[];
  readonly conflicts: readonly DutyAdjustmentConflict[];
  readonly coveredAssignment: LockedShiftAssignment;
  readonly coveredAssignmentVersion: number;
  readonly deductedMember: GroupMemberRow;
  readonly group: ActiveGroup;
  readonly nextStatus: DutyAdjustmentStatus;
  readonly overtimeAutoAccepts: boolean;
  readonly overtimeMember: GroupMemberRow;
  readonly period: LockedSchedulePeriod;
  readonly preview: DutyAdjustmentPreview;
  readonly requiresApproval: boolean;
}

export class DutyAdjustmentService {
  private readonly eventWriter = new EventWriter();
  private readonly notificationWriter = new NotificationWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly memberReader = new GroupMemberReader();
  private readonly workflowConflictService = new WorkflowConflictService();
  private readonly workflowSelfHealingService: WorkflowSelfHealingService;
  private readonly statisticsService: StatisticsService;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.statisticsService = new StatisticsService(this.databaseClient);
    this.workflowSelfHealingService = new WorkflowSelfHealingService(this.databaseClient);
  }

  public async preview(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: DutyAdjustmentPairInput,
  ): Promise<DutyAdjustmentPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const context = await this.loadDutyAdjustmentContext(
        transaction,
        authorization.group,
        input.overtimeMembershipId,
        input.coveredAssignmentId,
        authorization.membership.role === 'member' ? authorization.membership.id : null,
      );

      return context.preview;
    });
  }

  public async create(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateDutyAdjustmentRequestInput,
  ): Promise<DutyAdjustmentRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createDutyAdjustmentPairFingerprint({
            coveredAssignmentId: input.coveredAssignmentId,
            groupId,
            overtimeMembershipId: input.overtimeMembershipId,
            ...(input.reason === undefined ? {} : { reason: input.reason }),
          }),
          scope: 'duty_adjustment_create',
        },
        () => this.runCreation(transaction, authorization, input),
      );
    });
  }

  public async createDirect(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateDirectDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageDutyAdjustments',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createDutyAdjustmentPairFingerprint({
            coveredAssignmentId: input.coveredAssignmentId,
            groupId,
            overtimeMembershipId: input.overtimeMembershipId,
            ...(input.reason === undefined ? {} : { reason: input.reason }),
          }),
          scope: 'duty_adjustment_direct_create',
        },
        () => this.runDirectCreation(transaction, authorization, input),
      );
    });
  }

  public async listMine(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly DutyAdjustmentRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const rows = await transaction
        .select()
        .from(dutyAdjustments)
        .where(
          and(
            eq(dutyAdjustments.groupId, groupId),
            or(
              eq(dutyAdjustments.deductedMembershipId, authorization.membership.id),
              eq(dutyAdjustments.overtimeMembershipId, authorization.membership.id),
            ),
            isNull(dutyAdjustments.deletedAt),
          ),
        )
        .orderBy(desc(dutyAdjustments.createdAt), desc(dutyAdjustments.id));

      return this.hydrateDutyAdjustments(transaction, rows);
    });
  }

  public async listApprovals(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly DutyAdjustmentRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageDutyAdjustments',
      );
      const rows = await transaction
        .select()
        .from(dutyAdjustments)
        .where(and(eq(dutyAdjustments.groupId, groupId), isNull(dutyAdjustments.deletedAt)))
        .orderBy(desc(dutyAdjustments.createdAt), desc(dutyAdjustments.id));

      return this.hydrateDutyAdjustments(transaction, rows);
    });
  }

  public async accept(
    identity: AuthenticatedIdentity,
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createMutationFingerprint({
            dutyAdjustmentId,
            expectedVersion: input.expectedVersion,
            groupId,
          }),
          scope: 'duty_adjustment_accept',
        },
        () => this.runAcceptance(transaction, authorization, dutyAdjustmentId, input),
      );
    });
  }

  public async approve(
    identity: AuthenticatedIdentity,
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageDutyAdjustments',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createMutationFingerprint({
            dutyAdjustmentId,
            expectedVersion: input.expectedVersion,
            groupId,
          }),
          scope: 'duty_adjustment_approve',
        },
        () => this.runApproval(transaction, authorization, dutyAdjustmentId, input),
      );
    });
  }

  public async reject(
    identity: AuthenticatedIdentity,
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createMutationFingerprint({
            dutyAdjustmentId,
            expectedVersion: input.expectedVersion,
            groupId,
          }),
          scope: 'duty_adjustment_reject',
        },
        () => this.runRejection(transaction, identity, authorization, dutyAdjustmentId, input),
      );
    });
  }

  public async cancel(
    identity: AuthenticatedIdentity,
    groupId: string,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createMutationFingerprint({
            dutyAdjustmentId,
            expectedVersion: input.expectedVersion,
            groupId,
          }),
          scope: 'duty_adjustment_cancel',
        },
        () => this.runCancellation(transaction, identity, authorization, dutyAdjustmentId, input),
      );
    });
  }

  public async revoke(
    identity: AuthenticatedIdentity,
    groupId: string,
    dutyAdjustmentId: string,
    input: RevokeDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createMutationFingerprint({
            dutyAdjustmentId,
            expectedVersion: input.expectedVersion,
            groupId,
            ...(input.reason === undefined ? {} : { reason: input.reason }),
          }),
          scope: 'duty_adjustment_revoke',
        },
        () => this.runRevocation(transaction, authorization, dutyAdjustmentId, input),
      );
    });
  }

  public async getGroupSettings(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupDutyAdjustmentSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return { requiresApproval: authorization.group.dutyAdjustmentApprovalRequired };
    });
  }

  public async updateGroupSettings(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupDutyAdjustmentSettingsInput,
  ): Promise<GroupDutyAdjustmentSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageDutyAdjustments',
      );
      await transaction
        .update(groups)
        .set({
          dutyAdjustmentApprovalRequired: input.requiresApproval ? 1 : 0,
          version: sql`${groups.version} + 1`,
        })
        .where(eq(groups.id, authorization.group.id));

      return { requiresApproval: input.requiresApproval };
    });
  }

  public async getMySettings(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<MemberSwapSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const [membership] = await transaction
        .select({
          autoAcceptSwaps: groupMemberships.autoAcceptSwaps,
          autoAcceptSwapsManuallySet: groupMemberships.autoAcceptSwapsManuallySet,
        })
        .from(groupMemberships)
        .where(eq(groupMemberships.id, authorization.membership.id))
        .limit(1);

      return {
        autoAcceptSwaps:
          membership !== undefined &&
          membership.autoAcceptSwapsManuallySet === 1 &&
          membership.autoAcceptSwaps === 1,
      };
    });
  }

  private async runCreation(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: CreateDutyAdjustmentRequestInput,
  ): Promise<DutyAdjustmentRequest> {
    const context = await this.loadDutyAdjustmentContext(
      transaction,
      authorization.group,
      input.overtimeMembershipId,
      input.coveredAssignmentId,
      authorization.membership.id,
      true,
    );
    this.assertNoWorkflowConflicts(context);

    const dutyAdjustmentId = randomUUID();
    const workflowSequence = await allocateWorkflowSequence(transaction);
    const status = context.nextStatus;
    const decidedAt = status === 'completed' ? new Date() : null;
    await transaction.insert(dutyAdjustments).values({
      approverUserId: null,
      assignmentVersion: context.coveredAssignment.version,
      coveredAssignmentId: context.coveredAssignment.id,
      decidedAt,
      deductedMembershipId: context.deductedMember.id,
      groupId: authorization.group.id,
      id: dutyAdjustmentId,
      overtimeMembershipId: context.overtimeMember.id,
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      status,
      workflowSequence,
    });
    const createdEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      afterData: toLatestData({
        coveredAssignmentId: context.coveredAssignment.id,
        status,
      }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_request_created',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: dutyAdjustmentId,
      objectType: 'duty_adjustment',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      schedulePeriodId: context.period.id,
    });
    if (status === 'completed') {
      await this.notificationWriter.append(transaction, {
        body: '加扣班已完成，您的班次已更新。',
        groupId: authorization.group.id,
        notificationType: 'schedule_changed',
        payload: { dutyAdjustmentId, reason: 'duty_adjustment' },
        recipientMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
        scheduleEventId: createdEventId,
        title: '加扣班已完成',
      });
    } else {
      await this.notificationWriter.append(transaction, {
        body: '有人向您发起加扣班申请，请及时处理。',
        groupId: authorization.group.id,
        notificationType: 'duty_adjustment_request_created',
        objectId: dutyAdjustmentId,
        objectType: 'duty_adjustment',
        payload: { status },
        recipientMembershipIds: [context.overtimeMember.id],
        scheduleEventId: createdEventId,
        title: '新的加扣班申请',
      });
      if (status === 'pending_approval') {
        await this.notificationWriter.append(transaction, {
          administratorRecipients: true,
          body: '成员提交了加扣班申请，等待您审批。',
          excludeRecipientUserIds: [authorization.user.id],
          groupId: authorization.group.id,
          notificationType: 'approval_pending',
          objectId: dutyAdjustmentId,
          objectType: 'duty_adjustment',
          payload: { requestType: 'duty_adjustment' },
          scheduleEventId: createdEventId,
          title: '加扣班申请待审批',
        });
      }
    }

    if (status === 'completed') {
      await this.applyDutyAdjustment(
        transaction,
        context,
        dutyAdjustmentId,
        authorization.user.id,
        input.operationId,
        createdEventId,
        context.deductedMember.realName,
        null,
      );
    }

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      context.coveredAssignment.id,
    ]);

    return this.readDutyAdjustment(transaction, dutyAdjustmentId);
  }

  private async runDirectCreation(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: CreateDirectDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest> {
    const context = await this.loadDutyAdjustmentContext(
      transaction,
      authorization.group,
      input.overtimeMembershipId,
      input.coveredAssignmentId,
      null,
      true,
    );
    this.assertNoWorkflowConflicts(context);

    const dutyAdjustmentId = randomUUID();
    const workflowSequence = await allocateWorkflowSequence(transaction);
    const decidedAt = new Date();
    await transaction.insert(dutyAdjustments).values({
      approverUserId: authorization.user.id,
      assignmentVersion: context.coveredAssignment.version,
      coveredAssignmentId: context.coveredAssignment.id,
      decidedAt,
      deductedMembershipId: context.deductedMember.id,
      groupId: authorization.group.id,
      id: dutyAdjustmentId,
      overtimeMembershipId: context.overtimeMember.id,
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      status: 'completed',
      workflowSequence,
    });
    const createdEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      afterData: toLatestData({
        approverUserId: authorization.user.id,
        coveredAssignmentId: context.coveredAssignment.id,
        status: 'completed',
      }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_request_created',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: dutyAdjustmentId,
      objectType: 'duty_adjustment',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      schedulePeriodId: context.period.id,
    });
    await this.notificationWriter.append(transaction, {
      body: '管理员已为您调整加扣班，您的班次已更新。',
      groupId: authorization.group.id,
      notificationType: 'schedule_changed',
      payload: { dutyAdjustmentId, reason: 'duty_adjustment' },
      recipientMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      scheduleEventId: createdEventId,
      title: '加扣班已完成',
    });
    await this.applyDutyAdjustment(
      transaction,
      context,
      dutyAdjustmentId,
      authorization.user.id,
      input.operationId,
      createdEventId,
      authorization.user.realName,
      authorization.user.id,
    );

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      context.coveredAssignment.id,
    ]);

    return this.readDutyAdjustment(transaction, dutyAdjustmentId);
  }

  private async runAcceptance(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    const request = await this.lockDutyAdjustment(
      transaction,
      authorization.group.id,
      dutyAdjustmentId,
    );
    if (request.status !== 'pending_target') {
      throw alreadyHandled(request);
    }
    if (request.overtimeMembershipId !== authorization.membership.id) {
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '只有加班成员才能接受该加扣班申请。',
      });
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'duty_adjustment',
      userMessage: '加扣班申请已被其他操作更新，请刷新后重试。',
    });

    const context = await this.loadDutyAdjustmentContext(
      transaction,
      authorization.group,
      request.overtimeMembershipId,
      request.coveredAssignmentId,
      request.deductedMembershipId,
      true,
      false,
      request.id,
    );
    this.assertStoredAssignmentVersion(context, request);
    this.assertNoWorkflowConflicts(context);

    const nextStatus = authorization.group.dutyAdjustmentApprovalRequired
      ? 'pending_approval'
      : 'completed';
    const acceptedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      afterData: toLatestData({ status: nextStatus }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_request_accepted',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'duty_adjustment',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(request.reason === null ? {} : { reason: request.reason }),
      schedulePeriodId: context.period.id,
    });
    if (nextStatus === 'completed') {
      await this.notificationWriter.append(transaction, {
        body: '加扣班已完成，您的班次已更新。',
        groupId: authorization.group.id,
        notificationType: 'schedule_changed',
        payload: { dutyAdjustmentId: request.id, reason: 'duty_adjustment' },
        recipientMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
        scheduleEventId: acceptedEventId,
        title: '加扣班已完成',
      });
    } else {
      await this.notificationWriter.append(transaction, {
        body: '对方已接受加扣班申请，等待管理员审批。',
        groupId: authorization.group.id,
        notificationType: 'duty_adjustment_request_accepted',
        objectId: request.id,
        objectType: 'duty_adjustment',
        recipientMembershipIds: [context.deductedMember.id],
        scheduleEventId: acceptedEventId,
        title: '加扣班申请已接受',
      });
      await this.notificationWriter.append(transaction, {
        administratorRecipients: true,
        body: '加扣班申请已被双方接受，等待您审批。',
        excludeRecipientUserIds: [authorization.user.id],
        groupId: authorization.group.id,
        notificationType: 'approval_pending',
        objectId: request.id,
        objectType: 'duty_adjustment',
        payload: { requestType: 'duty_adjustment' },
        scheduleEventId: acceptedEventId,
        title: '加扣班申请待审批',
      });
    }

    if (nextStatus === 'completed') {
      await this.applyDutyAdjustment(
        transaction,
        context,
        request.id,
        authorization.user.id,
        input.operationId,
        acceptedEventId,
        context.deductedMember.realName,
        null,
      );
    } else {
      await transaction
        .update(dutyAdjustments)
        .set({ status: 'pending_approval', version: sql`${dutyAdjustments.version} + 1` })
        .where(eq(dutyAdjustments.id, request.id));
    }

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.coveredAssignmentId,
    ]);

    return this.readDutyAdjustment(transaction, request.id);
  }

  private async runApproval(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    const request = await this.lockDutyAdjustment(
      transaction,
      authorization.group.id,
      dutyAdjustmentId,
    );
    if (request.status !== 'pending_approval') {
      throw alreadyHandled(request);
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'duty_adjustment',
      userMessage: '加扣班申请已被其他操作更新，请刷新后重试。',
    });

    const context = await this.loadDutyAdjustmentContext(
      transaction,
      authorization.group,
      request.overtimeMembershipId,
      request.coveredAssignmentId,
      request.deductedMembershipId,
      true,
      false,
      request.id,
    );
    this.assertStoredAssignmentVersion(context, request);
    this.assertNoWorkflowConflicts(context);

    const approvedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      afterData: toLatestData({
        approverUserId: authorization.user.id,
        status: 'completed',
      }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_request_approved',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'duty_adjustment',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(request.reason === null ? {} : { reason: request.reason }),
      schedulePeriodId: context.period.id,
    });
    await this.notificationWriter.append(transaction, {
      body: '加扣班已审批通过，您的班次已更新。',
      groupId: authorization.group.id,
      notificationType: 'schedule_changed',
      payload: { dutyAdjustmentId: request.id, reason: 'duty_adjustment' },
      recipientMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      scheduleEventId: approvedEventId,
      title: '加扣班已生效',
    });
    await this.applyDutyAdjustment(
      transaction,
      context,
      request.id,
      authorization.user.id,
      input.operationId,
      approvedEventId,
      context.deductedMember.realName,
      authorization.user.id,
    );

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.coveredAssignmentId,
    ]);

    return this.readDutyAdjustment(transaction, request.id);
  }

  private async runRejection(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    authorization: GroupAuthorization,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    const request = await this.lockDutyAdjustment(
      transaction,
      authorization.group.id,
      dutyAdjustmentId,
    );
    const isOvertimeMember = request.overtimeMembershipId === authorization.membership.id;
    if (!isOvertimeMember) {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        authorization.group.id,
        'manageDutyAdjustments',
      );
    }
    const canReject = isOvertimeMember
      ? request.status === 'pending_target'
      : request.status === 'pending_target' || request.status === 'pending_approval';
    if (!canReject) {
      throw alreadyHandled(request);
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'duty_adjustment',
      userMessage: '加扣班申请已被其他操作更新，请刷新后重试。',
    });

    await transaction
      .update(dutyAdjustments)
      .set({
        approverUserId: isOvertimeMember ? null : authorization.user.id,
        decidedAt: new Date(),
        status: 'rejected',
        version: sql`${dutyAdjustments.version} + 1`,
      })
      .where(eq(dutyAdjustments.id, request.id));
    const rejectedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [request.deductedMembershipId, request.overtimeMembershipId],
      afterData: toLatestData({ status: 'rejected' }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_request_rejected',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'duty_adjustment',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(request.reason === null ? {} : { reason: request.reason }),
    });
    await this.notificationWriter.append(transaction, {
      body: '加扣班申请已被驳回。',
      groupId: authorization.group.id,
      notificationType: 'duty_adjustment_request_rejected',
      objectId: request.id,
      objectType: 'duty_adjustment',
      recipientMembershipIds: [request.deductedMembershipId, request.overtimeMembershipId],
      scheduleEventId: rejectedEventId,
      title: '加扣班申请已驳回',
    });

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.coveredAssignmentId,
    ]);

    return this.readDutyAdjustment(transaction, request.id);
  }

  private async runCancellation(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    authorization: GroupAuthorization,
    dutyAdjustmentId: string,
    input: DutyAdjustmentMutationInput,
  ): Promise<DutyAdjustmentRequest> {
    const request = await this.lockDutyAdjustment(
      transaction,
      authorization.group.id,
      dutyAdjustmentId,
    );
    const isInitiator = request.deductedMembershipId === authorization.membership.id;
    if (!isInitiator) {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        authorization.group.id,
        'manageDutyAdjustments',
      );
    }
    if (request.status !== 'pending_target' && request.status !== 'pending_approval') {
      throw alreadyHandled(request);
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'duty_adjustment',
      userMessage: '加扣班申请已被其他操作更新，请刷新后重试。',
    });

    await transaction
      .update(dutyAdjustments)
      .set({
        decidedAt: new Date(),
        status: 'cancelled',
        version: sql`${dutyAdjustments.version} + 1`,
      })
      .where(eq(dutyAdjustments.id, request.id));
    const cancelledEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [request.deductedMembershipId, request.overtimeMembershipId],
      afterData: toLatestData({ status: 'cancelled' }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_request_cancelled',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'duty_adjustment',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(request.reason === null ? {} : { reason: request.reason }),
    });
    await this.notificationWriter.append(transaction, {
      body: '加扣班申请已取消。',
      excludeRecipientUserIds: [authorization.user.id],
      groupId: authorization.group.id,
      notificationType: 'duty_adjustment_request_cancelled',
      objectId: request.id,
      objectType: 'duty_adjustment',
      recipientMembershipIds: [request.deductedMembershipId, request.overtimeMembershipId],
      scheduleEventId: cancelledEventId,
      title: '加扣班申请已取消',
    });

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.coveredAssignmentId,
    ]);

    return this.readDutyAdjustment(transaction, request.id);
  }

  private async runRevocation(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    dutyAdjustmentId: string,
    input: RevokeDutyAdjustmentInput,
  ): Promise<DutyAdjustmentRequest> {
    const request = await this.lockDutyAdjustment(
      transaction,
      authorization.group.id,
      dutyAdjustmentId,
    );
    const isParty =
      request.deductedMembershipId === authorization.membership.id ||
      request.overtimeMembershipId === authorization.membership.id;
    if (authorization.membership.role === 'member') {
      if (request.status !== 'completed' || !isParty) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '只有管理员或加扣班双方可以撤销已生效的加扣班。',
        });
      }
    }
    if (request.status !== 'completed') {
      throw alreadyHandled(request);
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'duty_adjustment',
      userMessage: '加扣班记录已被其他操作更新，请刷新后重试。',
    });

    const [coveredRow] = await transaction
      .select({ businessDate: shiftAssignments.businessDate, id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.id, request.coveredAssignmentId),
          isNull(shiftAssignments.deletedAt),
        ),
      )
      .limit(1);
    if (coveredRow === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '该加扣班的班次已失效（排班版本变更），无法直接撤销。',
      });
    }
    if (isPastBusinessDate(coveredRow.businessDate)) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: `该加扣班涉及已过日期（${coveredRow.businessDate}），已过日期不可修改，无法撤销。`,
      });
    }

    const context = await this.loadDutyAdjustmentContext(
      transaction,
      authorization.group,
      request.overtimeMembershipId,
      request.coveredAssignmentId,
      request.deductedMembershipId,
      true,
      true,
      request.id,
    );
    const laterWorkflows = await this.workflowConflictService.findLaterAssignmentWorkflows(
      transaction,
      authorization.group.id,
      context.coveredAssignment.id,
      request.workflowSequence,
      request.id,
    );
    if (laterWorkflows.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({
          laterWorkflowIds: laterWorkflows.map((workflow) => workflow.id),
        }),
        statusCode: 409,
        userMessage: '该加扣班后续还有换班或加扣班变动，请按先后顺序撤销。',
      });
    }
    if (getCurrentDutyMembershipId(context.coveredAssignment) !== context.overtimeMember.id) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({
          actualMemberId: context.coveredAssignment.actualMembershipId,
          id: context.coveredAssignment.id,
          objectType: 'shift_assignment',
          version: context.coveredAssignment.version,
        }),
        statusCode: 409,
        userMessage: '该班次当前当值人员已变化，无法直接撤销，请刷新后处理。',
      });
    }

    const beforeActual = {
      actualMemberId: context.coveredAssignment.actualMembershipId,
      actualMemberName: context.coveredAssignment.actualMemberName,
    };
    await updateShiftAssignments(
      transaction,
      eq(shiftAssignments.id, context.coveredAssignment.id),
      {
        actualMembershipId: context.deductedMember.id,
        actualMemberName: context.deductedMember.realName,
      },
    );
    await transaction
      .update(dutyAdjustments)
      .set({
        approverUserId: authorization.user.id,
        decidedAt: new Date(),
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        status: 'revoked',
        version: sql`${dutyAdjustments.version} + 1`,
      })
      .where(eq(dutyAdjustments.id, request.id));
    const revokedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      affectedShiftIds: [context.coveredAssignment.id],
      afterData: toLatestData({
        actualMemberId: context.deductedMember.id,
        actualMemberName: context.deductedMember.realName,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        status: 'revoked',
      }),
      beforeData: toLatestData({
        actualMemberId: beforeActual.actualMemberId,
        actualMemberName: beforeActual.actualMemberName,
        status: 'completed',
      }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_revoked',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'duty_adjustment',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      schedulePeriodId: context.period.id,
    });
    await this.notificationWriter.append(transaction, {
      body: '加扣班已撤销，原排班已恢复。',
      groupId: authorization.group.id,
      notificationType: 'duty_adjustment_revoked',
      objectId: request.id,
      objectType: 'duty_adjustment',
      recipientMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      scheduleEventId: revokedEventId,
      title: '加扣班已撤销',
    });
    await this.statisticsService.refreshInTransaction(
      transaction,
      authorization.group.id,
      context.period.businessMonth,
    );

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.coveredAssignmentId,
    ]);

    return this.readDutyAdjustment(transaction, request.id);
  }

  private async healStaleCompletedWorkflows(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    operationId: string,
    assignmentIds: readonly string[],
  ): Promise<void> {
    await this.workflowSelfHealingService.archiveStaleCompletedWorkflows(transaction, {
      actorUserId: authorization.user.id,
      assignmentIds,
      groupId: authorization.group.id,
      operationId,
    });
  }

  private async applyDutyAdjustment(
    transaction: DatabaseTransaction,
    context: DutyAdjustmentContext,
    dutyAdjustmentId: string,
    actorUserId: string,
    operationId: string,
    parentEventId: string,
    initiatorMemberName: string,
    approverUserId: string | null,
  ): Promise<void> {
    const beforeActual = {
      actualMemberId: context.coveredAssignment.actualMembershipId,
      actualMemberName: context.coveredAssignment.actualMemberName,
    };

    await updateShiftAssignments(
      transaction,
      eq(shiftAssignments.id, context.coveredAssignment.id),
      {
        actualMembershipId: context.overtimeMember.id,
        actualMemberName: context.overtimeMember.realName,
      },
    );
    await transaction
      .update(dutyAdjustments)
      .set({
        approverUserId,
        assignmentVersion: context.coveredAssignment.version + 1,
        decidedAt: new Date(),
        status: 'completed',
        version: sql`${dutyAdjustments.version} + 1`,
      })
      .where(eq(dutyAdjustments.id, dutyAdjustmentId));

    await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      affectedShiftIds: [context.coveredAssignment.id],
      afterData: toLatestData({
        actualMemberId: context.overtimeMember.id,
        actualMemberName: context.overtimeMember.realName,
        deductedMemberName: context.deductedMember.realName,
        initiatorMemberName,
        overtimeMemberName: context.overtimeMember.realName,
      }),
      beforeData: toLatestData({
        actualMemberId: beforeActual.actualMemberId,
        actualMemberName: beforeActual.actualMemberName,
        deductedMemberName: context.deductedMember.realName,
        overtimeMemberName: context.overtimeMember.realName,
      }),
      eventStatus: 'completed',
      eventType: 'duty_adjustment_completed',
      groupId: context.group.id,
      initiatedByUserId: actorUserId,
      objectId: dutyAdjustmentId,
      objectType: 'duty_adjustment',
      operationId,
      operatorUserId: actorUserId,
      parentEventId,
      schedulePeriodId: context.period.id,
    });
    await this.statisticsService.refreshInTransaction(
      transaction,
      context.group.id,
      context.period.businessMonth,
    );
  }

  private async loadDutyAdjustmentContext(
    transaction: DatabaseTransaction,
    group: ActiveGroup,
    overtimeMembershipId: string,
    coveredAssignmentId: string,
    deductedMembershipId: string | null,
    lockRows = false,
    skipDeductedDutyCheck = false,
    excludingDutyAdjustmentId?: string,
  ): Promise<DutyAdjustmentContext> {
    if (overtimeMembershipId === deductedMembershipId) {
      throw validationError('加班成员和扣班成员必须是不同成员。');
    }

    let assignmentQuery = transaction
      .select()
      .from(shiftAssignments)
      .where(and(eq(shiftAssignments.id, coveredAssignmentId), isNull(shiftAssignments.deletedAt)))
      .limit(1);
    if (lockRows) {
      assignmentQuery = assignmentQuery.for('update') as typeof assignmentQuery;
    }
    const [coveredAssignment] = await assignmentQuery;
    if (coveredAssignment === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '被代班班次已不存在，请刷新后重新选择。',
      });
    }

    let periodQuery = transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.id, coveredAssignment.schedulePeriodId),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .limit(1);
    if (lockRows) {
      periodQuery = periodQuery.for('update') as typeof periodQuery;
    }
    const [period] = await periodQuery;
    if (period === undefined || period.groupId !== group.id || period.status !== 'published') {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '被代班班次所属排班已变化，请刷新后重新选择。',
      });
    }

    assertFutureShift(coveredAssignment, '被代班班次');
    const currentDutyMembershipId = getCurrentDutyMembershipId(coveredAssignment);
    if (currentDutyMembershipId === null) {
      throw validationError('该班次没有当值成员，无法发起加扣班。');
    }
    if (
      !skipDeductedDutyCheck &&
      deductedMembershipId !== null &&
      deductedMembershipId !== currentDutyMembershipId
    ) {
      throw validationError('只能为自己当值的班次发起加扣班。');
    }
    const effectiveDeductedMembershipId = deductedMembershipId ?? currentDutyMembershipId;
    if (overtimeMembershipId === effectiveDeductedMembershipId) {
      throw validationError('加班成员和扣班成员必须是不同成员。');
    }

    const members = await this.memberReader.loadMembers(
      transaction,
      group.id,
      [overtimeMembershipId, effectiveDeductedMembershipId],
      { autoAcceptSwapsDefault: 0 },
      lockRows,
    );
    const overtimeMember = members.get(overtimeMembershipId);
    const deductedMember = members.get(effectiveDeductedMembershipId);
    if (overtimeMember === undefined || deductedMember === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '加扣班成员不存在或不可用。',
      });
    }

    const roleNamesById = await this.memberReader.loadRoleNames(transaction, [
      period.scheduleRoleId,
    ]);
    const conflicts = (
      await this.workflowConflictService.findMemberEligibilityConflicts(
        transaction,
        group.id,
        overtimeMember.id,
        coveredAssignment,
        period.scheduleRoleId,
        coveredAssignment.id,
        lockRows,
      )
    ).map(toDutyAdjustmentConflict);
    const activeWorkflowConflicts = (
      await this.workflowConflictService.findDutyAdjustmentAssignmentConflicts(
        transaction,
        group.id,
        coveredAssignment.id,
        excludingDutyAdjustmentId,
        lockRows,
      )
    ).map(toDutyAdjustmentConflict);
    const requiresApproval = group.dutyAdjustmentApprovalRequired;
    const overtimeAutoAccepts = overtimeMember.autoAcceptSwaps === 1;
    const nextStatus = resolveNextDutyAdjustmentStatus(requiresApproval, overtimeAutoAccepts);

    return {
      activeWorkflowConflicts,
      conflicts,
      coveredAssignment,
      coveredAssignmentVersion: coveredAssignment.version,
      deductedMember,
      group,
      nextStatus,
      overtimeAutoAccepts,
      overtimeMember,
      period,
      preview: buildDutyAdjustmentPreview({
        activeWorkflowConflicts,
        conflicts,
        coveredAssignment,
        deductedMember,
        group,
        nextStatus,
        overtimeAutoAccepts,
        overtimeMember,
        period,
        requiresApproval,
        roleNamesById,
      }),
      requiresApproval,
    };
  }

  private assertStoredAssignmentVersion(
    context: DutyAdjustmentContext,
    request: LockedDutyAdjustment,
  ): void {
    assertExpectedVersion({
      actualVersion: context.coveredAssignment.version,
      expectedVersion: request.assignmentVersion,
      id: context.coveredAssignment.id,
      latestData: {
        businessDate: context.coveredAssignment.businessDate,
        scheduleRoleId: context.period.scheduleRoleId,
      },
      objectType: 'shift_assignment',
      userMessage: '被代班班次已变化，加扣班申请已失效，请刷新后重新发起。',
    });
  }

  private assertNoWorkflowConflicts(context: DutyAdjustmentContext): void {
    this.workflowConflictService.assertNoWorkflowConflicts({
      activeWorkflowConflicts: context.activeWorkflowConflicts,
      conflicts: context.conflicts,
      latestData: {
        coveredAssignment: context.preview.coveredAssignment,
      },
    });
  }

  private async lockDutyAdjustment(
    transaction: DatabaseTransaction,
    groupId: string,
    dutyAdjustmentId: string,
  ): Promise<LockedDutyAdjustment> {
    const [request] = await transaction
      .select()
      .from(dutyAdjustments)
      .where(
        and(
          eq(dutyAdjustments.id, dutyAdjustmentId),
          eq(dutyAdjustments.groupId, groupId),
          isNull(dutyAdjustments.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (request === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '加扣班记录不存在或不可用。',
      });
    }

    return request;
  }

  private async readDutyAdjustment(
    transaction: DatabaseTransaction,
    dutyAdjustmentId: string,
  ): Promise<DutyAdjustmentRequest> {
    const [row] = await transaction
      .select()
      .from(dutyAdjustments)
      .where(and(eq(dutyAdjustments.id, dutyAdjustmentId), isNull(dutyAdjustments.deletedAt)))
      .limit(1);
    if (row === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '加扣班记录不存在或不可用。',
      });
    }
    const [hydrated] = await this.hydrateDutyAdjustments(transaction, [row]);
    if (hydrated === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '加扣班记录不存在或不可用。',
      });
    }

    return hydrated;
  }

  private async hydrateDutyAdjustments(
    transaction: DatabaseTransaction,
    rows: readonly LockedDutyAdjustment[],
  ): Promise<readonly DutyAdjustmentRequest[]> {
    if (rows.length === 0) {
      return [];
    }
    const membershipIds = [
      ...new Set(rows.flatMap((row) => [row.overtimeMembershipId, row.deductedMembershipId])),
    ];
    const assignmentIds = [...new Set(rows.map((row) => row.coveredAssignmentId))];
    const [members, assignments] = await Promise.all([
      this.memberReader.loadMembers(transaction, rows[0]?.groupId ?? '', membershipIds, {
        autoAcceptSwapsDefault: 0,
      }),
      transaction
        .select()
        .from(shiftAssignments)
        // Historical workflows remain readable after their schedule version is archived.
        .where(inArray(shiftAssignments.id, [...assignmentIds])),
    ]);
    const approverUserIds = [
      ...new Set(rows.flatMap((row) => (row.approverUserId === null ? [] : [row.approverUserId]))),
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
    const periodIds = [...new Set(assignments.map((assignment) => assignment.schedulePeriodId))];
    const periodRows =
      periodIds.length === 0
        ? []
        : await transaction
            .select()
            .from(schedulePeriods)
            .where(inArray(schedulePeriods.id, periodIds));
    const periodById = new Map(periodRows.map((period) => [period.id, period]));
    const roleIds = [...new Set(periodRows.map((period) => period.scheduleRoleId))];
    const roleNamesById = await this.memberReader.loadRoleNames(transaction, roleIds);
    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

    return rows.map((row): DutyAdjustmentRequest => {
      const overtimeMember = members.get(row.overtimeMembershipId);
      const deductedMember = members.get(row.deductedMembershipId);
      const coveredAssignment = assignmentById.get(row.coveredAssignmentId);
      const period = periodById.get(coveredAssignment?.schedulePeriodId ?? '');
      const decidedByMemberName =
        row.approverUserId === null ? undefined : approverNameByUserId.get(row.approverUserId);
      let isRevocable: boolean | undefined;
      let revocationBlockedReason: string | undefined;
      if (row.status === 'completed') {
        const stateMatches =
          coveredAssignment !== undefined &&
          coveredAssignment.deletedAt === null &&
          coveredAssignment.actualMembershipId === (overtimeMember?.id ?? null);
        if (stateMatches) {
          isRevocable = true;
        } else {
          isRevocable = false;
          revocationBlockedReason = '该加扣班后续还有排班变动或班次已失效，请按先后顺序撤销。';
        }
      }
      return {
        ...(row.approverUserId === null
          ? {}
          : {
              approverUserId: row.approverUserId,
              ...(decidedByMemberName === undefined ? {} : { decidedByMemberName }),
            }),
        assignmentVersion: row.assignmentVersion,
        coveredAssignment: toDutyAdjustmentAssignmentSummary(
          row.coveredAssignmentId,
          coveredAssignment,
          period,
          roleNamesById,
        ),
        coveredAssignmentId: row.coveredAssignmentId,
        createdAt: row.createdAt.toISOString(),
        ...(row.decidedAt === null ? {} : { decidedAt: row.decidedAt.toISOString() }),
        deductedMembershipId: row.deductedMembershipId,
        ...(deductedMember === undefined ? {} : { deductedMemberName: deductedMember.realName }),
        groupId: row.groupId,
        id: row.id,
        ...(isRevocable === undefined ? {} : { isRevocable }),
        ...(overtimeMember === undefined ? {} : { overtimeMemberName: overtimeMember.realName }),
        overtimeMembershipId: row.overtimeMembershipId,
        ...(row.reason === null ? {} : { reason: row.reason }),
        ...(revocationBlockedReason === undefined ? {} : { revocationBlockedReason }),
        ...(row.revocationReason === null ? {} : { revocationReason: row.revocationReason }),
        status: row.status,
        version: row.version,
      };
    });
  }
}

function buildDutyAdjustmentPreview(input: {
  readonly activeWorkflowConflicts: readonly DutyAdjustmentConflict[];
  readonly conflicts: readonly DutyAdjustmentConflict[];
  readonly coveredAssignment: LockedShiftAssignment;
  readonly deductedMember: GroupMemberRow;
  readonly group: ActiveGroup;
  readonly nextStatus: DutyAdjustmentStatus;
  readonly overtimeAutoAccepts: boolean;
  readonly overtimeMember: GroupMemberRow;
  readonly period: LockedSchedulePeriod;
  readonly requiresApproval: boolean;
  readonly roleNamesById: ReadonlyMap<string, string>;
}): DutyAdjustmentPreview {
  return {
    conflicts: [...input.conflicts, ...input.activeWorkflowConflicts],
    coveredAssignment: toDutyAdjustmentAssignmentSummary(
      input.coveredAssignment.id,
      input.coveredAssignment,
      input.period,
      input.roleNamesById,
    ),
    deductedMemberName: input.deductedMember.realName,
    groupId: input.group.id,
    nextStatus: input.nextStatus,
    overtimeAutoAccepts: input.overtimeAutoAccepts,
    overtimeMemberName: input.overtimeMember.realName,
    requiresApproval: input.requiresApproval,
  };
}

function toDutyAdjustmentAssignmentSummary(
  assignmentId: string,
  assignment: LockedShiftAssignment | undefined,
  period: LockedSchedulePeriod | undefined,
  roleNamesById: ReadonlyMap<string, string>,
): DutyAdjustmentAssignmentSummary {
  if (assignment === undefined || period === undefined) {
    throw new Error('The duty adjustment references an unknown assignment or period.');
  }
  const roleId = period.scheduleRoleId;
  return {
    ...(assignment.actualMembershipId === null
      ? {}
      : { actualMemberId: assignment.actualMembershipId }),
    ...(assignment.actualMemberName === null
      ? {}
      : { actualMemberName: assignment.actualMemberName }),
    assignmentId,
    businessDate: assignment.businessDate,
    endsAt: assignment.endsAt.toISOString(),
    ...(assignment.plannedMembershipId === null
      ? {}
      : { plannedMemberId: assignment.plannedMembershipId }),
    ...(assignment.plannedMemberName === null
      ? {}
      : { plannedMemberName: assignment.plannedMemberName }),
    scheduleRoleId: roleId,
    scheduleRoleName: roleNamesById.get(roleId) ?? '',
    shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
    shiftTypeColor: assignment.shiftTypeColor,
    shiftTypeId: assignment.shiftTypeId,
    shiftTypeName: assignment.shiftTypeName,
    shiftTypeTextColor: assignment.shiftTypeTextColor,
    slotPosition: assignment.slotPosition,
    startsAt: assignment.startsAt.toISOString(),
    version: assignment.version,
  };
}

function resolveNextDutyAdjustmentStatus(
  requiresApproval: boolean,
  overtimeAutoAccepts: boolean,
): DutyAdjustmentStatus {
  if (!overtimeAutoAccepts) {
    return 'pending_target';
  }
  return requiresApproval ? 'pending_approval' : 'completed';
}

function toDutyAdjustmentConflict(conflict: WorkflowConflict): DutyAdjustmentConflict {
  return {
    assignmentId: conflict.assignmentId,
    code: conflict.code as DutyAdjustmentConflict['code'],
    membershipId: conflict.membershipId,
    message: conflict.message,
  };
}

function assertFutureShift(assignment: LockedShiftAssignment, label: string): void {
  if (assignment.startsAt.valueOf() <= Date.now()) {
    throw validationError(`${label}不是未来班次，只能代值尚未开始的班次。`);
  }
}

function alreadyHandled(request: LockedDutyAdjustment): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    latestData: {
      id: request.id,
      objectType: 'duty_adjustment',
      status: request.status,
      version: request.version,
    },
    statusCode: 409,
    userMessage: '该加扣班记录已处理或当前状态不允许此操作。',
  });
}

function createDutyAdjustmentPairFingerprint(input: {
  readonly coveredAssignmentId: string;
  readonly groupId: string;
  readonly overtimeMembershipId: string;
  readonly reason?: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function createMutationFingerprint(input: {
  readonly dutyAdjustmentId: string;
  readonly expectedVersion: number;
  readonly groupId: string;
  readonly reason?: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}
