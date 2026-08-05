import { randomUUID } from 'node:crypto';

import type {
  PastScheduleAssignment,
  PastSchedulePeriod,
  UpdatePastScheduleAssignmentInput,
  UpdatePastScheduleAssignmentResult,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
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
import { and, asc, desc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { EventWriter } from '../events/event-writer.js';
import { GroupPermissionService, type GroupAuthorization } from '../groups/permission-service.js';
import { StatisticsService } from '../statistics/statistics-service.js';

export class PastScheduleService {
  private readonly eventWriter = new EventWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly statisticsService: StatisticsService;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.statisticsService = new StatisticsService(this.databaseClient);
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

      const before = {
        actualMemberId: assignment.actualMembershipId,
        actualMemberName: assignment.actualMemberName,
        shiftTypeId: assignment.shiftTypeId,
      };
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

      await transaction
        .update(shiftAssignments)
        .set({
          actualMembershipId: nextAssignment.actualMemberId,
          actualMemberName: nextAssignment.actualMemberName,
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

      const affectedMembershipIds = [
        ...new Set(
          [before.actualMemberId, nextActualMemberId].filter(
            (membershipId): membershipId is string => membershipId !== null,
          ),
        ),
      ];
      const eventId = await this.eventWriter.append(transaction, {
        affectedMembershipIds,
        affectedShiftIds: [assignment.id],
        afterData: {
          actualMemberId: nextActualMemberId,
          actualMemberName: nextActualMemberName,
          assignmentId: assignment.id,
          businessDate: assignment.businessDate,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          shiftTypeId: nextAssignment.shiftTypeId,
          source: 'schedule_backfill',
        },
        beforeData: {
          actualMemberId: before.actualMemberId,
          actualMemberName: before.actualMemberName,
          shiftTypeId: before.shiftTypeId,
        },
        eventStatus: 'completed',
        eventType: 'schedule_backfill_completed',
        groupId: authorization.group.id,
        initiatedByUserId: authorization.user.id,
        objectId: assignment.id,
        objectType: 'shift_assignment',
        operationId: randomUUID(),
        operatorUserId: authorization.user.id,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        schedulePeriodId: period.id,
      });
      await this.statisticsService.refreshInTransaction(
        transaction,
        authorization.group.id,
        `${assignment.businessDate.slice(0, 7)}-01`,
      );

      return { assignment: toPastScheduleAssignment(updated), eventId };
    });
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
