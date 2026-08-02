import { randomUUID } from 'node:crypto';

import type {
  CreateScheduleRoleRequest,
  CreateShiftTypeRequest,
  ReorderRotationMembersRequest,
  ReplaceScheduleRoleMembersRequest,
  RotationRule,
  ScheduleRole,
  SchedulingConfig,
  ShiftType,
  ShiftTypeInput,
  UpdateRotationRuleRequest,
  UpdateShiftTypeRequest,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  groupMemberships,
  groups,
  manualScheduleTemplates,
  memberScheduleRoles,
  rotationMembers,
  rotationRules,
  schedulePeriods,
  scheduleRoles,
  shiftTypes,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { calculateReadableTextColor } from '@schedule/scheduling-domain';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from '../groups/permission-service.js';

const allDayTemplateKey = 'all_day';
const positionOffset = 1_000_000;

const defaultShiftTypeTemplates = [
  {
    abbreviation: '全天',
    color: '#1F5AA6',
    countsTowardStatistics: 1,
    crossesMidnight: 1,
    displayOrder: 1,
    endTime: '08:00',
    isAllDay: 1,
    isEnabled: 1,
    name: '全天班',
    startTime: '08:00',
    templateKey: allDayTemplateKey,
  },
  {
    abbreviation: 'A',
    color: '#0F766E',
    countsTowardStatistics: 1,
    crossesMidnight: 0,
    displayOrder: 2,
    isAllDay: 0,
    isEnabled: 0,
    name: 'A 班',
    templateKey: 'a',
  },
  {
    abbreviation: 'N',
    color: '#4C1D95',
    countsTowardStatistics: 1,
    crossesMidnight: 0,
    displayOrder: 3,
    isAllDay: 0,
    isEnabled: 0,
    name: 'N 班',
    templateKey: 'n',
  },
  {
    abbreviation: 'P',
    color: '#C2410C',
    countsTowardStatistics: 1,
    crossesMidnight: 0,
    displayOrder: 4,
    isAllDay: 0,
    isEnabled: 0,
    name: 'P 班',
    templateKey: 'p',
  },
  {
    abbreviation: 'NP',
    color: '#9F1239',
    countsTowardStatistics: 1,
    crossesMidnight: 0,
    displayOrder: 5,
    isAllDay: 0,
    isEnabled: 0,
    name: 'NP 班',
    templateKey: 'np',
  },
  {
    abbreviation: '办公',
    color: '#475569',
    countsTowardStatistics: 0,
    crossesMidnight: 0,
    displayOrder: 6,
    isAllDay: 0,
    isEnabled: 0,
    name: '办公班',
    templateKey: 'office',
  },
] as const;

export async function createDefaultShiftTypes(
  transaction: DatabaseTransaction,
  groupId: string,
): Promise<void> {
  await transaction.insert(shiftTypes).values(
    defaultShiftTypeTemplates.map((template) => ({
      ...template,
      id: randomUUID(),
      groupId,
      textColor: calculateReadableTextColor(template.color),
    })),
  );
}

export class SchedulingConfigService {
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async getConfig(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<SchedulingConfig> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return this.readConfig(transaction, authorization.group.id, authorization.group.rulesVersion);
    });
  }

  public async createRole(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateScheduleRoleRequest,
  ): Promise<ScheduleRole> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const defaultShiftType = await this.getEnabledAllDayShiftForUpdate(
        transaction,
        authorization.group.id,
      );
      const roleId = randomUUID();
      await transaction.insert(scheduleRoles).values({
        groupId: authorization.group.id,
        id: roleId,
        name: input.name,
      });
      await transaction.insert(rotationRules).values({
        defaultShiftTypeId: defaultShiftType.id,
        id: randomUUID(),
        scheduleRoleId: roleId,
      });
      await this.bumpGroupRulesVersion(transaction, authorization.group.id);

      return this.readRole(transaction, roleId);
    });
  }

  public async replaceRoleMembers(
    identity: AuthenticatedIdentity,
    groupId: string,
    roleId: string,
    input: ReplaceScheduleRoleMembersRequest,
  ): Promise<ScheduleRole> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const role = await this.getRoleForUpdate(transaction, authorization.group.id, roleId);
      const rule = await this.getRuleForUpdate(transaction, role.id);
      await this.requireActiveGroupMemberships(
        transaction,
        authorization.group.id,
        input.membershipIds,
      );

      const existingMembers = await transaction
        .select({ id: memberScheduleRoles.id, membershipId: memberScheduleRoles.membershipId })
        .from(memberScheduleRoles)
        .where(
          and(
            eq(memberScheduleRoles.scheduleRoleId, role.id),
            isNull(memberScheduleRoles.deletedAt),
          ),
        )
        .for('update');
      const existingByMembershipId = new Map(
        existingMembers.map((member) => [member.membershipId, member]),
      );
      const requestedMembershipIds = new Set(input.membershipIds);
      const removedMembers = existingMembers.filter(
        (member) => !requestedMembershipIds.has(member.membershipId),
      );
      const newMembershipIds = input.membershipIds.filter(
        (membershipId) => !existingByMembershipId.has(membershipId),
      );

      if (newMembershipIds.length > 0) {
        await transaction.insert(memberScheduleRoles).values(
          newMembershipIds.map((membershipId) => ({
            id: randomUUID(),
            membershipId,
            scheduleRoleId: role.id,
          })),
        );
      }

      const activeMembers = await transaction
        .select({ id: memberScheduleRoles.id, membershipId: memberScheduleRoles.membershipId })
        .from(memberScheduleRoles)
        .where(
          and(
            eq(memberScheduleRoles.scheduleRoleId, role.id),
            isNull(memberScheduleRoles.deletedAt),
          ),
        )
        .for('update');
      const activeMembersByMembershipId = new Map(
        activeMembers.map((member) => [member.membershipId, member]),
      );
      const activeRotations = await this.getActiveRotationsForUpdate(transaction, rule.id);
      const activeRotationByMemberId = new Map(
        activeRotations.map((rotation) => [rotation.memberScheduleRoleId, rotation]),
      );
      const orderedExistingMemberIds = activeRotations
        .sort((first, second) => first.position - second.position)
        .map((rotation) => rotation.memberScheduleRoleId)
        .filter((memberId) =>
          Array.from(activeMembersByMembershipId.values()).some(
            (member) => member.id === memberId && requestedMembershipIds.has(member.membershipId),
          ),
        );
      const desiredMemberIds = [
        ...orderedExistingMemberIds,
        ...input.membershipIds
          .map((membershipId) => activeMembersByMembershipId.get(membershipId)?.id)
          .filter(
            (memberId): memberId is string =>
              memberId !== undefined && !activeRotationByMemberId.has(memberId),
          ),
      ];

      await this.persistRotationOrder(transaction, rule, desiredMemberIds, activeRotations);

      if (removedMembers.length > 0) {
        const removedMemberIds = new Set(removedMembers.map((member) => member.id));
        await transaction
          .update(memberScheduleRoles)
          .set({
            deletedAt: sql`current_timestamp(3)`,
            version: sql`${memberScheduleRoles.version} + 1`,
          })
          .where(
            and(
              eq(memberScheduleRoles.scheduleRoleId, role.id),
              inArray(memberScheduleRoles.id, [...removedMemberIds]),
              isNull(memberScheduleRoles.deletedAt),
            ),
          );
        await this.clearRemovedMemberFromRotationRule(transaction, rule, role.id, removedMemberIds);
      }

      await this.bumpGroupRulesVersion(transaction, authorization.group.id);
      return this.readRole(transaction, role.id);
    });
  }

  public async deleteRole(
    identity: AuthenticatedIdentity,
    groupId: string,
    roleId: string,
  ): Promise<void> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const role = await this.getRoleForUpdate(transaction, authorization.group.id, roleId);

      const usedPeriod = await transaction
        .select({ id: schedulePeriods.id })
        .from(schedulePeriods)
        .where(eq(schedulePeriods.scheduleRoleId, role.id))
        .limit(1);
      if (usedPeriod[0] !== undefined) {
        throw validationError('该排班岗位已用于排班，为保留历史数据不能删除。');
      }

      const usedTemplate = await transaction
        .select({ id: manualScheduleTemplates.id })
        .from(manualScheduleTemplates)
        .where(
          and(
            eq(manualScheduleTemplates.scheduleRoleId, role.id),
            isNull(manualScheduleTemplates.deletedAt),
          ),
        )
        .limit(1);
      if (usedTemplate[0] !== undefined) {
        throw validationError('该排班岗位仍被手动排班模板使用，请先删除相关模板。');
      }

      const rule = await this.getRuleForUpdate(transaction, role.id);
      await Promise.all([
        transaction
          .update(memberScheduleRoles)
          .set({
            deletedAt: sql`current_timestamp(3)`,
            version: sql`${memberScheduleRoles.version} + 1`,
          })
          .where(
            and(
              eq(memberScheduleRoles.scheduleRoleId, role.id),
              isNull(memberScheduleRoles.deletedAt),
            ),
          ),
        transaction
          .update(rotationMembers)
          .set({
            deletedAt: sql`current_timestamp(3)`,
            version: sql`${rotationMembers.version} + 1`,
          })
          .where(
            and(eq(rotationMembers.rotationRuleId, rule.id), isNull(rotationMembers.deletedAt)),
          ),
        transaction
          .update(rotationRules)
          .set({
            deletedAt: sql`current_timestamp(3)`,
            version: sql`${rotationRules.version} + 1`,
          })
          .where(and(eq(rotationRules.scheduleRoleId, role.id), isNull(rotationRules.deletedAt))),
        transaction
          .update(scheduleRoles)
          .set({
            deletedAt: sql`current_timestamp(3)`,
            version: sql`${scheduleRoles.version} + 1`,
          })
          .where(eq(scheduleRoles.id, role.id)),
      ]);
      await this.bumpGroupRulesVersion(transaction, authorization.group.id);
    });
  }

  public async reorderRotationMembers(
    identity: AuthenticatedIdentity,
    groupId: string,
    roleId: string,
    input: ReorderRotationMembersRequest,
  ): Promise<ScheduleRole> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const role = await this.getRoleForUpdate(transaction, authorization.group.id, roleId);
      const rule = await this.getRuleForUpdate(transaction, role.id);
      const activeMembers = await transaction
        .select({ id: memberScheduleRoles.id })
        .from(memberScheduleRoles)
        .where(
          and(
            eq(memberScheduleRoles.scheduleRoleId, role.id),
            isNull(memberScheduleRoles.deletedAt),
          ),
        )
        .for('update');
      const activeMemberIds = new Set(activeMembers.map((member) => member.id));
      const orderedEntries = [...input.members].sort(
        (first, second) => first.position - second.position,
      );

      if (
        orderedEntries.length !== activeMemberIds.size ||
        new Set(orderedEntries.map((member) => member.scheduleRoleMemberId)).size !==
          activeMemberIds.size ||
        orderedEntries.some(
          (member, index) =>
            member.position !== index + 1 || !activeMemberIds.has(member.scheduleRoleMemberId),
        )
      ) {
        throw validationError('轮值顺序必须包含角色中的每位成员，并从 1 开始连续编号。');
      }

      await this.persistRotationOrder(
        transaction,
        rule,
        orderedEntries.map((member) => member.scheduleRoleMemberId),
      );
      await this.bumpGroupRulesVersion(transaction, authorization.group.id);
      return this.readRole(transaction, role.id);
    });
  }

  public async updateRotationRule(
    identity: AuthenticatedIdentity,
    groupId: string,
    roleId: string,
    input: UpdateRotationRuleRequest,
  ): Promise<ScheduleRole> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const role = await this.getRoleForUpdate(transaction, authorization.group.id, roleId);
      const rule = await this.getRuleForUpdate(transaction, role.id);
      await this.getEnabledShiftTypeForUpdate(
        transaction,
        authorization.group.id,
        input.defaultShiftTypeId,
      );
      const members = await transaction
        .select({ id: memberScheduleRoles.id })
        .from(memberScheduleRoles)
        .where(
          and(
            eq(memberScheduleRoles.scheduleRoleId, role.id),
            isNull(memberScheduleRoles.deletedAt),
          ),
        )
        .for('update');
      const memberIds = new Set(members.map((member) => member.id));
      const startingMemberScheduleRoleId = input.startingMemberScheduleRoleId ?? null;

      if (startingMemberScheduleRoleId !== null && !memberIds.has(startingMemberScheduleRoleId)) {
        throw validationError('轮值起始成员必须属于该排班角色。');
      }

      if (
        members.length === 0 ? input.currentPosition !== 1 : input.currentPosition > members.length
      ) {
        throw validationError('当前轮值游标必须在已配置成员的连续顺序内。');
      }

      await transaction
        .update(rotationRules)
        .set({
          currentPosition: input.currentPosition,
          defaultShiftTypeId: input.defaultShiftTypeId,
          requiredMembersPerDay: input.requiredMembersPerDay,
          startDate: input.startDate ?? null,
          startingMemberScheduleRoleId,
          version: sql`${rotationRules.version} + 1`,
        })
        .where(eq(rotationRules.id, rule.id));
      await this.bumpGroupRulesVersion(transaction, authorization.group.id);
      return this.readRole(transaction, role.id);
    });
  }

  public async createShiftType(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateShiftTypeRequest,
  ): Promise<ShiftType> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const normalized = normalizeShiftTypeInput(input);
      validateShiftTypeInput(normalized);
      const [lastShiftType] = await transaction
        .select({ displayOrder: shiftTypes.displayOrder })
        .from(shiftTypes)
        .where(and(eq(shiftTypes.groupId, authorization.group.id), isNull(shiftTypes.deletedAt)))
        .orderBy(sql`${shiftTypes.displayOrder} desc`)
        .limit(1)
        .for('update');
      const shiftTypeId = randomUUID();
      await transaction.insert(shiftTypes).values({
        ...normalized,
        displayOrder: (lastShiftType?.displayOrder ?? 0) + 1,
        groupId: authorization.group.id,
        id: shiftTypeId,
        isAllDay: 0,
        templateKey: null,
        textColor: calculateReadableTextColor(normalized.color),
      });
      await this.bumpGroupRulesVersion(transaction, authorization.group.id);
      return this.readShiftType(transaction, shiftTypeId);
    });
  }

  public async updateShiftType(
    identity: AuthenticatedIdentity,
    groupId: string,
    shiftTypeId: string,
    input: UpdateShiftTypeRequest,
  ): Promise<ShiftType> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const existing = await this.getShiftTypeForUpdate(
        transaction,
        authorization.group.id,
        shiftTypeId,
      );
      const isAllDay = existing.isAllDay === 1;
      const normalized = normalizeShiftTypeInput(input, isAllDay);
      validateShiftTypeInput(normalized, isAllDay);

      if (existing.isAllDay === 1 && !normalized.isEnabled) {
        throw validationError('全天班是群组的固定默认班种，不能停用。');
      }

      if (existing.isEnabled === 1 && !normalized.isEnabled) {
        const [ruleUsingShiftType] = await transaction
          .select({ id: rotationRules.id })
          .from(rotationRules)
          .innerJoin(scheduleRoles, eq(scheduleRoles.id, rotationRules.scheduleRoleId))
          .where(
            and(
              eq(rotationRules.defaultShiftTypeId, existing.id),
              isNull(rotationRules.deletedAt),
              isNull(scheduleRoles.deletedAt),
            ),
          )
          .limit(1)
          .for('update');

        if (ruleUsingShiftType !== undefined) {
          throw new ApiError({
            code: 'CONFLICT',
            statusCode: 409,
            userMessage: '该班种仍被轮值规则使用，请先为相关角色选择其他启用班种。',
          });
        }
      }

      await transaction
        .update(shiftTypes)
        .set({
          ...normalized,
          configurationVersion: sql`${shiftTypes.configurationVersion} + 1`,
          textColor: calculateReadableTextColor(normalized.color),
          version: sql`${shiftTypes.version} + 1`,
        })
        .where(eq(shiftTypes.id, existing.id));
      await this.bumpGroupRulesVersion(transaction, authorization.group.id);
      return this.readShiftType(transaction, existing.id);
    });
  }

  private async readConfig(
    transaction: DatabaseTransaction,
    groupId: string,
    rulesVersion: number,
  ): Promise<SchedulingConfig> {
    const [groupMembers, roles, configuredShiftTypes] = await Promise.all([
      transaction
        .select({ membershipId: groupMemberships.id, realName: userProfiles.realName })
        .from(groupMemberships)
        .innerJoin(users, eq(users.id, groupMemberships.userId))
        .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(
          and(
            eq(groupMemberships.groupId, groupId),
            eq(groupMemberships.status, 'active'),
            eq(users.status, 'active'),
            isNull(groupMemberships.deletedAt),
            isNull(users.deletedAt),
            isNull(userProfiles.deletedAt),
          ),
        )
        .orderBy(asc(userProfiles.realName), asc(groupMemberships.id)),
      transaction
        .select({ id: scheduleRoles.id })
        .from(scheduleRoles)
        .where(and(eq(scheduleRoles.groupId, groupId), isNull(scheduleRoles.deletedAt)))
        .orderBy(asc(scheduleRoles.name), asc(scheduleRoles.id)),
      transaction
        .select()
        .from(shiftTypes)
        .where(and(eq(shiftTypes.groupId, groupId), isNull(shiftTypes.deletedAt)))
        .orderBy(asc(shiftTypes.displayOrder), asc(shiftTypes.id)),
    ]);

    return {
      groupMembers,
      roles: await Promise.all(roles.map((role) => this.readRole(transaction, role.id))),
      rulesVersion,
      shiftTypes: configuredShiftTypes.map(toShiftType),
    };
  }

  private async readRole(transaction: DatabaseTransaction, roleId: string): Promise<ScheduleRole> {
    const [role] = await transaction
      .select({ id: scheduleRoles.id, name: scheduleRoles.name, version: scheduleRoles.version })
      .from(scheduleRoles)
      .where(and(eq(scheduleRoles.id, roleId), isNull(scheduleRoles.deletedAt)))
      .limit(1);
    const [rule] = await transaction
      .select({
        currentPosition: rotationRules.currentPosition,
        defaultShiftTypeId: rotationRules.defaultShiftTypeId,
        id: rotationRules.id,
        requiredMembersPerDay: rotationRules.requiredMembersPerDay,
        startDate: rotationRules.startDate,
        startingMemberScheduleRoleId: rotationRules.startingMemberScheduleRoleId,
        version: rotationRules.version,
      })
      .from(rotationRules)
      .where(and(eq(rotationRules.scheduleRoleId, roleId), isNull(rotationRules.deletedAt)))
      .limit(1);

    if (role === undefined || rule === undefined) {
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        userMessage: '排班角色配置暂时无法读取，请稍后重试。',
      });
    }

    const members = await transaction
      .select({
        id: memberScheduleRoles.id,
        membershipId: memberScheduleRoles.membershipId,
        position: rotationMembers.position,
        realName: userProfiles.realName,
        version: memberScheduleRoles.version,
      })
      .from(memberScheduleRoles)
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(
        rotationMembers,
        and(
          eq(rotationMembers.memberScheduleRoleId, memberScheduleRoles.id),
          eq(rotationMembers.rotationRuleId, rule.id),
          isNull(rotationMembers.deletedAt),
        ),
      )
      .where(
        and(
          eq(memberScheduleRoles.scheduleRoleId, role.id),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          isNull(memberScheduleRoles.deletedAt),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .orderBy(asc(rotationMembers.position));

    return {
      id: role.id,
      members,
      name: role.name,
      rotationRule: toRotationRule(rule),
      version: role.version,
    };
  }

  private async readShiftType(
    transaction: DatabaseTransaction,
    shiftTypeId: string,
  ): Promise<ShiftType> {
    const [shiftType] = await transaction
      .select()
      .from(shiftTypes)
      .where(and(eq(shiftTypes.id, shiftTypeId), isNull(shiftTypes.deletedAt)))
      .limit(1);

    if (shiftType === undefined) {
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        userMessage: '班种配置暂时无法读取，请稍后重试。',
      });
    }

    return toShiftType(shiftType);
  }

  private async getRoleForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    roleId: string,
  ) {
    const [role] = await transaction
      .select({ id: scheduleRoles.id, name: scheduleRoles.name, version: scheduleRoles.version })
      .from(scheduleRoles)
      .where(
        and(
          eq(scheduleRoles.id, roleId),
          eq(scheduleRoles.groupId, groupId),
          isNull(scheduleRoles.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    if (role === undefined) {
      throw notFound('排班角色不存在或不可用。');
    }

    return role;
  }

  private async getRuleForUpdate(transaction: DatabaseTransaction, roleId: string) {
    const [rule] = await transaction
      .select({
        currentPosition: rotationRules.currentPosition,
        id: rotationRules.id,
        startingMemberScheduleRoleId: rotationRules.startingMemberScheduleRoleId,
      })
      .from(rotationRules)
      .where(and(eq(rotationRules.scheduleRoleId, roleId), isNull(rotationRules.deletedAt)))
      .limit(1)
      .for('update');

    if (rule === undefined) {
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        userMessage: '排班角色缺少轮值规则。',
      });
    }

    return rule;
  }

  private async getEnabledAllDayShiftForUpdate(transaction: DatabaseTransaction, groupId: string) {
    const [shiftType] = await transaction
      .select({ id: shiftTypes.id })
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.groupId, groupId),
          eq(shiftTypes.templateKey, allDayTemplateKey),
          eq(shiftTypes.isEnabled, 1),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    if (shiftType === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '群组缺少可用的全天班，暂时不能创建排班角色。',
      });
    }

    return shiftType;
  }

  private async getEnabledShiftTypeForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    shiftTypeId: string,
  ) {
    const [shiftType] = await transaction
      .select({ id: shiftTypes.id })
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.id, shiftTypeId),
          eq(shiftTypes.groupId, groupId),
          eq(shiftTypes.isEnabled, 1),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    if (shiftType === undefined) {
      throw validationError('轮值规则必须选择本群组已启用的班种。');
    }

    return shiftType;
  }

  private async getShiftTypeForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    shiftTypeId: string,
  ) {
    const [shiftType] = await transaction
      .select({ id: shiftTypes.id, isAllDay: shiftTypes.isAllDay, isEnabled: shiftTypes.isEnabled })
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.id, shiftTypeId),
          eq(shiftTypes.groupId, groupId),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    if (shiftType === undefined) {
      throw notFound('班种不存在或不可用。');
    }

    return shiftType;
  }

  private async requireActiveGroupMemberships(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipIds: readonly string[],
  ): Promise<void> {
    if (membershipIds.length === 0) {
      return;
    }

    const memberships = await transaction
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          inArray(groupMemberships.id, [...membershipIds]),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .for('update');

    if (memberships.length !== membershipIds.length) {
      throw validationError('排班角色成员必须是群组内的有效成员。');
    }
  }

  private async getActiveRotationsForUpdate(transaction: DatabaseTransaction, ruleId: string) {
    return transaction
      .select({
        id: rotationMembers.id,
        memberScheduleRoleId: rotationMembers.memberScheduleRoleId,
        position: rotationMembers.position,
      })
      .from(rotationMembers)
      .where(and(eq(rotationMembers.rotationRuleId, ruleId), isNull(rotationMembers.deletedAt)))
      .for('update');
  }

  private async persistRotationOrder(
    transaction: DatabaseTransaction,
    rule: { readonly id: string },
    memberIds: readonly string[],
    knownRotations?: readonly {
      readonly id: string;
      readonly memberScheduleRoleId: string;
      readonly position: number;
    }[],
  ): Promise<void> {
    const activeRotations =
      knownRotations ?? (await this.getActiveRotationsForUpdate(transaction, rule.id));
    const desiredMemberIds = new Set(memberIds);
    const rotationsByMemberId = new Map(
      activeRotations.map((rotation) => [rotation.memberScheduleRoleId, rotation]),
    );

    const removedRotationIds = activeRotations
      .filter((rotation) => !desiredMemberIds.has(rotation.memberScheduleRoleId))
      .map((rotation) => rotation.id);
    if (removedRotationIds.length > 0) {
      await transaction
        .update(rotationMembers)
        .set({
          deletedAt: sql`current_timestamp(3)`,
          version: sql`${rotationMembers.version} + 1`,
        })
        .where(
          and(inArray(rotationMembers.id, removedRotationIds), isNull(rotationMembers.deletedAt)),
        );
    }

    const retainedRotationIds = activeRotations
      .filter((rotation) => desiredMemberIds.has(rotation.memberScheduleRoleId))
      .map((rotation) => rotation.id);
    if (retainedRotationIds.length > 0) {
      await transaction
        .update(rotationMembers)
        .set({ position: sql`${rotationMembers.position} + ${positionOffset}` })
        .where(
          and(inArray(rotationMembers.id, retainedRotationIds), isNull(rotationMembers.deletedAt)),
        );
    }

    for (const [index, memberScheduleRoleId] of memberIds.entries()) {
      const existing = rotationsByMemberId.get(memberScheduleRoleId);
      if (existing === undefined) {
        await transaction.insert(rotationMembers).values({
          id: randomUUID(),
          memberScheduleRoleId,
          position: index + 1,
          rotationRuleId: rule.id,
        });
      } else {
        await transaction
          .update(rotationMembers)
          .set({ position: index + 1, version: sql`${rotationMembers.version} + 1` })
          .where(eq(rotationMembers.id, existing.id));
      }
    }
  }

  private async clearRemovedMemberFromRotationRule(
    transaction: DatabaseTransaction,
    rule: {
      readonly currentPosition: number;
      readonly id: string;
      readonly startingMemberScheduleRoleId: string | null;
    },
    roleId: string,
    removedMemberIds: ReadonlySet<string>,
  ): Promise<void> {
    const remainingMembers = await transaction
      .select({ id: memberScheduleRoles.id })
      .from(memberScheduleRoles)
      .where(
        and(eq(memberScheduleRoles.scheduleRoleId, roleId), isNull(memberScheduleRoles.deletedAt)),
      );
    const nextCurrentPosition =
      remainingMembers.length === 0 || rule.currentPosition > remainingMembers.length
        ? 1
        : rule.currentPosition;
    const startingMemberScheduleRoleId =
      rule.startingMemberScheduleRoleId !== null &&
      removedMemberIds.has(rule.startingMemberScheduleRoleId)
        ? null
        : rule.startingMemberScheduleRoleId;

    if (
      nextCurrentPosition !== rule.currentPosition ||
      startingMemberScheduleRoleId !== rule.startingMemberScheduleRoleId
    ) {
      await transaction
        .update(rotationRules)
        .set({
          currentPosition: nextCurrentPosition,
          startingMemberScheduleRoleId,
          version: sql`${rotationRules.version} + 1`,
        })
        .where(eq(rotationRules.id, rule.id));
    }
  }

  private async bumpGroupRulesVersion(
    transaction: DatabaseTransaction,
    groupId: string,
  ): Promise<void> {
    await transaction
      .update(groups)
      .set({ rulesVersion: sql`${groups.rulesVersion} + 1` })
      .where(eq(groups.id, groupId));
  }
}

