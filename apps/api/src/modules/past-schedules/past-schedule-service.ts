import { createHash, randomUUID } from 'node:crypto';

import {
  pastScheduleBackfillBatchRequestSchema,
  type CreatePastScheduleAssignmentInput,
  type PastScheduleBackfillBatchItem,
  type PastScheduleBackfillBatchRequest,
  type PastScheduleBackfillBatchResult,
  type PastScheduleAssignment,
  type PastScheduleBackfillRecord,
  type PastSchedulePeriod,
  type UpdatePastScheduleAssignmentInput,
  type UpdatePastScheduleAssignmentResult,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  groups,
  groupMemberships,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  shiftTypes,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import {
  getChinaStandardTimeBusinessDate,
  isPastBusinessDate,
  toChinaStandardTimeShiftRange,
} from '@schedule/scheduling-domain';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { EventWriter } from '../events/event-writer.js';
import { GroupPermissionService, type GroupAuthorization } from '../groups/permission-service.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { WorkflowSelfHealingService } from '../workflows/workflow-self-healing-service.js';

interface BackfillMutationResult {
  readonly assignment: typeof shiftAssignments.$inferSelect;
  readonly before: typeof shiftAssignments.$inferSelect | undefined;
  readonly schedulePeriodId: string;
}

export class PastScheduleService {
  private readonly eventWriter = new EventWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly statisticsService: StatisticsService;
  private readonly workflowSelfHealingService: WorkflowSelfHealingService;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.statisticsService = new StatisticsService(this.databaseClient);
    this.workflowSelfHealingService = new WorkflowSelfHealingService(this.databaseClient);
  }

  public async listPeriods(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly PastSchedulePeriod[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const currentMonth = getChinaStandardTimeBusinessDate(new Date()).slice(0, 7);
      const rows = await transaction
        .select({
          businessMonth: schedulePeriods.businessMonth,
          id: schedulePeriods.id,
          revision: schedulePeriods.revision,
          scheduleRoleId: schedulePeriods.scheduleRoleId,
          scheduleRoleName: scheduleRoles.name,
          status: schedulePeriods.status,
          version: schedulePeriods.version,
        })
        .from(schedulePeriods)
        .innerJoin(scheduleRoles, eq(scheduleRoles.id, schedulePeriods.scheduleRoleId))
        .where(
          and(
            eq(schedulePeriods.groupId, authorization.group.id),
            isNull(schedulePeriods.deletedAt),
            or(
              eq(schedulePeriods.status, 'past'),
              and(
                eq(schedulePeriods.status, 'published'),
                lte(schedulePeriods.businessMonth, `${currentMonth}-01`),
              ),
            ),
          ),
        )
        .orderBy(
          desc(schedulePeriods.businessMonth),
          asc(scheduleRoles.name),
          sql`case when ${schedulePeriods.status} = 'past' then 0 else 1 end`,
          desc(schedulePeriods.revision),
        );
      const seenKeys = new Set<string>();
      const periods: PastSchedulePeriod[] = [];
      for (const row of rows) {
        const key = `${row.businessMonth}|${row.scheduleRoleId}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        periods.push({
          businessMonth: row.businessMonth.slice(0, 7),
          id: row.id,
          periodStatus: row.status === 'past' ? 'past' : 'published',
          revision: row.revision,
          scheduleRoleId: row.scheduleRoleId,
          scheduleRoleName: row.scheduleRoleName,
          version: row.version,
        });
      }

      return periods;
    });
  }

  public async listAssignments(
    identity: AuthenticatedIdentity,
    groupId: string,
    periodId: string,
  ): Promise<readonly PastScheduleAssignment[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const period = await this.lockDisplayablePeriod(transaction, authorization, periodId);
      const rows = await transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.schedulePeriodId, period.id),
            isNull(shiftAssignments.deletedAt),
            lt(shiftAssignments.businessDate, getChinaStandardTimeBusinessDate(new Date())),
          ),
        )
        .orderBy(asc(shiftAssignments.businessDate), asc(shiftAssignments.slotPosition));
      return rows.map(toPastScheduleAssignment);
    });
  }

  public async updateAssignment(
    identity: AuthenticatedIdentity,
    groupId: string,
    periodId: string,
    assignmentId: string,
    input: UpdatePastScheduleAssignmentInput,
  ): Promise<UpdatePastScheduleAssignmentResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const period = await this.lockDisplayablePeriod(transaction, authorization, periodId);
      const [assignment] = await transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.id, assignmentId),
            eq(shiftAssignments.schedulePeriodId, period.id),
            isNull(shiftAssignments.deletedAt),
          ),
        )
        .limit(1)
        .for('update');
      if (assignment === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '该既往班次不存在或不可用。',
        });
      }
      if (!isPastBusinessDate(assignment.businessDate)) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: `该班次日期（${assignment.businessDate}）尚未过去，请使用正常排班功能修改。`,
        });
      }

      let nextActualMemberId = assignment.actualMembershipId;
      let nextActualMemberName = assignment.actualMemberName;
      if (input.actualMembershipId !== undefined) {
        const memberName = await this.readMemberName(
          transaction,
          authorization,
          input.actualMembershipId,
        );
        nextActualMemberId = input.actualMembershipId;
        nextActualMemberName = memberName;
      }

      const nextAssignment = {
        actualMemberId: nextActualMemberId,
        actualMemberName: nextActualMemberName,
        endsAt: assignment.endsAt,
        shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
        shiftTypeColor: assignment.shiftTypeColor,
        shiftTypeConfigurationVersion: assignment.shiftTypeConfigurationVersion,
        shiftTypeId: assignment.shiftTypeId,
        shiftTypeName: assignment.shiftTypeName,
        shiftTypeTextColor: assignment.shiftTypeTextColor,
        shiftStartTime: assignment.shiftStartTime,
        shiftEndTime: assignment.shiftEndTime,
        crossesMidnight: assignment.crossesMidnight,
        isAllDay: assignment.isAllDay,
        countsTowardStatistics: assignment.countsTowardStatistics,
        startsAt: assignment.startsAt,
      };
      if (input.shiftTypeId !== undefined) {
        const shiftType = await this.readShiftType(transaction, authorization, input.shiftTypeId);
        const timeRange = toChinaStandardTimeShiftRange({
          businessDate: assignment.businessDate,
          crossesMidnight: shiftType.crossesMidnight === 1,
          endTime: (shiftType.endTime as string).slice(0, 5),
          startTime: (shiftType.startTime as string).slice(0, 5),
        });
        nextAssignment.shiftTypeAbbreviation = shiftType.abbreviation;
        nextAssignment.shiftTypeColor = shiftType.color;
        nextAssignment.shiftTypeConfigurationVersion = shiftType.configurationVersion;
        nextAssignment.shiftTypeId = shiftType.id;
        nextAssignment.shiftTypeName = shiftType.name;
        nextAssignment.shiftTypeTextColor = shiftType.textColor;
        nextAssignment.shiftStartTime = (shiftType.startTime as string).slice(0, 5);
        nextAssignment.shiftEndTime = (shiftType.endTime as string).slice(0, 5);
        nextAssignment.crossesMidnight = shiftType.crossesMidnight;
        nextAssignment.isAllDay = shiftType.isAllDay;
        nextAssignment.countsTowardStatistics = shiftType.countsTowardStatistics;
        nextAssignment.startsAt = timeRange.startsAt;
        nextAssignment.endsAt = timeRange.endsAt;
      }

      const revertedToPlanned =
        input.actualMembershipId !== undefined &&
        assignment.plannedMembershipId !== null &&
        input.actualMembershipId === assignment.plannedMembershipId &&
        assignment.actualMembershipId !== assignment.plannedMembershipId;
      const hasChange =
        nextActualMemberId !== assignment.actualMembershipId ||
        (input.shiftTypeId !== undefined && input.shiftTypeId !== assignment.shiftTypeId);
      const nextBackfillAt = revertedToPlanned
        ? null
        : hasChange
          ? new Date()
          : assignment.backfillAt;
      const nextBackfillOperatorUserId = revertedToPlanned
        ? null
        : hasChange
          ? authorization.user.id
          : assignment.backfillOperatorUserId;
      const nextBackfillReason = revertedToPlanned
        ? null
        : hasChange
          ? (input.reason ?? assignment.backfillReason)
          : assignment.backfillReason;

      await transaction
        .update(shiftAssignments)
        .set({
          actualMembershipId: nextAssignment.actualMemberId,
          actualMemberName: nextAssignment.actualMemberName,
          backfillAt: nextBackfillAt,
          backfillOperatorUserId: nextBackfillOperatorUserId,
          backfillReason: nextBackfillReason,
          countsTowardStatistics: nextAssignment.countsTowardStatistics,
          crossesMidnight: nextAssignment.crossesMidnight,
          endsAt: nextAssignment.endsAt,
          isAllDay: nextAssignment.isAllDay,
          shiftEndTime: nextAssignment.shiftEndTime,
          shiftStartTime: nextAssignment.shiftStartTime,
          shiftTypeAbbreviation: nextAssignment.shiftTypeAbbreviation,
          shiftTypeColor: nextAssignment.shiftTypeColor,
          shiftTypeConfigurationVersion: nextAssignment.shiftTypeConfigurationVersion,
          shiftTypeId: nextAssignment.shiftTypeId,
          shiftTypeName: nextAssignment.shiftTypeName,
          shiftTypeTextColor: nextAssignment.shiftTypeTextColor,
          startsAt: nextAssignment.startsAt,
          version: sql`${shiftAssignments.version} + 1`,
        })
        .where(eq(shiftAssignments.id, assignment.id));
      const [updated] = await transaction
        .select()
        .from(shiftAssignments)
        .where(eq(shiftAssignments.id, assignment.id));
      if (updated === undefined) {
        throw new Error('The backfilled assignment could not be read back.');
      }

      await this.statisticsService.refreshInTransaction(
        transaction,
        authorization.group.id,
        `${assignment.businessDate.slice(0, 7)}-01`,
      );
      await this.workflowSelfHealingService.archiveStaleCompletedWorkflows(transaction, {
        actorUserId: authorization.user.id,
        assignmentIds: [assignment.id],
        groupId: authorization.group.id,
        operationId: randomUUID(),
      });

      return { assignment: toPastScheduleAssignment(updated) };
    });
  }

  public async backfillBatch(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: PastScheduleBackfillBatchRequest,
    operationId: string,
  ): Promise<PastScheduleBackfillBatchResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const parsedInput = pastScheduleBackfillBatchRequestSchema.safeParse(input);
      if (!parsedInput.success) {
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: parsedInput.error.issues[0]?.message ?? '批量补录请求不符合要求。',
        });
      }
      if (
        parsedInput.data.operationId !== undefined &&
        parsedInput.data.operationId !== operationId
      ) {
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: '幂等键与请求中的操作编号不一致。',
        });
      }

      const sortedItems = [...parsedInput.data.items].sort(compareBackfillItems);
      const now = new Date();
      for (const item of sortedItems) {
        if (!isPastBusinessDate(item.businessDate, now)) {
          throw new ApiError({
            code: 'CONFLICT',
            statusCode: 409,
            userMessage: `该班次日期（${item.businessDate}）尚未过去，请使用正常排班功能修改。`,
          });
        }
      }

      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId,
          requestFingerprint: createBackfillBatchFingerprint({
            groupId: authorization.group.id,
            items: sortedItems,
            reason: parsedInput.data.reason ?? null,
          }),
          scope: `past_schedule_backfill:${authorization.group.id}`,
        },
        async () => {
          const assignments: PastScheduleAssignment[] = [];
          const assignmentIds: string[] = [];
          const eventIds: string[] = [];
          const businessMonths = new Set<string>();
          const mutations: BackfillMutationResult[] = [];

          for (const item of sortedItems) {
            const mutation = await this.mutateAssignmentInTransaction(
              transaction,
              authorization,
              item,
              parsedInput.data.reason,
            );
            mutations.push(mutation);
            assignments.push(toPastScheduleAssignment(mutation.assignment));
            assignmentIds.push(mutation.assignment.id);
            businessMonths.add(`${item.businessDate.slice(0, 7)}-01`);
          }

          for (const mutation of mutations) {
            const eventId = await this.eventWriter.append(transaction, {
              affectedMembershipIds: collectDefinedIds(
                mutation.before?.actualMembershipId,
                mutation.assignment.actualMembershipId,
              ),
              affectedShiftIds: [mutation.assignment.id],
              afterData: toBackfillEventState(mutation.assignment),
              beforeData: toBackfillEventState(mutation.before),
              eventStatus: 'completed',
              eventType: 'schedule_backfill_completed',
              groupId: authorization.group.id,
              initiatedByUserId: authorization.user.id,
              objectId: mutation.assignment.id,
              objectType: 'shift_assignment',
              operationId,
              operatorUserId: authorization.user.id,
              ...(parsedInput.data.reason === undefined ? {} : { reason: parsedInput.data.reason }),
              schedulePeriodId: mutation.schedulePeriodId,
            });

            eventIds.push(eventId);
          }

          for (const businessMonth of [...businessMonths].sort()) {
            await this.statisticsService.refreshInTransaction(
              transaction,
              authorization.group.id,
              businessMonth,
            );
          }
          await this.workflowSelfHealingService.archiveStaleCompletedWorkflows(transaction, {
            actorUserId: authorization.user.id,
            assignmentIds: [...new Set(assignmentIds)],
            groupId: authorization.group.id,
            operationId,
          });

          return { assignments, eventIds };
        },
      );
    });
  }

  public async createAssignment(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreatePastScheduleAssignmentInput,
  ): Promise<UpdatePastScheduleAssignmentResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.businessDate)) {
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: '补录日期格式不正确。',
        });
      }
      if (!isPastBusinessDate(input.businessDate)) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: `该班次日期（${input.businessDate}）尚未过去，请使用正常排班功能修改。`,
        });
      }
      const mutation = await this.mutateAssignmentInTransaction(
        transaction,
        authorization,
        input,
        input.reason,
      );

      await this.statisticsService.refreshInTransaction(
        transaction,
        authorization.group.id,
        `${input.businessDate.slice(0, 7)}-01`,
      );
      await this.workflowSelfHealingService.archiveStaleCompletedWorkflows(transaction, {
        actorUserId: authorization.user.id,
        assignmentIds: [mutation.assignment.id],
        groupId: authorization.group.id,
        operationId: randomUUID(),
      });

      return { assignment: toPastScheduleAssignment(mutation.assignment) };
    });
  }

  private async mutateAssignmentInTransaction(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: PastScheduleBackfillBatchItem,
    reason: string | undefined,
  ): Promise<BackfillMutationResult> {
    const period = await this.findOrCreatePastPeriod(
      transaction,
      authorization,
      input.scheduleRoleId,
      input.businessDate,
    );
    const memberName = await this.readMemberName(
      transaction,
      authorization,
      input.actualMembershipId,
    );
    const shiftType = await this.readShiftType(transaction, authorization, input.shiftTypeId);
    const timeRange = toChinaStandardTimeShiftRange({
      businessDate: input.businessDate,
      crossesMidnight: shiftType.crossesMidnight === 1,
      endTime: (shiftType.endTime as string).slice(0, 5),
      startTime: (shiftType.startTime as string).slice(0, 5),
    });
    const shiftSnapshot = {
      shiftEndTime: (shiftType.endTime as string).slice(0, 5),
      shiftStartTime: (shiftType.startTime as string).slice(0, 5),
      shiftTypeAbbreviation: shiftType.abbreviation,
      shiftTypeColor: shiftType.color,
      shiftTypeConfigurationVersion: shiftType.configurationVersion,
      shiftTypeId: shiftType.id,
      shiftTypeName: shiftType.name,
      shiftTypeTextColor: shiftType.textColor,
      crossesMidnight: shiftType.crossesMidnight,
      isAllDay: shiftType.isAllDay,
      countsTowardStatistics: shiftType.countsTowardStatistics,
    };

    const [existing] = await transaction
      .select()
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.schedulePeriodId, period.id),
          eq(shiftAssignments.businessDate, input.businessDate),
          isNull(shiftAssignments.deletedAt),
        ),
      )
      .orderBy(asc(shiftAssignments.slotPosition), asc(shiftAssignments.id))
      .limit(1)
      .for('update');
    let before = existing;
    let assignmentId: string;
    if (existing !== undefined) {
      assignmentId = existing.id;
      const revertedToPlanned =
        existing.plannedMembershipId !== null &&
        input.actualMembershipId === existing.plannedMembershipId &&
        existing.actualMembershipId !== existing.plannedMembershipId;
      const hasChange =
        input.actualMembershipId !== existing.actualMembershipId ||
        input.shiftTypeId !== existing.shiftTypeId;
      await transaction
        .update(shiftAssignments)
        .set({
          actualMembershipId: input.actualMembershipId,
          actualMemberName: memberName,
          backfillAt: revertedToPlanned ? null : hasChange ? new Date() : existing.backfillAt,
          backfillOperatorUserId: revertedToPlanned
            ? null
            : hasChange
              ? authorization.user.id
              : existing.backfillOperatorUserId,
          backfillReason: revertedToPlanned
            ? null
            : hasChange
              ? (reason ?? existing.backfillReason)
              : existing.backfillReason,
          ...shiftSnapshot,
          endsAt: timeRange.endsAt,
          startsAt: timeRange.startsAt,
          version: sql`${shiftAssignments.version} + 1`,
        })
        .where(eq(shiftAssignments.id, existing.id));
    } else {
      const [reusableDeleted] = await transaction
        .select()
        .from(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.schedulePeriodId, period.id),
            eq(shiftAssignments.businessDate, input.businessDate),
            eq(shiftAssignments.slotPosition, 1),
            eq(shiftAssignments.startsAt, timeRange.startsAt),
            isNotNull(shiftAssignments.deletedAt),
          ),
        )
        .limit(1)
        .for('update');
      if (reusableDeleted === undefined) {
        assignmentId = randomUUID();
        await transaction.insert(shiftAssignments).values({
          actualMembershipId: input.actualMembershipId,
          actualMemberName: memberName,
          backfillAt: new Date(),
          backfillOperatorUserId: authorization.user.id,
          backfillReason: reason ?? null,
          businessDate: input.businessDate,
          id: assignmentId,
          plannedMembershipId: input.actualMembershipId,
          plannedMemberName: memberName,
          schedulePeriodId: period.id,
          slotPosition: 1,
          ...shiftSnapshot,
          endsAt: timeRange.endsAt,
          startsAt: timeRange.startsAt,
        });
      } else {
        before = reusableDeleted;
        assignmentId = reusableDeleted.id;
        await transaction
          .update(shiftAssignments)
          .set({
            actualMembershipId: input.actualMembershipId,
            actualMemberName: memberName,
            backfillAt: new Date(),
            backfillOperatorUserId: authorization.user.id,
            backfillReason: reason ?? null,
            deletedAt: null,
            plannedMembershipId: input.actualMembershipId,
            plannedMemberName: memberName,
            ...shiftSnapshot,
            endsAt: timeRange.endsAt,
            startsAt: timeRange.startsAt,
            version: sql`${shiftAssignments.version} + 1`,
          })
          .where(eq(shiftAssignments.id, reusableDeleted.id));
      }
    }
    const [updated] = await transaction
      .select()
      .from(shiftAssignments)
      .where(eq(shiftAssignments.id, assignmentId));
    if (updated === undefined) {
      throw new Error('The backfilled assignment could not be read back.');
    }

    return { assignment: updated, before, schedulePeriodId: period.id };
  }

  public async listBackfillRecords(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly PastScheduleBackfillRecord[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const today = getChinaStandardTimeBusinessDate(new Date());
      const rows = await transaction
        .select({
          assignmentId: shiftAssignments.id,
          actualMemberName: shiftAssignments.actualMemberName,
          backfilledAt: shiftAssignments.backfillAt,
          businessDate: shiftAssignments.businessDate,
          operatorName: userProfiles.realName,
          reason: shiftAssignments.backfillReason,
          shiftTypeAbbreviation: shiftAssignments.shiftTypeAbbreviation,
          shiftTypeName: shiftAssignments.shiftTypeName,
        })
        .from(shiftAssignments)
        .innerJoin(schedulePeriods, eq(schedulePeriods.id, shiftAssignments.schedulePeriodId))
        .leftJoin(users, eq(users.id, shiftAssignments.backfillOperatorUserId))
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(
          and(
            eq(schedulePeriods.groupId, authorization.group.id),
            isNull(schedulePeriods.deletedAt),
            isNull(shiftAssignments.deletedAt),
            lt(shiftAssignments.businessDate, today),
            sql`${shiftAssignments.backfillAt} is not null`,
          ),
        )
        .orderBy(desc(shiftAssignments.backfillAt))
        .limit(30);

      return rows.map((row) => ({
        ...(row.actualMemberName === null ? {} : { actualMemberName: row.actualMemberName }),
        assignmentId: row.assignmentId,
        backfilledAt: row.backfilledAt === null ? '' : new Date(row.backfilledAt).toISOString(),
        businessDate: row.businessDate,
        operatorName: row.operatorName ?? '',
        ...(row.reason === null ? {} : { reason: row.reason }),
        shiftTypeAbbreviation: row.shiftTypeAbbreviation,
        shiftTypeName: row.shiftTypeName,
      }));
    });
  }

  private async findOrCreatePastPeriod(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    scheduleRoleId: string,
    businessDate: string,
  ): Promise<typeof schedulePeriods.$inferSelect> {
    const businessMonth = `${businessDate.slice(0, 7)}-01`;
    const [existing] = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, authorization.group.id),
          eq(schedulePeriods.scheduleRoleId, scheduleRoleId),
          eq(schedulePeriods.businessMonth, businessMonth),
          inArray(schedulePeriods.status, ['past', 'published']),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .orderBy(
        sql`case when ${schedulePeriods.status} = 'past' then 0 else 1 end`,
        desc(schedulePeriods.revision),
      )
      .limit(1)
      .for('update');
    if (existing !== undefined) {
      return existing;
    }

    const [mostRecentPeriod] = await transaction
      .select({ revision: schedulePeriods.revision })
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, authorization.group.id),
          eq(schedulePeriods.scheduleRoleId, scheduleRoleId),
          eq(schedulePeriods.businessMonth, businessMonth),
        ),
      )
      .orderBy(desc(schedulePeriods.revision))
      .limit(1)
      .for('update');
    const revision = (mostRecentPeriod?.revision ?? 0) + 1;
    const [groupRow] = await transaction
      .select({ rulesVersion: groups.rulesVersion })
      .from(groups)
      .where(eq(groups.id, authorization.group.id))
      .limit(1);
    const pastPeriodId = randomUUID();
    await transaction.insert(schedulePeriods).values({
      businessMonth,
      groupId: authorization.group.id,
      id: pastPeriodId,
      revision,
      rulesVersion: groupRow?.rulesVersion ?? 1,
      scheduleRoleId,
      status: 'past',
    });
    const [created] = await transaction
      .select()
      .from(schedulePeriods)
      .where(eq(schedulePeriods.id, pastPeriodId))
      .limit(1);
    if (created === undefined) {
      throw new Error('The past schedule period could not be read back.');
    }

    return created;
  }

  private async lockDisplayablePeriod(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    periodId: string,
  ): Promise<typeof schedulePeriods.$inferSelect> {
    const [period] = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.id, periodId),
          eq(schedulePeriods.groupId, authorization.group.id),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (period === undefined || (period.status !== 'past' && period.status !== 'published')) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '该既往排班不存在或不可用。',
      });
    }

    return period;
  }

  private async readMemberName(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    membershipId: string,
  ): Promise<string> {
    const [member] = await transaction
      .select({ realName: userProfiles.realName })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.id, membershipId),
          eq(groupMemberships.groupId, authorization.group.id),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1);
    if (member === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '补录成员不存在或不在当前群组。',
      });
    }

    return member.realName;
  }

  private async readShiftType(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    shiftTypeId: string,
  ): Promise<typeof shiftTypes.$inferSelect> {
    const [shiftType] = await transaction
      .select()
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.id, shiftTypeId),
          eq(shiftTypes.groupId, authorization.group.id),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .limit(1);
    if (
      shiftType === undefined ||
      shiftType.isEnabled !== 1 ||
      shiftType.startTime === null ||
      shiftType.endTime === null
    ) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '补录班种不可用（已停用或未配置时间）。',
      });
    }

    return shiftType;
  }
}

function toPastScheduleAssignment(
  assignment: typeof shiftAssignments.$inferSelect,
): PastScheduleAssignment {
  return {
    ...(assignment.actualMembershipId === null
      ? {}
      : {
          actualMemberId: assignment.actualMembershipId,
          ...(assignment.actualMemberName === null
            ? {}
            : { actualMemberName: assignment.actualMemberName }),
        }),
    assignmentId: assignment.id,
    ...(assignment.backfillAt === null
      ? {}
      : { backfillAt: new Date(assignment.backfillAt).toISOString() }),
    ...(assignment.backfillReason === null ? {} : { backfillReason: assignment.backfillReason }),
    businessDate: assignment.businessDate,
    ...(assignment.plannedMembershipId === null
      ? {}
      : {
          plannedMemberId: assignment.plannedMembershipId,
          ...(assignment.plannedMemberName === null
            ? {}
            : { plannedMemberName: assignment.plannedMemberName }),
        }),
    shiftTypeAbbreviation: assignment.shiftTypeAbbreviation,
    shiftTypeId: assignment.shiftTypeId,
    shiftTypeName: assignment.shiftTypeName,
    slotPosition: assignment.slotPosition,
  };
}

function compareBackfillItems(
  left: PastScheduleBackfillBatchItem,
  right: PastScheduleBackfillBatchItem,
): number {
  return (
    compareText(left.scheduleRoleId, right.scheduleRoleId) ||
    compareText(left.businessDate, right.businessDate) ||
    compareText(left.actualMembershipId, right.actualMembershipId) ||
    compareText(left.shiftTypeId, right.shiftTypeId)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createBackfillBatchFingerprint(input: {
  readonly groupId: string;
  readonly items: readonly PastScheduleBackfillBatchItem[];
  readonly reason: string | null;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        groupId: input.groupId,
        items: input.items.map((item) => ({
          actualMembershipId: item.actualMembershipId,
          businessDate: item.businessDate,
          scheduleRoleId: item.scheduleRoleId,
          shiftTypeId: item.shiftTypeId,
        })),
        reason: input.reason,
      }),
    )
    .digest('hex');
}

function collectDefinedIds(...ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => id !== null && id !== undefined))];
}

function toBackfillEventState(assignment: typeof shiftAssignments.$inferSelect | undefined): {
  readonly actualMemberName: string | null;
  readonly actualMembershipId: string | null;
  readonly reason: string | null;
  readonly shiftTypeId: string | null;
  readonly shiftTypeName: string | null;
  readonly version: number;
} {
  return {
    actualMemberName: assignment?.actualMemberName ?? null,
    actualMembershipId: assignment?.actualMembershipId ?? null,
    reason: assignment?.backfillReason ?? null,
    shiftTypeId: assignment?.shiftTypeId ?? null,
    shiftTypeName: assignment?.shiftTypeName ?? null,
    version: assignment?.version ?? 0,
  };
}
