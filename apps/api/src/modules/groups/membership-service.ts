import { randomUUID } from 'node:crypto';

import type {
  CreateMembershipClaimRequest,
  CreateMembershipClaimResponse,
  GroupMember,
  GroupRole,
  GroupSummary,
  MembershipClaimLookupRequest,
  MembershipClaimLookupResponse,
  MembershipClaimRequest,
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
  membershipClaimRequests,
  memberScheduleRoles,
  rosterEntries,
  rotationMembers,
  shiftAssignments,
  swapRequests,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { updateShiftAssignments } from '../schedules/shift-assignment-writer.js';
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
      const pendingClaims = await transaction
        .select({ targetMembershipId: membershipClaimRequests.targetMembershipId })
        .from(membershipClaimRequests)
        .where(
          and(
            eq(membershipClaimRequests.groupId, authorization.group.id),
            eq(membershipClaimRequests.requestingUserId, authorization.user.id),
            eq(membershipClaimRequests.status, 'pending'),
            isNull(membershipClaimRequests.deletedAt),
          ),
        );
      const pendingClaimTargetIds = new Set(pendingClaims.map((claim) => claim.targetMembershipId));

      const memberRows: GroupMember[] = members.map((member) => ({
        ...(pendingClaimTargetIds.has(member.id) ? { claimRequestStatus: 'pending' as const } : {}),
        id: member.id,
        isClaimedByCurrentUser: member.userId === authorization.user.id,
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

  public async lookupClaimMatches(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: MembershipClaimLookupRequest,
  ): Promise<MembershipClaimLookupResponse> {
    const realName = input.realName.trim();
    if (realName.length === 0) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '真实姓名不能为空。',
      });
    }

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
            sql`binary ${userProfiles.realName} = binary ${realName}`,
          ),
        )
        .orderBy(asc(userProfiles.realName), asc(groupMemberships.id));

      return {
        matches: members.map((member) => ({
          isUnclaimed: member.cloudbaseUid === null,
          membershipId: member.id,
          realName: member.realName,
          role: member.role,
        })),
      };
    });
  }

  public async createClaimRequest(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateMembershipClaimRequest,
  ): Promise<CreateMembershipClaimResponse> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewMembers',
      );
      const target = await this.findMembershipForUpdate(
        transaction,
        authorization.group.id,
        input.membershipId,
      );
      if (target === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '成员不存在或不可用。',
        });
      }
      if (target.userId === authorization.user.id) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '你已经是该成员身份，无需重复认领。',
        });
      }
      if (target.cloudbaseUid !== null) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该成员已被其他账号认领，不能重复认领。',
        });
      }

      if (authorization.membership.role !== 'member') {
        await this.endMembershipForClaim(
          transaction,
          authorization.group.id,
          authorization.user.id,
        );
        await this.bindMembershipToUser(transaction, target.id, authorization.user.id);
        await this.updateProfileRealName(transaction, authorization.user.id, target.realName);
        await this.cancelPendingClaimsForTarget(transaction, target.id);

        return { direct: true };
      }

      const [existing] = await transaction
        .select({ id: membershipClaimRequests.id })
        .from(membershipClaimRequests)
        .where(
          and(
            eq(membershipClaimRequests.groupId, authorization.group.id),
            eq(membershipClaimRequests.requestingUserId, authorization.user.id),
            eq(membershipClaimRequests.targetMembershipId, target.id),
            eq(membershipClaimRequests.status, 'pending'),
            isNull(membershipClaimRequests.deletedAt),
          ),
        )
        .limit(1)
        .for('update');
      if (existing !== undefined) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '你已有该成员身份的待审批认领申请。',
        });
      }

      const claimRequestId = randomUUID();
      await transaction.insert(membershipClaimRequests).values({
        groupId: authorization.group.id,
        id: claimRequestId,
        requestingUserId: authorization.user.id,
        targetMembershipId: target.id,
      });

      return {
        direct: false,
        request: await this.readClaimRequest(transaction, authorization.group.id, claimRequestId),
      };
    });
  }

  public async listClaimRequests(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<readonly MembershipClaimRequest[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewMembers',
      );
      const isAdministrator = authorization.membership.role !== 'member';
      const rows = await transaction
        .select()
        .from(membershipClaimRequests)
        .where(
          and(
            eq(membershipClaimRequests.groupId, authorization.group.id),
            ...(isAdministrator
              ? []
              : [eq(membershipClaimRequests.requestingUserId, authorization.user.id)]),
            isNull(membershipClaimRequests.deletedAt),
          ),
        )
        .orderBy(desc(membershipClaimRequests.createdAt), desc(membershipClaimRequests.id));
      if (rows.length === 0) {
        return [];
      }

      const userIds = [
        ...new Set([
          ...rows.map((row) => row.requestingUserId),
          ...rows.flatMap((row) => (row.decidedByUserId === null ? [] : [row.decidedByUserId])),
        ]),
      ];
      const membershipIds = [...new Set(rows.map((row) => row.targetMembershipId))];
      const [profiles, targets] = await Promise.all([
        transaction
          .select({ realName: userProfiles.realName, userId: userProfiles.userId })
          .from(userProfiles)
          .where(and(inArray(userProfiles.userId, userIds), isNull(userProfiles.deletedAt))),
        transaction
          .select({ id: groupMemberships.id, userId: groupMemberships.userId })
          .from(groupMemberships)
          .where(inArray(groupMemberships.id, membershipIds)),
      ]);
      const profileNameByUserId = new Map(
        profiles.map((profile) => [profile.userId, profile.realName]),
      );
      const targetUserIdById = new Map(targets.map((target) => [target.id, target.userId]));
      const targetMembers = await transaction
        .select({ realName: userProfiles.realName, userId: userProfiles.userId })
        .from(userProfiles)
        .where(
          and(
            inArray(userProfiles.userId, [...targetUserIdById.values()]),
            isNull(userProfiles.deletedAt),
          ),
        );
      const targetNameByUserId = new Map(
        targetMembers.map((member) => [member.userId, member.realName]),
      );

      return rows.map((row) => {
        const targetUserId = targetUserIdById.get(row.targetMembershipId);
        const decidedByRealName =
          row.decidedByUserId === null ? undefined : profileNameByUserId.get(row.decidedByUserId);
        return {
          createdAt: row.createdAt.toISOString(),
          ...(row.decidedAt === null ? {} : { decidedAt: row.decidedAt.toISOString() }),
          ...(row.decidedByUserId === null
            ? {}
            : {
                ...(decidedByRealName === undefined ? {} : { decidedByRealName }),
                decidedByUserId: row.decidedByUserId,
              }),
          groupId: row.groupId,
          id: row.id,
          requestingUserRealName: profileNameByUserId.get(row.requestingUserId) ?? '',
          requestingUserId: row.requestingUserId,
          status: row.status,
          targetMemberRealName:
            targetUserId === undefined ? '' : (targetNameByUserId.get(targetUserId) ?? ''),
          targetMembershipId: row.targetMembershipId,
          version: row.version,
        };
      });
    });
  }

  public async approveClaimRequest(
    identity: AuthenticatedIdentity,
    groupId: string,
    claimRequestId: string,
  ): Promise<MembershipClaimRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageMembers',
      );
      const request = await this.lockClaimRequest(
        transaction,
        authorization.group.id,
        claimRequestId,
      );
      if (request === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '认领申请不存在或不可用。',
        });
      }
      if (request.status !== 'pending') {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该认领申请已被处理。',
        });
      }
      const target = await this.findMembershipForUpdate(
        transaction,
        authorization.group.id,
        request.targetMembershipId,
      );
      if (target === undefined || target.cloudbaseUid !== null) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该成员已被其他账号认领，申请无法生效。',
        });
      }

      await this.endMembershipForClaim(
        transaction,
        authorization.group.id,
        request.requestingUserId,
      );
      await this.bindMembershipToUser(transaction, target.id, request.requestingUserId);
      await this.updateProfileRealName(transaction, request.requestingUserId, target.realName);
      await this.cancelPendingClaimsForTarget(transaction, target.id);
      await transaction
        .update(membershipClaimRequests)
        .set({
          decidedAt: new Date(),
          decidedByUserId: authorization.user.id,
          status: 'approved',
          version: sql`${membershipClaimRequests.version} + 1`,
        })
        .where(eq(membershipClaimRequests.id, request.id));

      return this.readClaimRequest(transaction, authorization.group.id, request.id);
    });
  }

  public async rejectClaimRequest(
    identity: AuthenticatedIdentity,
    groupId: string,
    claimRequestId: string,
  ): Promise<MembershipClaimRequest> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageMembers',
      );
      const request = await this.lockClaimRequest(
        transaction,
        authorization.group.id,
        claimRequestId,
      );
      if (request === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '认领申请不存在或不可用。',
        });
      }
      if (request.status !== 'pending') {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该认领申请已被处理。',
        });
      }
      await transaction
        .update(membershipClaimRequests)
        .set({
          decidedAt: new Date(),
          decidedByUserId: authorization.user.id,
          status: 'rejected',
          version: sql`${membershipClaimRequests.version} + 1`,
        })
        .where(eq(membershipClaimRequests.id, request.id));

      return this.readClaimRequest(transaction, authorization.group.id, request.id);
    });
  }

  public async revokeClaim(
    identity: AuthenticatedIdentity,
    groupId: string,
    membershipId: string,
  ): Promise<void> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageMembers',
      );
      const target = await this.findMembershipForUpdate(
        transaction,
        authorization.group.id,
        membershipId,
      );
      if (target === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '成员不存在或不可用。',
        });
      }
      if (target.cloudbaseUid === null) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该成员尚未被认领。',
        });
      }

      const placeholderUserId = randomUUID();
      await transaction.insert(users).values({
        id: placeholderUserId,
        status: 'active',
      });
      await transaction.insert(userProfiles).values({
        realName: target.realName,
        userId: placeholderUserId,
      });
      await transaction
        .update(groupMemberships)
        .set({
          userId: placeholderUserId,
          version: sql`${groupMemberships.version} + 1`,
        })
        .where(eq(groupMemberships.id, target.id));
      await this.cancelPendingClaimsForTarget(transaction, target.id);
    });
  }

  private async readClaimRequest(
    transaction: DatabaseTransaction,
    groupId: string,
    claimRequestId: string,
  ): Promise<MembershipClaimRequest> {
    const requests = await this.listClaimRequestRows(transaction, groupId, claimRequestId);
    const request = requests[0];
    if (request === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '认领申请不存在或不可用。',
      });
    }
    return request;
  }

  private async listClaimRequestRows(
    transaction: DatabaseTransaction,
    groupId: string,
    claimRequestId?: string,
  ): Promise<readonly MembershipClaimRequest[]> {
    const rows = await transaction
      .select()
      .from(membershipClaimRequests)
      .where(
        and(
          eq(membershipClaimRequests.groupId, groupId),
          ...(claimRequestId === undefined ? [] : [eq(membershipClaimRequests.id, claimRequestId)]),
          isNull(membershipClaimRequests.deletedAt),
        ),
      )
      .orderBy(desc(membershipClaimRequests.createdAt), desc(membershipClaimRequests.id))
      .limit(claimRequestId === undefined ? 100 : 1);
    if (rows.length === 0) {
      return [];
    }

    const userIds = [
      ...new Set([
        ...rows.map((row) => row.requestingUserId),
        ...rows.flatMap((row) => (row.decidedByUserId === null ? [] : [row.decidedByUserId])),
      ]),
    ];
    const membershipIds = [...new Set(rows.map((row) => row.targetMembershipId))];
    const [profiles, targets] = await Promise.all([
      transaction
        .select({ realName: userProfiles.realName, userId: userProfiles.userId })
        .from(userProfiles)
        .where(and(inArray(userProfiles.userId, userIds), isNull(userProfiles.deletedAt))),
      transaction
        .select({ id: groupMemberships.id, userId: groupMemberships.userId })
        .from(groupMemberships)
        .where(inArray(groupMemberships.id, membershipIds)),
    ]);
    const profileNameByUserId = new Map(
      profiles.map((profile) => [profile.userId, profile.realName]),
    );
    const targetUserIdById = new Map(targets.map((target) => [target.id, target.userId]));
    const targetNames = await transaction
      .select({ realName: userProfiles.realName, userId: userProfiles.userId })
      .from(userProfiles)
      .where(
        and(
          inArray(userProfiles.userId, [...targetUserIdById.values()]),
          isNull(userProfiles.deletedAt),
        ),
      );
    const targetNameByUserId = new Map(
      targetNames.map((member) => [member.userId, member.realName]),
    );

    return rows.map((row) => {
      const targetUserId = targetUserIdById.get(row.targetMembershipId);
      const decidedByRealName =
        row.decidedByUserId === null ? undefined : profileNameByUserId.get(row.decidedByUserId);
      return {
        createdAt: row.createdAt.toISOString(),
        ...(row.decidedAt === null ? {} : { decidedAt: row.decidedAt.toISOString() }),
        ...(row.decidedByUserId === null
          ? {}
          : {
              ...(decidedByRealName === undefined ? {} : { decidedByRealName }),
              decidedByUserId: row.decidedByUserId,
            }),
        groupId: row.groupId,
        id: row.id,
        requestingUserRealName: profileNameByUserId.get(row.requestingUserId) ?? '',
        requestingUserId: row.requestingUserId,
        status: row.status,
        targetMemberRealName:
          targetUserId === undefined ? '' : (targetNameByUserId.get(targetUserId) ?? ''),
        targetMembershipId: row.targetMembershipId,
        version: row.version,
      };
    });
  }

  private async lockClaimRequest(
    transaction: DatabaseTransaction,
    groupId: string,
    claimRequestId: string,
  ) {
    const [request] = await transaction
      .select()
      .from(membershipClaimRequests)
      .where(
        and(
          eq(membershipClaimRequests.groupId, groupId),
          eq(membershipClaimRequests.id, claimRequestId),
          isNull(membershipClaimRequests.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    return request;
  }

  private async bindMembershipToUser(
    transaction: DatabaseTransaction,
    membershipId: string,
    userId: string,
  ): Promise<void> {
    const [current] = await transaction
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(eq(groupMemberships.id, membershipId))
      .limit(1);
    await transaction
      .update(groupMemberships)
      .set({ userId, version: sql`${groupMemberships.version} + 1` })
      .where(eq(groupMemberships.id, membershipId));
    if (current !== undefined && current.userId !== userId) {
      await this.releaseUnboundUserIfUnused(transaction, current.userId);
    }
  }

  private async endMembershipForClaim(
    transaction: DatabaseTransaction,
    groupId: string,
    userId: string,
  ): Promise<void> {
    const [membership] = await transaction
      .select({ id: groupMemberships.id, role: groupMemberships.role })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, userId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (membership === undefined) {
      return;
    }
    if (membership.role === 'owner') {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '群主不能认领其他成员身份，请先转让群主。',
      });
    }

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
    await transaction
      .update(groupMemberships)
      .set({
        deletedAt: sql`current_timestamp(3)`,
        status: 'inactive',
        version: sql`${groupMemberships.version} + 1`,
      })
      .where(eq(groupMemberships.id, membership.id));
  }

  private async updateProfileRealName(
    transaction: DatabaseTransaction,
    userId: string,
    realName: string,
  ): Promise<void> {
    await transaction
      .update(userProfiles)
      .set({ realName, version: sql`${userProfiles.version} + 1` })
      .where(eq(userProfiles.userId, userId));
  }

  private async releaseUnboundUserIfUnused(
    transaction: DatabaseTransaction,
    userId: string,
  ): Promise<void> {
    const [user] = await transaction
      .select({ cloudbaseUid: users.cloudbaseUid })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user === undefined || user.cloudbaseUid !== null) {
      return;
    }
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
      .set({ deletedAt: sql`current_timestamp(3)`, version: sql`${userProfiles.version} + 1` })
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

  private async cancelPendingClaimsForTarget(
    transaction: DatabaseTransaction,
    targetMembershipId: string,
  ): Promise<void> {
    await transaction
      .update(membershipClaimRequests)
      .set({
        status: 'cancelled',
        version: sql`${membershipClaimRequests.version} + 1`,
      })
      .where(
        and(
          eq(membershipClaimRequests.targetMembershipId, targetMembershipId),
          eq(membershipClaimRequests.status, 'pending'),
          isNull(membershipClaimRequests.deletedAt),
        ),
      );
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
    await updateShiftAssignments(
      transaction,
      and(
        eq(shiftAssignments.plannedMembershipId, membership.id),
        isNull(shiftAssignments.deletedAt),
      ),
      { plannedMembershipId: null },
    );
    await updateShiftAssignments(
      transaction,
      and(
        eq(shiftAssignments.actualMembershipId, membership.id),
        isNull(shiftAssignments.deletedAt),
      ),
      { actualMembershipId: null },
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
