import { randomUUID } from 'node:crypto';

import type {
  CreateScheduleRoleRequest,
  CreateShiftTypeRequest,
  OrganizationMutationCompleted,
  ReplaceScheduleRoleMembersRequest,
  ScheduleRole,
  ScheduleRoleVersionMutationRequest,
  SchedulingConfig,
  ShiftType,
  ShiftTypeInput,
  ShiftTypeVersionMutationRequest,
  UpdateShiftTypeRequest,
  UpdateScheduleRoleRequest,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  groupMemberships,
  groups,
  manualScheduleCells,
  manualScheduleTemplates,
  memberScheduleRoles,
  schedulePeriods,
  scheduleRoles,
  shiftTypes,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { calculateReadableTextColor } from '@schedule/scheduling-domain';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import {
  createOrganizationFingerprint,
  organizationMutationCompleted,
  runOrganizationMutation,
} from '../groups/organization-operation.js';
import { GroupPermissionService } from '../groups/permission-service.js';

const allDayTemplateKey = 'all_day';

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
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedRulesVersion: input.expectedRulesVersion,
        groupId,
        name: input.name,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        assertExpectedRulesVersion(
          authorization.group.id,
          authorization.group.rulesVersion,
          input.expectedRulesVersion,
        );
        const roleId = randomUUID();
        await transaction.insert(scheduleRoles).values({
          groupId: authorization.group.id,
          id: roleId,
          name: input.name,
        });
        await this.bumpGroupRulesVersion(transaction, authorization.group.id);

        return this.readRole(transaction, roleId);
      },
      scope: 'scheduling_role_create',
    });
  }

  public async updateRole(
    identity: AuthenticatedIdentity,
    groupId: string,
    roleId: string,
    input: UpdateScheduleRoleRequest,
  ): Promise<ScheduleRole> {
    const name = input.name.trim();
    if (name.length === 0 || name.length > 100) throw validationError('岗位名称须为1–100字。');
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        groupId,
        roleId,
        name,
        expectedVersion: input.expectedVersion,
        expectedRulesVersion: input.expectedRulesVersion,
      }),
      scope: 'scheduling_role_update',
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        assertExpectedRulesVersion(
          authorization.group.id,
          authorization.group.rulesVersion,
          input.expectedRulesVersion,
        );
        const role = await this.getRoleForUpdate(transaction, authorization.group.id, roleId);
        assertExpectedVersion({
          actualVersion: role.version,
          expectedVersion: input.expectedVersion,
          id: role.id,
          objectType: 'schedule_role',
        });
        await transaction
          .update(scheduleRoles)
          .set({ name, version: sql`${scheduleRoles.version} + 1` })
          .where(eq(scheduleRoles.id, role.id));
        await this.bumpGroupRulesVersion(transaction, authorization.group.id);
        return this.readRole(transaction, role.id);
      },
    });
  }

  public async replaceRoleMembers(
    identity: AuthenticatedIdentity,
    groupId: string,
    roleId: string,
    input: ReplaceScheduleRoleMembersRequest,
  ): Promise<ScheduleRole> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedRoleVersion: input.expectedRoleVersion,
        expectedRulesVersion: input.expectedRulesVersion,
        groupId,
        membershipIds: input.membershipIds,
        roleId,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        assertExpectedRulesVersion(
          authorization.group.id,
          authorization.group.rulesVersion,
          input.expectedRulesVersion,
        );
        const role = await this.getRoleForUpdate(transaction, authorization.group.id, roleId);
        assertExpectedVersion({
          actualVersion: role.version,
          expectedVersion: input.expectedRoleVersion,
          id: role.id,
          objectType: 'schedule_role',
        });
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
        }

        await transaction
          .update(scheduleRoles)
          .set({ version: sql`${scheduleRoles.version} + 1` })
          .where(eq(scheduleRoles.id, role.id));
        await this.bumpGroupRulesVersion(transaction, authorization.group.id);
        return this.readRole(transaction, role.id);
      },
      scope: 'scheduling_role_members_replace',
    });
  }

  public async deleteRole(
    identity: AuthenticatedIdentity,
    groupId: string,
    roleId: string,
    input: ScheduleRoleVersionMutationRequest,
  ): Promise<OrganizationMutationCompleted> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedRulesVersion: input.expectedRulesVersion,
        expectedVersion: input.expectedVersion,
        groupId,
        roleId,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        assertExpectedRulesVersion(
          authorization.group.id,
          authorization.group.rulesVersion,
          input.expectedRulesVersion,
        );
        const role = await this.getRoleForUpdate(transaction, authorization.group.id, roleId);
        assertExpectedVersion({
          actualVersion: role.version,
          expectedVersion: input.expectedVersion,
          id: role.id,
          objectType: 'schedule_role',
        });

        const usedPeriod = await transaction
          .select({ id: schedulePeriods.id })
          .from(schedulePeriods)
          .where(
            and(eq(schedulePeriods.scheduleRoleId, role.id), isNull(schedulePeriods.deletedAt)),
          )
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
            .update(scheduleRoles)
            .set({
              deletedAt: sql`current_timestamp(3)`,
              version: sql`${scheduleRoles.version} + 1`,
            })
            .where(eq(scheduleRoles.id, role.id)),
        ]);
        await this.bumpGroupRulesVersion(transaction, authorization.group.id);
        return organizationMutationCompleted();
      },
      scope: 'scheduling_role_delete',
    });
  }

  public async createShiftType(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateShiftTypeRequest,
  ): Promise<ShiftType> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        ...input,
        groupId,
        operationId: undefined,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        assertExpectedRulesVersion(
          authorization.group.id,
          authorization.group.rulesVersion,
          input.expectedRulesVersion,
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
      },
      scope: 'scheduling_shift_type_create',
    });
  }

  public async updateShiftType(
    identity: AuthenticatedIdentity,
    groupId: string,
    shiftTypeId: string,
    input: UpdateShiftTypeRequest,
  ): Promise<ShiftType> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        ...input,
        groupId,
        operationId: undefined,
        shiftTypeId,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        assertExpectedRulesVersion(
          authorization.group.id,
          authorization.group.rulesVersion,
          input.expectedRulesVersion,
        );
        const existing = await this.getShiftTypeForUpdate(
          transaction,
          authorization.group.id,
          shiftTypeId,
        );
        assertExpectedVersion({
          actualVersion: existing.version,
          expectedVersion: input.expectedVersion,
          id: existing.id,
          objectType: 'shift_type',
        });
        const isAllDay = existing.isAllDay === 1;
        const normalized = normalizeShiftTypeInput(input, isAllDay);
        validateShiftTypeInput(normalized, isAllDay);

        if (existing.isAllDay === 1 && !normalized.isEnabled) {
          throw validationError('全天班是群组的固定默认班种，不能停用。');
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
      },
      scope: 'scheduling_shift_type_update',
    });
  }

  public async deleteShiftType(
    identity: AuthenticatedIdentity,
    groupId: string,
    shiftTypeId: string,
    input: ShiftTypeVersionMutationRequest,
  ): Promise<OrganizationMutationCompleted> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedRulesVersion: input.expectedRulesVersion,
        expectedVersion: input.expectedVersion,
        groupId,
        shiftTypeId,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageScheduleConfiguration',
        );
        assertExpectedRulesVersion(
          authorization.group.id,
          authorization.group.rulesVersion,
          input.expectedRulesVersion,
        );
        const existing = await this.getShiftTypeForUpdate(
          transaction,
          authorization.group.id,
          shiftTypeId,
        );
        assertExpectedVersion({
          actualVersion: existing.version,
          expectedVersion: input.expectedVersion,
          id: existing.id,
          objectType: 'shift_type',
        });
        if (existing.templateKey !== null) {
          throw validationError('内置班种不能删除，只能停用。');
        }

        const [cellUsingShiftType] = await transaction
          .select({ id: manualScheduleCells.id })
          .from(manualScheduleCells)
          .where(
            and(
              eq(manualScheduleCells.shiftTypeId, existing.id),
              isNull(manualScheduleCells.deletedAt),
            ),
          )
          .limit(1)
          .for('update');
        if (cellUsingShiftType !== undefined) {
          throw validationError('该班种仍被手动排班模板使用，请先删除相关模板。');
        }

        await transaction
          .update(shiftTypes)
          .set({
            deletedAt: sql`current_timestamp(3)`,
            version: sql`${shiftTypes.version} + 1`,
          })
          .where(eq(shiftTypes.id, existing.id));
        await this.bumpGroupRulesVersion(transaction, authorization.group.id);
        return organizationMutationCompleted();
      },
      scope: 'scheduling_shift_type_delete',
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
            ne(users.isDeveloperAdmin, 1),
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
    if (role === undefined) {
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
        realName: userProfiles.realName,
        version: memberScheduleRoles.version,
      })
      .from(memberScheduleRoles)
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(memberScheduleRoles.scheduleRoleId, role.id),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
          ne(users.isDeveloperAdmin, 1),
          isNull(memberScheduleRoles.deletedAt),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .orderBy(asc(userProfiles.realName), asc(memberScheduleRoles.id));

    return {
      id: role.id,
      members,
      name: role.name,
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

  private async getShiftTypeForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    shiftTypeId: string,
  ) {
    const [shiftType] = await transaction
      .select({
        id: shiftTypes.id,
        isAllDay: shiftTypes.isAllDay,
        isEnabled: shiftTypes.isEnabled,
        templateKey: shiftTypes.templateKey,
        version: shiftTypes.version,
      })
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
          ne(users.isDeveloperAdmin, 1),
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

function assertExpectedRulesVersion(
  groupId: string,
  actualRulesVersion: number,
  expectedRulesVersion: number,
): void {
  if (actualRulesVersion === expectedRulesVersion) return;
  throw new ApiError({
    code: 'CONFLICT',
    latestData: {
      id: groupId,
      objectType: 'scheduling_rules',
      rulesVersion: actualRulesVersion,
    },
    statusCode: 409,
    userMessage: '排班配置已被其他操作更新，请刷新后重新确认。',
  });
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
    (input.crossesMidnight === 0 && input.endTime <= input.startTime) ||
    (input.crossesMidnight === 1 && input.endTime > input.startTime)
  ) {
    throw validationError('班种时间与跨日设置不一致。');
  }
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
    isBuiltIn: shiftType.templateKey !== null,
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
