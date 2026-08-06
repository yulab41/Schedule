import type { DatabaseTransaction } from '@schedule/database';
import { groupMemberships, scheduleRoles, userProfiles, users } from '@schedule/database';
import { and, eq, inArray, isNull } from 'drizzle-orm';

export interface GroupMemberRow {
  readonly autoAcceptSwaps: number;
  readonly id: string;
  readonly isActive: boolean;
  readonly realName: string;
}

export interface LoadGroupMembersOptions {
  /**
   * Fallback used when a member never set autoAcceptSwaps explicitly.
   * Swap workflows default to accepting (1) while duty adjustments default
   * to declining (0), even though both reuse the same membership preference.
   */
  readonly autoAcceptSwapsDefault: 0 | 1;
}

export class GroupMemberReader {
  public async loadMembers(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipIds: readonly string[],
    options: LoadGroupMembersOptions,
    lockRows = false,
  ): Promise<ReadonlyMap<string, GroupMemberRow>> {
    if (membershipIds.length === 0) {
      return new Map();
    }
    let query = transaction
      .select({
        autoAcceptSwapsManuallySet: groupMemberships.autoAcceptSwapsManuallySet,
        autoAcceptSwaps: groupMemberships.autoAcceptSwaps,
        id: groupMemberships.id,
        membershipDeletedAt: groupMemberships.deletedAt,
        membershipStatus: groupMemberships.status,
        realName: userProfiles.realName,
        userDeletedAt: users.deletedAt,
        userStatus: users.status,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          inArray(groupMemberships.id, [...membershipIds]),
          isNull(groupMemberships.deletedAt),
        ),
      );
    if (lockRows) {
      query = query.for('update') as typeof query;
    }
    const rows = await query;

    return new Map(
      rows.map((row) => [
        row.id,
        {
          autoAcceptSwaps:
            row.autoAcceptSwapsManuallySet === 1
              ? row.autoAcceptSwaps
              : options.autoAcceptSwapsDefault,
          id: row.id,
          isActive:
            row.membershipStatus === 'active' &&
            row.userStatus === 'active' &&
            row.membershipDeletedAt === null &&
            row.userDeletedAt === null,
          realName: row.realName,
        },
      ]),
    );
  }

  public async loadRoleNames(
    transaction: DatabaseTransaction,
    roleIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (roleIds.length === 0) {
      return new Map();
    }
    const rows = await transaction
      .select({ id: scheduleRoles.id, name: scheduleRoles.name })
      .from(scheduleRoles)
      .where(and(inArray(scheduleRoles.id, [...roleIds]), isNull(scheduleRoles.deletedAt)));

    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
