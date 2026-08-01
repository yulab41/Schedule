import { createHash } from 'node:crypto';

import type {
  GenerateSchedulePreviewRequest,
  GroupSchedulePublishMode,
  SaveGeneratedScheduleRequest,
  SavedScheduleGeneration,
  ScheduleGenerationConflict,
  ScheduleGenerationPreview,
  ScheduleGenerationRoleCount,
  ScheduleGenerationShiftTypeCount,
  ScheduleGenerationStatistics,
  ScheduleGenerationVacancy,
  ScheduleGenerationWarning,
  SchedulePeriodSummary,
  SchedulePreviewAssignment,
  SchedulePublishMode,
  UpdateGroupSchedulePublishModeRequest,
} from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  groupMemberships,
  groups,
  memberScheduleRoles,
  rotationMembers,
  rotationRules,
  scheduleRoles,
  shiftTypes,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import {
  assertBusinessMonthContainsDate,
  generateRotation,
  type GeneratedRotationAssignment,
  type RotationGenerationResult,
  type RotationMember,
  type RotationRule,
  type RotationShiftType,
} from '@schedule/scheduling-domain';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { EventWriter } from '../events/event-writer.js';
import { GroupPermissionService, type GroupAuthorization } from '../groups/permission-service.js';
import { withIdempotentOperation } from './idempotency.js';
import { toLatestData, toPeriodSummary } from './shared.js';
import { ScheduleRepository, type CreateShiftAssignmentInput } from './schedule-repository.js';

interface LoadedRole {
  readonly defaultShiftType: LoadedShiftType;
  readonly members: readonly LoadedMember[];
  readonly requiredMembersPerDay: number;
  readonly roleId: string;
  readonly roleName: string;
  readonly rotationRuleId: string;
  readonly startDate: string;
  readonly startingMemberScheduleRoleId: string | null;
}

interface LoadedMember {
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly isActive: boolean;
  readonly memberScheduleRoleId: string;
  readonly membershipId: string;
  readonly position: number;
  readonly realName: string;
}

interface LoadedShiftType {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime: string;
  readonly id: string;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime: string;
}

interface RotationMemberRow {
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

interface GenerationContext {
  readonly domainResult: RotationGenerationResult;
  readonly preview: ScheduleGenerationPreview;
}

interface MutableShiftTypeCount {
  assignmentCount: number;
  countedAssignmentCount: number;
  shiftTypeAbbreviation: string;
  shiftTypeId: string;
  shiftTypeName: string;
}

interface MutableRoleCount {
  assignmentCount: number;
  countedAssignmentCount: number;
  scheduleRoleId: string;
  scheduleRoleName: string;
  vacancyCount: number;
}

export class ScheduleGenerateService {
  private readonly eventWriter = new EventWriter();
  private readonly permissionService = new GroupPermissionService();

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly repository: ScheduleRepository,
  ) {}

