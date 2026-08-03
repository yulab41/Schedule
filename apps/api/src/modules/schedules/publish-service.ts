import { createHash, randomUUID } from 'node:crypto';

import type {
  PublishSchedulePeriodRequest,
  PublishSchedulePeriodBatchRequest,
  PublishSchedulePeriodBatchResult,
  PublishSchedulePeriodResult,
  ScheduleDraftSummary,
  ScheduleGenerationConflict,
  ScheduleGenerationPreview,
  ScheduleGenerationRoleCount,
  ScheduleGenerationShiftTypeCount,
  ScheduleGenerationStatistics,
  ScheduleGenerationVacancy,
  ScheduleGenerationWarning,
  SchedulePeriodHistoryItem,
  SchedulePreviewAssignment,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  withTransaction,
} from '@schedule/database';
import {
  createRotationBusinessKey,
  findContinuousDutyWarnings,
  findRotationHardConflicts,
  type GeneratedRotationAssignment,
} from '@schedule/scheduling-domain';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import { GroupPermissionService, type GroupAuthorization } from '../groups/permission-service.js';
import {
  isConflictBlockedError,
  writeConflictNotification,
} from '../notifications/conflict-notifier.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { ScheduleRepository } from './schedule-repository.js';
import { toLatestData, toPeriodSummary } from './shared.js';

type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;

interface MutableShiftTypeCount {
  assignmentCount: number;
  countedAssignmentCount: number;
  shiftTypeAbbreviation: string;
  shiftTypeId: string;
  shiftTypeName: string;
}

