import { createHash, randomUUID } from 'node:crypto';

import type {
  CreateDirectSwapInput,
  CreateSwapRequestInput,
  GroupSwapSettings,
  MemberSwapSettings,
  RevokeSwapRequestInput,
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
  groupMemberships,
  groups,
  schedulePeriods,
  shiftAssignments,
  swapRequests,
  userProfiles,
  withTransaction,
} from '@schedule/database';
import { isPastBusinessDate } from '@schedule/scheduling-domain';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import type { GroupMemberRow } from '../groups/group-member-reader.js';
import type { ActiveGroup, GroupAuthorization } from '../groups/permission-service.js';
import { updateShiftAssignments } from '../schedules/shift-assignment-writer.js';
import { toLatestData } from '../schedules/shared.js';
import {
  getCurrentDutyMembershipId,
  type WorkflowConflict,
} from '../workflows/workflow-conflict-service.js';
import { runAuthorizedMutation } from '../workflows/workflow-operation.js';
import { allocateWorkflowSequence } from '../workflows/workflow-sequence-allocator.js';
import { WorkflowServices } from '../workflows/workflow-services.js';

type LockedSwapRequest = typeof swapRequests.$inferSelect;
type LockedShiftAssignment = typeof shiftAssignments.$inferSelect;
type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;

interface SwapContext {
  readonly activeWorkflowConflicts: readonly SwapConflict[];
  readonly conflicts: readonly SwapConflict[];
  readonly group: ActiveGroup;
  readonly initiatorAssignment: LockedShiftAssignment;
  readonly initiatorAssignmentVersion: number;
  readonly initiatorEligibleForTargetShift: boolean;
  readonly initiatorMember: GroupMemberRow;
  readonly initiatorPeriod: LockedSchedulePeriod;
  readonly nextStatus: SwapRequestStatus;
  readonly preview: SwapPreview;
  readonly requiresApproval: boolean;
  readonly targetAssignment: LockedShiftAssignment;
  readonly targetAssignmentVersion: number;
  readonly targetAutoAccepts: boolean;
  readonly targetEligibleForInitiatorShift: boolean;
  readonly targetMember: GroupMemberRow;
  readonly targetPeriod: LockedSchedulePeriod;
}