  public async preview(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: GenerateSchedulePreviewRequest,
  ): Promise<ScheduleGenerationPreview> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const context = await this.loadGenerationContext(transaction, authorization, input);
      return context.preview;
    });
  }

  public async save(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: SaveGeneratedScheduleRequest,
  ): Promise<SavedScheduleGeneration> {
    return withTransaction(this.databaseClient, async (transaction) => {
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
          requestFingerprint: createGenerationFingerprint(authorization.group.id, input),
          scope: 'schedule_generation',
        },
        () => this.runGeneration(transaction, authorization, input),
      );
    });
  }

  public async getPublishMode(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupSchedulePublishMode> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return { publishMode: authorization.group.schedulePublishMode };
    });
  }

  public async updatePublishMode(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupSchedulePublishModeRequest,
  ): Promise<GroupSchedulePublishMode> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      await transaction
        .update(groups)
        .set({
          schedulePublishMode: input.publishMode,
          version: sql`${groups.version} + 1`,
        })
        .where(eq(groups.id, authorization.group.id));

      return { publishMode: input.publishMode };
    });
  }

  private async runGeneration(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: SaveGeneratedScheduleRequest,
  ): Promise<SavedScheduleGeneration> {
    const context = await this.loadGenerationContext(transaction, authorization, input);
    const publishMode = input.publishMode ?? authorization.group.schedulePublishMode;
    assertPublicationBlockers(context.preview, publishMode, input.acknowledgeBlockers === true);

    const assignmentsByRole = groupAssignmentsByRole(context.domainResult.assignments);
    const periods: SchedulePeriodSummary[] = [];
    for (const scheduleRoleId of [...assignmentsByRole.keys()].sort()) {
      const assignments = assignmentsByRole.get(scheduleRoleId);
      if (assignments === undefined) {
        continue;
      }
      const draft = await this.repository.createDraftInTransaction(transaction, {
        actorUserId: authorization.user.id,
        assignments,
        businessMonth: input.businessMonth,
        expectedRulesVersion: input.rulesVersion,
        groupId: authorization.group.id,
        operationId: input.operationId,
        scheduleRoleId,
      });
      const period =
        publishMode === 'published'
          ? await this.repository.publishInTransaction(transaction, {
              actorUserId: authorization.user.id,
              expectedVersion: draft.version,
              operationId: input.operationId,
              schedulePeriodId: draft.id,
            })
          : draft;
      periods.push(toPeriodSummary(period));
    }

    await this.eventWriter.append(transaction, {
      affectedMembershipIds: getAffectedMembershipIds(context.domainResult.assignments),
      afterData: toLatestData({
        businessMonth: input.businessMonth,
        publishMode,
        rulesVersion: input.rulesVersion,
        scheduleRoleIds: [...assignmentsByRole.keys()].sort(),
      }),
      eventStatus: 'completed',
      eventType: 'schedule_generation_completed',
      groupId: authorization.group.id,
      initiatedByUserId: authorization.user.id,
      objectType: 'schedule_generation',
      operationId: input.operationId,
      operatorUserId: authorization.user.id,
      ...(periods[0] === undefined
        ? {}
        : { objectId: periods[0].id, schedulePeriodId: periods[0].id }),
    });

    return {
      operationId: input.operationId,
      periods,
      preview: context.preview,
      publishMode,
      status: publishMode === 'published' ? 'published' : 'draft',
    };
  }

  private async loadGenerationContext(
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
    input: GenerateSchedulePreviewRequest,
  ): Promise<GenerationContext> {
    if (authorization.group.rulesVersion !== input.rulesVersion) {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { rulesVersion: authorization.group.rulesVersion },
        statusCode: 409,
        userMessage: '排班规则已更新，请刷新后重新生成。',
      });
    }

    const businessMonth = assertValidBusinessMonth(input.businessMonth);
    const scheduleRoleIds = [...new Set(input.scheduleRoleIds)].sort();
    const loadedRoles = await this.loadRotationRoles(
      transaction,
      authorization.group.id,
      scheduleRoleIds,
    );
    const monthStart = `${businessMonth}-01`;
    const monthEnd = getBusinessMonthEnd(businessMonth);
    const domainRules = loadedRoles.map((role) => toDomainRotationRule(role, monthStart));
    const domainResult = generateRotation({
      endDate: monthEnd,
      rules: domainRules,
      startDate: monthStart,
    });

    return {
      domainResult,
      preview: buildPreview(domainResult, businessMonth, input.rulesVersion, loadedRoles),
    };
  }

  private async loadRotationRoles(
    transaction: DatabaseTransaction,
    groupId: string,
    scheduleRoleIds: readonly string[],
  ): Promise<LoadedRole[]> {
    const roles = await transaction
      .select({
        defaultShiftTypeId: rotationRules.defaultShiftTypeId,
        id: scheduleRoles.id,
        name: scheduleRoles.name,
        requiredMembersPerDay: rotationRules.requiredMembersPerDay,
        rotationRuleId: rotationRules.id,
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
      )
      .orderBy(asc(scheduleRoles.name), asc(scheduleRoles.id));

    if (roles.length !== scheduleRoleIds.length) {
      throw notFound('部分排班角色不存在或不可用。');
    }

    const defaultShiftTypeIds = [...new Set(roles.map((role) => role.defaultShiftTypeId))];
    const configuredShiftTypes = await transaction
      .select()
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.groupId, groupId),
          inArray(shiftTypes.id, defaultShiftTypeIds),
          isNull(shiftTypes.deletedAt),
        ),
      );
    const shiftTypesById = new Map(
      configuredShiftTypes.map((shiftType) => [shiftType.id, shiftType]),
    );
    if (shiftTypesById.size !== defaultShiftTypeIds.length) {
      throw validationError('排班角色缺少有效的默认班种配置。');
    }

    const memberRows = await this.loadRotationMembers(
      transaction,
      roles.map((role) => role.rotationRuleId),
    );
    const membersByRuleId = new Map<string, LoadedMember[]>();
    for (const memberRow of memberRows) {
      const loadedMember = toLoadedMember(memberRow);
      const members = membersByRuleId.get(memberRow.rotationRuleId) ?? [];
      members.push(loadedMember);
      membersByRuleId.set(memberRow.rotationRuleId, members);
    }

    return roles.map((role) => {
      const shiftType = shiftTypesById.get(role.defaultShiftTypeId);
      if (
        shiftType === undefined ||
        shiftType.startTime === null ||
        shiftType.endTime === null ||
        shiftType.isEnabled !== 1
      ) {
        throw validationError(`排班角色“${role.name}”必须使用本群组已启用的班种。`);
      }
      if (role.startDate === null) {
        throw validationError(`排班角色“${role.name}”尚未配置轮值起始日期。`);
      }

      return {
        defaultShiftType: {
          abbreviation: shiftType.abbreviation,
          color: shiftType.color,
          countsTowardStatistics: shiftType.countsTowardStatistics === 1,
          crossesMidnight: shiftType.crossesMidnight === 1,
          endTime: normalizeTime(shiftType.endTime),
          id: shiftType.id,
          isEnabled: true,
          name: shiftType.name,
          startTime: normalizeTime(shiftType.startTime),
        },
        members: membersByRuleId.get(role.rotationRuleId) ?? [],
        requiredMembersPerDay: role.requiredMembersPerDay,
        roleId: role.id,
        roleName: role.name,
        rotationRuleId: role.rotationRuleId,
        startDate: role.startDate,
        startingMemberScheduleRoleId: role.startingMemberScheduleRoleId,
      };
    });
  }

  private async loadRotationMembers(
    transaction: DatabaseTransaction,
    rotationRuleIds: readonly string[],
  ): Promise<RotationMemberRow[]> {
    if (rotationRuleIds.length === 0) {
      return [];
    }

    return transaction
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
  }
}

