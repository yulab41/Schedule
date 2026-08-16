import type { SchedulePublishMode } from '@schedule/contracts';
import type { DatabaseTransaction } from '@schedule/database';
import { groupMemberships, groups, userProfiles, users } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';

export type GroupPermission =
  | 'deleteGroup'
  | 'manageDutyAdjustments'
  | 'manageAdministrators'
  | 'manageContacts'
  | 'manageLeaves'
  | 'manageInvites'
  | 'manageMembers'
  | 'manageNotifications'
  | 'manageRoster'
  | 'manageScheduleConfiguration'
  | 'manageSwaps'
  | 'updateGroupCode'
  | 'regenerateVisitorKey'
  | 'restoreGroup'
  | 'transferOwnership'
  | 'updateGroupName'
  | 'viewContacts'
  | 'viewGuestCalendar'
  | 'viewGroupQr'
  | 'viewMembers'
  | 'viewVisitorAccessLogs'
  | 'viewScheduleConfiguration';

export interface ActiveGroupUser {
  readonly id: string;
  readonly isDeveloperAdmin: boolean;
  readonly realName: string;
}

export interface ActiveGroup {
  readonly groupCode: string;
  readonly dutyAdjustmentApprovalRequired: boolean;
  readonly id: string;
  readonly leaveReflowStrategy: 'keep-original-order' | 'shift-forward';
  readonly name: string;
  readonly ownerUserId: string;
  readonly rulesVersion: number;
  readonly schedulePublishMode: SchedulePublishMode;
  readonly swapApprovalRequired: boolean;
  readonly version: number;
}

export interface ActiveGroupMembership {
  readonly autoAcceptSwaps: boolean;
  readonly id: string;
  readonly isDeveloperAdmin: boolean;
  readonly role: 'administrator' | 'guest' | 'member' | 'owner';
  readonly userId: string;
}

export interface GroupAuthorization {
  readonly group: ActiveGroup;
  readonly membership: ActiveGroupMembership;
  readonly user: ActiveGroupUser;
}

const permissionsByRole: Readonly<
  Record<ActiveGroupMembership['role'], readonly GroupPermission[]>
> = {
  administrator: [
    'manageContacts',
    'manageDutyAdjustments',
    'manageLeaves',
    'manageInvites',
    'manageMembers',
    'manageNotifications',
    'manageRoster',
    'manageScheduleConfiguration',
    'manageSwaps',
    'viewGroupQr',
    'viewVisitorAccessLogs',
    'viewContacts',
    'viewMembers',
    'viewScheduleConfiguration',
  ],
  guest: ['viewGuestCalendar'],
  member: ['viewContacts', 'viewMembers', 'viewScheduleConfiguration'],
  owner: [
    'deleteGroup',
    'manageAdministrators',
    'manageContacts',
    'manageDutyAdjustments',
    'manageLeaves',
    'manageInvites',
    'manageMembers',
    'manageNotifications',
    'manageRoster',
    'manageScheduleConfiguration',
    'manageSwaps',
    'updateGroupCode',
    'regenerateVisitorKey',
    'restoreGroup',
    'transferOwnership',
    'updateGroupName',
    'viewContacts',
    'viewGuestCalendar',
    'viewGroupQr',
    'viewMembers',
    'viewVisitorAccessLogs',
    'viewScheduleConfiguration',
  ],
};