export class SwapService {
  private readonly services: WorkflowServices;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.services = new WorkflowServices(databaseClient);
  }

  public async preview(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: SwapPairInput,
  ): Promise<SwapPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.services.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const initiatorMembershipId = input.initiatorMembershipId ?? authorization.membership.id;
      if (initiatorMembershipId !== authorization.membership.id) {
        await this.services.permissionService.requirePermission(
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
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'viewScheduleConfiguration',
      permissionService: this.services.permissionService,
      requestFingerprint: createSwapPairFingerprint({
        groupId,
        initiatorAssignmentId: input.initiatorAssignmentId,
        targetAssignmentId: input.targetAssignmentId,
        targetMembershipId: input.targetMembershipId,
      }),
      run: (transaction, authorization) => this.runCreation(transaction, authorization, input),
      scope: 'swap_request_create',
    });
  }

  public async createDirect(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateDirectSwapInput,
  ): Promise<SwapRequest> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'manageSwaps',
      permissionService: this.services.permissionService,
      requestFingerprint: createDirectSwapFingerprint({
        groupId,
        initiatorAssignmentId: input.initiatorAssignmentId,
        targetAssignmentId: input.targetAssignmentId,
      }),
      run: (transaction, authorization) =>
        this.runDirectCreation(transaction, authorization, input),
      scope: 'swap_request_direct_create',
    });
  }

  public async listMine(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly SwapRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.services.permissionService.requirePermission(
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
      await this.services.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageSwaps',
      );
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
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'viewScheduleConfiguration',
      permissionService: this.services.permissionService,
      requestFingerprint: createMutationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
        swapRequestId,
      }),
      run: (transaction, authorization) =>
        this.runAcceptance(transaction, authorization, swapRequestId, input),
      scope: 'swap_request_accept',
    });
  }

  public async approve(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'manageSwaps',
      permissionService: this.services.permissionService,
      requestFingerprint: createMutationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
        swapRequestId,
      }),
      run: (transaction, authorization) =>
        this.runApproval(transaction, authorization, swapRequestId, input),
      scope: 'swap_request_approve',
    });
  }

  public async reject(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'viewScheduleConfiguration',
      permissionService: this.services.permissionService,
      requestFingerprint: createMutationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
        swapRequestId,
      }),
      run: (transaction, authorization) =>
        this.runRejection(transaction, identity, authorization, swapRequestId, input),
      scope: 'swap_request_reject',
    });
  }

  public async cancel(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: SwapRequestMutationInput,
  ): Promise<SwapRequest> {
    return runAuthorizedMutation({
      databaseClient: this.databaseClient,
      groupId,
      identity,
      operationId: input.operationId,
      permission: 'viewScheduleConfiguration',
      permissionService: this.services.permissionService,
      requestFingerprint: createMutationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
        swapRequestId,
      }),
      run: (transaction, authorization) =>
        this.runCancellation(transaction, identity, authorization, swapRequestId, input),
      scope: 'swap_request_cancel',
    });
  }

  public async revokeCompleted(
    identity: AuthenticatedIdentity,
    groupId: string,
    swapRequestId: string,
    input: RevokeSwapRequestInput,
  ): Promise<SwapRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.services.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      const request = await this.lockSwapRequest(
        transaction,
        authorization.group.id,
        swapRequestId,
      );
      const isParty =
        request.initiatorMembershipId === authorization.membership.id ||
        request.targetMembershipId === authorization.membership.id;
      if (authorization.membership.role === 'member' && !isParty) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '只有管理员或换班双方可以撤销该换班。',
        });
      }

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
          scope: 'swap_request_revoke',
        },
        () => this.runSwapRevocation(transaction, authorization, swapRequestId, input),
      );
    });
  }

  public async getGroupSettings(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupSwapSettings> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.services.permissionService.requirePermission(
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
      const authorization = await this.services.permissionService.requirePermission(
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
      const authorization = await this.services.permissionService.requirePermission(
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
      const authorization = await this.services.permissionService.requirePermission(
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

  private async runSwapRevocation(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    swapRequestId: string,
    input: RevokeSwapRequestInput,
  ): Promise<SwapRequest> {
    const request = await this.lockSwapRequest(transaction, authorization.group.id, swapRequestId);
    if (request.status !== 'completed') {
      throw alreadyHandled(request);
    }
    assertExpectedVersion({
      actualVersion: request.version,
      expectedVersion: input.expectedVersion,
      id: request.id,
      latestData: { status: request.status },
      objectType: 'swap_request',
      userMessage: '换班记录已被其他操作更新，请刷新后重试。',
    });

    const assignmentRows = await transaction
      .select({ id: shiftAssignments.id, schedulePeriodId: shiftAssignments.schedulePeriodId })
      .from(shiftAssignments)
      .where(
        and(
          inArray(shiftAssignments.id, [request.initiatorAssignmentId, request.targetAssignmentId]),
          isNull(shiftAssignments.deletedAt),
        ),
      );
    if (assignmentRows.length !== 2) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '该换班的班次已失效（排班版本变更），无法直接撤销。',
      });
    }

    const assignments = await transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(
          inArray(shiftAssignments.id, [request.initiatorAssignmentId, request.targetAssignmentId]),
          isNull(shiftAssignments.deletedAt),
        ),
      )
      .for('update');
    const initiatorAssignment = assignments.find(
      (assignment) => assignment.id === request.initiatorAssignmentId,
    );
    const targetAssignment = assignments.find(
      (assignment) => assignment.id === request.targetAssignmentId,
    );
    const periodRows = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          inArray(schedulePeriods.id, [
            initiatorAssignment?.schedulePeriodId ?? '',
            targetAssignment?.schedulePeriodId ?? '',
          ]),
          isNull(schedulePeriods.deletedAt),
        ),
      );
    const initiatorPeriod = periodRows.find(
      (period) => period.id === initiatorAssignment?.schedulePeriodId,
    );
    const targetPeriod = periodRows.find(
      (period) => period.id === targetAssignment?.schedulePeriodId,
    );
    if (
      initiatorAssignment === undefined ||
      targetAssignment === undefined ||
      initiatorPeriod === undefined ||
      targetPeriod === undefined
    ) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '该换班的班次已失效（排班版本变更），无法直接撤销。',
      });
    }
    const pastDates = [initiatorAssignment, targetAssignment]
      .map((assignment) => assignment.businessDate)
      .filter((businessDate) => isPastBusinessDate(businessDate));
    if (pastDates.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: `该换班涉及已过日期（${[...new Set(pastDates)].join('、')}），已过日期不可修改，无法撤销。`,
      });
    }
    const laterWorkflows = [
      ...(await this.services.workflowConflictService.findLaterAssignmentWorkflows(
        transaction,
        authorization.group.id,
        request.initiatorAssignmentId,
        request.workflowSequence,
      )),
      ...(await this.services.workflowConflictService.findLaterAssignmentWorkflows(
        transaction,
        authorization.group.id,
        request.targetAssignmentId,
        request.workflowSequence,
      )),
    ];
    if (laterWorkflows.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({
          laterWorkflowIds: laterWorkflows.map((workflow) => workflow.id),
        }),
        statusCode: 409,
        userMessage: '该换班后续还有换班或加扣班变动，请按先后顺序撤销。',
      });
    }
    const members = await this.services.memberReader.loadMembers(
      transaction,
      authorization.group.id,
      [request.initiatorMembershipId, request.targetMembershipId],
      { autoAcceptSwapsDefault: 1 },
    );
    const initiatorMember = members.get(request.initiatorMembershipId);
    const targetMember = members.get(request.targetMembershipId);
    if (initiatorMember === undefined || targetMember === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '该换班涉及成员已失效，无法直接撤销。',
      });
    }

    const initiatorStateMatches = initiatorAssignment.actualMembershipId === targetMember.id;
    const targetStateMatches = targetAssignment.actualMembershipId === initiatorMember.id;
    if (!initiatorStateMatches || !targetStateMatches) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '该换班后续还有排班变动，请按先后顺序撤销。',
      });
    }

    const beforeInitiator = {
      actualMemberId: initiatorAssignment.actualMembershipId,
      actualMemberName: initiatorAssignment.actualMemberName,
    };
    await updateShiftAssignments(transaction, eq(shiftAssignments.id, initiatorAssignment.id), {
      actualMembershipId: initiatorMember.id,
      actualMemberName: initiatorMember.realName,
    });
    await updateShiftAssignments(transaction, eq(shiftAssignments.id, targetAssignment.id), {
      actualMembershipId: targetMember.id,
      actualMemberName: targetMember.realName,
    });
    await transaction
      .update(swapRequests)
      .set({
        decidedAt: new Date(),
        ...(input.reason === undefined ? {} : { revocationReason: input.reason }),
        status: 'revoked',
        version: sql`${swapRequests.version} + 1`,
      })
      .where(eq(swapRequests.id, request.id));

    const affectedMembershipIds = [initiatorMember.id, targetMember.id];
    const periodByAssignmentId = new Map<string, string>([
      [initiatorAssignment.id, initiatorPeriod.id],
      [targetAssignment.id, targetPeriod.id],
    ]);
    let lastEventId = '';
    for (const schedulePeriodId of [...new Set(periodByAssignmentId.values())]) {
      const affectedShiftIds = [initiatorAssignment.id, targetAssignment.id].filter(
        (assignmentId) => periodByAssignmentId.get(assignmentId) === schedulePeriodId,
      );
      lastEventId = await this.services.eventWriter.append(transaction, {
        affectedMembershipIds,
        affectedShiftIds,
        afterData: toLatestData({
          actualMemberId: initiatorMember.id,
          actualMemberName: initiatorMember.realName,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          status: 'revoked',
        }),
        beforeData: toLatestData({
          actualMemberId: beforeInitiator.actualMemberId,
          actualMemberName: beforeInitiator.actualMemberName,
          status: 'completed',
        }),
        eventStatus: 'completed',
        eventType: 'swap_revoked',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: request.id,
        objectType: 'swap_request',
        operationId: input.operationId,
        operatorUserId: authorization.user.id,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        schedulePeriodId,
      });
    }
    await this.services.notificationWriter.append(transaction, {
      body: '换班已撤销，双方实际班次已恢复。',
      groupId: authorization.group.id,
      notificationType: 'swap_revoked',
      objectId: request.id,
      objectType: 'swap_request',
      recipientMembershipIds: affectedMembershipIds,
      ...(lastEventId === '' ? {} : { scheduleEventId: lastEventId }),
      title: '换班已撤销',
    });
    for (const businessMonth of new Set([
      initiatorPeriod.businessMonth,
      targetPeriod.businessMonth,
    ])) {
      await this.services.statisticsService.refreshInTransaction(
        transaction,
        authorization.group.id,
        businessMonth,
      );
    }

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.initiatorAssignmentId,
      request.targetAssignmentId,
    ]);

    return this.readSwapRequest(transaction, request.id);
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
    this.assertNoWorkflowConflicts(context, true);

    const swapRequestId = randomUUID();
    const workflowSequence = await allocateWorkflowSequence(transaction);
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
      workflowSequence,
    });
    const createdEventId = await this.services.eventWriter.append(transaction, {
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
      await this.services.notificationWriter.append(transaction, {
        body: '换班已完成，您的班次已更新。',
        groupId: authorization.group.id,
        notificationType: 'schedule_changed',
        payload: { reason: 'swap', swapRequestId },
        recipientMembershipIds: [context.initiatorMember.id, context.targetMember.id],
        scheduleEventId: createdEventId,
        title: '换班已完成',
      });
    } else {
      await this.services.notificationWriter.append(transaction, {
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
        await this.services.notificationWriter.append(transaction, {
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
        authorization.user.realName,
        input.operationId,
        createdEventId,
        null,
      );
    }

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      context.initiatorAssignment.id,
      context.targetAssignment.id,
    ]);

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
    this.assertNoWorkflowConflicts(context, true);

    const swapRequestId = randomUUID();
    const workflowSequence = await allocateWorkflowSequence(transaction);
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
      workflowSequence,
    });
    const createdEventId = await this.services.eventWriter.append(transaction, {
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
    await this.services.notificationWriter.append(transaction, {
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
      authorization.user.realName,
      input.operationId,
      createdEventId,
      authorization.user.id,
    );

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      context.initiatorAssignment.id,
      context.targetAssignment.id,
    ]);

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
    this.assertNoWorkflowConflicts(context, false);

    const nextStatus = authorization.group.swapApprovalRequired ? 'pending_approval' : 'completed';
    const acceptedEventId = await this.services.eventWriter.append(transaction, {
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
      await this.services.notificationWriter.append(transaction, {
        body: '换班已完成，您的班次已更新。',
        groupId: authorization.group.id,
        notificationType: 'schedule_changed',
        payload: { reason: 'swap', swapRequestId: request.id },
        recipientMembershipIds: [context.initiatorMember.id, context.targetMember.id],
        scheduleEventId: acceptedEventId,
        title: '换班已完成',
      });
    } else {
      await this.services.notificationWriter.append(transaction, {
        body: '对方已接受换班申请，等待管理员审批。',
        groupId: authorization.group.id,
        notificationType: 'swap_request_accepted',
        objectId: request.id,
        objectType: 'swap_request',
        recipientMembershipIds: [context.initiatorMember.id],
        scheduleEventId: acceptedEventId,
        title: '换班申请已接受',
      });
      await this.services.notificationWriter.append(transaction, {
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
        authorization.user.realName,
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

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.initiatorAssignmentId,
      request.targetAssignmentId,
    ]);

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
    this.assertNoWorkflowConflicts(context, false);

    const approvedEventId = await this.services.eventWriter.append(transaction, {
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
    await this.services.notificationWriter.append(transaction, {
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
      authorization.user.realName,
      input.operationId,
      approvedEventId,
      authorization.user.id,
    );

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.initiatorAssignmentId,
      request.targetAssignmentId,
    ]);

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
      await this.services.permissionService.requirePermission(
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
    const rejectedEventId = await this.services.eventWriter.append(transaction, {
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
    await this.services.notificationWriter.append(transaction, {
      body: '换班申请已被驳回。',
      groupId: authorization.group.id,
      notificationType: 'swap_request_rejected',
      objectId: request.id,
      objectType: 'swap_request',
      recipientMembershipIds: [request.initiatorMembershipId, request.targetMembershipId],
      scheduleEventId: rejectedEventId,
      title: '换班申请已驳回',
    });

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.initiatorAssignmentId,
      request.targetAssignmentId,
    ]);

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
      await this.services.permissionService.requirePermission(
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
    const cancelledEventId = await this.services.eventWriter.append(transaction, {
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
    await this.services.notificationWriter.append(transaction, {
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

    await this.healStaleCompletedWorkflows(transaction, authorization, input.operationId, [
      request.initiatorAssignmentId,
      request.targetAssignmentId,
    ]);

    return this.readSwapRequest(transaction, request.id);
  }

  private async applySwap(
    transaction: DatabaseTransaction,
    context: SwapContext,
    swapRequestId: string,
    actorUserId: string,
    actorMemberName: string,
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

    await updateShiftAssignments(
      transaction,
      eq(shiftAssignments.id, context.initiatorAssignment.id),
      {
        actualMembershipId: context.targetMember.id,
        actualMemberName: context.targetMember.realName,
      },
    );
    await updateShiftAssignments(
      transaction,
      eq(shiftAssignments.id, context.targetAssignment.id),
      {
        actualMembershipId: context.initiatorMember.id,
        actualMemberName: context.initiatorMember.realName,
      },
    );
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
      await this.services.eventWriter.append(transaction, {
        affectedMembershipIds,
        affectedShiftIds,
        afterData: toLatestData({
          initiatorAssignmentId: context.initiatorAssignment.id,
          initiatorAssignment: toEventAssignmentData(
            context.initiatorAssignment,
            context.targetMember.id,
            context.targetMember.realName,
          ),
          initiatorMemberName: actorMemberName,
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
          initiatorMemberName: actorMemberName,
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
      await this.services.statisticsService.refreshInTransaction(
        transaction,
        context.group.id,
        businessMonth,
      );
    }
  }

  private async healStaleCompletedWorkflows(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    operationId: string,
    assignmentIds: readonly string[],
  ): Promise<void> {
    await this.services.workflowSelfHealingService.archiveStaleCompletedWorkflows(transaction, {
      actorUserId: authorization.user.id,
      assignmentIds,
      groupId: authorization.group.id,
      operationId,
    });
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

    const members = await this.services.memberReader.loadMembers(
      transaction,
      group.id,
      [initiatorMembershipId, targetMembershipId],
      { autoAcceptSwapsDefault: 1 },
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
    if (getCurrentDutyMembershipId(initiatorAssignment) !== initiatorMembershipId) {
      throw validationError('只能选择自己当值的班次发起换班。');
    }
    if (getCurrentDutyMembershipId(targetAssignment) !== targetMembershipId) {
      throw validationError('目标班次必须由目标成员当值。');
    }

    const roleNamesById = await this.services.memberReader.loadRoleNames(transaction, [
      initiatorPeriod.scheduleRoleId,
      targetPeriod.scheduleRoleId,
    ]);
    const targetConflicts = (
      await this.services.workflowConflictService.findMemberEligibilityConflicts(
        transaction,
        group.id,
        targetMember.id,
        initiatorAssignment,
        initiatorPeriod.scheduleRoleId,
        targetAssignment.id,
        lockRows,
      )
    ).map(toSwapConflict);
    const initiatorConflicts = (
      await this.services.workflowConflictService.findMemberEligibilityConflicts(
        transaction,
        group.id,
        initiatorMember.id,
        targetAssignment,
        targetPeriod.scheduleRoleId,
        initiatorAssignment.id,
        lockRows,
      )
    ).map(toSwapConflict);
    const conflicts = [...targetConflicts, ...initiatorConflicts];
    const activeWorkflowConflicts = (
      await this.services.workflowConflictService.findSwapAssignmentConflicts(
        transaction,
        group.id,
        [initiatorAssignment.id, targetAssignment.id],
        lockRows,
      )
    ).map(toSwapConflict);
    const requiresApproval = group.swapApprovalRequired;
    const targetAutoAccepts = targetMember.autoAcceptSwaps === 1;
    const nextStatus = resolveNextStatus(requiresApproval, targetAutoAccepts);

    return {
      activeWorkflowConflicts,
      conflicts,
      group,
      initiatorAssignment,
      initiatorAssignmentVersion: initiatorAssignment.version,
      initiatorEligibleForTargetShift: initiatorConflicts.length === 0,
      initiatorMember,
      initiatorPeriod,
      nextStatus,
      preview: buildSwapPreview({
        activeWorkflowConflicts,
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
    const initiatorMembershipId = getCurrentDutyMembershipId(initiatorAssignment);
    const targetMembershipId = getCurrentDutyMembershipId(targetAssignment);
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

  // accept/approve 复检时，findSwapAssignmentConflicts 会把当前请求自身算作活动工作流
  // （查询无排除参数），因此这两个入口沿用旧行为只重查资格冲突。
  private assertNoWorkflowConflicts(
    context: SwapContext,
    includeActiveWorkflowConflicts: boolean,
  ): void {
    this.services.workflowConflictService.assertNoWorkflowConflicts({
      activeWorkflowConflicts: includeActiveWorkflowConflicts
        ? context.activeWorkflowConflicts
        : [],
      conflicts: context.conflicts,
      latestData: {
        initiatorAssignment: context.preview.initiatorAssignment,
        targetAssignment: context.preview.targetAssignment,
      },
    });
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
      this.services.memberReader.loadMembers(transaction, rows[0]?.groupId ?? '', membershipIds, {
        autoAcceptSwapsDefault: 1,
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
    const roleNamesById = await this.services.memberReader.loadRoleNames(transaction, roleIds);
    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
    return rows.map((row): SwapRequest => {
      const initiatorMember = members.get(row.initiatorMembershipId);
      const targetMember = members.get(row.targetMembershipId);
      const initiatorAssignment = assignmentById.get(row.initiatorAssignmentId);
      const targetAssignment = assignmentById.get(row.targetAssignmentId);
      const initiatorPeriod = periodById.get(initiatorAssignment?.schedulePeriodId ?? '');
      const targetPeriod = periodById.get(targetAssignment?.schedulePeriodId ?? '');
      const decidedByMemberName =
        row.approverUserId === null ? undefined : approverNameByUserId.get(row.approverUserId);
      let isRevocable: boolean | undefined;
      let revocationBlockedReason: string | undefined;
      if (row.status === 'completed') {
        const initiatorStateMatches =
          initiatorAssignment !== undefined &&
          initiatorAssignment.deletedAt === null &&
          initiatorAssignment.actualMembershipId === (targetMember?.id ?? null);
        const targetStateMatches =
          targetAssignment !== undefined &&
          targetAssignment.deletedAt === null &&
          targetAssignment.actualMembershipId === (initiatorMember?.id ?? null);
        if (initiatorStateMatches && targetStateMatches) {
          isRevocable = true;
        } else {
          isRevocable = false;
          revocationBlockedReason = '该换班后续还有排班变动或班次已失效，请按先后顺序撤销。';
        }
      }
      return {
        ...(row.approverUserId === null
          ? {}
          : {
              approverUserId: row.approverUserId,
              ...(decidedByMemberName === undefined ? {} : { decidedByMemberName }),
            }),
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
        ...(isRevocable === undefined ? {} : { isRevocable }),
        ...(revocationBlockedReason === undefined ? {} : { revocationBlockedReason }),
        ...(row.revocationReason === null ? {} : { revocationReason: row.revocationReason }),
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
  readonly activeWorkflowConflicts: readonly SwapConflict[];
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
    conflicts: [...input.conflicts, ...input.activeWorkflowConflicts],
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

function toSwapConflict(conflict: WorkflowConflict): SwapConflict {
  return {
    assignmentId: conflict.assignmentId,
    code: conflict.code as SwapConflict['code'],
    membershipId: conflict.membershipId,
    message: conflict.message,
  };
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
