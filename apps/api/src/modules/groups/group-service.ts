import { randomUUID } from 'node:crypto';

import type {
  AddGroupMembersRequest,
  AddGroupMembersResponse,
  AddRosterEntriesRequest,
  AddRosterEntriesResponse,
  ConvertPendingRosterRequest,
  ConvertPendingRosterResponse,
  CreateGroupRequest,
  DissolvedGroup,
  GroupSummary,
  RegenerateGroupCodeRequest,
  UpdateGroupNameRequest,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  groupMemberships,
  groups,
  rosterEntries,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupCodeService } from './group-code-service.js';
import { GroupPermissionService } from './permission-service.js';
import { createDefaultShiftTypes } from '../scheduling-config/scheduling-config-service.js';

interface ActiveGroupUser {
  readonly id: string;
  readonly realName: string;
}

interface ActiveGroup {
  readonly groupCode: string;
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly version: number;
}

export class GroupService {
  private readonly groupCodeService: GroupCodeService;
  private readonly permissionService = new GroupPermissionService();

  public constructor(
    private readonly databaseClient: DatabaseClient,
    groupCodeService?: GroupCodeService,
  ) {
    this.groupCodeService = groupCodeService ?? new GroupCodeService(databaseClient);
  }

  public async create(
    identity: AuthenticatedIdentity,
    input: CreateGroupRequest,
  ): Promise<GroupSummary> {
    if (input.groupCode !== undefined) {
      try {
        return await this.createWithCode(identity, input.name, input.groupCode);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw groupCodeConflict();
        }

        throw error;
      }
    }

    for (let attempt = 0; attempt < 32; attempt += 1) {
      try {
        return await this.createWithCode(
          identity,
          input.name,
          this.groupCodeService.createRandomCode(),
        );
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }

    throw new ApiError({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
      userMessage: '暂时无法分配群组码，请稍后重试。',
    });
  }

  public async addRosterEntries(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: AddRosterEntriesRequest,
  ): Promise<AddRosterEntriesResponse> {
    ensureDistinctNames(input.realNames);

    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageRoster',
        );
        for (const realName of input.realNames) {
          await this.assertNoSameNameInGroup(transaction, authorization.group.id, realName);
        }
        for (const realName of input.realNames) {
          await this.createUnboundMemberInTransaction(
            transaction,
            authorization.group.id,
            realName,
          );
          await transaction.insert(rosterEntries).values({
            groupId,
            id: randomUUID(),
            realName,
          });
        }

