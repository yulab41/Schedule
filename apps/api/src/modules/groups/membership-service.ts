import type {
  GroupMember,
  GroupRole,
  GroupSummary,
  TransferGroupOwnershipRequest,
  UpdateGroupMemberRoleRequest,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  groupMemberships,
  groups,
  rosterEntries,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from './permission-service.js';

export class MembershipService {
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async listGroups(identity: AuthenticatedIdentity): Promise<GroupSummary[]> {
    const memberships = await this.databaseClient.database
      .select({
        groupCode: groups.groupCode,
        id: groups.id,
        name: groups.name,
        role: groupMemberships.role,
        version: groups.version,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          eq(users.status, 'active'),
          eq(groupMemberships.status, 'active'),
          isNull(groups.deletedAt),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .orderBy(asc(groups.name), asc(groups.id));

    return memberships.map((membership) => ({
      ...membership,
      role: membership.role as GroupRole,
    }));
  }

  public async listMembers(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupMember[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewMembers',
      );
      const members = await transaction
        .select({
          cloudbaseUid: users.cloudbaseUid,
          id: groupMemberships.id,
          realName: userProfiles.realName,
          role: groupMemberships.role,
          userId: groupMemberships.userId,
        })
        .from(groupMemberships)
        .innerJoin(users, eq(users.id, groupMemberships.userId))
        .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(
          and(
            eq(groupMemberships.groupId, authorization.group.id),
            eq(groupMemberships.status, 'active'),
            eq(users.status, 'active'),
            isNull(groupMemberships.deletedAt),
            isNull(users.deletedAt),
            isNull(userProfiles.deletedAt),
          ),
        )
        .orderBy(asc(userProfiles.realName), asc(groupMemberships.id));
      const pendingRoster = await transaction
        .select({ id: rosterEntries.id, realName: rosterEntries.realName })
        .from(rosterEntries)
        .where(
          and(
            eq(rosterEntries.groupId, authorization.group.id),
            eq(rosterEntries.status, 'pending'),
            isNull(rosterEntries.deletedAt),
          ),
        )
        .orderBy(asc(rosterEntries.realName), asc(rosterEntries.id));

      const memberRows: GroupMember[] = members.map((member) => ({
        id: member.id,
        isCurrentUser: member.userId === authorization.user.id,
        isUnclaimed: member.cloudbaseUid === null,
        realName: member.realName,
        role: member.role,
      }));
      const memberNames = new Set(memberRows.map((member) => member.realName));
      for (const roster of pendingRoster) {
        if (memberNames.has(roster.realName)) {
          continue;
        }
        memberRows.push({
          id: roster.id,
          isCurrentUser: false,
          isPendingRoster: true,
          isUnclaimed: true,
          realName: roster.realName,
          role: 'member',
        });
      }

      return memberRows.sort(
        (first, second) =>
          first.realName.localeCompare(second.realName, 'zh-Hans-CN') ||
          first.id.localeCompare(second.id),
      );
    });
  }

  public async updateMemberRole(
    identity: AuthenticatedIdentity,
    groupId: string,
    membershipId: string,
    input: UpdateGroupMemberRoleRequest,
  ): Promise<GroupMember> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageAdministrators',
      );
      const target = await this.permissionService.getActiveMemberForUpdate(
        transaction,
        authorization.group.id,
        membershipId,
      );

      if (target.role === 'owner') {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '请先转让群主身份，再调整原群主权限。',
        });
      }

      await transaction
        .update(groupMemberships)
        .set({ role: input.role, version: sql`${groupMemberships.version} + 1` })
        .where(eq(groupMemberships.id, target.id));

      const [member] = await transaction
        .select({ realName: userProfiles.realName })
        .from(userProfiles)
        .where(and(eq(userProfiles.userId, target.userId), isNull(userProfiles.deletedAt)))
        .limit(1);

      if (member === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '群组成员不存在或不可用。',
        });
      }

      return {
        id: target.id,
        isCurrentUser: target.userId === authorization.user.id,
        realName: member.realName,
        role: input.role,
      };
    });
  }

  public async transferOwnership(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: TransferGroupOwnershipRequest,
  ): Promise<GroupSummary> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'transferOwnership',
      );
      const target = await this.permissionService.getActiveMemberForUpdate(
        transaction,
        authorization.group.id,
        input.membershipId,
      );

      if (target.id === authorization.membership.id) {
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: '请选择另一位有效成员作为群主。',
        });
      }

      await transaction
        .update(groupMemberships)
        .set({ role: 'administrator', version: sql`${groupMemberships.version} + 1` })
        .where(eq(groupMemberships.id, authorization.membership.id));
      await transaction
        .update(groupMemberships)
        .set({ role: 'owner', version: sql`${groupMemberships.version} + 1` })
        .where(eq(groupMemberships.id, target.id));
      await transaction
        .update(groups)
        .set({ ownerUserId: target.userId, version: sql`${groups.version} + 1` })
        .where(eq(groups.id, authorization.group.id));

      return {
        groupCode: authorization.group.groupCode,
        id: authorization.group.id,
        name: authorization.group.name,
        role: 'administrator',
        version: authorization.group.version + 1,
      };
    });
  }

  public async deleteGroup(identity: AuthenticatedIdentity, groupId: string): Promise<void> {
    await withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'deleteGroup',
      );
      await transaction
        .update(groups)
        .set({ deletedAt: sql`current_timestamp(3)`, version: sql`${groups.version} + 1` })
        .where(and(eq(groups.id, authorization.group.id), isNull(groups.deletedAt)));
    });
  }
}
