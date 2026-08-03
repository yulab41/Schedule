import { createHash, randomUUID } from 'node:crypto';

import type {
  CreateDirectSwapInput,
  CreateSwapRequestInput,
  GroupSwapSettings,
  MemberSwapSettings,
  SwapAssignmentSummary,
  SwapConflict,
  SwapPairInput,
  SwapPreview,
  SwapRequest,
  SwapRequestMutationInput,
  SwapRequestStatus,
  UpdateGroupSwapSettingsInput,
  UpdateMemberSwapSettingsInput,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  dutyAdjustments,
  groupMemberships,
  groups,
  leaveRequests,
  memberScheduleRoles,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  swapRequests,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { intervalsOverlap, leaveOverlapsInterval } from '@schedule/scheduling-domain';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

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
import { NotificationWriter } from '../notifications/notification-writer.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { toLatestData } from '../schedules/shared.js';

type LockedSwapRequest = typeof swapRequests.$inferSelect;
type LockedShiftAssignment = typeof shiftAssignments.$inferSelect;
type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;

interface SwapMemberRow {
  readonly autoAcceptSwaps: number;
  readonly id: string;
  readonly isActive: boolean;
  readonly realName: string;
}

interface SwapContext {
  readonly conflicts: readonly SwapConflict[];
  readonly group: ActiveGroup;
  readonly initiatorAssignment: LockedShiftAssignment;
  readonly initiatorAssignmentVersion: number;
  readonly initiatorEligibleForTargetShift: boolean;
  readonly initiatorMember: SwapMemberRow;
  readonly initiatorPeriod: LockedSchedulePeriod;
  readonly nextStatus: SwapRequestStatus;
  readonly preview: SwapPreview;
  readonly requiresApproval: boolean;
  readonly targetAssignment: LockedShiftAssignment;
  readonly targetAssignmentVersion: number;
  readonly targetAutoAccepts: boolean;
  readonly targetEligibleForInitiatorShift: boolean;
  readonly targetMember: SwapMemberRow;
  readonly targetPeriod: LockedSchedulePeriod;
}

export class SwapService {
  private readonly eventWriter = new EventWriter();
  private readonly notificationWriter = new NotificationWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly statisticsService: StatisticsService;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.statisticsService = new StatisticsService(this.databaseClient);
  }

  public async preview(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: SwapPairInput,
  ): Promise<SwapPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const initiatorMembershipId = input.initiatorMembershipId ?? authorization.membership.id;
      if (initiatorMembershipId !== authorization.membership.id) {
        await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageSwaps',
        );
      }
      const context = await this.loadSwapContext(
        transaction,
        authorization.group,
        initiatorMembershipId,
        input.targetMembershipId,
        input.initiatorAssignmentId,
        input.targetAssignmentId,
      );

      return context.preview;
    });
  }

  public async create(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateSwapRequestInput,
  ): Promise<SwapRequest> {
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
          requestFingerprint: createSwapPairFingerprint({
            groupId,
            initiatorAssignmentId: input.initiatorAssignmentId,
            targetAssignmentId: input.targetAssignmentId,
            targetMembershipId: input.targetMembershipId,
          }),
          scope: 'swap_request_create',
        },
        () => this.runCreation(transaction, authorization, input),
      );
    });
  }

  public async createDirect(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateDirectSwapInput,
  ): Promise<SwapRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageSwaps',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createDirectSwapFingerprint({
            groupId,
            initiatorAssignmentId: input.initiatorAssignmentId,
            targetAssignmentId: input.targetAssignmentId,
          }),
          scope: 'swap_request_direct_create',
        },
        () => this.runDirectCreation(transaction, authorization, input),
      );
    });
  }

  public async listMine(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly SwapRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const rows = await transaction
        .select()
        .from(swapRequests)
        .where(
          and(
            eq(swapRequests.groupId, groupId),
            or(
              eq(swapRequests.initiatorMembershipId, authorization.membership.id),
              eq(swapRequests.targetMembershipId, authorization.membership.id),
            ),
            isNull(swapRequests.deletedAt),
          ),
        )
        .orderBy(desc(swapRequests.createdAt), desc(swapRequests.id));

      return this.hydrateSwapRequests(transaction, rows);
    });
  }

  public async listApprovals(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly SwapRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(transaction, identity, groupId, 'manageSwaps');
      const rows = await transaction
        .select()
        .from(swapRequests)
        .where(and(eq(swapRequests.groupId, groupId), isNull(swapRequests.deletedAt)))
        .orderBy(desc(swapRequests.createdAt), desc(swapRequests.id));

      return this.hydrateSwapRequests(transaction, rows);
    });
  }

  public async accept(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
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
            expectedVersion: input.expectedVersion,
            groupId,
            swapRequestId,
          }),
          scope: 'swap_request_accept',
        },
        () => this.runAcceptance(transaction, authorization, swapRequestId, input),
      );
    });
  }

  public async approve(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageSwaps',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: input.operationId,
          requestFingerprint: createMutationFingerprint({
            expectedVersion: input.expectedVersion,
            groupId,
            swapRequestId,
          }),
          scope: 'swap_request_approve',
        },
        () => this.runApproval(transaction, authorization, swapRequestId, input),
      );
    });
  }

  public async reject(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
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
            expectedVersion: input.expectedVersion,
            groupId,
            swapRequestId,
          }),
          scope: 'swap_request_reject',
        },
        () => this.runRejection(transaction, identity, authorization, swapRequestId, input),
      );
    });
  }

  public async cancel(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
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
            expectedVersion: input.expectedVersion,
            groupId,
            swapRequestId,
          }),
          scope: 'swap_request_cancel',
        },
        () => this.runCancellation(transaction, identity, authorization, swapRequestId, input),
      );
    });
  }

  public async getGroupSettings(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupSwapSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return { requiresApproval: authorization.group.swapApprovalRequired };
    });
  }

  public async updateGroupSettings(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupSwapSettingsInput,
  ): Promise<GroupSwapSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageSwaps',
      );
      await transaction
        .update(groups)
        .set({
          swapApprovalRequired: input.requiresApproval ? 1 : 0,
          swapApprovalRequiredManuallySet: 1,
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
      return { autoAcceptSwaps: authorization.membership.autoAcceptSwaps };
    });
  }

  public async updateMySettings(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateMemberSwapSettingsInput,
  ): Promise<MemberSwapSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      await transaction
        .update(groupMemberships)
        .set({
          autoAcceptSwaps: input.autoAcceptSwaps ? 1 : 0,
          autoAcceptSwapsManuallySet: 1,
          version: sql`${groupMemberships.version} + 1`,
        })
        .where(eq(groupMemberships.id, authorization.membership.id));

      return { autoAcceptSwaps: input.autoAcceptSwaps };
    });
  }

  private async runCreation(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: CreateSwapRequestInput,
  ): Promise<SwapRequest> {
    const context = await this.loadSwapContext(
      transaction,
      authorization.group,
      authorization.membership.id,
      input.targetMembershipId,
      input.initiatorAssignmentId,
      input.targetAssignmentId,
      true,
    );
    this.assertNoSwapConflicts(context);
    const activeRequests = await this.findActiveSwapRequests(transaction, authorization.group.id, [
      context.initiatorAssignment.id,
      context.targetAssignment.id,
    ]);
    if (activeRequests.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { swapRequestIds: activeRequests.map((request) => request.id) },
        statusCode: 409,
        userMessage: '其中一个班次已有待处理的换班申请，请刷新后重试。',
      });
    }
    await this.assertNoActiveDutyAdjustments(transaction, authorization.group.id, [
      context.initiatorAssignment.id,
      context.targetAssignment.id,
    ]);

    const swapRequestId = randomUUID();
    const status = context.nextStatus;
    const decidedAt = status === 'completed' ? new Date() : null;
    await transaction.insert(swapRequests).values({
      approverUserId: null,
      decidedAt,
      groupId: authorization.group.id,
      id: swapRequestId,
      initiatorAssignmentId: context.initiatorAssignment.id,
      initiatorAssignmentVersion: context.initiatorAssignment.version,
      initiatorMembershipId: context.initiatorMember.id,
      status,
      targetAssignmentId: context.targetAssignment.id,
      targetAssignmentVersion: context.targetAssignment.version,
      targetMembershipId: context.targetMember.id,
    });
    const createdEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.initiatorMember.id, context.targetMember.id],
      afterData: toLatestData({
        initiatorAssignmentId: context.initiatorAssignment.id,
        status,
        targetAssignmentId: context.targetAssignment.id,
      }),
      eventStatus: 'completed',
      eventType: 'swap_request_created',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: swapRequestId,
      objectType: 'swap_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      schedulePeriodId: context.initiatorPeriod.id,
    });
    if (status === 'completed') {
      await this.notificationWriter.append(transaction, {
        body: '换班已完成，您的班次已更新。',
        groupId: authorization.group.id,
        notificationType: 'schedule_changed',
        payload: { reason: 'swap', swapRequestId },
        recipientMembershipIds: [context.initiatorMember.id, context.targetMember.id],
        scheduleEventId: createdEventId,
        title: '换班已完成',
      });
    } else {
      await this.notificationWriter.append(transaction, {
        body: '有人向您发起换班申请，请及时处理。',
        groupId: authorization.group.id,
        notificationType: 'swap_request_created',
        objectId: swapRequestId,
        objectType: 'swap_request',
        payload: { status },
        recipientMembershipIds: [context.targetMember.id],
        scheduleEventId: createdEventId,
        title: '新的换班申请',
      });
      if (status === 'pending_approval') {
        await this.notificationWriter.append(transaction, {
          administratorRecipients: true,
          body: '成员提交了换班申请，等待您审批。',
          excludeRecipientUserIds: [authorization.user.id],
          groupId: authorization.group.id,
          notificationType: 'approval_pending',
          objectId: swapRequestId,
          objectType: 'swap_request',
          payload: { requestType: 'swap' },
          scheduleEventId: createdEventId,
          title: '换班申请待审批',
        });
      }
    }

    if (status === 'completed') {
      await this.applySwap(
        transaction,
        context,
        swapRequestId,
        authorization.user.id,
        input.operationId,
        createdEventId,
        null,
      );
    }

    return this.readSwapRequest(transaction, swapRequestId);
  }

  private async runDirectCreation(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: CreateDirectSwapInput,
  ): Promise<SwapRequest> {
    const context = await this.loadDirectSwapContext(
      transaction,
      authorization.group,
      input.initiatorAssignmentId,
      input.targetAssignmentId,
    );
    this.assertNoSwapConflicts(context);
    const activeRequests = await this.findActiveSwapRequests(transaction, authorization.group.id, [
      context.initiatorAssignment.id,
      context.targetAssignment.id,
    ]);
    if (activeRequests.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { swapRequestIds: activeRequests.map((request) => request.id) },
        statusCode: 409,
        userMessage: '其中一个班次已有待处理的换班申请，请刷新后重试。',
      });
    }
    await this.assertNoActiveDutyAdjustments(transaction, authorization.group.id, [
      context.initiatorAssignment.id,
      context.targetAssignment.id,
    ]);

    const swapRequestId = randomUUID();
    const decidedAt = new Date();
    await transaction.insert(swapRequests).values({
      approverUserId: authorization.user.id,
      decidedAt,
      groupId: authorization.group.id,
      id: swapRequestId,
      initiatorAssignmentId: context.initiatorAssignment.id,
      initiatorAssignmentVersion: context.initiatorAssignment.version,
      initiatorMembershipId: context.initiatorMember.id,
      status: 'completed',
      targetAssignmentId: context.targetAssignment.id,
      targetAssignmentVersion: context.targetAssignment.version,
      targetMembershipId: context.targetMember.id,
    });
    const createdEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.initiatorMember.id, context.targetMember.id],
      afterData: toLatestData({
        approverUserId: authorization.user.id,
        initiatorAssignmentId: context.initiatorAssignment.id,
        status: 'completed',
        targetAssignmentId: context.targetAssignment.id,
      }),
      eventStatus: 'completed',
      eventType: 'swap_request_created',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: swapRequestId,
      objectType: 'swap_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      schedulePeriodId: context.initiatorPeriod.id,
    });
    await this.notificationWriter.append(transaction, {
      body: '管理员已为您完成换班，您的班次已更新。',
      groupId: authorization.group.id,
      notificationType: 'schedule_changed',
      payload: { reason: 'swap', swapRequestId },
      recipientMembershipIds: [context.initiatorMember.id, context.targetMember.id],
      scheduleEventId: createdEventId,
      title: '换班已完成',
    });
    await this.applySwap(
      transaction,
      context,
      swapRequestId,
      authorization.user.id,
      input.operationId,
      createdEventId,
      authorization.user.id,
    );

    return this.readSwapRequest(transaction, swapRequestId);
  }

  private async runAcceptance(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    const request = await this.lockSwapRequest(transaction, authorization.group.id, swapRequestId);
    if (request.status !== 'pending_target') {
      throw alreadyHandled(request);
    }
    if (request.targetMembershipId !== authorization.membership.id) {
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '只有换班目标成员才能接受该申请。',
      });
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'swap_request',
      userMessage: '换班申请已被其他操作更新，请刷新后重试。',
    });

    const context = await this.loadSwapContext(
      transaction,
      authorization.group,
      request.initiatorMembershipId,
      request.targetMembershipId,
      request.initiatorAssignmentId,
      request.targetAssignmentId,
      true,
    );
    this.assertStoredAssignmentVersions(context, request);
    this.assertNoSwapConflicts(context);

    const nextStatus = authorization.group.swapApprovalRequired ? 'pending_approval' : 'completed';
    const acceptedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.initiatorMember.id, context.targetMember.id],
      afterData: toLatestData({ status: nextStatus }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'swap_request_accepted',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'swap_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      schedulePeriodId: context.initiatorPeriod.id,
    });
    if (nextStatus === 'completed') {
      await this.notificationWriter.append(transaction, {
        body: '换班已完成，您的班次已更新。',
        groupId: authorization.group.id,
        notificationType: 'schedule_changed',
        payload: { reason: 'swap', swapRequestId: request.id },
        recipientMembershipIds: [context.initiatorMember.id, context.targetMember.id],
        scheduleEventId: acceptedEventId,
        title: '换班已完成',
      });
    } else {
      await this.notificationWriter.append(transaction, {
        body: '对方已接受换班申请，等待管理员审批。',
        groupId: authorization.group.id,
        notificationType: 'swap_request_accepted',
        objectId: request.id,
        objectType: 'swap_request',
        recipientMembershipIds: [context.initiatorMember.id],
        scheduleEventId: acceptedEventId,
        title: '换班申请已接受',
      });
      await this.notificationWriter.append(transaction, {
        administratorRecipients: true,
        body: '换班申请已被双方接受，等待您审批。',
        excludeRecipientUserIds: [authorization.user.id],
        groupId: authorization.group.id,
        notificationType: 'approval_pending',
        objectId: request.id,
        objectType: 'swap_request',
        payload: { requestType: 'swap' },
        scheduleEventId: acceptedEventId,
        title: '换班申请待审批',
      });
    }

    if (nextStatus === 'completed') {
      await this.applySwap(
        transaction,
        context,
        request.id,
        authorization.user.id,
        input.operationId,
        acceptedEventId,
        null,
      );
    } else {
      await transaction
        .update(swapRequests)
        .set({ status: 'pending_approval', version: sql`${swapRequests.version} + 1` })
        .where(eq(swapRequests.id, request.id));
    }

    return this.readSwapRequest(transaction, request.id);
  }

  private async runApproval(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    const request = await this.lockSwapRequest(transaction, authorization.group.id, swapRequestId);
    if (request.status !== 'pending_approval') {
      throw alreadyHandled(request);
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'swap_request',
      userMessage: '换班申请已被其他操作更新，请刷新后重试。',
    });

    const context = await this.loadSwapContext(
      transaction,
      authorization.group,
      request.initiatorMembershipId,
      request.targetMembershipId,
      request.initiatorAssignmentId,
      request.targetAssignmentId,
      true,
    );
    this.assertStoredAssignmentVersions(context, request);
    this.assertNoSwapConflicts(context);

    const approvedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.initiatorMember.id, context.targetMember.id],
      afterData: toLatestData({
        approverUserId: authorization.user.id,
        status: 'completed',
      }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'swap_request_approved',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'swap_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      schedulePeriodId: context.initiatorPeriod.id,
    });
    await this.notificationWriter.append(transaction, {
      body: '换班已审批通过，您的班次已更新。',
      groupId: authorization.group.id,
      notificationType: 'schedule_changed',
      payload: { reason: 'swap', swapRequestId: request.id },
      recipientMembershipIds: [context.initiatorMember.id, context.targetMember.id],
      scheduleEventId: approvedEventId,
      title: '换班已生效',
    });
    await this.applySwap(
      transaction,
      context,
      request.id,
      authorization.user.id,
      input.operationId,
      approvedEventId,
      authorization.user.id,
    );

    return this.readSwapRequest(transaction, request.id);
  }

  private async runRejection(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    authorization: GroupAuthorization,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    const request = await this.lockSwapRequest(transaction, authorization.group.id, swapRequestId);
    const isTarget = request.targetMembershipId === authorization.membership.id;
    if (!isTarget) {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        authorization.group.id,
        'manageSwaps',
      );
    }
    const canReject = isTarget
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
      objectType: 'swap_request',
      userMessage: '换班申请已被其他操作更新，请刷新后重试。',
    });

    await transaction
      .update(swapRequests)
      .set({
        approverUserId: isTarget ? null : authorization.user.id,
        decidedAt: new Date(),
        status: 'rejected',
        version: sql`${swapRequests.version} + 1`,
      })
      .where(eq(swapRequests.id, request.id));
    const rejectedEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [request.initiatorMembershipId, request.targetMembershipId],
      afterData: toLatestData({ status: 'rejected' }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'swap_request_rejected',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'swap_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
    });
    await this.notificationWriter.append(transaction, {
      body: '换班申请已被驳回。',
      groupId: authorization.group.id,
      notificationType: 'swap_request_rejected',
      objectId: request.id,
      objectType: 'swap_request',
      recipientMembershipIds: [request.initiatorMembershipId, request.targetMembershipId],
      scheduleEventId: rejectedEventId,
      title: '换班申请已驳回',
    });

    return this.readSwapRequest(transaction, request.id);
  }

  private async runCancellation(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    authorization: GroupAuthorization,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    const request = await this.lockSwapRequest(transaction, authorization.group.id, swapRequestId);
    const isInitiator = request.initiatorMembershipId === authorization.membership.id;
    if (!isInitiator) {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        authorization.group.id,
        'manageSwaps',
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
      objectType: 'swap_request',
      userMessage: '换班申请已被其他操作更新，请刷新后重试。',
    });

    await transaction
      .update(swapRequests)
      .set({
        decidedAt: new Date(),
        status: 'cancelled',
        version: sql`${swapRequests.version} + 1`,
      })
      .where(eq(swapRequests.id, request.id));
    const cancelledEventId = await this.eventWriter.append(transaction, {
      affectedMembershipIds: [request.initiatorMembershipId, request.targetMembershipId],
      afterData: toLatestData({ status: 'cancelled' }),
      beforeData: toLatestData({ status: request.status }),
      eventStatus: 'completed',
      eventType: 'swap_request_cancelled',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectId: request.id,
      objectType: 'swap_request',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
    });
    await this.notificationWriter.append(transaction, {
      body: '换班申请已取消。',
      excludeRecipientUserIds: [authorization.user.id],
      groupId: authorization.group.id,
      notificationType: 'swap_request_cancelled',
      objectId: request.id,
      objectType: 'swap_request',
      recipientMembershipIds: [request.initiatorMembershipId, request.targetMembershipId],
      scheduleEventId: cancelledEventId,
      title: '换班申请已取消',
    });

    return this.readSwapRequest(transaction, request.id);
  }

  private async applySwap(
    transaction: DatabaseTransaction,
    context: SwapContext,
    swapRequestId: string,
    actorUserId: string,
    operationId: string,
    parentEventId: string,
    approverUserId: string | null,
  ): Promise<void> {
    const decidedAt = new Date();
    const beforeInitiator = toEventAssignmentData(
      context.initiatorAssignment,
      context.initiatorAssignment.actualMembershipId,
      context.initiatorAssignment.actualMemberName,
    );
    const beforeTarget = toEventAssignmentData(
      context.targetAssignment,
      context.targetAssignment.actualMembershipId,
      context.targetAssignment.actualMemberName,
    );

    await transaction
      .update(shiftAssignments)
      .set({
        actualMembershipId: context.targetMember.id,
        actualMemberName: context.targetMember.realName,
        startsAt: sql`${shiftAssignments.startsAt}`,
        version: sql`${shiftAssignments.version} + 1`,
      })
      .where(eq(shiftAssignments.id, context.initiatorAssignment.id));
    await transaction
      .update(shiftAssignments)
      .set({
        actualMembershipId: context.initiatorMember.id,
        actualMemberName: context.initiatorMember.realName,
        startsAt: sql`${shiftAssignments.startsAt}`,
        version: sql`${shiftAssignments.version} + 1`,
      })
      .where(eq(shiftAssignments.id, context.targetAssignment.id));
    await transaction
      .update(swapRequests)
      .set({
        approverUserId,
        decidedAt,
        status: 'completed',
        version: sql`${swapRequests.version} + 1`,
      })
      .where(eq(swapRequests.id, swapRequestId));

    const periodByAssignmentId = new Map<string, string>([
      [context.initiatorAssignment.id, context.initiatorPeriod.id],
      [context.targetAssignment.id, context.targetPeriod.id],
    ]);
    const affectedMembershipIds = [context.initiatorMember.id, context.targetMember.id];
    for (const schedulePeriodId of [
      ...new Set([context.initiatorPeriod.id, context.targetPeriod.id]),
    ]) {
      const affectedShiftIds = [context.initiatorAssignment.id, context.targetAssignment.id].filter(
        (assignmentId) => periodByAssignmentId.get(assignmentId) === schedulePeriodId,
      );
      await this.eventWriter.append(transaction, {
        affectedMembershipIds,
        affectedShiftIds,
        afterData: toLatestData({
          initiatorAssignmentId: context.initiatorAssignment.id,
          initiatorAssignment: toEventAssignmentData(
            context.initiatorAssignment,
            context.targetMember.id,
            context.targetMember.realName,
          ),
          targetAssignmentId: context.targetAssignment.id,
          targetAssignment: toEventAssignmentData(
            context.targetAssignment,
            context.initiatorMember.id,
            context.initiatorMember.realName,
          ),
        }),
        beforeData: toLatestData({
          initiatorAssignmentId: context.initiatorAssignment.id,
          initiatorAssignment: beforeInitiator,
          targetAssignmentId: context.targetAssignment.id,
          targetAssignment: beforeTarget,
        }),
        eventStatus: 'completed',
        eventType: 'swap_completed',
        groupId: context.group.id,
        initiatedByUserId: actorUserId,
        objectId: swapRequestId,
        objectType: 'swap_request',
        operationId,
        operatorUserId: actorUserId,
        parentEventId,
        schedulePeriodId,
      });
    }
    for (const businessMonth of new Set([
      context.initiatorPeriod.businessMonth,
      context.targetPeriod.businessMonth,
    ])) {
      await this.statisticsService.refreshInTransaction(
        transaction,
        context.group.id,
        businessMonth,
      );
    }
  }

  private async loadSwapContext(
    transaction: DatabaseTransaction,
    group: ActiveGroup,
    initiatorMembershipId: string,
    targetMembershipId: string,
    initiatorAssignmentId: string,
    targetAssignmentId: string,
    lockRows = false,
  ): Promise<SwapContext> {
    if (initiatorMembershipId === targetMembershipId) {
      throw validationError('换班双方必须是不同成员。');
    }
    if (initiatorAssignmentId === targetAssignmentId) {
      throw validationError('不能与自己的同一个班次换班。');
    }

    const members = await this.loadMembers(
      transaction,
      group.id,
      [initiatorMembershipId, targetMembershipId],
      lockRows,
    );
    const initiatorMember = members.get(initiatorMembershipId);
    const targetMember = members.get(targetMembershipId);
    if (initiatorMember === undefined || targetMember === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '换班成员不存在或不可用。',
      });
    }

    let assignmentQuery = transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(
          inArray(shiftAssignments.id, [initiatorAssignmentId, targetAssignmentId]),
          isNull(shiftAssignments.deletedAt),
        ),
      );
    if (lockRows) {
      assignmentQuery = assignmentQuery.for('update') as typeof assignmentQuery;
    }
    const assignments = await assignmentQuery;
    const initiatorAssignment = assignments.find(
      (assignment) => assignment.id === initiatorAssignmentId,
    );
    const targetAssignment = assignments.find((assignment) => assignment.id === targetAssignmentId);
    if (initiatorAssignment === undefined || targetAssignment === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '其中一个班次已不存在，请刷新后重新选择。',
      });
    }

    const periodIds = [
      ...new Set([initiatorAssignment.schedulePeriodId, targetAssignment.schedulePeriodId]),
    ];
    let periodQuery = transaction
      .select()
      .from(schedulePeriods)
      .where(and(inArray(schedulePeriods.id, periodIds), isNull(schedulePeriods.deletedAt)));
    if (lockRows) {
      periodQuery = periodQuery.for('update') as typeof periodQuery;
    }
    const periods = await periodQuery;
    const periodById = new Map(periods.map((period) => [period.id, period]));
    const initiatorPeriod = periodById.get(initiatorAssignment.schedulePeriodId);
    const targetPeriod = periodById.get(targetAssignment.schedulePeriodId);
    if (
      initiatorPeriod === undefined ||
      targetPeriod === undefined ||
      initiatorPeriod.groupId !== group.id ||
      targetPeriod.groupId !== group.id ||
      initiatorPeriod.status !== 'published' ||
      targetPeriod.status !== 'published'
    ) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '其中一个班次所属排班已变化，请刷新后重新选择。',
      });
    }

    assertFutureShift(initiatorAssignment, '发起人的班次');
    assertFutureShift(targetAssignment, '目标班次');
    if (getDutyMembershipId(initiatorAssignment) !== initiatorMembershipId) {
      throw validationError('只能选择自己当值的班次发起换班。');
    }
    if (getDutyMembershipId(targetAssignment) !== targetMembershipId) {
      throw validationError('目标班次必须由目标成员当值。');
    }

    const roleNamesById = await this.loadRoleNames(transaction, [
      initiatorPeriod.scheduleRoleId,
      targetPeriod.scheduleRoleId,
    ]);
    const targetConflicts = await this.findEligibilityConflicts(
      transaction,
      group.id,
      targetMember.id,
      initiatorAssignment,
      initiatorPeriod.scheduleRoleId,
      targetAssignment.id,
      lockRows,
    );
    const initiatorConflicts = await this.findEligibilityConflicts(
      transaction,
      group.id,
      initiatorMember.id,
      targetAssignment,
      targetPeriod.scheduleRoleId,
      initiatorAssignment.id,
      lockRows,
    );
    const conflicts = [...targetConflicts, ...initiatorConflicts];
    const requiresApproval = group.swapApprovalRequired;
    const targetAutoAccepts = targetMember.autoAcceptSwaps === 1;
    const nextStatus = resolveNextStatus(requiresApproval, targetAutoAccepts);

    return {
      conflicts,
      group,
      initiatorAssignment,
      initiatorAssignmentVersion: initiatorAssignment.version,
      initiatorEligibleForTargetShift: initiatorConflicts.length === 0,
      initiatorMember,
      initiatorPeriod,
      nextStatus,
      preview: buildSwapPreview({
        conflicts,
        group,
        initiatorAssignment,
        initiatorEligibleForTargetShift: initiatorConflicts.length === 0,
        initiatorPeriod,
        nextStatus,
        requiresApproval,
        roleNamesById,
        targetAssignment,
        targetAutoAccepts,
        targetEligibleForInitiatorShift: targetConflicts.length === 0,
        targetPeriod,
      }),
      requiresApproval,
      targetAssignment,
      targetAssignmentVersion: targetAssignment.version,
      targetAutoAccepts,
      targetEligibleForInitiatorShift: targetConflicts.length === 0,
      targetMember,
      targetPeriod,
    };
  }

  private async loadDirectSwapContext(
    transaction: DatabaseTransaction,
    group: ActiveGroup,
    initiatorAssignmentId: string,
    targetAssignmentId: string,
  ): Promise<SwapContext> {
    if (initiatorAssignmentId === targetAssignmentId) {
      throw validationError('不能与自己的同一个班次换班。');
    }
    const assignments = await transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(
          inArray(shiftAssignments.id, [initiatorAssignmentId, targetAssignmentId]),
          isNull(shiftAssignments.deletedAt),
        ),
      )
      .for('update');
    const initiatorAssignment = assignments.find(
      (assignment) => assignment.id === initiatorAssignmentId,
    );
    const targetAssignment = assignments.find((assignment) => assignment.id === targetAssignmentId);
    if (initiatorAssignment === undefined || targetAssignment === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '其中一个班次已不存在，请刷新后重新选择。',
      });
    }
    const initiatorMembershipId = getDutyMembershipId(initiatorAssignment);
    const targetMembershipId = getDutyMembershipId(targetAssignment);
    if (initiatorMembershipId === null || targetMembershipId === null) {
      throw validationError('班次缺少当值成员，无法直接换班。');
    }
    if (initiatorMembershipId === targetMembershipId) {
      throw validationError('换班双方必须是不同成员。');
    }

    return this.loadSwapContext(
      transaction,
      group,
      initiatorMembershipId,
      targetMembershipId,
      initiatorAssignmentId,
      targetAssignmentId,
      true,
    );
  }

  private async findEligibilityConflicts(
    transaction: DatabaseTransaction,
    groupId: string,
    receivingMembershipId: string,
    receivedAssignment: LockedShiftAssignment,
    receivedRoleId: string,
    ownAssignmentId: string,
    lockRows: boolean,
  ): Promise<SwapConflict[]> {
    const conflicts: SwapConflict[] = [];
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
          eq(memberScheduleRoles.membershipId, receivingMembershipId),
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
        membershipId: receivingMembershipId,
        message: '该成员不在班次的排班角色中或不在生效区间。',
      });
    }

    const leaves = await transaction
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.groupId, groupId),
          eq(leaveRequests.membershipId, receivingMembershipId),
          eq(leaveRequests.status, 'approved'),
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
        membershipId: receivingMembershipId,
        message: '该成员在班次时间内有已批准请假。',
      });
    }

    const conflictingAssignments = await this.findMemberTimeConflicts(
      transaction,
      groupId,
      receivingMembershipId,
      ownAssignmentId,
      receivedAssignment,
    );
    const conflictingAssignment = conflictingAssignments[0];
    if (conflictingAssignment !== undefined) {
      conflicts.push({
        assignmentId: conflictingAssignment.id,
        code: 'MEMBER_TIME_OVERLAP',
        membershipId: receivingMembershipId,
        message: '该成员在班次时间内另有排班。',
      });
    }

    return conflicts;
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
        getDutyMembershipId(assignment) === membershipId &&
        intervalsOverlap(assignment, receivedAssignment),
    );
  }

  private async findActiveSwapRequests(
    transaction: DatabaseTransaction,
    groupId: string,
    assignmentIds: readonly string[],
  ): Promise<readonly LockedSwapRequest[]> {
    return transaction
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
      )
      .for('update');
  }

  private async assertNoActiveDutyAdjustments(
    transaction: DatabaseTransaction,
    groupId: string,
    assignmentIds: readonly string[],
  ): Promise<void> {
    const activeAdjustments = await transaction
      .select()
      .from(dutyAdjustments)
      .where(
        and(
          eq(dutyAdjustments.groupId, groupId),
          inArray(dutyAdjustments.status, ['pending_target', 'pending_approval', 'completed']),
          inArray(dutyAdjustments.coveredAssignmentId, [...assignmentIds]),
          isNull(dutyAdjustments.deletedAt),
        ),
      )
      .for('update');
    if (activeAdjustments.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: {
          dutyAdjustmentIds: activeAdjustments.map((adjustment) => adjustment.id),
        },
        statusCode: 409,
        userMessage: '其中一个班次已有待处理或生效中的加扣班关系，请先撤销后再换班。',
      });
    }
  }

  private assertStoredAssignmentVersions(context: SwapContext, request: LockedSwapRequest): void {
    assertExpectedVersion({
      actualVersion: context.initiatorAssignment.version,
      expectedVersion: request.initiatorAssignmentVersion,
      id: context.initiatorAssignment.id,
      latestData: {
        businessDate: context.initiatorAssignment.businessDate,
        scheduleRoleId: context.initiatorPeriod.scheduleRoleId,
      },
      objectType: 'shift_assignment',
      userMessage: '发起人的班次已变化，换班申请已失效，请刷新后重新发起。',
    });
    assertExpectedVersion({
      actualVersion: context.targetAssignment.version,
      expectedVersion: request.targetAssignmentVersion,
      id: context.targetAssignment.id,
      latestData: {
        businessDate: context.targetAssignment.businessDate,
        scheduleRoleId: context.targetPeriod.scheduleRoleId,
      },
      objectType: 'shift_assignment',
      userMessage: '目标班次已变化，换班申请已失效，请刷新后重新发起。',
    });
  }

  private assertNoSwapConflicts(context: SwapContext): void {
    if (context.conflicts.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({
          conflicts: context.conflicts,
          initiatorAssignment: context.preview.initiatorAssignment,
          targetAssignment: context.preview.targetAssignment,
        }),
        statusCode: 409,
        userMessage: '换班预检发现资格、请假或时间冲突，无法继续。',
      });
    }
  }

  private async loadMembers(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipIds: readonly string[],
    lockRows = false,
  ): Promise<ReadonlyMap<string, SwapMemberRow>> {
    if (membershipIds.length === 0) {
      return new Map();
    }
    let query = transaction
      .select({
        autoAcceptSwapsManuallySet: groupMemberships.autoAcceptSwapsManuallySet,
        autoAcceptSwaps: groupMemberships.autoAcceptSwaps,
        id: groupMemberships.id,
        membershipDeletedAt: groupMemberships.deletedAt,
        membershipStatus: groupMemberships.status,
        realName: userProfiles.realName,
        userDeletedAt: users.deletedAt,
        userStatus: users.status,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          inArray(groupMemberships.id, [...membershipIds]),
          isNull(groupMemberships.deletedAt),
        ),
      );
    if (lockRows) {
      query = query.for('update') as typeof query;
    }
    const rows = await query;

    return new Map(
      rows.map((row) => [
        row.id,
        {
          autoAcceptSwaps: row.autoAcceptSwapsManuallySet === 1 ? row.autoAcceptSwaps : 1,
          id: row.id,
          isActive:
            row.membershipStatus === 'active' &&
            row.userStatus === 'active' &&
            row.membershipDeletedAt === null &&
            row.userDeletedAt === null,
          realName: row.realName,
        },
      ]),
    );
  }

  private async loadRoleNames(
    transaction: DatabaseTransaction,
    roleIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (roleIds.length === 0) {
      return new Map();
    }
    const rows = await transaction
      .select({ id: scheduleRoles.id, name: scheduleRoles.name })
      .from(scheduleRoles)
      .where(and(inArray(scheduleRoles.id, [...roleIds]), isNull(scheduleRoles.deletedAt)));

    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async lockSwapRequest(
    transaction: DatabaseTransaction,
    groupId: string,
    swapRequestId: string,
  ): Promise<LockedSwapRequest> {
    const [request] = await transaction
      .select()
      .from(swapRequests)
      .where(
        and(
          eq(swapRequests.id, swapRequestId),
          eq(swapRequests.groupId, groupId),
          isNull(swapRequests.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (request === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '换班申请不存在或不可用。',
      });
    }

    return request;
  }

  private async readSwapRequest(
    transaction: DatabaseTransaction,
    swapRequestId: string,
  ): Promise<SwapRequest> {
    const [row] = await transaction
      .select()
      .from(swapRequests)
      .where(and(eq(swapRequests.id, swapRequestId), isNull(swapRequests.deletedAt)))
      .limit(1);
    if (row === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '换班申请不存在或不可用。',
      });
    }
    const [hydrated] = await this.hydrateSwapRequests(transaction, [row]);
    if (hydrated === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '换班申请不存在或不可用。',
      });
    }

    return hydrated;
  }

  private async hydrateSwapRequests(
    transaction: DatabaseTransaction,
    rows: readonly LockedSwapRequest[],
  ): Promise<readonly SwapRequest[]> {
    if (rows.length === 0) {
      return [];
    }
    const membershipIds = [
      ...new Set(rows.flatMap((row) => [row.initiatorMembershipId, row.targetMembershipId])),
    ];
    const assignmentIds = [
      ...new Set(rows.flatMap((row) => [row.initiatorAssignmentId, row.targetAssignmentId])),
    ];
    const [members, assignments] = await Promise.all([
      this.loadMembers(transaction, rows[0]?.groupId ?? '', membershipIds),
      transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(inArray(shiftAssignments.id, [...assignmentIds]), isNull(shiftAssignments.deletedAt)),
        ),
    ]);
    const periodIds = [...new Set(assignments.map((assignment) => assignment.schedulePeriodId))];
    const periodRows =
      periodIds.length === 0
        ? []
        : await transaction
            .select()
            .from(schedulePeriods)
            .where(and(inArray(schedulePeriods.id, periodIds), isNull(schedulePeriods.deletedAt)));
    const periodById = new Map(periodRows.map((period) => [period.id, period]));
    const roleIds = [...new Set(periodRows.map((period) => period.scheduleRoleId))];
    const roleNamesById = await this.loadRoleNames(transaction, roleIds);
    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

    return rows.map((row): SwapRequest => {
      const initiatorMember = members.get(row.initiatorMembershipId);
      const targetMember = members.get(row.targetMembershipId);
      const initiatorAssignment = assignmentById.get(row.initiatorAssignmentId);
      const targetAssignment = assignmentById.get(row.targetAssignmentId);
      const initiatorPeriod = periodById.get(initiatorAssignment?.schedulePeriodId ?? '');
      const targetPeriod = periodById.get(targetAssignment?.schedulePeriodId ?? '');
      return {
        ...(row.approverUserId === null ? {} : { approverUserId: row.approverUserId }),
        createdAt: row.createdAt.toISOString(),
        ...(row.decidedAt === null ? {} : { decidedAt: row.decidedAt.toISOString() }),
        groupId: row.groupId,
        id: row.id,
        initiatorAssignment: toSwapAssignmentSummary(
          row.initiatorAssignmentId,
          initiatorAssignment,
          initiatorPeriod,
          roleNamesById,
        ),
        initiatorAssignmentId: row.initiatorAssignmentId,
        initiatorAssignmentVersion: row.initiatorAssignmentVersion,
        ...(initiatorMember === undefined ? {} : { initiatorMemberName: initiatorMember.realName }),
        initiatorMembershipId: row.initiatorMembershipId,
        status: row.status,
        targetAssignment: toSwapAssignmentSummary(
          row.targetAssignmentId,
          targetAssignment,
          targetPeriod,
          roleNamesById,
        ),
        targetAssignmentId: row.targetAssignmentId,
        targetAssignmentVersion: row.targetAssignmentVersion,
        ...(targetMember === undefined ? {} : { targetMemberName: targetMember.realName }),
        targetMembershipId: row.targetMembershipId,
        version: row.version,
      };
    });
  }
}

