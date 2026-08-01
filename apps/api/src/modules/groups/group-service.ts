import { randomUUID } from 'node:crypto';

import type {
  AddRosterEntriesRequest,
  AddRosterEntriesResponse,
  ClaimGroupRequest,
  ClaimGroupResponse,
  CreateGroupRequest,
  GroupSummary,
  RegenerateGroupCodeRequest,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  groupJoinRequests,
  groupMemberships,
  groups,
  rosterEntries,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupCodeService } from './group-code-service.js';
import { GroupPermissionService } from './permission-service.js';

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
        await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageRoster',
        );
        await transaction.insert(rosterEntries).values(
          input.realNames.map((realName) => ({
            groupId,
            id: randomUUID(),
            realName,
          })),
        );

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

  public async claim(
    identity: AuthenticatedIdentity,
    input: ClaimGroupRequest,
  ): Promise<ClaimGroupResponse> {
    const attemptingUser = await this.getActiveUser(identity);
    await this.groupCodeService.consumeAttempt(attemptingUser.id);

    return withTransaction(this.databaseClient, async (transaction) => {
      const user = await this.getActiveUserInTransaction(transaction, identity);
      const [group] = await transaction
        .select({
          groupCode: groups.groupCode,
          id: groups.id,
          name: groups.name,
          ownerUserId: groups.ownerUserId,
          version: groups.version,
        })
        .from(groups)
        .where(and(eq(groups.groupCode, input.groupCode), isNull(groups.deletedAt)))
        .limit(1)
        .for('update');

      if (group === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '群组码无效或群组不可用。',
        });
      }

      const [existingMembership] = await transaction
        .select({ id: groupMemberships.id })
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.groupId, group.id),
            eq(groupMemberships.userId, user.id),
            eq(groupMemberships.status, 'active'),
            isNull(groupMemberships.deletedAt),
          ),
        )
        .limit(1)
        .for('update');

      if (existingMembership !== undefined) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '您已经加入该群组。',
        });
      }

      const [rosterEntry] = await transaction
        .select({ id: rosterEntries.id })
        .from(rosterEntries)
        .where(
          and(
            eq(rosterEntries.groupId, group.id),
            eq(rosterEntries.status, 'pending'),
            isNull(rosterEntries.deletedAt),
            sql`binary ${rosterEntries.realName} = binary ${user.realName}`,
          ),
        )
        .limit(1)
        .for('update');

      if (rosterEntry === undefined) {
        await transaction
          .insert(groupJoinRequests)
          .values({
            groupId: group.id,
            id: randomUUID(),
            requestedRealName: user.realName,
            requestingUserId: user.id,
          })
          .onDuplicateKeyUpdate({
            set: { updatedAt: sql`current_timestamp(3)` },
          });

        return { status: 'request_created' };
      }

      await transaction
        .update(rosterEntries)
        .set({
          claimedByUserId: user.id,
          status: 'claimed',
          version: sql`${rosterEntries.version} + 1`,
        })
        .where(
          and(
            eq(rosterEntries.id, rosterEntry.id),
            eq(rosterEntries.status, 'pending'),
            isNull(rosterEntries.deletedAt),
          ),
        );
      await transaction
        .update(groupJoinRequests)
        .set({
          status: 'resolved',
          version: sql`${groupJoinRequests.version} + 1`,
        })
        .where(
          and(
            eq(groupJoinRequests.groupId, group.id),
            eq(groupJoinRequests.requestingUserId, user.id),
            eq(groupJoinRequests.status, 'pending'),
            isNull(groupJoinRequests.deletedAt),
          ),
        );
      await transaction.insert(groupMemberships).values({
        groupId: group.id,
        id: randomUUID(),
        role: 'member',
        userId: user.id,
      });

      return {
        group: toGroupSummary(group, 'member'),
        status: 'claimed',
      };
    });
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

function toGroupSummary(group: ActiveGroup, role: 'member' | 'owner'): GroupSummary {
  return {
    groupCode: group.groupCode,
    id: group.id,
    name: group.name,
    role,
    version: group.version,
  };
}