function normalizeShiftTypeInput(input: ShiftTypeInput, isAllDay = false) {
  if (isAllDay) {
    return {
      abbreviation: input.abbreviation,
      color: input.color.toUpperCase(),
      countsTowardStatistics: input.countsTowardStatistics ? 1 : 0,
      crossesMidnight: 1,
      endTime: '08:00',
      isEnabled: 1,
      name: input.name,
      startTime: '08:00',
    };
  }

  return {
    abbreviation: input.abbreviation,
    color: input.color.toUpperCase(),
    countsTowardStatistics: input.countsTowardStatistics ? 1 : 0,
    crossesMidnight: input.crossesMidnight ? 1 : 0,
    endTime: input.endTime ?? null,
    isEnabled: input.isEnabled ? 1 : 0,
    name: input.name,
    startTime: input.startTime ?? null,
  };
}

function validateShiftTypeInput(
  input: {
    readonly crossesMidnight: number;
    readonly endTime: string | null;
    readonly isEnabled: number;
    readonly startTime: string | null;
  },
  isAllDay = false,
): void {
  if (isAllDay) {
    return;
  }

  if (input.startTime === null || input.endTime === null) {
    if (input.startTime !== input.endTime || input.isEnabled === 1) {
      throw validationError('启用班种前必须同时填写开始和结束时间。');
    }
    return;
  }

  if (
    input.startTime === input.endTime ||
    (input.crossesMidnight === 0 && input.endTime < input.startTime) ||
    (input.crossesMidnight === 1 && input.endTime > input.startTime)
  ) {
    throw validationError('班种时间与跨日设置不一致。');
  }
}