function assertPublicationBlockers(
  preview: ScheduleGenerationPreview,
  publishMode: SchedulePublishMode,
  acknowledged: boolean,
): void {
  const hasBlockers = preview.hardConflicts.length > 0 || preview.vacancies.length > 0;
  if (publishMode === 'published' && hasBlockers && !acknowledged) {
    throw new ApiError({
      code: 'CONFLICT',
      latestData: toLatestData({ preview }),
      statusCode: 409,
      userMessage: '生成结果包含硬冲突或待处理空缺，确认后才能发布。',
    });
  }
}

function createGenerationFingerprint(groupId: string, input: SaveGeneratedScheduleRequest): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        acknowledgeBlockers: input.acknowledgeBlockers === true,
        businessMonth: input.businessMonth,
        groupId,
        publishMode: input.publishMode ?? null,
        rulesVersion: input.rulesVersion,
        scheduleRoleIds: [...new Set(input.scheduleRoleIds)].sort(),
      }),
    )
    .digest('hex');
}

function groupAssignmentsByRole(
  assignments: readonly GeneratedRotationAssignment[],
): ReadonlyMap<string, CreateShiftAssignmentInput[]> {
  const assignmentsByRole = new Map<string, CreateShiftAssignmentInput[]>();
  for (const assignment of assignments) {
    const inputs = assignmentsByRole.get(assignment.scheduleRoleId) ?? [];
    inputs.push({
      businessDate: assignment.businessDate,
      shiftTypeId: assignment.shiftTypeId,
      slotPosition: assignment.slotPosition,
      ...(assignment.plannedMembershipId === null
        ? {}
        : { plannedMembershipId: assignment.plannedMembershipId }),
    });
    assignmentsByRole.set(assignment.scheduleRoleId, inputs);
  }

  return assignmentsByRole;
}