function buildSwapPreview(input: {
  readonly conflicts: readonly SwapConflict[];
  readonly group: ActiveGroup;
  readonly initiatorAssignment: LockedShiftAssignment;
  readonly initiatorEligibleForTargetShift: boolean;
  readonly initiatorPeriod: LockedSchedulePeriod;
  readonly nextStatus: SwapRequestStatus;
  readonly requiresApproval: boolean;
  readonly roleNamesById: ReadonlyMap<string, string>;
  readonly targetAssignment: LockedShiftAssignment;
  readonly targetAutoAccepts: boolean;
  readonly targetEligibleForInitiatorShift: boolean;
  readonly targetPeriod: LockedSchedulePeriod;
}): SwapPreview {
  return {
    conflicts: input.conflicts,
    groupId: input.group.id,
    initiatorAssignment: toSwapAssignmentSummary(
      input.initiatorAssignment.id,
      input.initiatorAssignment,
      input.initiatorPeriod,
      input.roleNamesById,
    ),
    initiatorEligibleForTargetShift: input.initiatorEligibleForTargetShift,
    nextStatus: input.nextStatus,
    requiresApproval: input.requiresApproval,
    targetAssignment: toSwapAssignmentSummary(
      input.targetAssignment.id,
      input.targetAssignment,
      input.targetPeriod,
      input.roleNamesById,
    ),
    targetAutoAccepts: input.targetAutoAccepts,
    targetEligibleForInitiatorShift: input.targetEligibleForInitiatorShift,
  };
}

