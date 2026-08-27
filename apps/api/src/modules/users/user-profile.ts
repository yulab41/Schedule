import type { UserProfile } from '@schedule/contracts';
import { type DatabaseTransaction, userProfileAvatars } from '@schedule/database';
import { eq } from 'drizzle-orm';

export interface UserProfileRow {
  readonly avatarVersion?: number | null | undefined;
  readonly id: string;
  readonly realName: string;
  readonly version: number;
}

export function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    ...(row.avatarVersion === null || row.avatarVersion === undefined
      ? {}
      : { avatarVersion: row.avatarVersion }),
    id: row.id,
    realName: row.realName,
    version: row.version,
  };
}

export async function findUserAvatarVersion(
  transaction: DatabaseTransaction,
  userId: string,
): Promise<number | null> {
  const [avatar] = await transaction
    .select({ avatarVersion: userProfileAvatars.version })
    .from(userProfileAvatars)
    .where(eq(userProfileAvatars.userId, userId))
    .limit(1);
  return avatar?.avatarVersion ?? null;
}