function buildPreview(
  result: RotationGenerationResult,
  businessMonth: string,
  rulesVersion: number,
  roles: readonly LoadedRole[],
): ScheduleGenerationPreview {
  const rolesById = new Map(roles.map((role) => [role.roleId, role]));
  const memberNamesById = new Map(
    roles.flatMap((role) =>
      role.members.map((member) => [member.membershipId, member.realName] as const),
    ),
  );

  return {
    assignments: result.assignments.map((assignment) =>
      toPreviewAssignment(assignment, rolesById, memberNamesById),
    ),
    businessMonth,
    continuousDutyWarnings: result.continuousDutyWarnings.map(
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
    hardConflicts: result.hardConflicts.map((conflict): ScheduleGenerationConflict => {
      const memberName = memberNamesById.get(conflict.membershipId);
      return {
        assignmentBusinessKeys: conflict.assignmentBusinessKeys,
        code: conflict.code,
        membershipId: conflict.membershipId,
        ...(memberName === undefined ? {} : { memberName }),
      };
    }),
    rulesVersion,
    scheduleRoleIds: [
      ...new Set(result.assignments.map((assignment) => assignment.scheduleRoleId)),
    ].sort(),
    statistics: buildStatistics(result, rolesById),
    vacancies: result.vacancies.map((vacancy): ScheduleGenerationVacancy => ({
      assignmentBusinessKey: vacancy.assignmentBusinessKey,
      businessDate: vacancy.businessDate,
      code: vacancy.code,
      scheduleRoleId: vacancy.scheduleRoleId,
      slotPosition: vacancy.slotPosition,
    })),
  };
}

function buildStatistics(
  result: RotationGenerationResult,
  rolesById: ReadonlyMap<string, LoadedRole>,
): ScheduleGenerationStatistics {
  const shiftTypeCounts = new Map<string, MutableShiftTypeCount>();
  const roleCounts = new Map<string, MutableRoleCount>();
  let countedAssignmentCount = 0;

  for (const assignment of result.assignments) {
    const role = rolesById.get(assignment.scheduleRoleId);
    if (role === undefined) {
      continue;
    }
    const shiftType = role.defaultShiftType;
    const counted = shiftType.countsTowardStatistics ? 1 : 0;
    countedAssignmentCount += counted;

    const shiftTypeCount = shiftTypeCounts.get(shiftType.id) ?? {
      assignmentCount: 0,
      countedAssignmentCount: 0,
      shiftTypeAbbreviation: shiftType.abbreviation,
      shiftTypeId: shiftType.id,
      shiftTypeName: shiftType.name,
    };
    shiftTypeCount.assignmentCount += 1;
    shiftTypeCount.countedAssignmentCount += counted;
    shiftTypeCounts.set(shiftType.id, shiftTypeCount);

    const roleCount = roleCounts.get(role.roleId) ?? {
      assignmentCount: 0,
      countedAssignmentCount: 0,
      scheduleRoleId: role.roleId,
      scheduleRoleName: role.roleName,
      vacancyCount: 0,
    };
    roleCount.assignmentCount += 1;
    roleCount.countedAssignmentCount += counted;
    roleCounts.set(role.roleId, roleCount);
  }

  for (const vacancy of result.vacancies) {
    const roleCount = roleCounts.get(vacancy.scheduleRoleId);
    if (roleCount !== undefined) {
      roleCount.vacancyCount += 1;
    }
  }

  return {
    assignmentCount: result.assignments.length,
    byRole: [...roleCounts.values()].map((roleCount): ScheduleGenerationRoleCount => ({
      assignmentCount: roleCount.assignmentCount,
      countedAssignmentCount: roleCount.countedAssignmentCount,
      scheduleRoleId: roleCount.scheduleRoleId,
      scheduleRoleName: roleCount.scheduleRoleName,
      vacancyCount: roleCount.vacancyCount,
    })),
    byShiftType: [...shiftTypeCounts.values()].map(
      (shiftTypeCount): ScheduleGenerationShiftTypeCount => ({
        assignmentCount: shiftTypeCount.assignmentCount,
        countedAssignmentCount: shiftTypeCount.countedAssignmentCount,
        shiftTypeAbbreviation: shiftTypeCount.shiftTypeAbbreviation,
        shiftTypeId: shiftTypeCount.shiftTypeId,
        shiftTypeName: shiftTypeCount.shiftTypeName,
      }),
    ),
    countedAssignmentCount,
    vacancyCount: result.vacancies.length,
  };
}

function toPreviewAssignment(
  assignment: GeneratedRotationAssignment,
  rolesById: ReadonlyMap<string, LoadedRole>,
  memberNamesById: ReadonlyMap<string, string>,
): SchedulePreviewAssignment {
  const role = rolesById.get(assignment.scheduleRoleId);
  if (role === undefined) {
    throw new Error('The generated assignment references an unknown schedule role.');
  }
  const shiftType = role.defaultShiftType;
  const memberName =
    assignment.plannedMembershipId === null
      ? undefined
      : memberNamesById.get(assignment.plannedMembershipId);

  return {
    businessDate: assignment.businessDate,
    endsAt: assignment.endsAt.toISOString(),
    ...(assignment.plannedMembershipId === null
      ? {}
      : { plannedMemberId: assignment.plannedMembershipId }),
    ...(memberName === undefined ? {} : { plannedMemberName: memberName }),
    scheduleRoleId: assignment.scheduleRoleId,
    scheduleRoleName: role.roleName,
    shiftTypeAbbreviation: shiftType.abbreviation,
    shiftTypeColor: shiftType.color,
    shiftTypeId: assignment.shiftTypeId,
    shiftTypeName: shiftType.name,
    slotPosition: assignment.slotPosition,
    startsAt: assignment.startsAt.toISOString(),
  };
}

function toLoadedMember(memberRow: RotationMemberRow): LoadedMember {
  return {
    ...(memberRow.effectiveFrom === null ? {} : { effectiveFrom: memberRow.effectiveFrom }),
    ...(memberRow.effectiveTo === null ? {} : { effectiveTo: memberRow.effectiveTo }),
    isActive:
      memberRow.membershipStatus === 'active' &&
      memberRow.userStatus === 'active' &&
      memberRow.memberScheduleRoleDeletedAt === null &&
      memberRow.membershipDeletedAt === null &&
      memberRow.userDeletedAt === null,
    memberScheduleRoleId: memberRow.memberScheduleRoleId,
    membershipId: memberRow.membershipId,
    position: memberRow.position,
    realName: memberRow.realName,
  };
}

function toDomainRotationRule(role: LoadedRole, monthStart: string): RotationRule {
  if (role.members.length > 0) {
    if (role.startDate > monthStart) {
      throw validationError(`排班角色“${role.roleName}”的轮值起始日期晚于生成月份。`);
    }
    if (role.startingMemberScheduleRoleId === null) {
      throw validationError(`排班角色“${role.roleName}”尚未配置轮值起始成员。`);
    }
  }
  const startingMember = role.members.find(
    (member) => member.memberScheduleRoleId === role.startingMemberScheduleRoleId,
  );
  if (role.members.length > 0 && startingMember === undefined) {
    throw validationError(`排班角色“${role.roleName}”的轮值起始成员无效。`);
  }

  return {
    defaultShiftType: toDomainShiftType(role.defaultShiftType),
    members: role.members.map(toDomainMember),
    requiredMembersPerDay: role.requiredMembersPerDay,
    rotationStartDate: role.startDate,
    scheduleRoleId: role.roleId,
    ...(startingMember === undefined ? {} : { startingMembershipId: startingMember.membershipId }),
  };
}

function toDomainMember(member: LoadedMember): RotationMember {
  return {
    ...(member.effectiveFrom === undefined ? {} : { effectiveFrom: member.effectiveFrom }),
    ...(member.effectiveTo === undefined ? {} : { effectiveTo: member.effectiveTo }),
    isActive: member.isActive,
    membershipId: member.membershipId,
    position: member.position,
  };
}

function toDomainShiftType(shiftType: LoadedShiftType): RotationShiftType {
  return {
    crossesMidnight: shiftType.crossesMidnight,
    endTime: shiftType.endTime,
    id: shiftType.id,
    isEnabled: shiftType.isEnabled,
    startTime: shiftType.startTime,
  };
}

function getAffectedMembershipIds(
  assignments: readonly GeneratedRotationAssignment[],
): readonly string[] {
  return [
    ...new Set(
      assignments.flatMap((assignment) =>
        assignment.plannedMembershipId === null ? [] : [assignment.plannedMembershipId],
      ),
    ),
  ];
}

function assertValidBusinessMonth(businessMonth: string): string {
  try {
    assertBusinessMonthContainsDate(businessMonth, `${businessMonth}-01`);
  } catch (error) {
    throw validationError(error instanceof Error ? error.message : '生成月份格式无效。');
  }

  return businessMonth;
}

function getBusinessMonthEnd(businessMonth: string): string {
  const [yearText = '', monthText = ''] = businessMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${businessMonth}-${String(lastDay).padStart(2, '0')}`;
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}

function notFound(userMessage: string): ApiError {
  return new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage });
}
