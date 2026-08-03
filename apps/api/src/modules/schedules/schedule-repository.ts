import { randomUUID } from 'node:crypto';

import type { ScheduleDraftSummary, SchedulePeriodHistoryItem } from '@schedule/contracts';
import {
  groups,
  groupMemberships,
  scheduleEvents,
  schedulePeriods,
  scheduleRoles,
  shiftAssignments,
  shiftTypes,
  userProfiles,
  withTransaction,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@schedule/database';
import {
  assertBusinessMonthContainsDate,
  canTransitionSchedulePeriod,
  toChinaStandardTimeShiftRange,
  type SchedulePeriodStatus,
} from '@schedule/scheduling-domain';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';
import { assertExpectedVersion as assertVersionMatch } from '../concurrency/version-guard.js';
import { EventWriter } from '../events/event-writer.js';

export interface CreateSchedulePeriodInput {
  readonly actorUserId: string;
  readonly assignments: readonly CreateShiftAssignmentInput[];
  readonly businessMonth: string;
  readonly expectedRulesVersion?: number;
  readonly groupId: string;
  readonly operationId: string;
  readonly scheduleRoleId: string;
}

export interface CreateShiftAssignmentInput {
  readonly actualMembershipId?: string;
  readonly businessDate: string;
  readonly plannedMembershipId?: string;
  readonly shiftTypeId: string;
  readonly slotPosition: number;
}

export interface SchedulePeriodMutationInput {
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly operationId: string;
  readonly schedulePeriodId: string;
}

export interface SchedulePeriodRecord {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly id: string;
  readonly publishedAt?: string;
  readonly replacedByPeriodId?: string;
  readonly revision: number;
  readonly rulesVersion: number;
  readonly scheduleRoleId: string;
  readonly status: SchedulePeriodStatus;
  readonly version: number;
  readonly withdrawnAt?: string;
}

type LockedSchedulePeriod = typeof schedulePeriods.$inferSelect;

export class ScheduleRepository {
  private readonly eventWriter = new EventWriter();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async createDraft(input: CreateSchedulePeriodInput): Promise<SchedulePeriodRecord> {
    return withTransaction(this.databaseClient, (transaction) =>
      this.createDraftInTransaction(transaction, input),
    );
  }

  public async listDrafts(groupId: string): Promise<ScheduleDraftSummary[]> {
    return withTransaction(this.databaseClient, (transaction) =>
      this.listDraftsInTransaction(transaction, groupId),
    );
  }

  public async listDraftsInTransaction(
    transaction: DatabaseTransaction,
    groupId: string,
  ): Promise<ScheduleDraftSummary[]> {
    const rows = await transaction
      .select({
        businessMonth: schedulePeriods.businessMonth,
        id: schedulePeriods.id,
        revision: schedulePeriods.revision,
        rulesVersion: schedulePeriods.rulesVersion,
        scheduleRoleId: schedulePeriods.scheduleRoleId,
        scheduleRoleName: scheduleRoles.name,
        status: schedulePeriods.status,
        version: schedulePeriods.version,
      })
      .from(schedulePeriods)
      .innerJoin(scheduleRoles, eq(scheduleRoles.id, schedulePeriods.scheduleRoleId))
      .where(
        and(
          eq(schedulePeriods.groupId, groupId),
          eq(schedulePeriods.status, 'draft'),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .orderBy(desc(schedulePeriods.businessMonth), desc(schedulePeriods.revision));

    return rows.map((row) => ({
      businessMonth: row.businessMonth,
      id: row.id,
      revision: row.revision,
      rulesVersion: row.rulesVersion,
      scheduleRoleId: row.scheduleRoleId,
      scheduleRoleName: row.scheduleRoleName,
      status: row.status,
      version: row.version,
    }));
  }

  public async listHistoryInTransaction(
    transaction: DatabaseTransaction,
    groupId: string,
  ): Promise<SchedulePeriodHistoryItem[]> {
    const rows = await transaction
      .select({
        businessMonth: schedulePeriods.businessMonth,
        createdAt: schedulePeriods.createdAt,
        id: schedulePeriods.id,
        publishedAt: schedulePeriods.publishedAt,
        revision: schedulePeriods.revision,
        scheduleRoleId: schedulePeriods.scheduleRoleId,
        scheduleRoleName: scheduleRoles.name,
        status: schedulePeriods.status,
        version: schedulePeriods.version,
      })
      .from(schedulePeriods)
      .innerJoin(scheduleRoles, eq(scheduleRoles.id, schedulePeriods.scheduleRoleId))
      .where(and(eq(schedulePeriods.groupId, groupId), isNull(schedulePeriods.deletedAt)))
      .orderBy(desc(schedulePeriods.businessMonth), desc(schedulePeriods.revision));

    const draftIds = rows.filter((row) => row.status === 'draft').map((row) => row.id);
    const applyRanges = new Map<
      string,
      {
        readonly applyEndDate: string;
        readonly applyStartDate: string;
        readonly operationId: string;
      }
    >();
    if (draftIds.length > 0) {
      const events = await transaction
        .select({
          afterData: scheduleEvents.afterData,
          operationId: scheduleEvents.operationId,
          schedulePeriodId: scheduleEvents.schedulePeriodId,
        })
        .from(scheduleEvents)
        .where(
          and(
            eq(scheduleEvents.eventType, 'manual_schedule_template_applied'),
            inArray(scheduleEvents.schedulePeriodId, draftIds),
          ),
        );
      for (const event of events) {
        const after = event.afterData as
          { applyEndDate?: unknown; applyStartDate?: unknown } | null | undefined;
        if (
          event.schedulePeriodId !== null &&
          after !== null &&
          after !== undefined &&
          typeof after.applyStartDate === 'string' &&
          typeof after.applyEndDate === 'string'
        ) {
          applyRanges.set(event.schedulePeriodId, {
            applyEndDate: after.applyEndDate,
            applyStartDate: after.applyStartDate,
            operationId: event.operationId,
          });
        }
      }
    }

    return rows.map((row) => {
      const range = applyRanges.get(row.id);
      return {
        ...(range === undefined
          ? {}
          : {
              applyEndDate: range.applyEndDate,
              applyStartDate: range.applyStartDate,
              operationId: range.operationId,
            }),
        businessMonth: row.businessMonth.slice(0, 7),
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt.toISOString() }),
        revision: row.revision,
        scheduleRoleId: row.scheduleRoleId,
        scheduleRoleName: row.scheduleRoleName,
        status: row.status,
        version: row.version,
      };
    });
  }

  public async softDeleteDraftsInTransaction(
    transaction: DatabaseTransaction,
    groupId: string,
    scheduleRoleId: string,
    businessMonth: string,
  ): Promise<void> {
    const monthStart = toBusinessMonthStart(businessMonth);
    const drafts = await transaction
      .select({ id: schedulePeriods.id })
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, groupId),
          eq(schedulePeriods.scheduleRoleId, scheduleRoleId),
          eq(schedulePeriods.businessMonth, monthStart),
          eq(schedulePeriods.status, 'draft'),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .for('update');
    if (drafts.length === 0) {
      return;
    }

    const draftIds = drafts.map((draft) => draft.id);
    await transaction
      .update(schedulePeriods)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        version: sql`${schedulePeriods.version} + 1`,
      })
      .where(inArray(schedulePeriods.id, draftIds));
    for (const draftId of draftIds) {
      await this.softDeleteAssignments(transaction, draftId);
    }
  }

  public async deleteDraftInTransaction(
    transaction: DatabaseTransaction,
    input: {
      readonly actorUserId: string;
      readonly groupId: string;
      readonly operationId: string;
      readonly schedulePeriodId: string;
    },
  ): Promise<void> {
    const [period] = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.id, input.schedulePeriodId),
          eq(schedulePeriods.groupId, input.groupId),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (period === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '排班草稿不存在或不可用。',
      });
    }
    if (
      period.status !== 'draft' &&
      period.status !== 'replaced' &&
      period.status !== 'withdrawn'
    ) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '只能删除草稿或已归档的排班版本，当前发布的排班不能删除。',
      });
    }

    await transaction
      .update(schedulePeriods)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        version: sql`${schedulePeriods.version} + 1`,
      })
      .where(eq(schedulePeriods.id, period.id));
    await this.softDeleteAssignments(transaction, period.id);
    await this.eventWriter.append(transaction, {
      afterData: {
        businessMonth: period.businessMonth,
        scheduleRoleId: period.scheduleRoleId,
        status: period.status,
        version: period.version + 1,
      },
      eventStatus: 'completed',
      eventType: 'schedule_period_deleted',
      groupId: input.groupId,
      initiatedByUserId: input.actorUserId,
      objectId: period.id,
      objectType: 'schedule_period',
      operationId: input.operationId,
      operatorUserId: input.actorUserId,
      schedulePeriodId: period.id,
    });
  }

  public async createDraftInTransaction(
    transaction: DatabaseTransaction,
    input: CreateSchedulePeriodInput,
  ): Promise<SchedulePeriodRecord> {
    const businessMonth = toBusinessMonthStart(input.businessMonth);
    validateAssignments(input.assignments, businessMonth);

    const scope = await this.lockScheduleScope(transaction, input.groupId, input.scheduleRoleId);
    assertExpectedRulesVersion(scope, input.expectedRulesVersion);
    const [mostRecentPeriod] = await transaction
      .select({ revision: schedulePeriods.revision })
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, input.groupId),
          eq(schedulePeriods.scheduleRoleId, input.scheduleRoleId),
          eq(schedulePeriods.businessMonth, businessMonth),
        ),
      )
      .orderBy(desc(schedulePeriods.revision))
      .limit(1);
    const periodId = randomUUID();
    const revision = (mostRecentPeriod?.revision ?? 0) + 1;
    const assignmentRows = await this.snapshotAssignments(
      transaction,
      input,
      businessMonth,
      periodId,
    );

    await transaction.insert(schedulePeriods).values({
      businessMonth,
      groupId: input.groupId,
      id: periodId,
      revision,
      rulesVersion: scope.rulesVersion,
      scheduleRoleId: input.scheduleRoleId,
    });
    if (assignmentRows.length > 0) {
      await transaction.insert(shiftAssignments).values(assignmentRows);
    }
    await this.eventWriter.append(transaction, {
      affectedMembershipIds: getAffectedMembershipIds(input.assignments),
      affectedShiftIds: [],
      afterData: { businessMonth, revision, status: 'draft' },
      eventStatus: 'completed',
      eventType: 'schedule_period_created',
      groupId: input.groupId,
      initiatedByUserId: input.actorUserId,
      objectId: periodId,
      objectType: 'schedule_period',
      operationId: input.operationId,
      operatorUserId: input.actorUserId,
      schedulePeriodId: periodId,
    });

    return this.readPeriod(transaction, periodId);
  }

  public async submitForPublication(
    input: SchedulePeriodMutationInput,
  ): Promise<SchedulePeriodRecord> {
    return this.transition(input, 'pending_publication', 'schedule_period_submitted');
  }

  public async returnToDraft(input: SchedulePeriodMutationInput): Promise<SchedulePeriodRecord> {
    return this.transition(input, 'draft', 'schedule_period_returned_to_draft');
  }

  public async publish(input: SchedulePeriodMutationInput): Promise<SchedulePeriodRecord> {
    return withTransaction(this.databaseClient, (transaction) =>
      this.publishInTransaction(transaction, input),
    );
  }

  public async publishInTransaction(
    transaction: DatabaseTransaction,
    input: SchedulePeriodMutationInput,
  ): Promise<SchedulePeriodRecord> {
    const target = await this.lockPeriodWithScope(transaction, input.schedulePeriodId);
    assertExpectedPeriodVersion(target, input.expectedVersion);
    assertTransition(target.status, 'published');

    const [currentPublished] = await transaction
      .select()
      .from(schedulePeriods)
      .where(
        and(
          eq(schedulePeriods.groupId, target.groupId),
          eq(schedulePeriods.scheduleRoleId, target.scheduleRoleId),
          eq(schedulePeriods.businessMonth, target.businessMonth),
          eq(schedulePeriods.status, 'published'),
          isNull(schedulePeriods.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    const publishedAt = new Date();

    if (currentPublished !== undefined) {
      await transaction
        .update(schedulePeriods)
        .set({
          replacedByPeriodId: target.id,
          status: 'replaced',
          version: sql`${schedulePeriods.version} + 1`,
        })
        .where(eq(schedulePeriods.id, currentPublished.id));
    }

    await transaction
      .update(schedulePeriods)
      .set({
        publishedAt,
        status: 'published',
        version: sql`${schedulePeriods.version} + 1`,
      })
      .where(eq(schedulePeriods.id, target.id));
    const published = await this.readPeriod(transaction, target.id);
    const publicationEventId = await this.eventWriter.append(transaction, {
      afterData: { status: published.status, version: published.version },
      beforeData: { status: target.status, version: target.version },
      eventStatus: 'completed',
      eventType: 'schedule_period_published',
      groupId: target.groupId,
      initiatedByUserId: input.actorUserId,
      objectId: target.id,
      objectType: 'schedule_period',
      operationId: input.operationId,
      operatorUserId: input.actorUserId,
      schedulePeriodId: target.id,
    });

    if (currentPublished !== undefined) {
      await this.eventWriter.append(transaction, {
        afterData: { replacedByPeriodId: target.id, status: 'replaced' },
        beforeData: { status: 'published', version: currentPublished.version },
        eventStatus: 'completed',
        eventType: 'schedule_period_replaced',
        groupId: target.groupId,
        initiatedByUserId: input.actorUserId,
        objectId: currentPublished.id,
        objectType: 'schedule_period',
        operationId: input.operationId,
        operatorUserId: input.actorUserId,
        parentEventId: publicationEventId,
        schedulePeriodId: currentPublished.id,
      });
    }

    return published;
  }

  public async withdraw(input: SchedulePeriodMutationInput): Promise<SchedulePeriodRecord> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const period = await this.lockPeriodWithScope(transaction, input.schedulePeriodId);
      assertExpectedPeriodVersion(period, input.expectedVersion);
      assertTransition(period.status, 'withdrawn');

      await transaction
        .update(schedulePeriods)
        .set({
          status: 'withdrawn',
          version: sql`${schedulePeriods.version} + 1`,
          withdrawnAt: new Date(),
        })
        .where(eq(schedulePeriods.id, period.id));
      const withdrawn = await this.readPeriod(transaction, period.id);
      await this.eventWriter.append(transaction, {
        afterData: { status: withdrawn.status, version: withdrawn.version },
        beforeData: { status: period.status, version: period.version },
        eventStatus: 'completed',
        eventType: 'schedule_period_withdrawn',
        groupId: period.groupId,
        initiatedByUserId: input.actorUserId,
        objectId: period.id,
        objectType: 'schedule_period',
        operationId: input.operationId,
        operatorUserId: input.actorUserId,
        schedulePeriodId: period.id,
      });

      return withdrawn;
    });
  }

  private async transition(
    input: SchedulePeriodMutationInput,
    nextStatus: Extract<SchedulePeriodStatus, 'draft' | 'pending_publication'>,
    eventType: string,
  ): Promise<SchedulePeriodRecord> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const period = await this.lockPeriodWithScope(transaction, input.schedulePeriodId);
      assertExpectedPeriodVersion(period, input.expectedVersion);
      assertTransition(period.status, nextStatus);

      await transaction
        .update(schedulePeriods)
        .set({ status: nextStatus, version: sql`${schedulePeriods.version} + 1` })
        .where(eq(schedulePeriods.id, period.id));
      const updated = await this.readPeriod(transaction, period.id);
      await this.eventWriter.append(transaction, {
        afterData: { status: updated.status, version: updated.version },
        beforeData: { status: period.status, version: period.version },
        eventStatus: 'completed',
        eventType,
        groupId: period.groupId,
        initiatedByUserId: input.actorUserId,
        objectId: period.id,
        objectType: 'schedule_period',
        operationId: input.operationId,
        operatorUserId: input.actorUserId,
        schedulePeriodId: period.id,
      });

      return updated;
    });
  }

  private async snapshotAssignments(
    transaction: DatabaseTransaction,
    input: CreateSchedulePeriodInput,
    businessMonth: string,
    schedulePeriodId: string,
  ): Promise<(typeof shiftAssignments.$inferInsert)[]> {
    if (input.assignments.length === 0) {
      return [];
    }

    const shiftTypeIds = [
      ...new Set(input.assignments.map((assignment) => assignment.shiftTypeId)),
    ];
    const configuredShiftTypes = await transaction
      .select()
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.groupId, input.groupId),
          inArray(shiftTypes.id, shiftTypeIds),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .for('update');
    const shiftTypesById = new Map(
      configuredShiftTypes.map((shiftType) => [shiftType.id, shiftType]),
    );
    if (shiftTypesById.size !== shiftTypeIds.length) {
      throw validationError('A requested shift type does not belong to this active group.');
    }

    const membershipIds = getAffectedMembershipIds(input.assignments);
    const membersById = await this.readActiveMemberNames(transaction, input.groupId, membershipIds);
    if (membersById.size !== membershipIds.length) {
      throw validationError('A planned or actual member is not active in this group.');
    }

    return input.assignments.map((assignment) => {
      const shiftType = shiftTypesById.get(assignment.shiftTypeId);
      if (shiftType === undefined || shiftType.startTime === null || shiftType.endTime === null) {
        throw validationError('A shift assignment requires a configured shift type.');
      }
      if (shiftType.isEnabled !== 1) {
        throw validationError('Disabled shift types cannot be assigned to a new schedule period.');
      }

      const startTime = normalizeTime(shiftType.startTime);
      const endTime = normalizeTime(shiftType.endTime);
      const timeRange = toChinaStandardTimeShiftRange({
        businessDate: assignment.businessDate,
        crossesMidnight: shiftType.crossesMidnight === 1,
        endTime,
        startTime,
      });

      return {
        actualMemberName:
          assignment.actualMembershipId === undefined
            ? null
            : (membersById.get(assignment.actualMembershipId) ?? null),
        actualMembershipId: assignment.actualMembershipId ?? null,
        businessDate: timeRange.businessDate,
        countsTowardStatistics: shiftType.countsTowardStatistics,
        crossesMidnight: shiftType.crossesMidnight,
        endsAt: timeRange.endsAt,
        id: randomUUID(),
        isAllDay: shiftType.isAllDay,
        plannedMemberName:
          assignment.plannedMembershipId === undefined
            ? null
            : (membersById.get(assignment.plannedMembershipId) ?? null),
        plannedMembershipId: assignment.plannedMembershipId ?? null,
        schedulePeriodId,
        shiftEndTime: endTime,
        shiftStartTime: startTime,
        shiftTypeAbbreviation: shiftType.abbreviation,
        shiftTypeColor: shiftType.color,
        shiftTypeConfigurationVersion: shiftType.configurationVersion,
        shiftTypeId: shiftType.id,
        shiftTypeName: shiftType.name,
        shiftTypeTextColor: shiftType.textColor,
        slotPosition: assignment.slotPosition,
        startsAt: timeRange.startsAt,
      };
    });
  }

  private async softDeleteAssignments(
    transaction: DatabaseTransaction,
    schedulePeriodId: string,
  ): Promise<void> {
    const assignments = await transaction
      .select({ id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.schedulePeriodId, schedulePeriodId),
          isNull(shiftAssignments.deletedAt),
        ),
      );
    if (assignments.length === 0) {
      return;
    }

    await transaction
      .update(shiftAssignments)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        startsAt: sql`${shiftAssignments.startsAt}`,
        version: sql`${shiftAssignments.version} + 1`,
      })
      .where(
        inArray(
          shiftAssignments.id,
          assignments.map((assignment) => assignment.id),
        ),
      );
  }

  private async lockPeriodWithScope(
    transaction: DatabaseTransaction,
    schedulePeriodId: string,
  ): Promise<LockedSchedulePeriod> {
    const [unlockedPeriod] = await transaction
      .select({ groupId: schedulePeriods.groupId, scheduleRoleId: schedulePeriods.scheduleRoleId })
      .from(schedulePeriods)
      .where(and(eq(schedulePeriods.id, schedulePeriodId), isNull(schedulePeriods.deletedAt)))
      .limit(1);
    if (unlockedPeriod === undefined) {
      throw notFound('The schedule period was not found.');
    }

    await this.lockScheduleScope(
      transaction,
      unlockedPeriod.groupId,
      unlockedPeriod.scheduleRoleId,
    );
    const [period] = await transaction
      .select()
      .from(schedulePeriods)
      .where(and(eq(schedulePeriods.id, schedulePeriodId), isNull(schedulePeriods.deletedAt)))
      .limit(1)
      .for('update');
    if (period === undefined) {
      throw notFound('The schedule period was not found.');
    }

    return period;
  }

  private async lockScheduleScope(
    transaction: DatabaseTransaction,
    groupId: string,
    scheduleRoleId: string,
  ): Promise<{ readonly rulesVersion: number }> {
    const [scope] = await transaction
      .select({ rulesVersion: groups.rulesVersion })
      .from(scheduleRoles)
      .innerJoin(groups, eq(groups.id, scheduleRoles.groupId))
      .where(
        and(
          eq(scheduleRoles.id, scheduleRoleId),
          eq(scheduleRoles.groupId, groupId),
          isNull(scheduleRoles.deletedAt),
          isNull(groups.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (scope === undefined) {
      throw notFound('The schedule role was not found in this active group.');
    }

    return scope;
  }

  private async readActiveMemberNames(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (membershipIds.length === 0) {
      return new Map();
    }

    const members = await transaction
      .select({ id: groupMemberships.id, realName: userProfiles.realName })
      .from(groupMemberships)
      .innerJoin(userProfiles, eq(userProfiles.userId, groupMemberships.userId))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          inArray(groupMemberships.id, membershipIds),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .for('update');

    return new Map(members.map((member) => [member.id, member.realName]));
  }

  private async readPeriod(
    transaction: DatabaseTransaction,
    schedulePeriodId: string,
  ): Promise<SchedulePeriodRecord> {
    const [period] = await transaction
      .select()
      .from(schedulePeriods)
      .where(eq(schedulePeriods.id, schedulePeriodId))
      .limit(1);
    if (period === undefined) {
      throw notFound('The schedule period was not found.');
    }

    return toSchedulePeriodRecord(period);
  }
}

function toBusinessMonthStart(value: string): string {
  try {
    assertBusinessMonthContainsDate(value, `${value}-01`);
  } catch (error) {
    throw validationError(
      error instanceof Error ? error.message : 'The business month is invalid.',
    );
  }

  return `${value}-01`;
}

function validateAssignments(
  assignments: readonly CreateShiftAssignmentInput[],
  businessMonth: string,
): void {
  const slotKeys = new Set<string>();
  for (const assignment of assignments) {
    if (!Number.isInteger(assignment.slotPosition) || assignment.slotPosition < 1) {
      throw validationError('A shift assignment position must be a positive integer.');
    }
    try {
      assertBusinessMonthContainsDate(businessMonth.slice(0, 7), assignment.businessDate);
    } catch (error) {
      throw validationError(error instanceof Error ? error.message : 'The shift date is invalid.');
    }

    const slotKey = `${assignment.businessDate}:${assignment.shiftTypeId}:${assignment.slotPosition}`;
    if (slotKeys.has(slotKey)) {
      throw validationError('A schedule period cannot contain duplicate shift slots.');
    }
    slotKeys.add(slotKey);
  }
}

function getAffectedMembershipIds(assignments: readonly CreateShiftAssignmentInput[]): string[] {
  return [
    ...new Set(
      assignments.flatMap((assignment) =>
        [assignment.plannedMembershipId, assignment.actualMembershipId].filter(
          (membershipId): membershipId is string => membershipId !== undefined,
        ),
      ),
    ),
  ];
}

function assertExpectedPeriodVersion(period: LockedSchedulePeriod, expectedVersion: number): void {
  if (
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    period.version !== expectedVersion
  ) {
    assertVersionMatch({
      actualVersion: period.version,
      expectedVersion,
      id: period.id,
      latestData: { status: period.status },
      objectType: 'schedule_period',
      userMessage: 'The schedule period has changed. Refresh and try again.',
    });
  }
}

function assertExpectedRulesVersion(
  scope: { readonly rulesVersion: number },
  expectedRulesVersion: number | undefined,
): void {
  if (expectedRulesVersion !== undefined && scope.rulesVersion !== expectedRulesVersion) {
    throw new ApiError({
      code: 'CONFLICT',
      latestData: { rulesVersion: scope.rulesVersion },
      statusCode: 409,
      userMessage: '排班规则已更新，请刷新后重新生成。',
    });
  }
}

function assertTransition(from: SchedulePeriodStatus, to: SchedulePeriodStatus): void {
  if (!canTransitionSchedulePeriod(from, to)) {
    throw new ApiError({
      code: 'CONFLICT',
      statusCode: 409,
      userMessage: 'The schedule period is not in a state that allows this operation.',
    });
  }
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function toSchedulePeriodRecord(period: LockedSchedulePeriod): SchedulePeriodRecord {
  return {
    businessMonth: period.businessMonth,
    groupId: period.groupId,
    id: period.id,
    revision: period.revision,
    rulesVersion: period.rulesVersion,
    scheduleRoleId: period.scheduleRoleId,
    status: period.status,
    version: period.version,
    ...(period.publishedAt === null ? {} : { publishedAt: period.publishedAt.toISOString() }),
    ...(period.replacedByPeriodId === null
      ? {}
      : { replacedByPeriodId: period.replacedByPeriodId }),
    ...(period.withdrawnAt === null ? {} : { withdrawnAt: period.withdrawnAt.toISOString() }),
  };
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}

function notFound(userMessage: string): ApiError {
  return new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage });
}
