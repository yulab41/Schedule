import type {
  GroupMember,
  GroupRole,
  GroupSummary,
  TransferGroupOwnershipRequest,
  UpdateGroupMemberRoleRequest,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  dutyAdjustments,
  groupJoinRequests,
  groupMemberships,
  groupMemberContacts,
  groups,
  leaveRequests,
  memberScheduleRoles,
  rosterEntries,
  rotationMembers,
  shiftAssignments,
  swapRequests,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

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

  public async deleteMember(
    identity: AuthenticatedIdentity,
    groupId: string,
    memberId: string,
  ): Promise<void> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageMembers',
      );
      const rosterEntry = await this.findPendingRosterForUpdate(
        transaction,
        authorization.group.id,
        memberId,
      );
      let membership = await this.findMembershipForUpdate(
        transaction,
        authorization.group.id,
        memberId,
      );
      if (membership === undefined && rosterEntry !== undefined) {
        membership = await this.findMembershipByRealNameForUpdate(
          transaction,
          authorization.group.id,
          rosterEntry.realName,
        );
      }
      if (membership === undefined && rosterEntry === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '成员不存在或不可用。',
        });
      }

      if (membership !== undefined) {
        if (membership.role === 'owner') {
          throw new ApiError({
            code: 'CONFLICT',
            statusCode: 409,
            userMessage: '不能删除群主，请先转让群主身份。',
          });
        }
        if (membership.role === 'administrator' && authorization.membership.role !== 'owner') {
          throw new ApiError({
            code: 'FORBIDDEN',
            statusCode: 403,
            userMessage: '只有群主可以删除管理员。',
          });
        }

        await this.hardDeleteMembership(transaction, membership);
      }

      const realName = membership?.realName ?? rosterEntry?.realName;
      if (realName !== undefined) {
        await transaction
          .delete(rosterEntries)
          .where(
            and(
              eq(rosterEntries.groupId, authorization.group.id),
              eq(rosterEntries.status, 'pending'),
              isNull(rosterEntries.deletedAt),
              sql`binary ${rosterEntries.realName} = binary ${realName}`,
            ),
          );
      }
    });
  }

  private async findPendingRosterForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    memberId: string,
  ) {
    const [rosterEntry] = await transaction
      .select({ id: rosterEntries.id, realName: rosterEntries.realName })
      .from(rosterEntries)
      .where(
        and(
          eq(rosterEntries.groupId, groupId),
          eq(rosterEntries.id, memberId),
          eq(rosterEntries.status, 'pending'),
          isNull(rosterEntries.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    return rosterEntry;
  }

  private async findMembershipForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    memberId: string,
  ) {
    const [membership] = await transaction
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
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.id, memberId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1)
      .for('update');

    return membership;
  }

  private async findMembershipByRealNameForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    realName: string,
  ) {
    const [membership] = await transaction
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
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
          sql`binary ${userProfiles.realName} = binary ${realName}`,
        ),
      )
      .limit(1)
      .for('update');

    return membership;
  }

  private async hardDeleteMembership(
    transaction: DatabaseTransaction,
    membership: {
      readonly cloudbaseUid: string | null;
      readonly id: string;
      readonly userId: string;
    },
  ): Promise<void> {
    await transaction
      .update(shiftAssignments)
      .set({
        plannedMembershipId: null,
        version: sql`${shiftAssignments.version} + 1`,
      })
      .where(
        and(
          eq(shiftAssignments.plannedMembershipId, membership.id),
          isNull(shiftAssignments.deletedAt),
        ),
      );
    await transaction
      .update(shiftAssignments)
      .set({
        actualMembershipId: null,
        version: sql`${shiftAssignments.version} + 1`,
      })
      .where(
        and(
          eq(shiftAssignments.actualMembershipId, membership.id),
          isNull(shiftAssignments.deletedAt),
        ),
      );

    const roleMembers = await transaction
      .select({ id: memberScheduleRoles.id })
      .from(memberScheduleRoles)
      .where(
        and(
          eq(memberScheduleRoles.membershipId, membership.id),
          isNull(memberScheduleRoles.deletedAt),
        ),
      );
    if (roleMembers.length > 0) {
      const roleMemberIds = roleMembers.map((member) => member.id);
      await transaction
        .delete(rotationMembers)
        .where(inArray(rotationMembers.memberScheduleRoleId, roleMemberIds));
      await transaction
        .delete(memberScheduleRoles)
        .where(inArray(memberScheduleRoles.id, roleMemberIds));
    }

    await transaction
      .delete(groupMemberContacts)
      .where(eq(groupMemberContacts.membershipId, membership.id));
    await transaction.delete(leaveRequests).where(eq(leaveRequests.membershipId, membership.id));
    await transaction
      .delete(swapRequests)
      .where(
        or(
          eq(swapRequests.initiatorMembershipId, membership.id),
          eq(swapRequests.targetMembershipId, membership.id),
        ),
      );
    await transaction
      .delete(dutyAdjustments)
      .where(
        or(
          eq(dutyAdjustments.overtimeMembershipId, membership.id),
          eq(dutyAdjustments.deductedMembershipId, membership.id),
        ),
      );
    await transaction.delete(groupMemberships).where(eq(groupMemberships.id, membership.id));

    if (membership.cloudbaseUid === null) {
      const [remainingMembership] = await transaction
        .select({ id: groupMemberships.id })
        .from(groupMemberships)
        .where(
          and(eq(groupMemberships.userId, membership.userId), isNull(groupMemberships.deletedAt)),
        )
        .limit(1);
      const [pendingRequest] = await transaction
        .select({ id: groupJoinRequests.id })
        .from(groupJoinRequests)
        .where(
          and(
            eq(groupJoinRequests.requestingUserId, membership.userId),
            eq(groupJoinRequests.status, 'pending'),
            isNull(groupJoinRequests.deletedAt),
          ),
        )
        .limit(1);
      if (remainingMembership === undefined && pendingRequest === undefined) {
        await transaction.delete(userProfiles).where(eq(userProfiles.userId, membership.userId));
        await transaction.delete(users).where(eq(users.id, membership.userId));
      }
    }
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
