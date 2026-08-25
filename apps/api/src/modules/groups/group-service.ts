import { randomUUID } from 'node:crypto';

import type {
  AddGroupMembersRequest,
  AddGroupMembersResponse,
  AddRosterEntriesRequest,
  AddRosterEntriesResponse,
  ClaimGroupRequest,
  ClaimGroupResponse,
  ConvertPendingRosterRequest,
  ConvertPendingRosterResponse,
  CreateGroupRequest,
  DissolvedGroup,
  GroupSummary,
  GroupVersionMutationRequest,
  OrganizationMutationCompleted,
  UpdateGroupCodeRequest,
  UpdateGroupNameRequest,
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
} from '@schedule/database';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import { GroupCodeService } from './group-code-service.js';
import {
  createOrganizationFingerprint,
  organizationMutationCompleted,
  runOrganizationMutation,
  type OrganizationMutationActor,
} from './organization-operation.js';
import { GroupPermissionService } from './permission-service.js';
import { createDefaultShiftTypes } from '../scheduling-config/scheduling-config-service.js';

interface ActiveGroupUser {
  readonly id: string;
  readonly isDeveloperAdmin: boolean;
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
    try {
      return await runOrganizationMutation({
        databaseClient: this.databaseClient,
        identity,
        operationId: input.operationId,
        requestFingerprint: createOrganizationFingerprint({
          groupCode: input.groupCode,
          name: input.name,
        }),
        run: (transaction, actor) =>
          this.createWithCode(transaction, actor, input.name, input.groupCode),
        scope: 'organization_group_create',
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw groupCodeConflict();
      }

      throw error;
    }
  }

