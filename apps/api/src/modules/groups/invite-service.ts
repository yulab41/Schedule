import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type {
  AcceptInviteResponse,
  CreateInviteLinkResponse,
  GroupRole,
  InvitePermissionRole,
  ResolveInviteResponse,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  type ScheduleDatabase,
  groupJoinRequests,
  groupMemberships,
  groups,
  inviteTokens,
  memberScheduleRoles,
  membershipClaimRequests,
  rosterEntries,
  scheduleRoles,
  userAuthIdentities,
  userProfiles,
  users,
  wechatUnionAccounts,
  withTransaction,
} from '@schedule/database';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { GroupPermissionService } from './permission-service.js';

const MAX_PENDING_INVITES_PER_GROUP = 10;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateInviteLinkInput {
  readonly permissionRole?: InvitePermissionRole;
  readonly scheduleRoleId?: string;
  readonly targetMembershipId?: string;
  readonly targetRosterEntryId?: string;
}

export interface InviteServiceOptions {
  readonly databaseClient: DatabaseClient;
  readonly holidayAdminUids?: ReadonlySet<string>;
  readonly issueSessionForUser?:
    ((userId: string, openid: string, authVersion: number) => string) | undefined;
  readonly platformAdminUids?: ReadonlySet<string>;
}

export class InviteService {
  private readonly auditWriter = new AuditWriter();
  private readonly databaseClient: DatabaseClient;
  private readonly holidayAdminUids: ReadonlySet<string>;
  private readonly issueSessionForUser:
    ((userId: string, openid: string, authVersion: number) => string) | undefined;
  private readonly permissionService = new GroupPermissionService();
  private readonly platformAdminUids: ReadonlySet<string>;

  public constructor(options: InviteServiceOptions) {
    this.databaseClient = options.databaseClient;
    this.holidayAdminUids = options.holidayAdminUids ?? new Set();
    this.issueSessionForUser = options.issueSessionForUser;
    this.platformAdminUids = options.platformAdminUids ?? new Set();
  }