function toSwapAssignmentSummary(
  assignmentId: string,
  assignment: LockedShiftAssignment | undefined,
  period: LockedSchedulePeriod | undefined,
  roleNamesById: ReadonlyMap<string, string>,
): SwapAssignmentSummary {
  if (assignment === undefined || period === undefined) {
    throw new Error('The swap request references an unknown assignment or period.');
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

function toEventAssignmentData(
  assignment: LockedShiftAssignment,
  actualMemberId: string | null,
  actualMemberName: string | null,
): Record<string, string> {
  return {
    ...(assignment.plannedMembershipId === null
      ? {}
      : { plannedMemberId: assignment.plannedMembershipId }),
    ...(assignment.plannedMemberName === null
      ? {}
      : { plannedMemberName: assignment.plannedMemberName }),
    ...(actualMemberId === null ? {} : { actualMemberId }),
    ...(actualMemberName === null ? {} : { actualMemberName }),
  };
}

function resolveNextStatus(
  requiresApproval: boolean,
  targetAutoAccepts: boolean,
): SwapRequestStatus {
  if (!targetAutoAccepts) {
    return 'pending_target';
  }
  return requiresApproval ? 'pending_approval' : 'completed';
}

function getDutyMembershipId(assignment: LockedShiftAssignment): string | null {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
}

function assertFutureShift(assignment: LockedShiftAssignment, label: string): void {
  if (assignment.startsAt.valueOf() <= Date.now()) {
    throw validationError(`${label}不是未来班次，只能交换尚未开始的班次。`);
  }
}

function alreadyHandled(request: LockedSwapRequest): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    latestData: {
      id: request.id,
      objectType: 'swap_request',
      status: request.status,
      version: request.version,
    },
    statusCode: 409,
    userMessage: '该换班申请已处理或当前状态不允许此操作。',
  });
}

function createSwapPairFingerprint(input: {
  readonly groupId: string;
  readonly initiatorAssignmentId: string;
  readonly targetAssignmentId: string;
  readonly targetMembershipId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function createDirectSwapFingerprint(input: {
  readonly groupId: string;
  readonly initiatorAssignmentId: string;
  readonly targetAssignmentId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function createMutationFingerprint(input: {
  readonly expectedVersion: number;
  readonly groupId: string;
  readonly swapRequestId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}