function toRotationRule(rule: {
  readonly currentPosition: number;
  readonly defaultShiftTypeId: string;
  readonly requiredMembersPerDay: number;
  readonly startDate: string | null;
  readonly startingMemberScheduleRoleId: string | null;
  readonly version: number;
}): RotationRule {
  return {
    currentPosition: rule.currentPosition,
    defaultShiftTypeId: rule.defaultShiftTypeId,
    requiredMembersPerDay: rule.requiredMembersPerDay,
    ...(rule.startDate === null ? {} : { startDate: rule.startDate }),
    ...(rule.startingMemberScheduleRoleId === null
      ? {}
      : { startingMemberScheduleRoleId: rule.startingMemberScheduleRoleId }),
    version: rule.version,
  };
}

function toShiftType(shiftType: typeof shiftTypes.$inferSelect): ShiftType {
  return {
    abbreviation: shiftType.abbreviation,
    color: shiftType.color,
    configurationVersion: shiftType.configurationVersion,
    countsTowardStatistics: shiftType.countsTowardStatistics === 1,
    crossesMidnight: shiftType.crossesMidnight === 1,
    displayOrder: shiftType.displayOrder,
    ...(shiftType.endTime === null ? {} : { endTime: normalizeTime(shiftType.endTime) }),
    id: shiftType.id,
    isAllDay: shiftType.isAllDay === 1,
    isEnabled: shiftType.isEnabled === 1,
    name: shiftType.name,
    ...(shiftType.startTime === null ? {} : { startTime: normalizeTime(shiftType.startTime) }),
    textColor: shiftType.textColor,
    version: shiftType.version,
  };
}

function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

function validationError(userMessage: string): ApiError {
  return new ApiError({ code: 'VALIDATION_FAILED', statusCode: 400, userMessage });
}

function notFound(userMessage: string): ApiError {
  return new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage });
}