  public async createLink(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateInviteLinkInput,
  ): Promise<CreateInviteLinkResponse> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageInvites',
      );

      const [pendingCount] = await transaction
        .select({ count: sql<number>`count(*)` })
        .from(inviteTokens)
        .where(
          and(eq(inviteTokens.groupId, authorization.group.id), eq(inviteTokens.status, 'pending')),
        );
      if ((pendingCount?.count ?? 0) >= MAX_PENDING_INVITES_PER_GROUP) {
        throw new ApiError({
          code: 'RATE_LIMITED',
          statusCode: 429,
          userMessage: '该群待使用的邀请链接已达上限，请先撤销或等待使用。',
        });
      }

      const target = await this.resolveCreateTarget(transaction, authorization.group.id, input);
      const scheduleRoleName = await this.validateScheduleRole(
        transaction,
        authorization.group.id,
        input.scheduleRoleId,
      );
      const permissionRole = input.permissionRole ?? 'member';
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

      await transaction.insert(inviteTokens).values({
        createdByUserId: authorization.user.id,
        expiresAt,
        groupId: authorization.group.id,
        id: randomUUID(),
        inviteeRealName: target.realName,
        permissionRole,
        scheduleRoleId: input.scheduleRoleId ?? null,
        targetMembershipId: input.targetMembershipId ?? null,
        targetRosterEntryId: input.targetRosterEntryId ?? null,
        tokenHash,
      });
      await this.auditWriter.append(transaction, {
        action: 'invite_created',
        actorUserId: authorization.user.id,
        groupId: authorization.group.id,
        metadata: {
          inviteeRealName: target.realName,
          permissionRole,
          targetType: input.targetMembershipId === undefined ? 'roster_entry' : 'membership',
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: authorization.group.id,
        targetType: 'group',
      });

      return {
        expiresAt: expiresAt.toISOString(),
        groupName: authorization.group.name,
        permissionRole,
        realName: target.realName,
        ...(scheduleRoleName === undefined ? {} : { scheduleRoleName }),
        sharePath: `pages/invite/invite?t=${token}`,
        token,
      };
    });
  }

  public async resolve(
    identity: AuthenticatedIdentity,
    token: string,
  ): Promise<ResolveInviteResponse> {
    const tokenHash = hashToken(token);
    const invite = await this.findInvite(this.databaseClient.database, tokenHash);
    assertInviteUsable(invite);

    const [group] = await this.databaseClient.database
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(eq(groups.id, invite.groupId), isNull(groups.deletedAt)))
      .limit(1);
    if (group === undefined) {
      throw inviteInvalid();
    }

    return {
      groupId: group.id,
      groupName: group.name,
      inviteeRealName: invite.inviteeRealName,
      permissionRole: invite.permissionRole,
      ...(invite.scheduleRoleId === null
        ? {}
        : {
            scheduleRoleName:
              (await this.findScheduleRoleName(
                this.databaseClient.database,
                group.id,
                invite.scheduleRoleId,
              )) ?? undefined,
          }),
    };
  }

  public async accept(
    identity: AuthenticatedIdentity,
    token: string,
    confirmRealName: string,
  ): Promise<AcceptInviteResponse> {
    const tokenHash = hashToken(token);

    return withTransaction(this.databaseClient, async (transaction) => {
      const currentUser = await this.getActiveUserInTransaction(transaction, identity);
      const invite = await this.lockInvite(transaction, tokenHash);
      assertInviteUsable(invite);
      const confirmedName = confirmRealName.trim();
      if (confirmedName.length === 0 || confirmedName !== invite.inviteeRealName) {
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: '确认姓名与邀请不一致。',
        });
      }

      const [group] = await transaction
        .select({
          groupCode: groups.groupCode,
          id: groups.id,
          name: groups.name,
          version: groups.version,
        })
        .from(groups)
        .where(and(eq(groups.id, invite.groupId), isNull(groups.deletedAt)))
        .limit(1)
        .for('update');
      if (group === undefined) {
        throw inviteInvalid();
      }

      let role: GroupRole;
      let tokenOverride: string | undefined;
      if (invite.targetRosterEntryId !== null) {
        role = await this.acceptRosterTarget(transaction, group, invite, currentUser.id);
      } else if (invite.targetMembershipId !== null) {
        const result = await this.acceptMembershipTarget(transaction, group, invite, currentUser);
        role = result.role;
        tokenOverride = result.token;
      } else {
        throw inviteInvalid();
      }

      await this.markInviteUsed(transaction, invite.id, currentUser.id);
      const usedByUserId = currentUser.id;
      await this.auditWriter.append(transaction, {
        action: tokenOverride === undefined ? 'invite_accepted' : 'invite_accepted_merged',
        actorUserId: usedByUserId,
        groupId: group.id,
        metadata: {
          inviteeRealName: invite.inviteeRealName,
          permissionRole: invite.permissionRole,
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: group.id,
        targetType: 'group',
      });

      return {
        group: {
          groupCode: group.groupCode,
          id: group.id,
          name: group.name,
          role,
          version: group.version,
        },
        ...(tokenOverride === undefined ? {} : { token: tokenOverride }),
      };
    });
  }

  public async revoke(
    identity: AuthenticatedIdentity,
    groupId: string,
    token: string,
  ): Promise<void> {
    const tokenHash = hashToken(token);
    await withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageInvites',
      );
      const [invite] = await transaction
        .select()
        .from(inviteTokens)
        .where(
          and(
            eq(inviteTokens.groupId, authorization.group.id),
            eq(inviteTokens.tokenHash, tokenHash),
          ),
        )
        .limit(1)
        .for('update');
      if (invite === undefined) {
        throw inviteInvalid();
      }
      if (invite.status !== 'pending') {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '只能撤销待使用的邀请链接。',
        });
      }

      await transaction
        .update(inviteTokens)
        .set({ status: 'revoked', version: sql`${inviteTokens.version} + 1` })
        .where(eq(inviteTokens.id, invite.id));
      await this.auditWriter.append(transaction, {
        action: 'invite_revoked',
        actorUserId: authorization.user.id,
        groupId: authorization.group.id,
        metadata: { inviteeRealName: invite.inviteeRealName },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: authorization.group.id,
        targetType: 'group',
      });
    });
  }

  private async resolveCreateTarget(
    transaction: DatabaseTransaction,
    groupId: string,
    input: CreateInviteLinkInput,
  ): Promise<{ readonly realName: string }> {
    if (input.targetMembershipId !== undefined) {
      const [membership] = await transaction
        .select({ realName: userProfiles.realName })
        .from(groupMemberships)
        .innerJoin(users, eq(users.id, groupMemberships.userId))
        .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(
          and(
            eq(groupMemberships.id, input.targetMembershipId),
            eq(groupMemberships.groupId, groupId),
            eq(groupMemberships.status, 'active'),
            ne(groupMemberships.role, 'guest'),
            isNull(groupMemberships.deletedAt),
            isNull(users.deletedAt),
            isNull(userProfiles.deletedAt),
          ),
        )
        .limit(1)
        .for('update');
      if (membership === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '邀请目标成员不存在或不可用。',
        });
      }
      return { realName: membership.realName };
    }

    const [roster] = await transaction
      .select({ realName: rosterEntries.realName })
      .from(rosterEntries)
      .where(
        and(
          eq(rosterEntries.id, input.targetRosterEntryId ?? ''),
          eq(rosterEntries.groupId, groupId),
          eq(rosterEntries.status, 'pending'),
          isNull(rosterEntries.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (roster === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '邀请目标待认领人员不存在或不可用。',
      });
    }
    return { realName: roster.realName };
  }

  private async validateScheduleRole(
    transaction: DatabaseTransaction,
    groupId: string,
    scheduleRoleId: string | undefined,
  ): Promise<string | undefined> {
    if (scheduleRoleId === undefined) {
      return undefined;
    }
    const [role] = await transaction
      .select({ name: scheduleRoles.name })
      .from(scheduleRoles)
      .where(
        and(
          eq(scheduleRoles.id, scheduleRoleId),
          eq(scheduleRoles.groupId, groupId),
          isNull(scheduleRoles.deletedAt),
        ),
      )
      .limit(1);
    if (role === undefined) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '排班岗位不存在或不属于该群组。',
      });
    }
    return role.name;
  }

  private async acceptRosterTarget(
    transaction: DatabaseTransaction,
    group: { readonly id: string },
    invite: typeof inviteTokens.$inferSelect,
    userId: string,
  ): Promise<InvitePermissionRole> {
    const [roster] = await transaction
      .select()
      .from(rosterEntries)
      .where(
        and(
          eq(rosterEntries.id, invite.targetRosterEntryId as string),
          eq(rosterEntries.groupId, group.id),
          eq(rosterEntries.status, 'pending'),
          isNull(rosterEntries.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (roster === undefined) {
      throw inviteInvalid();
    }

    await this.assertNoActiveMembership(transaction, group.id, userId);
    const membershipId = randomUUID();
    await transaction.insert(groupMemberships).values({
      groupId: group.id,
      id: membershipId,
      role: invite.permissionRole,
      userId,
    });
    await transaction
      .update(rosterEntries)
      .set({
        claimedByUserId: userId,
        status: 'claimed',
        version: sql`${rosterEntries.version} + 1`,
      })
      .where(eq(rosterEntries.id, roster.id));
    if (invite.scheduleRoleId !== null) {
      await this.addScheduleRole(transaction, membershipId, invite.scheduleRoleId);
    }
    return invite.permissionRole;
  }

  private async acceptMembershipTarget(
    transaction: DatabaseTransaction,
    group: {
      readonly groupCode: string;
      readonly id: string;
      readonly name: string;
      readonly version: number;
    },
    invite: typeof inviteTokens.$inferSelect,
    currentUser: { readonly cloudbaseUid: string; readonly id: string; readonly realName: string },
  ): Promise<{ readonly role: GroupRole; readonly token: string | undefined }> {
    const [membership] = await transaction
      .select({
        cloudbaseUid: users.cloudbaseUid,
        id: groupMemberships.id,
        role: groupMemberships.role,
        userId: groupMemberships.userId,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.id, invite.targetMembershipId as string),
          eq(groupMemberships.groupId, group.id),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (membership === undefined) {
      throw inviteInvalid();
    }
    if (membership.userId === currentUser.id) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '您已经是该成员身份，无需重复接受。',
      });
    }

    if (membership.cloudbaseUid === null) {
      await this.bindUnclaimedMembership(
        transaction,
        membership.id,
        membership.userId,
        currentUser.id,
      );
      await transaction
        .update(groupMemberships)
        .set({ role: invite.permissionRole, version: sql`${groupMemberships.version} + 1` })
        .where(eq(groupMemberships.id, membership.id));
      if (invite.scheduleRoleId !== null) {
        await this.addScheduleRole(transaction, membership.id, invite.scheduleRoleId);
      }
      return { role: invite.permissionRole, token: undefined };
    }

    return this.mergeWechatAccounts(transaction, group, invite, membership, currentUser);
  }

  private async mergeWechatAccounts(
    transaction: DatabaseTransaction,
    group: {
      readonly groupCode: string;
      readonly id: string;
      readonly name: string;
      readonly version: number;
    },
    invite: typeof inviteTokens.$inferSelect,
    targetMembership: {
      readonly cloudbaseUid: string | null;
      readonly id: string;
      readonly role: string;
      readonly userId: string;
    },
    currentUser: { readonly cloudbaseUid: string; readonly id: string; readonly realName: string },
  ): Promise<{ readonly role: GroupRole; readonly token: string | undefined }> {
    if (
      this.platformAdminUids.has(currentUser.cloudbaseUid) ||
      this.holidayAdminUids.has(currentUser.cloudbaseUid)
    ) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '平台或节假日管理员账号不能合并，请先处理身份冲突。',
      });
    }

    const [currentUserRow] = await transaction
      .select({ wechatOpenid: users.wechatOpenid })
      .from(users)
      .where(eq(users.id, currentUser.id))
      .limit(1)
      .for('update');
    if (currentUserRow?.wechatOpenid === null || currentUserRow?.wechatOpenid === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '当前账号未绑定微信身份，无法执行合并。',
      });
    }

    const [targetUserRow] = await transaction
      .select({ authVersion: users.authVersion, wechatOpenid: users.wechatOpenid })
      .from(users)
      .where(eq(users.id, targetMembership.userId))
      .limit(1)
      .for('update');
    if (targetUserRow === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '目标账号已不存在，无法合并。',
      });
    }
    if (
      targetUserRow.wechatOpenid !== null &&
      targetUserRow.wechatOpenid !== currentUserRow.wechatOpenid
    ) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '目标账号已绑定其他微信身份，无法合并。',
      });
    }

    await this.assertNoOverlappingGroups(transaction, currentUser.id, targetMembership.userId);

    await transaction
      .update(groupMemberships)
      .set({ userId: targetMembership.userId, version: sql`${groupMemberships.version} + 1` })
      .where(
        and(
          eq(groupMemberships.userId, currentUser.id),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      );
    await transaction
      .update(groups)
      .set({ ownerUserId: targetMembership.userId, version: sql`${groups.version} + 1` })
      .where(eq(groups.ownerUserId, currentUser.id));
    await transaction
      .update(membershipClaimRequests)
      .set({
        requestingUserId: targetMembership.userId,
        version: sql`${membershipClaimRequests.version} + 1`,
      })
      .where(
        and(
          eq(membershipClaimRequests.requestingUserId, currentUser.id),
          eq(membershipClaimRequests.status, 'pending'),
          isNull(membershipClaimRequests.deletedAt),
        ),
      );
    await transaction
      .update(groupJoinRequests)
      .set({
        requestingUserId: targetMembership.userId,
        version: sql`${groupJoinRequests.version} + 1`,
      })
      .where(
        and(
          eq(groupJoinRequests.requestingUserId, currentUser.id),
          eq(groupJoinRequests.status, 'pending'),
          isNull(groupJoinRequests.deletedAt),
        ),
      );

    const openid = currentUserRow.wechatOpenid;
    await transaction
      .update(users)
      .set({ wechatOpenid: null, version: sql`${users.version} + 1` })
      .where(eq(users.id, currentUser.id));
    await transaction
      .update(users)
      .set({ wechatOpenid: openid, version: sql`${users.version} + 1` })
      .where(eq(users.id, targetMembership.userId));
    await transaction
      .update(userAuthIdentities)
      .set({ userId: targetMembership.userId })
      .where(eq(userAuthIdentities.userId, currentUser.id));
    await transaction
      .update(wechatUnionAccounts)
      .set({ userId: targetMembership.userId })
      .where(eq(wechatUnionAccounts.userId, currentUser.id));
    await transaction
      .update(users)
      .set({
        cloudbaseUid: null,
        deletedAt: sql`current_timestamp(3)`,
        status: 'deleted',
        version: sql`${users.version} + 1`,
      })
      .where(eq(users.id, currentUser.id));
    await transaction
      .update(userProfiles)
      .set({ deletedAt: sql`current_timestamp(3)`, version: sql`${userProfiles.version} + 1` })
      .where(and(eq(userProfiles.userId, currentUser.id), isNull(userProfiles.deletedAt)));

    if (this.issueSessionForUser === undefined) {
      throw new ApiError({
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        userMessage: '合并成功但会话签发暂不可用，请重新登录。',
      });
    }
    return {
      role: targetMembership.role as GroupRole,
      token: this.issueSessionForUser(targetMembership.userId, openid, targetUserRow.authVersion),
    };
  }

  private async bindUnclaimedMembership(
    transaction: DatabaseTransaction,
    membershipId: string,
    previousUserId: string,
    userId: string,
  ): Promise<void> {
    await transaction
      .update(groupMemberships)
      .set({ userId, version: sql`${groupMemberships.version} + 1` })
      .where(eq(groupMemberships.id, membershipId));
    if (previousUserId !== userId) {
      await this.releaseUnboundUserIfUnused(transaction, previousUserId);
    }
  }

  private async addScheduleRole(
    transaction: DatabaseTransaction,
    membershipId: string,
    scheduleRoleId: string,
  ): Promise<void> {
    const [existing] = await transaction
      .select({ id: memberScheduleRoles.id })
      .from(memberScheduleRoles)
      .where(
        and(
          eq(memberScheduleRoles.membershipId, membershipId),
          eq(memberScheduleRoles.scheduleRoleId, scheduleRoleId),
          isNull(memberScheduleRoles.deletedAt),
        ),
      )
      .limit(1);
    if (existing === undefined) {
      await transaction.insert(memberScheduleRoles).values({
        id: randomUUID(),
        membershipId,
        scheduleRoleId,
      });
    }
  }

  private async assertNoActiveMembership(
    transaction: DatabaseTransaction,
    groupId: string,
    userId: string,
  ): Promise<void> {
    const [membership] = await transaction
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, userId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1);
    if (membership !== undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '您已经加入该群组。',
      });
    }
  }

  private async assertNoOverlappingGroups(
    transaction: DatabaseTransaction,
    firstUserId: string,
    secondUserId: string,
  ): Promise<void> {
    const rows = await transaction
      .select({ groupId: groupMemberships.groupId })
      .from(groupMemberships)
      .where(
        and(
          inArray(groupMemberships.userId, [firstUserId, secondUserId]),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .groupBy(groupMemberships.groupId)
      .having(sql`count(distinct ${groupMemberships.userId}) = 2`);
    if (rows.length > 0) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '两个账号在同一群组已有身份，无法合并。',
      });
    }
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

  private async getActiveUserInTransaction(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
  ): Promise<{ readonly cloudbaseUid: string; readonly id: string; readonly realName: string }> {
    const [user] = await transaction
      .select({
        cloudbaseUid: users.cloudbaseUid,
        id: users.id,
        realName: userProfiles.realName,
        status: users.status,
      })
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
    if (user === undefined || user.cloudbaseUid === null) {
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
    return { cloudbaseUid: user.cloudbaseUid, id: user.id, realName: user.realName };
  }

  private async findInvite(
    db: ScheduleDatabase | DatabaseTransaction,
    tokenHash: string,
  ): Promise<typeof inviteTokens.$inferSelect> {
    const [invite] = await db
      .select()
      .from(inviteTokens)
      .where(eq(inviteTokens.tokenHash, tokenHash))
      .limit(1);
    if (invite === undefined) {
      throw inviteInvalid();
    }
    return invite;
  }

  private async lockInvite(
    db: DatabaseTransaction,
    tokenHash: string,
  ): Promise<typeof inviteTokens.$inferSelect> {
    const [invite] = await db
      .select()
      .from(inviteTokens)
      .where(eq(inviteTokens.tokenHash, tokenHash))
      .limit(1)
      .for('update');
    if (invite === undefined) {
      throw inviteInvalid();
    }
    return invite;
  }

  private async markInviteUsed(
    transaction: DatabaseTransaction,
    inviteId: string,
    userId: string,
  ): Promise<void> {
    await transaction
      .update(inviteTokens)
      .set({
        status: 'used',
        usedAt: new Date(),
        usedByUserId: userId,
        version: sql`${inviteTokens.version} + 1`,
      })
      .where(eq(inviteTokens.id, inviteId));
  }

  private async findScheduleRoleName(
    db: ScheduleDatabase | DatabaseTransaction,
    groupId: string,
    scheduleRoleId: string,
  ): Promise<string | undefined> {
    const [role] = await db
      .select({ name: scheduleRoles.name })
      .from(scheduleRoles)
      .where(
        and(
          eq(scheduleRoles.id, scheduleRoleId),
          eq(scheduleRoles.groupId, groupId),
          isNull(scheduleRoles.deletedAt),
        ),
      )
      .limit(1);
    return role?.name;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function assertInviteUsable(invite: typeof inviteTokens.$inferSelect): void {
  if (invite.status === 'used') {
    throw new ApiError({
      code: 'INVITE_USED',
      statusCode: 409,
      userMessage: '该邀请链接已被使用。',
    });
  }
  if (invite.status === 'revoked') {
    throw inviteInvalid();
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new ApiError({
      code: 'INVITE_EXPIRED',
      statusCode: 410,
      userMessage: '该邀请链接已过期。',
    });
  }
}

function inviteInvalid(): ApiError {
  return new ApiError({
    code: 'INVITE_INVALID',
    statusCode: 400,
    userMessage: '邀请链接无效。',
  });
}