  public async addRosterEntries(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: AddRosterEntriesRequest,
  ): Promise<AddRosterEntriesResponse> {
    ensureDistinctNames(input.realNames);

    try {
      return await runOrganizationMutation({
        databaseClient: this.databaseClient,
        identity,
        operationId: input.operationId,
        requestFingerprint: createOrganizationFingerprint({
          groupId,
          realNames: [...input.realNames].sort((left, right) => left.localeCompare(right)),
        }),
        run: async (transaction) => {
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
        },
        scope: 'organization_roster_add',
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

    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        groupId,
        realNames: [...input.realNames].sort((left, right) => left.localeCompare(right)),
      }),
      run: async (transaction) => {
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

          await this.createUnboundMemberInTransaction(
            transaction,
            authorization.group.id,
            realName,
          );
          converted += 1;
        }

        return { converted, skipped };
      },
      scope: 'organization_roster_convert',
    });
  }

  public async addGroupMembers(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: AddGroupMembersRequest,
  ): Promise<AddGroupMembersResponse> {
    ensureDistinctNames(input.realNames);

    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        groupId,
        realNames: [...input.realNames].sort((left, right) => left.localeCompare(right)),
      }),
      run: async (transaction) => {
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
          await this.createUnboundMemberInTransaction(
            transaction,
            authorization.group.id,
            realName,
          );
        }

        return { added: input.realNames.length };
      },
      scope: 'organization_members_add',
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

  public async claim(
    identity: AuthenticatedIdentity,
    input: ClaimGroupRequest,
  ): Promise<ClaimGroupResponse> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({ groupCode: input.groupCode }),
      run: async (transaction, actor) => {
        await this.groupCodeService.consumeAttempt(actor.id, transaction);
        const claimRealName = actor.realName;
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
              eq(groupMemberships.userId, actor.id),
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
              sql`binary ${rosterEntries.realName} = binary ${claimRealName}`,
            ),
          )
          .limit(1)
          .for('update');

        const unboundMembership = await this.findUnboundMembership(
          transaction,
          group.id,
          claimRealName,
        );
        if (unboundMembership === undefined) {
          throw new ApiError({
            code: 'FORBIDDEN',
            statusCode: 403,
            userMessage: '该群没有与您姓名相同的预设成员，暂不能加入。',
          });
        }

        await transaction
          .update(groupMemberships)
          .set({ userId: actor.id, version: sql`${groupMemberships.version} + 1` })
          .where(eq(groupMemberships.id, unboundMembership.id));
        if (rosterEntry !== undefined) {
          await transaction
            .update(rosterEntries)
            .set({
              claimedByUserId: actor.id,
              status: 'claimed',
              version: sql`${rosterEntries.version} + 1`,
            })
            .where(eq(rosterEntries.id, rosterEntry.id));
        }
        await this.removePlaceholderUserIfUnused(transaction, unboundMembership.userId);

        return {
          group: toGroupSummary(group, unboundMembership.role, actor.isDeveloperAdmin),
          status: 'claimed',
        };
      },
      scope: 'organization_group_claim',
    });
  }

  private async findUnboundMembership(
    transaction: DatabaseTransaction,
    groupId: string,
    realName: string,
  ): Promise<
    | {
        readonly id: string;
        readonly role: 'administrator' | 'guest' | 'member' | 'owner';
        readonly userId: string;
      }
    | undefined
  > {
    const [membership] = await transaction
      .select({
        id: groupMemberships.id,
        role: groupMemberships.role,
        userId: groupMemberships.userId,
      })
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
          isNull(users.cloudbaseUid),
          sql`binary ${userProfiles.realName} = binary ${realName}`,
        ),
      )
      .limit(1)
      .for('update');

    return membership;
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

  private async removePlaceholderUserIfUnused(
    transaction: DatabaseTransaction,
    userId: string,
  ): Promise<void> {
    const [remainingMembership] = await transaction
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(and(eq(groupMemberships.userId, userId), isNull(groupMemberships.deletedAt)))
      .limit(1);
    const [pendingRequest] = await transaction
      .select({ id: groupJoinRequests.id })
      .from(groupJoinRequests)
      .where(
        and(
          eq(groupJoinRequests.requestingUserId, userId),
          eq(groupJoinRequests.status, 'pending'),
          isNull(groupJoinRequests.deletedAt),
        ),
      )
      .limit(1);
    if (remainingMembership !== undefined || pendingRequest !== undefined) {
      return;
    }

    await transaction
      .update(userProfiles)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        version: sql`${userProfiles.version} + 1`,
      })
      .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)));
    await transaction
      .update(users)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        status: 'deleted',
        version: sql`${users.version} + 1`,
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  }

  public async updateCode(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupCodeRequest,
  ): Promise<GroupSummary> {
    try {
      return await runOrganizationMutation({
        databaseClient: this.databaseClient,
        identity,
        operationId: input.operationId,
        requestFingerprint: createOrganizationFingerprint({
          expectedVersion: input.expectedVersion,
          groupCode: input.groupCode,
          groupId,
        }),
        run: async (transaction) => {
          const authorization = await this.permissionService.requirePermission(
            transaction,
            identity,
            groupId,
            'updateGroupCode',
          );
          assertExpectedVersion({
            actualVersion: authorization.group.version,
            expectedVersion: input.expectedVersion,
            id: authorization.group.id,
            objectType: 'group',
          });
          await transaction
            .update(groups)
            .set({ groupCode: input.groupCode, version: sql`${groups.version} + 1` })
            .where(eq(groups.id, authorization.group.id));
          return {
            ...toGroupSummary(
              authorization.group,
              authorization.membership.role,
              authorization.user.isDeveloperAdmin,
            ),
            groupCode: input.groupCode,
            version: authorization.group.version + 1,
          };
        },
        scope: 'organization_group_code_update',
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw groupCodeConflict();
      }

      throw error;
    }
  }

  public async updateName(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupNameRequest,
  ): Promise<GroupSummary> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
        name: input.name,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'updateGroupName',
        );
        assertExpectedVersion({
          actualVersion: authorization.group.version,
          expectedVersion: input.expectedVersion,
          id: authorization.group.id,
          objectType: 'group',
        });
        await transaction
          .update(groups)
          .set({ name: input.name, version: sql`${groups.version} + 1` })
          .where(eq(groups.id, authorization.group.id));

        return {
          groupCode: authorization.group.groupCode,
          id: authorization.group.id,
          ...(authorization.user.isDeveloperAdmin ? { isDeveloperAdmin: true } : {}),
          name: input.name,
          role: authorization.membership.role,
          version: authorization.group.version + 1,
        };
      },
      scope: 'organization_group_name_update',
    });
  }

  public async listDissolved(identity: AuthenticatedIdentity): Promise<DissolvedGroup[]> {
    const user = await this.getActiveUser(identity);
    const rows = await this.databaseClient.database
      .select({
        deletedAt: groups.deletedAt,
        id: groups.id,
        name: groups.name,
        version: groups.version,
      })
      .from(groups)
      .where(
        and(
          ...(user.isDeveloperAdmin ? [] : [eq(groups.ownerUserId, user.id)]),
          sql`${groups.deletedAt} is not null`,
          sql`${groups.deletedAt} >= timestampadd(day, -30, current_timestamp(3))`,
        ),
      )
      .orderBy(desc(groups.deletedAt), desc(groups.id));

    return rows.map((row) => ({
      deletedAt: row.deletedAt!.toISOString(),
      id: row.id,
      name: row.name,
      version: row.version,
    }));
  }

  public async restoreGroup(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: GroupVersionMutationRequest,
  ): Promise<OrganizationMutationCompleted> {
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
      }),
      run: async (transaction, actor) => {
        const [group] = await transaction
          .select({ id: groups.id, version: groups.version })
          .from(groups)
          .where(
            and(
              eq(groups.id, groupId),
              ...(actor.isDeveloperAdmin ? [] : [eq(groups.ownerUserId, actor.id)]),
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
        assertExpectedVersion({
          actualVersion: group.version,
          expectedVersion: input.expectedVersion,
          id: group.id,
          objectType: 'group',
        });

        await transaction
          .update(groups)
          .set({ deletedAt: null, version: sql`${groups.version} + 1` })
          .where(eq(groups.id, group.id));
        return organizationMutationCompleted();
      },
      scope: 'organization_group_restore',
    });
  }

  private async createWithCode(
    transaction: DatabaseTransaction,
    actor: OrganizationMutationActor,
    name: string,
    groupCode: string,
  ): Promise<GroupSummary> {
    const groupId = randomUUID();
    await transaction.insert(groups).values({
      groupCode,
      id: groupId,
      name,
      ownerUserId: actor.id,
    });
    await transaction.insert(groupMemberships).values({
      groupId,
      id: randomUUID(),
      role: 'owner',
      userId: actor.id,
    });
    const developerAdmins = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.isDeveloperAdmin, 1), eq(users.status, 'active'), isNull(users.deletedAt)),
      );
    for (const developerAdmin of developerAdmins) {
      if (developerAdmin.id === actor.id) {
        continue;
      }
      await transaction.insert(groupMemberships).values({
        groupId,
        id: randomUUID(),
        role: 'administrator',
        userId: developerAdmin.id,
      });
    }
    await createDefaultShiftTypes(transaction, groupId);

    return toGroupSummary(
      { groupCode, id: groupId, name, ownerUserId: actor.id, version: 1 },
      'owner',
      actor.isDeveloperAdmin,
    );
  }

  private async getActiveUser(identity: AuthenticatedIdentity): Promise<ActiveGroupUser> {
    const [user] = await this.databaseClient.database
      .select({
        id: users.id,
        isDeveloperAdmin: users.isDeveloperAdmin,
        realName: userProfiles.realName,
      })
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

    return {
      id: user.id,
      isDeveloperAdmin: user.isDeveloperAdmin === 1,
      realName: user.realName,
    };
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

function toGroupSummary(
  group: ActiveGroup,
  role: GroupSummary['role'],
  isDeveloperAdmin = false,
): GroupSummary {
  return {
    groupCode: group.groupCode,
    id: group.id,
    ...(isDeveloperAdmin ? { isDeveloperAdmin: true } : {}),
    name: group.name,
    role,
    version: group.version,
  };
}
