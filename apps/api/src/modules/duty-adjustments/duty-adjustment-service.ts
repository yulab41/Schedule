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
  RevokeDutyAdjustmentInput,
  UpdateGroupDutyAdjustmentSettingsInput,
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
import { intervalsOverlap } from '@schedule/scheduling-domain';
import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';

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
import { toLatestData } from '../schedules/shared.js';

type LockedDutyAdjustment = typeof dutyAdjustments.$inferSelect;
type LockedShiftAssignment = typeof shiftAssignments.$inferSelect;
type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;

interface DutyAdjustmentMemberRow {
  readonly autoAcceptSwaps: number;
  readonly id: string;
  readonly isActive: boolean;
  readonly realName: string;
}

interface DutyAdjustmentContext {
  readonly conflicts: readonly DutyAdjustmentConflict[];
  readonly coveredAssignment: LockedShiftAssignment;
  readonly coveredAssignmentVersion: number;
  readonly deductedMember: DutyAdjustmentMemberRow;
  readonly group: ActiveGroup;
  readonly nextStatus: DutyAdjustmentStatus;
  readonly overtimeAutoAccepts: boolean;
  readonly overtimeMember: DutyAdjustmentMemberRow;
  readonly period: LockedSchedulePeriod;
  readonly preview: DutyAdjustmentPreview;
  readonly requiresApproval: boolean;
}

export class DutyAdjustmentService {
  private readonly eventWriter = new EventWriter();
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

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
            reason: input.reason,
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
            reason: input.reason,
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
    this.assertNoDutyAdjustmentConflicts(context);
    await this.assertNoActiveWorkflows(
      transaction,
      authorization.group.id,
      context.coveredAssignment.id,
    );