export class GroupPermissionService {
  public async requirePermission(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    groupId: string,
    permission: GroupPermission,
  ): Promise<GroupAuthorization> {
    const user = await this.getActiveUserForUpdate(transaction, identity);
    const group = await this.getActiveGroupForUpdate(transaction, groupId);
    const membership = await this.getActiveMembershipForUpdate(transaction, group.id, user.id);

    if (
      !user.isDeveloperAdmin &&
      ((membership.role === 'owner' && group.ownerUserId !== user.id) ||
        (group.ownerUserId === user.id && membership.role !== 'owner'))
    ) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '群组负责人状态已发生变化，请刷新后重试。',
      });
    }

    if (!user.isDeveloperAdmin && !permissionsByRole[membership.role].includes(permission)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '当前账号无权执行此群组操作。',
      });
    }

    return { group, membership, user };
  }

  public async getActiveMembershipForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    userId: string,
  ): Promise<ActiveGroupMembership> {
    const [membership] = await transaction
      .select({
        autoAcceptSwapsManuallySetValue: groupMemberships.autoAcceptSwapsManuallySet,
        autoAcceptSwapsValue: groupMemberships.autoAcceptSwaps,
        id: groupMemberships.id,
        role: groupMemberships.role,
        userId: groupMemberships.userId,
      })
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
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '当前账号不是该群组的有效成员。',
      });
    }

    return {
      autoAcceptSwaps:
        membership.autoAcceptSwapsManuallySetValue === 1
          ? membership.autoAcceptSwapsValue === 1
          : true,
      id: membership.id,
      isDeveloperAdmin: false,
      role: membership.role,
      userId: membership.userId,
    };
  }

  public async getActiveMemberForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId: string,
  ): Promise<ActiveGroupMembership> {
    const [membership] = await transaction
      .select({
        autoAcceptSwapsManuallySetValue: groupMemberships.autoAcceptSwapsManuallySet,
        autoAcceptSwapsValue: groupMemberships.autoAcceptSwaps,
        id: groupMemberships.id,
        isDeveloperAdmin: users.isDeveloperAdmin,
        role: groupMemberships.role,
        userId: groupMemberships.userId,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.id, membershipId),
          eq(groupMemberships.status, 'active'),
          eq(users.status, 'active'),
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
        userMessage: '群组成员不存在或不可用。',
      });
    }

    return {
      autoAcceptSwaps:
        membership.autoAcceptSwapsManuallySetValue === 1
          ? membership.autoAcceptSwapsValue === 1
          : true,
      id: membership.id,
      isDeveloperAdmin: membership.isDeveloperAdmin === 1,
      role: membership.role,
      userId: membership.userId,
    };
  }

  private async getActiveUserForUpdate(
    transaction: DatabaseTransaction,
    identity: AuthenticatedIdentity,
  ): Promise<ActiveGroupUser> {
    const [user] = await transaction
      .select({
        id: users.id,
        isDeveloperAdmin: users.isDeveloperAdmin,
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

    return {
      id: user.id,
      isDeveloperAdmin: user.isDeveloperAdmin === 1,
      realName: user.realName,
    };
  }

  private async getActiveGroupForUpdate(
    transaction: DatabaseTransaction,
    groupId: string,
  ): Promise<ActiveGroup> {
    const [group] = await transaction
      .select({
        dutyAdjustmentApprovalRequiredValue: groups.dutyAdjustmentApprovalRequired,
        swapApprovalRequiredManuallySetValue: groups.swapApprovalRequiredManuallySet,
        swapApprovalRequiredValue: groups.swapApprovalRequired,
        groupCode: groups.groupCode,
        id: groups.id,
        leaveReflowStrategy: groups.leaveReflowStrategy,
        name: groups.name,
        ownerUserId: groups.ownerUserId,
        rulesVersion: groups.rulesVersion,
        schedulePublishMode: groups.schedulePublishMode,
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

    return {
      dutyAdjustmentApprovalRequired: group.dutyAdjustmentApprovalRequiredValue === 1,
      groupCode: group.groupCode,
      id: group.id,
      leaveReflowStrategy: group.leaveReflowStrategy,
      name: group.name,
      ownerUserId: group.ownerUserId,
      rulesVersion: group.rulesVersion,
      schedulePublishMode: group.schedulePublishMode,
      swapApprovalRequired:
        group.swapApprovalRequiredManuallySetValue === 1
          ? group.swapApprovalRequiredValue === 1
          : false,
      version: group.version,
    };
  }
}
