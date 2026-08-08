import { randomUUID } from 'node:crypto';

import type { DatabaseClient } from '@schedule/database';
import { sql } from 'drizzle-orm';

export interface InsertDirectMembershipInput {
  readonly cloudbaseUid?: string;
  readonly groupCode: string;
  readonly realName: string;
  readonly role?: 'administrator' | 'member';
}

/**
 * 测试夹具：在群组码加入/认领下线后，直接向数据库插入一条绑定到
 * “真实姓名匹配且已绑定云身份”的用户的成员记录。
 */
export async function insertDirectMembership(
  client: DatabaseClient,
  input: InsertDirectMembershipInput,
): Promise<string> {
  const [userRows] = (await client.database.execute(sql`
    SELECT u.id
    FROM users u
    INNER JOIN user_profiles p ON p.user_id = u.id
    WHERE p.real_name = ${input.realName}
      AND u.cloudbase_uid IS NOT NULL
      ${input.cloudbaseUid === undefined ? sql`` : sql`AND u.cloudbase_uid = ${input.cloudbaseUid}`}
      AND u.deleted_at IS NULL
    LIMIT 1
  `)) as unknown as [{ id: string }[], unknown];
  const [groupRows] = (await client.database.execute(
    sql`SELECT id FROM \`groups\` WHERE group_code = ${input.groupCode} LIMIT 1`,
  )) as unknown as [{ id: string }[], unknown];
  const userId = userRows[0]?.id;
  const groupId = groupRows[0]?.id;
  if (userId === undefined || groupId === undefined) {
    throw new Error(
      `insertDirectMembership fixture failed for realName=${input.realName} groupCode=${input.groupCode}`,
    );
  }

  const [existingRows] = (await client.database.execute(sql`
    SELECT gm.id, gm.user_id AS userId
    FROM group_memberships gm
    INNER JOIN users u ON u.id = gm.user_id
    INNER JOIN user_profiles p ON p.user_id = u.id
    WHERE gm.group_id = ${groupId}
      AND p.real_name = ${input.realName}
      AND u.cloudbase_uid IS NULL
      AND gm.status = 'active'
      AND gm.deleted_at IS NULL
    LIMIT 1
  `)) as unknown as [{ id: string; userId: string }[], unknown];
  const existing = existingRows[0];
  if (existing !== undefined) {
    if (existing.userId !== userId) {
      await client.database.execute(
        sql`UPDATE group_memberships SET user_id = ${userId} WHERE id = ${existing.id}`,
      );
    }
    return existing.id;
  }

  const membershipId = randomUUID();
  await client.database.execute(sql`
    INSERT INTO group_memberships (id, group_id, user_id, role, status)
    VALUES (${membershipId}, ${groupId}, ${userId}, ${input.role ?? 'member'}, 'active')
  `);
  return membershipId;
}
