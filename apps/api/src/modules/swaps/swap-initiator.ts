import type { SwapInitiatorOption } from '@schedule/contracts';
import {
  groupMemberships,
  rosterEntries,
  userProfiles,
  users,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { ApiError } from '../../plugins/error-handler.js';
import { parsePlatformAdminUids } from '../platform-admin/platform-admin.js';

export interface SwapInitiator extends SwapInitiatorOption {
  readonly userId?: string;
}

export async function readSwapInitiators(
  transaction: DatabaseTransaction,
  groupId: string,
  currentUserId: string,
  platformAdminUids: ReadonlySet<string> = parsePlatformAdminUids(process.env),
): Promise<SwapInitiator[]> {
  const platformUids = [...platformAdminUids];
  const accounts = await transaction
    .select({
      id: users.id,
      realName: userProfiles.realName,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(
      groupMemberships,
      and(
        eq(groupMemberships.userId, users.id),
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.status, 'active'),
        ne(groupMemberships.role, 'guest'),
        isNull(groupMemberships.deletedAt),
      ),
    )
    .where(
      and(
        eq(users.status, 'active'),
        isNull(users.deletedAt),
        isNull(userProfiles.deletedAt),
        or(
          eq(users.isDeveloperAdmin, 1),
          platformUids.length ? inArray(users.cloudbaseUid, platformUids) : undefined,
          eq(groupMemberships.groupId, groupId),
        ),
      ),
    );
  const pending = await transaction
    .select({ id: rosterEntries.id, realName: rosterEntries.realName })
    .from(rosterEntries)
    .where(
      and(
        eq(rosterEntries.groupId, groupId),
        eq(rosterEntries.status, 'pending'),
        isNull(rosterEntries.deletedAt),
      ),
    );
  // Disabled identities must not reappear through legacy pending roster rows.
  const knownMembers = await transaction
    .select({ realName: userProfiles.realName })
    .from(groupMemberships)
    .innerJoin(userProfiles, eq(userProfiles.userId, groupMemberships.userId))
    .where(eq(groupMemberships.groupId, groupId));
  const names = new Set(knownMembers.map((row) => row.realName));
  return [
    ...accounts.map((row) => ({ ...row, userId: row.id, isCurrentUser: row.id === currentUserId })),
    ...pending
      .filter((row) => !names.has(row.realName))
      .map((row) => ({ ...row, isCurrentUser: false })),
  ].sort((a, b) => a.realName.localeCompare(b.realName, 'zh-Hans-CN') || a.id.localeCompare(b.id));
}

export async function resolveSwapInitiator(
  transaction: DatabaseTransaction,
  groupId: string,
  current: { readonly id: string; readonly realName: string },
  initiatedById?: string,
  platformAdminUids: ReadonlySet<string> = parsePlatformAdminUids(process.env),
): Promise<SwapInitiator> {
  if (initiatedById === undefined) return { ...current, userId: current.id, isCurrentUser: true };
  // Attribution is a submission-time snapshot, not an authorization identity.
  // Do not introduce third-person user/profile locks into the existing group locks.
  const selected = (
    await readSwapInitiators(transaction, groupId, current.id, platformAdminUids)
  ).find((candidate) => candidate.id === initiatedById);
  if (!selected) throw invalidInitiator();
  return selected;
}

function invalidInitiator(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '所选发起人已失效或不在可选范围，请重新选择。',
  });
}