export class SchedulePublishService {
  private readonly notificationWriter = new NotificationWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly statisticsService: StatisticsService;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly repository: ScheduleRepository,
  ) {
    this.statisticsService = new StatisticsService(this.databaseClient);
  }

  public async listDrafts(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<ScheduleDraftSummary[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      return this.repository.listDraftsInTransaction(transaction, authorization.group.id);
    });
  }

  public async listHistory(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<SchedulePeriodHistoryItem[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      return this.repository.listHistoryInTransaction(transaction, authorization.group.id);
    });
  }

  public async publishDraftBatch(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: PublishSchedulePeriodBatchRequest,
  ): Promise<PublishSchedulePeriodBatchResult> {
    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        return withIdempotentOperation(
          transaction,
          {
            actorUserId: authorization.user.id,
            operationId: input.operationId,
            requestFingerprint: createBatchPublishFingerprint({
              acknowledgeBlockers: input.acknowledgeBlockers === true,
              groupId: authorization.group.id,
              replacePublished: input.replacePublished === true,
              schedulePeriodIds: [...new Set(input.schedulePeriodIds)].sort(),
            }),
            scope: 'schedule_period_publish_batch',
          },
          () => this.runBatchPublish(transaction, authorization, input),
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

  private async runBatchPublish(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: PublishSchedulePeriodBatchRequest,
  ): Promise<PublishSchedulePeriodBatchResult> {
    const periods = [];
    for (const schedulePeriodId of new Set(input.schedulePeriodIds)) {
      const result = await this.publishInTransaction(transaction, authorization, schedulePeriodId, {
        acknowledgeBlockers: input.acknowledgeBlockers === true,
        operationId: randomUUID(),
        replacePublished: input.replacePublished === true,
      });
      periods.push(result.period);
    }

    return { periods };
  }

  public async deleteDraft(
    identity: AuthenticatedIdentity,
    groupId: string,
    schedulePeriodId: string,
  ): Promise<void> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      await this.repository.deleteDraftInTransaction(transaction, {
        actorUserId: authorization.user.id,
        groupId: authorization.group.id,
        operationId: randomUUID(),
        schedulePeriodId,
      });
    });
  }

  public async previewDraft(
    identity: AuthenticatedIdentity,
    groupId: string,
    schedulePeriodId: string,
  ): Promise<ScheduleGenerationPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const period = await this.lockPeriod(transaction, authorization.group.id, schedulePeriodId);
      const assignments = await transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(eq(shiftAssignments.schedulePeriodId, period.id), isNull(shiftAssignments.deletedAt)),
        )
        .orderBy(
          asc(shiftAssignments.businessDate),
          asc(shiftAssignments.slotPosition),
          asc(shiftAssignments.id),
        );

      return this.buildPreviewFromStoredAssignments(transaction, period, assignments);
    });
  }

  public async publishDraft(
    identity: AuthenticatedIdentity,
    groupId: string,
    schedulePeriodId: string,
    input: PublishSchedulePeriodRequest,
  ): Promise<PublishSchedulePeriodResult> {
    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        return withIdempotentOperation(
          transaction,
          {
            actorUserId: authorization.user.id,
            operationId: input.operationId,
            requestFingerprint: createPublishFingerprint({
              acknowledgeBlockers: input.acknowledgeBlockers === true,
              expectedVersion: input.expectedVersion,
              groupId: authorization.group.id,
              schedulePeriodId,
            }),
            scope: 'schedule_period_publish',
          },
          () => this.publishInTransaction(transaction, authorization, schedulePeriodId, input),
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

  private async publishInTransaction(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    schedulePeriodId: string,
    input: Omit<PublishSchedulePeriodRequest, 'expectedVersion'> & {
      readonly expectedVersion?: number;
    },
  ): Promise<PublishSchedulePeriodResult> {
    const period = await this.lockPeriod(transaction, authorization.group.id, schedulePeriodId);
    if (input.expectedVersion !== undefined) {
      assertExpectedVersion({
        actualVersion: period.version,
        expectedVersion: input.expectedVersion,
        id: period.id,
        latestData: { status: period.status },
        objectType: 'schedule_period',
        userMessage: '排班期间已被更新，请刷新后重试。',
      });
    }

    const [existingPublished] = await transaction
      .select({ id: schedulePeriods.id })
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, authorization.group.id),
          eq(schedulePeriods.scheduleRoleId, period.scheduleRoleId),
          eq(schedulePeriods.businessMonth, period.businessMonth),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
          ne(schedulePeriods.id, period.id),
        ),
      )
      .limit(1)
      .for('update');
    if (existingPublished !== undefined && input.replacePublished !== true) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({
          existingPublishedPeriodId: existingPublished.id,
          status: 'published',
        }),
        statusCode: 409,
        userMessage: '该岗位该月份已有已发布排班，请确认覆盖发布。',
      });
    }

    const assignments = await transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(eq(shiftAssignments.schedulePeriodId, period.id), isNull(shiftAssignments.deletedAt)),
      )
      .orderBy(asc(shiftAssignments.businessDate), asc(shiftAssignments.slotPosition));
    const preview = await this.buildPreviewFromStoredAssignments(transaction, period, assignments);
    const hasBlockers = preview.hardConflicts.length > 0 || preview.vacancies.length > 0;
    if (hasBlockers && input.acknowledgeBlockers !== true) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: toLatestData({ preview }),
        statusCode: 409,
        userMessage: '排班结果包含硬冲突或待处理空缺，确认后才能发布。',
      });
    }

    const published = await this.repository.publishInTransaction(transaction, {
      actorUserId: authorization.user.id,
      expectedVersion: period.version,
      operationId: input.operationId,
      schedulePeriodId: period.id,
    });
    const affectedMembershipIds = [
      ...new Set(
        assignments.flatMap((assignment) =>
          [assignment.plannedMembershipId, assignment.actualMembershipId].filter(
            (membershipId): membershipId is string => membershipId !== null,
          ),
        ),
      ),
    ];
    if (affectedMembershipIds.length > 0) {
      await this.notificationWriter.append(transaction, {
        body: `您的 ${period.businessMonth} 排班已发布，请查看日历。`,
        groupId: authorization.group.id,
        notificationType: 'schedule_published',
        objectId: period.id,
        objectType: 'schedule_period',
        payload: { businessMonth: period.businessMonth, scheduleRoleId: period.scheduleRoleId },
        recipientMembershipIds: affectedMembershipIds,
        title: '排班已发布',
      });
    }
    await this.statisticsService.refreshInTransaction(
      transaction,
      authorization.group.id,
      period.businessMonth,
    );

    return { period: toPeriodSummary(published), preview };
  }

  private async lockPeriod(
    transaction: DatabaseTransaction,
    groupId: string,
    schedulePeriodId: string,
  ): Promise<LockedSchedulePeriod> {
    const [period] = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.id, schedulePeriodId),
          eq(schedulePeriods.groupId, groupId),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (period === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '排班期间不存在或不可用。',
      });
    }

    return period;
  }

  private async buildPreviewFromStoredAssignments(
    transaction: DatabaseTransaction,
    period: LockedSchedulePeriod,
    assignments: readonly (typeof shiftAssignments.$inferSelect)[],
  ): Promise<ScheduleGenerationPreview> {
    const [role] = await transaction
      .select({ name: scheduleRoles.name })
      .from(scheduleRoles)
      .where(and(eq(scheduleRoles.id, period.scheduleRoleId), isNull(scheduleRoles.deletedAt)))
      .limit(1);
    const roleName = role?.name ?? '';
    const domainAssignments = assignments.map<GeneratedRotationAssignment>((assignment) => ({
      businessDate: assignment.businessDate,
      businessKey: createRotationBusinessKey(
        period.scheduleRoleId,
        assignment.businessDate,
        assignment.slotPosition,
      ),
      endsAt: assignment.endsAt,
      plannedMembershipId: assignment.plannedMembershipId,
      scheduleRoleId: period.scheduleRoleId,
      shiftTypeId: assignment.shiftTypeId,
      slotPosition: assignment.slotPosition,
      startsAt: assignment.startsAt,
    }));
    const memberNamesById = new Map(
      assignments.flatMap((assignment) =>
        assignment.plannedMembershipId === null || assignment.plannedMemberName === null
          ? []
          : [[assignment.plannedMembershipId, assignment.plannedMemberName] as const],
      ),
    );

    return {
      assignments: assignments.map((assignment) =>
        toStoredPreviewAssignment(period.scheduleRoleId, roleName, assignment),
      ),
      businessMonth: period.businessMonth.slice(0, 7),
      continuousDutyWarnings: findContinuousDutyWarnings(domainAssignments).map(
        (warning): ScheduleGenerationWarning => {
          const memberName = memberNamesById.get(warning.membershipId);
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
      hardConflicts: findRotationHardConflicts(domainAssignments).map(
        (conflict): ScheduleGenerationConflict => {
          const memberName = memberNamesById.get(conflict.membershipId);
          return {
            assignmentBusinessKeys: conflict.assignmentBusinessKeys,
            code: conflict.code,
            membershipId: conflict.membershipId,
            ...(memberName === undefined ? {} : { memberName }),
          };
        },
      ),
      rulesVersion: period.rulesVersion,
      scheduleRoleIds: [period.scheduleRoleId],
      statistics: buildStoredStatistics(period.scheduleRoleId, roleName, assignments),
      vacancies: assignments
        .filter((assignment) => assignment.plannedMembershipId === null)
        .map((assignment): ScheduleGenerationVacancy => ({
          assignmentBusinessKey: createRotationBusinessKey(
            period.scheduleRoleId,
            assignment.businessDate,
            assignment.slotPosition,
          ),
          businessDate: assignment.businessDate,
          code: 'NO_ELIGIBLE_MEMBER',
          scheduleRoleId: period.scheduleRoleId,
          slotPosition: assignment.slotPosition,
        })),
    };
  }
}

function createPublishFingerprint(input: {
  readonly acknowledgeBlockers: boolean;
  readonly expectedVersion: number;
  readonly groupId: string;
  readonly schedulePeriodId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function createBatchPublishFingerprint(input: {
  readonly acknowledgeBlockers: boolean;
  readonly groupId: string;
  readonly replacePublished: boolean;
  readonly schedulePeriodIds: readonly string[];
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function toStoredPreviewAssignment(
  scheduleRoleId: string,
  roleName: string,
  assignment: typeof shiftAssignments.$inferSelect,
): SchedulePreviewAssignment {
  return {
    businessDate: assignment.businessDate,
    endsAt: assignment.endsAt.toISOString(),
    ...(assignment.plannedMembershipId === null
      ? {}
      : { plannedMemberId: assignment.plannedMembershipId }),
    ...(assignment.plannedMemberName === null
      ? {}
      : { plannedMemberName: assignment.plannedMemberName }),
    scheduleRoleId,
    scheduleRoleName: roleName,
    shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
    shiftTypeColor: assignment.shiftTypeColor,
    shiftTypeId: assignment.shiftTypeId,
    shiftTypeName: assignment.shiftTypeName,
    slotPosition: assignment.slotPosition,
    startsAt: assignment.startsAt.toISOString(),
  };
}

function buildStoredStatistics(
  scheduleRoleId: string,
  roleName: string,
  assignments: readonly (typeof shiftAssignments.$inferSelect)[],
): ScheduleGenerationStatistics {
  const byShiftType = new Map<string, MutableShiftTypeCount>();
  let countedAssignmentCount = 0;
  for (const assignment of assignments) {
    const counted = assignment.countsTowardStatistics === 1 ? 1 : 0;
    countedAssignmentCount += counted;
    const shiftTypeCount = byShiftType.get(assignment.shiftTypeId) ?? {
      assignmentCount: 0,
      countedAssignmentCount: 0,
      shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
      shiftTypeId: assignment.shiftTypeId,
      shiftTypeName: assignment.shiftTypeName,
    };
    shiftTypeCount.assignmentCount += 1;
    shiftTypeCount.countedAssignmentCount += counted;
    byShiftType.set(assignment.shiftTypeId, shiftTypeCount);
  }

  const vacancyCount = assignments.filter(
    (assignment) => assignment.plannedMembershipId === null,
  ).length;
  const roleCount: ScheduleGenerationRoleCount = {
    assignmentCount: assignments.length,
    countedAssignmentCount,
    scheduleRoleId,
    scheduleRoleName: roleName,
    vacancyCount,
  };

  return {
    assignmentCount: assignments.length,
    byRole: [roleCount],
    byShiftType: [...byShiftType.values()].map(
      (shiftTypeCount): ScheduleGenerationShiftTypeCount => ({
        assignmentCount: shiftTypeCount.assignmentCount,
        countedAssignmentCount: shiftTypeCount.countedAssignmentCount,
        shiftTypeAbbreviation: shiftTypeCount.shiftTypeAbbreviation,
        shiftTypeId: shiftTypeCount.shiftTypeId,
        shiftTypeName: shiftTypeCount.shiftTypeName,
      }),
    ),
    countedAssignmentCount,
    vacancyCount,
  };
}