    const dutyAdjustmentId = randomUUID();
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
      await this.applyDutyAdjustment(
        transaction,
        context,
        dutyAdjustmentId,
        authorization.user.id,
        input.operationId,
        createdEventId,
        null,
      );
    }

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
    this.assertNoDutyAdjustmentConflicts(context);
    await this.assertNoActiveWorkflows(
      transaction,
      authorization.group.id,
      context.coveredAssignment.id,
    );

    const dutyAdjustmentId = randomUUID();
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
      reason: input.reason,
      status: 'completed',
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
      reason: input.reason,
      schedulePeriodId: context.period.id,
    });
    await this.applyDutyAdjustment(
      transaction,
      context,
      dutyAdjustmentId,
      authorization.user.id,
      input.operationId,
      createdEventId,
      authorization.user.id,
    );

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
    );
    this.assertStoredAssignmentVersion(context, request);
    this.assertNoDutyAdjustmentConflicts(context);
    await this.assertNoActiveWorkflows(
      transaction,
      authorization.group.id,
      context.coveredAssignment.id,
      request.id,
    );

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
      await this.applyDutyAdjustment(
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
        .update(dutyAdjustments)
        .set({ status: 'pending_approval', version: sql`${dutyAdjustments.version} + 1` })
        .where(eq(dutyAdjustments.id, request.id));
    }

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
    );
    this.assertStoredAssignmentVersion(context, request);
    this.assertNoDutyAdjustmentConflicts(context);
    await this.assertNoActiveWorkflows(
      transaction,
      authorization.group.id,
      context.coveredAssignment.id,
      request.id,
    );

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
    await this.applyDutyAdjustment(
      transaction,
      context,
      request.id,
      authorization.user.id,
      input.operationId,
      approvedEventId,
      authorization.user.id,
    );

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
    await this.eventWriter.append(transaction, {
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
    await this.eventWriter.append(transaction, {
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

    const context = await this.loadDutyAdjustmentContext(
      transaction,
      authorization.group,
      request.overtimeMembershipId,
      request.coveredAssignmentId,
      request.deductedMembershipId,
      true,
      true,
    );
    this.assertStoredAssignmentVersion(context, request);
    if (getDutyMembershipId(context.coveredAssignment) !== context.overtimeMember.id) {
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
    await transaction
      .update(shiftAssignments)
      .set({
        actualMembershipId: context.deductedMember.id,
        actualMemberName: context.deductedMember.realName,
        version: sql`${shiftAssignments.version} + 1`,
      })
      .where(eq(shiftAssignments.id, context.coveredAssignment.id));
    await transaction
      .update(dutyAdjustments)
      .set({
        approverUserId: authorization.user.id,
        decidedAt: new Date(),
        reason: input.reason,
        status: 'revoked',
        version: sql`${dutyAdjustments.version} + 1`,
      })
      .where(eq(dutyAdjustments.id, request.id));
    await this.eventWriter.append(transaction, {
      affectedMembershipIds: [context.deductedMember.id, context.overtimeMember.id],
      affectedShiftIds: [context.coveredAssignment.id],
      afterData: toLatestData({
        actualMemberId: context.deductedMember.id,
        actualMemberName: context.deductedMember.realName,
        reason: input.reason,
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
      reason: input.reason,
      schedulePeriodId: context.period.id,
    });

    return this.readDutyAdjustment(transaction, request.id);
  }

  private async applyDutyAdjustment(
    transaction: DatabaseTransaction,
    context: DutyAdjustmentContext,
    dutyAdjustmentId: string,
    actorUserId: string,
    operationId: string,
    parentEventId: string,
    approverUserId: string | null,
  ): Promise<void> {
    const beforeActual = {
      actualMemberId: context.coveredAssignment.actualMembershipId,
      actualMemberName: context.coveredAssignment.actualMemberName,
    };

    await transaction
      .update(shiftAssignments)
      .set({
        actualMembershipId: context.overtimeMember.id,
        actualMemberName: context.overtimeMember.realName,
        version: sql`${shiftAssignments.version} + 1`,
      })
      .where(eq(shiftAssignments.id, context.coveredAssignment.id));
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
      }),
      beforeData: toLatestData({
        actualMemberId: beforeActual.actualMemberId,
        actualMemberName: beforeActual.actualMemberName,
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
  }

  private async loadDutyAdjustmentContext(
    transaction: DatabaseTransaction,
    group: ActiveGroup,
    overtimeMembershipId: string,
    coveredAssignmentId: string,
    deductedMembershipId: string | null,
    lockRows = false,
    skipDeductedDutyCheck = false,
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
    const currentDutyMembershipId = getDutyMembershipId(coveredAssignment);
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

    const members = await this.loadMembers(
      transaction,
      group.id,
      [overtimeMembershipId, effectiveDeductedMembershipId],
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

    const roleNamesById = await this.loadRoleNames(transaction, [period.scheduleRoleId]);
    const conflicts = await this.findEligibilityConflicts(
      transaction,
      group.id,
      overtimeMember.id,
      coveredAssignment,
      period.scheduleRoleId,
      lockRows,
    );
    const requiresApproval = group.dutyAdjustmentApprovalRequired;
    const overtimeAutoAccepts = overtimeMember.autoAcceptSwaps === 1;
    const nextStatus = resolveNextDutyAdjustmentStatus(requiresApproval, overtimeAutoAccepts);

    return {
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

  private async findEligibilityConflicts(
    transaction: DatabaseTransaction,
    groupId: string,
    overtimeMembershipId: string,
    coveredAssignment: LockedShiftAssignment,
    receivedRoleId: string,
    lockRows: boolean,
  ): Promise<DutyAdjustmentConflict[]> {
    const conflicts: DutyAdjustmentConflict[] = [];
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
          eq(memberScheduleRoles.membershipId, overtimeMembershipId),
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
        roleMember.effectiveFrom <= coveredAssignment.businessDate) &&
      (roleMember.effectiveTo === null || roleMember.effectiveTo >= coveredAssignment.businessDate);
    if (!isInRole) {
      conflicts.push({
        assignmentId: coveredAssignment.id,
        code: 'MEMBER_NOT_ELIGIBLE',
        membershipId: overtimeMembershipId,
        message: '该成员不在班次的排班角色中或不在生效区间。',
      });
    }

    const leaves = await transaction
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.groupId, groupId),
          eq(leaveRequests.membershipId, overtimeMembershipId),
          eq(leaveRequests.status, 'approved'),
          isNull(leaveRequests.deletedAt),
        ),
      );
    const overlappingLeave = leaves.find((leave) => intervalsOverlap(leave, coveredAssignment));
    if (overlappingLeave !== undefined) {
      conflicts.push({
        assignmentId: coveredAssignment.id,
        code: 'MEMBER_LEAVE_OVERLAP',
        membershipId: overtimeMembershipId,
        message: '该成员在班次时间内有已批准请假。',
      });
    }

    const conflictingAssignments = await this.findMemberTimeConflicts(
      transaction,
      groupId,
      overtimeMembershipId,
      coveredAssignment,
    );
    const conflictingAssignment = conflictingAssignments[0];
    if (conflictingAssignment !== undefined) {
      conflicts.push({
        assignmentId: conflictingAssignment.id,
        code: 'MEMBER_TIME_OVERLAP',
        membershipId: overtimeMembershipId,
        message: '该成员在班次时间内另有排班。',
      });
    }

    return conflicts;
  }

  private async findMemberTimeConflicts(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId: string,
    coveredAssignment: LockedShiftAssignment,
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
        assignment.id !== coveredAssignment.id &&
        getDutyMembershipId(assignment) === membershipId &&
        intervalsOverlap(assignment, coveredAssignment),
    );
  }

  private async assertNoActiveWorkflows(
    transaction: DatabaseTransaction,
    groupId: string,
    coveredAssignmentId: string,
    excludingDutyAdjustmentId?: string,
  ): Promise<void> {
    const activeDutyAdjustments = await this.findActiveDutyAdjustments(
      transaction,
      groupId,
      [coveredAssignmentId],
      excludingDutyAdjustmentId,
    );
    if (activeDutyAdjustments.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { dutyAdjustmentIds: activeDutyAdjustments.map((request) => request.id) },
        statusCode: 409,
        userMessage: '该班次已有一组待处理或生效中的加扣班关系，请先撤销后再代值。',
      });
    }

    const activeSwaps = await transaction
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
      )
      .for('update');
    if (activeSwaps.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { swapRequestIds: activeSwaps.map((request) => request.id) },
        statusCode: 409,
        userMessage: '该班次已有待处理的换班申请，请刷新后重试。',
      });
    }
  }

  private async findActiveDutyAdjustments(
    transaction: DatabaseTransaction,
    groupId: string,
    assignmentIds: readonly string[],
    excludingDutyAdjustmentId?: string,
  ): Promise<readonly LockedDutyAdjustment[]> {
    const idFilter =
      excludingDutyAdjustmentId === undefined
        ? undefined
        : ne(dutyAdjustments.id, excludingDutyAdjustmentId);
    return transaction
      .select()
      .from(dutyAdjustments)
      .where(
        and(
          eq(dutyAdjustments.groupId, groupId),
          inArray(dutyAdjustments.status, ['pending_target', 'pending_approval', 'completed']),
          inArray(dutyAdjustments.coveredAssignmentId, [...assignmentIds]),
          isNull(dutyAdjustments.deletedAt),
          ...(idFilter === undefined ? [] : [idFilter]),
        ),
      )
      .for('update');
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

  private assertNoDutyAdjustmentConflicts(context: DutyAdjustmentContext): void {
    if (context.conflicts.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({
          conflicts: context.conflicts,
          coveredAssignment: context.preview.coveredAssignment,
        }),
        statusCode: 409,
        userMessage: '加扣班预检发现资格、请假或时间冲突，无法继续。',
      });
    }
  }

  private async loadMembers(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipIds: readonly string[],
    lockRows = false,
  ): Promise<ReadonlyMap<string, DutyAdjustmentMemberRow>> {
    if (membershipIds.length === 0) {
      return new Map();
    }
    let query = transaction
      .select({
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
          autoAcceptSwaps: row.autoAcceptSwaps,
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

    return rows.map((row): DutyAdjustmentRequest => {
      const overtimeMember = members.get(row.overtimeMembershipId);
      const deductedMember = members.get(row.deductedMembershipId);
      const coveredAssignment = assignmentById.get(row.coveredAssignmentId);
      const period = periodById.get(coveredAssignment?.schedulePeriodId ?? '');
      return {
        ...(row.approverUserId === null ? {} : { approverUserId: row.approverUserId }),
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
        ...(overtimeMember === undefined ? {} : { overtimeMemberName: overtimeMember.realName }),
        overtimeMembershipId: row.overtimeMembershipId,
        ...(row.reason === null ? {} : { reason: row.reason }),
        status: row.status,
        version: row.version,
      };
    });
  }
}

function buildDutyAdjustmentPreview(input: {
  readonly conflicts: readonly DutyAdjustmentConflict[];
  readonly coveredAssignment: LockedShiftAssignment;
  readonly deductedMember: DutyAdjustmentMemberRow;
  readonly group: ActiveGroup;
  readonly nextStatus: DutyAdjustmentStatus;
  readonly overtimeAutoAccepts: boolean;
  readonly overtimeMember: DutyAdjustmentMemberRow;
  readonly period: LockedSchedulePeriod;
  readonly requiresApproval: boolean;
  readonly roleNamesById: ReadonlyMap<string, string>;
}): DutyAdjustmentPreview {
  return {
    conflicts: input.conflicts,
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

function getDutyMembershipId(assignment: LockedShiftAssignment): string | null {
  return assignment.actualMembershipId ?? assignment.plannedMembershipId;
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