        return { added: input.realNames.length };
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '群组内存在同名的待认领人员。',
        });
      }

      throw error;
    }
  }

  public async convertRosterEntries(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: ConvertPendingRosterRequest,
  ): Promise<ConvertPendingRosterResponse> {
    ensureDistinctNames(input.realNames);

    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageRoster',
      );
      let converted = 0;
      let skipped = 0;
      for (const realName of input.realNames) {
        const [rosterEntry] = await transaction
          .select({ id: rosterEntries.id })
          .from(rosterEntries)
          .where(
            and(
              eq(rosterEntries.groupId, authorization.group.id),
              eq(rosterEntries.status, 'pending'),
              isNull(rosterEntries.deletedAt),
              sql`binary ${rosterEntries.realName} = binary ${realName}`,
            ),
          )
          .limit(1)
          .for('update');
        if (rosterEntry === undefined) {
          skipped += 1;
          continue;
        }

        const [existingMember] = await transaction
          .select({ id: groupMemberships.id })
          .from(groupMemberships)
          .innerJoin(users, eq(users.id, groupMemberships.userId))
          .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
          .where(
            and(
              eq(groupMemberships.groupId, authorization.group.id),
              eq(groupMemberships.status, 'active'),
              isNull(groupMemberships.deletedAt),
              isNull(users.deletedAt),
              isNull(userProfiles.deletedAt),
              sql`binary ${userProfiles.realName} = binary ${realName}`,
            ),
          )
          .limit(1);
        if (existingMember !== undefined) {
          skipped += 1;
          continue;
        }

        await this.createUnboundMemberInTransaction(transaction, authorization.group.id, realName);
        converted += 1;
      }

      return { converted, skipped };
    });
  }

  public async addGroupMembers(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: AddGroupMembersRequest,
  ): Promise<AddGroupMembersResponse> {
    ensureDistinctNames(input.realNames);

    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageMembers',
      );
      for (const realName of input.realNames) {
        await this.assertNoSameNameInGroup(transaction, authorization.group.id, realName);
      }

      for (const realName of input.realNames) {
        await this.createUnboundMemberInTransaction(transaction, authorization.group.id, realName);
      }

      return { added: input.realNames.length };
    });
  }

  private async createUnboundMemberInTransaction(
    transaction: DatabaseTransaction,
    groupId: string,
    realName: string,
  ): Promise<void> {
    const userId = randomUUID();
    await transaction.insert(users).values({
      cloudbaseUid: null,
      id: userId,
    });
    await transaction.insert(userProfiles).values({
      realName,
      userId,
    });
    await transaction.insert(groupMemberships).values({
      groupId,
      id: randomUUID(),
      role: 'member',
      userId,
    });
  }

  private async assertNoSameNameInGroup(
    transaction: DatabaseTransaction,
    groupId: string,
    realName: string,
  ): Promise<void> {
    const [member] = await transaction
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
          sql`binary ${userProfiles.realName} = binary ${realName}`,
        ),
      )
      .limit(1);
    if (member !== undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '群组内已存在同名成员。',
      });
    }

    const [pendingRoster] = await transaction
      .select({ id: rosterEntries.id })
      .from(rosterEntries)
      .where(
        and(
          eq(rosterEntries.groupId, groupId),
          eq(rosterEntries.status, 'pending'),
          isNull(rosterEntries.deletedAt),
          sql`binary ${rosterEntries.realName} = binary ${realName}`,
        ),
      )
      .limit(1);
    if (pendingRoster !== undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '群组内已存在同名的待认领人员，请先让该成员认领或移除待认领名单。',
      });
    }
  }

  public async regenerateCode(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: RegenerateGroupCodeRequest,
  ): Promise<GroupSummary> {
    if (input.groupCode !== undefined) {
      try {
        return await this.updateGroupCode(groupId, identity, input.groupCode);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw groupCodeConflict();
        }

        throw error;
      }
    }

    for (let attempt = 0; attempt < 32; attempt += 1) {
      try {
        return await this.updateGroupCode(
          groupId,
          identity,
          this.groupCodeService.createRandomCode(),
        );
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }

    throw new ApiError({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
      userMessage: '暂时无法分配新的群组码，请稍后重试。',
    });
  }

  public async updateName(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupNameRequest,
  ): Promise<GroupSummary> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'updateGroupName',
      );
      await transaction
        .update(groups)
        .set({ name: input.name, version: sql`${groups.version} + 1` })
        .where(eq(groups.id, authorization.group.id));

      return {
        groupCode: authorization.group.groupCode,
        id: authorization.group.id,
        name: input.name,
        role: authorization.membership.role,
        version: authorization.group.version + 1,
      };
    });
  }

  public async listDissolved(identity: AuthenticatedIdentity): Promise<DissolvedGroup[]> {
    const user = await this.getActiveUser(identity);
    const rows = await this.databaseClient.database
      .select({ deletedAt: groups.deletedAt, id: groups.id, name: groups.name })
      .from(groups)
      .where(
        and(
          eq(groups.ownerUserId, user.id),
          sql`${groups.deletedAt} is not null`,
          sql`${groups.deletedAt} >= timestampadd(day, -30, current_timestamp(3))`,
        ),
      )
      .orderBy(desc(groups.deletedAt), desc(groups.id));

    return rows.map((row) => ({
      deletedAt: row.deletedAt!.toISOString(),
      id: row.id,
      name: row.name,
    }));
  }

  public async restoreGroup(identity: AuthenticatedIdentity, groupId: string): Promise<void> {
    await withTransaction(this.databaseClient, async (transaction) => {
      const user = await this.getActiveUserInTransaction(transaction, identity);
      const [group] = await transaction
        .select({ id: groups.id })
        .from(groups)
        .where(
          and(
            eq(groups.id, groupId),
            eq(groups.ownerUserId, user.id),
            sql`${groups.deletedAt} is not null`,
            sql`${groups.deletedAt} >= timestampadd(day, -30, current_timestamp(3))`,
          ),
        )
        .limit(1)
        .for('update');
      if (group === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '群组不存在、不属于您或已超过恢复期限。',
        });
      }

      await transaction
        .update(groups)
        .set({ deletedAt: null, version: sql`${groups.version} + 1` })
        .where(eq(groups.id, group.id));
    });
  }

  private async createWithCode(
    identity: AuthenticatedIdentity,
    name: string,
    groupCode: string,
  ): Promise<GroupSummary> {
    const groupId = randomUUID();

    return withTransaction(this.databaseClient, async (transaction) => {
      const user = await this.getActiveUserInTransaction(transaction, identity);
      await transaction.insert(groups).values({
        groupCode,
        id: groupId,
        name,
        ownerUserId: user.id,
      });
      await transaction.insert(groupMemberships).values({
        groupId,
        id: randomUUID(),
        role: 'owner',
        userId: user.id,
      });
      await createDefaultShiftTypes(transaction, groupId);

      return {
        groupCode,
        id: groupId,
        name,
        role: 'owner',
        version: 1,
      };
    });
  }

  private async getActiveUser(identity: AuthenticatedIdentity): Promise<ActiveGroupUser> {
    const [user] = await this.databaseClient.database
      .select({ id: users.id, realName: userProfiles.realName })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1);

    if (user === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '当前账号尚未完成个人资料。',
      });
    }

    return user;
  }

  private async getActiveUserInTransaction(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
  ): Promise<ActiveGroupUser> {
    const [user] = await transaction
      .select({ id: users.id, realName: userProfiles.realName, status: users.status })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    if (user === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '当前账号尚未完成个人资料。',
      });
    }

    if (user.status !== 'active') {
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '当前账号无法执行群组操作。',
      });
    }

    return { id: user.id, realName: user.realName };
  }

  private async getOwnedGroup(
    transaction: DatabaseTransaction,
    groupId: string,
    userId: string,
  ): Promise<ActiveGroup> {
    const [group] = await transaction
      .select({
        groupCode: groups.groupCode,
        id: groups.id,
        name: groups.name,
        ownerUserId: groups.ownerUserId,
        version: groups.version,
      })
      .from(groups)
      .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
      .limit(1)
      .for('update');

    if (group === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '群组不存在或不可用。',
      });
    }

    if (group.ownerUserId !== userId) {
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '只有群主可以执行此操作。',
      });
    }

    return group;
  }

  private async updateGroupCode(
    groupId: string,
    identity: AuthenticatedIdentity,
    groupCode: string,
  ): Promise<GroupSummary> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const user = await this.getActiveUserInTransaction(transaction, identity);
      const group = await this.getOwnedGroup(transaction, groupId, user.id);
      await transaction
        .update(groups)
        .set({
          groupCode,
          version: sql`${groups.version} + 1`,
        })
        .where(eq(groups.id, group.id));

      return {
        ...toGroupSummary(group, 'owner'),
        groupCode,
        version: group.version + 1,
      };
    });
  }
}

function ensureDistinctNames(realNames: readonly string[]): void {
  if (new Set(realNames).size === realNames.length) {
    return;
  }

  throw new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '群组内存在同名的待认领人员。',
  });
}

function groupCodeConflict(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '该群组码已被使用，请更换后重试。',
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return getDatabaseErrorCode(error) === 'ER_DUP_ENTRY';
}

function getDatabaseErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('code' in error) {
    return error.code;
  }

  return 'cause' in error ? getDatabaseErrorCode(error.cause) : undefined;
}

function toGroupSummary(group: ActiveGroup, role: GroupSummary['role']): GroupSummary {
  return {
    groupCode: group.groupCode,
    id: group.id,
    name: group.name,
    role,
    version: group.version,
  };
}
