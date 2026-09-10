import type { GroupSummary } from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';

type QueryDatabase = DatabaseClient['database'] | DatabaseTransaction;

// Only persisted formal membership is a source. Derived access is never recursive,
// never a group_memberships row, and never inherits developer administration.
export async function listLinkedGuestGroups(
  database: QueryDatabase,
  identity: AuthenticatedIdentity,
  targetGroupId?: string,
): Promise<GroupSummary[]> {
  const [rows] = (await database.execute(sql`
    SELECT DISTINCT target.id, target.name, target.version
    FROM group_memberships source_member
    JOIN users actor ON actor.id = source_member.user_id
    JOIN user_profiles profile ON profile.user_id = actor.id
    JOIN \`groups\` source_group ON source_group.id = source_member.group_id
    JOIN group_visitor_links link ON
      (link.first_group_id = source_group.id OR link.second_group_id = source_group.id)
    JOIN \`groups\` target ON target.id =
      CASE WHEN link.first_group_id = source_group.id THEN link.second_group_id ELSE link.first_group_id END
    WHERE actor.cloudbase_uid = ${identity.cloudbaseUid}
      AND actor.status = 'active' AND actor.deleted_at IS NULL AND profile.deleted_at IS NULL
      AND source_member.status = 'active' AND source_member.deleted_at IS NULL
      AND source_member.role IN ('owner', 'administrator', 'member')
      AND source_group.deleted_at IS NULL AND target.deleted_at IS NULL AND link.is_enabled = 1
      ${targetGroupId === undefined ? sql`` : sql`AND target.id = ${targetGroupId}`}
    ORDER BY target.name, target.id
  `)) as unknown as [Array<{ id: string; name: string; version: number }>, unknown];
  return rows.map((group) => ({ ...group, role: 'guest' }));
}

export function linkedGuestMembershipConflict(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '此访问权限来自群组关联，随原群成员资格变更',
  });
}
