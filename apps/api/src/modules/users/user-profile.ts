import type { UserProfile } from '@schedule/contracts';

export interface UserProfileRow {
  readonly id: string;
  readonly realName: string;
  readonly version: number;
}

export function toUserProfile(row: UserProfileRow): UserProfile {
  return { id: row.id, realName: row.realName, version: row.version };
}
