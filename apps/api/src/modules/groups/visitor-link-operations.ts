import { randomUUID } from 'node:crypto';
import {
  auditLogs,
  groups,
  groupVisitorLinks,
  withTransaction,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

const mutationSchema = z
  .object({
    firstGroupId: z.string().uuid(),
    secondGroupId: z.string().uuid(),
    enabled: z.boolean(),
    expectedVersion: z.number().int().nonnegative(),
    operator: z.string().trim().min(1).max(64),
  })
  .strict();

export type VisitorLinkMutation = z.infer<typeof mutationSchema>;

export async function inspectVisitorLink(
  client: DatabaseClient,
  firstName: string,
  secondName: string,
) {
  if (!firstName.trim() || !secondName.trim() || firstName === secondName)
    throw new Error('需要两个不同的准确群名。');
  return withTransaction(client, async (transaction) => {
    const candidates = await transaction
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(inArray(groups.name, [firstName, secondName]), isNull(groups.deletedAt)));
    const first = candidates.filter((group) => group.name === firstName);
    const second = candidates.filter((group) => group.name === secondName);
    if (first.length !== 1 || second.length !== 1)
      throw new Error('群名不存在或有重名，请先明确目标群组。');
    return inspectPair(transaction, first[0]!.id, second[0]!.id);
  });
}

export async function setVisitorLink(client: DatabaseClient, input: VisitorLinkMutation) {
  const value = mutationSchema.parse(input);
  const pair = [value.firstGroupId.toLowerCase(), value.secondGroupId.toLowerCase()].sort();
  const first = pair[0]!,
    second = pair[1]!;
  if (first === second) throw new Error('不能关联同一个群组。');
  return withTransaction(client, async (transaction) => {
    // Fixed lock order serializes both orientations, including first-time creation.
    const targetGroups = await transaction
      .select({ id: groups.id, deletedAt: groups.deletedAt })
      .from(groups)
      .where(inArray(groups.id, pair))
      .orderBy(asc(groups.id))
      .for('update');
    if (
      targetGroups.length !== 2 ||
      (value.enabled && targetGroups.some((group) => group.deletedAt !== null))
    ) {
      throw new Error('目标群组不存在或已解散。');
    }
    const [existing] = await transaction
      .select()
      .from(groupVisitorLinks)
      .where(
        and(eq(groupVisitorLinks.firstGroupId, first), eq(groupVisitorLinks.secondGroupId, second)),
      )
      .limit(1)
      .for('update');
    const currentEnabled = existing?.isEnabled === 1;
    if (currentEnabled === value.enabled)
      return { changed: false, ...(await inspectPair(transaction, first, second)) };
    if ((existing?.version ?? 0) !== value.expectedVersion)
      throw new Error('关联版本已变化，请重新预检。');
    const linkId = existing?.id ?? randomUUID();
    if (existing === undefined) {
      await transaction
        .insert(groupVisitorLinks)
        .values({ id: linkId, firstGroupId: first, secondGroupId: second });
    } else {
      await transaction
        .update(groupVisitorLinks)
        .set({ isEnabled: value.enabled ? 1 : 0, version: existing.version + 1 })
        .where(eq(groupVisitorLinks.id, linkId));
    }
    await transaction.insert(auditLogs).values({
      id: randomUUID(),
      groupId: first,
      action: 'group_visitor_link_changed',
      outcome: 'success',
      targetType: 'group_visitor_link',
      targetId: linkId,
      operationId: randomUUID(),
      metadata: {
        operator: value.operator,
        firstGroupId: first,
        secondGroupId: second,
        previouslyEnabled: currentEnabled,
        enabled: value.enabled,
      },
    });
    return { changed: true, ...(await inspectPair(transaction, first, second)) };
  });
}

async function inspectPair(transaction: DatabaseTransaction, first: string, second: string) {
  const pair = [first, second].sort();
  const targetGroups = await transaction
    .select({ id: groups.id, name: groups.name, deletedAt: groups.deletedAt })
    .from(groups)
    .where(inArray(groups.id, pair))
    .orderBy(asc(groups.id));
  const [link] = await transaction
    .select({
      id: groupVisitorLinks.id,
      enabled: groupVisitorLinks.isEnabled,
      version: groupVisitorLinks.version,
    })
    .from(groupVisitorLinks)
    .where(
      and(
        eq(groupVisitorLinks.firstGroupId, pair[0]!),
        eq(groupVisitorLinks.secondGroupId, pair[1]!),
      ),
    );
  const directions = [];
  for (const [source, target] of [
    [first, second],
    [second, first],
  ] as const) {
    const [rows] = (await transaction.execute(sql`
      SELECT COUNT(DISTINCT member.user_id) AS formalMembers,
        COUNT(DISTINCT CASE WHEN NOT EXISTS (
          SELECT 1 FROM group_memberships direct WHERE direct.group_id=${target}
          AND direct.user_id=member.user_id AND direct.status='active' AND direct.deleted_at IS NULL
        ) THEN member.user_id END) AS membersWithoutDirectAccess
      FROM group_memberships member JOIN users actor ON actor.id=member.user_id
      JOIN user_profiles profile ON profile.user_id=actor.id
      JOIN \`groups\` source_group ON source_group.id=member.group_id
      JOIN \`groups\` target_group ON target_group.id=${target}
      WHERE member.group_id=${source} AND member.status='active' AND member.deleted_at IS NULL
      AND member.role IN ('owner','administrator','member') AND actor.cloudbase_uid IS NOT NULL
      AND actor.status='active' AND actor.deleted_at IS NULL AND profile.deleted_at IS NULL
      AND source_group.deleted_at IS NULL AND target_group.deleted_at IS NULL
    `)) as unknown as [
      Array<{ formalMembers: number; membersWithoutDirectAccess: number }>,
      unknown,
    ];
    directions.push({ sourceGroupId: source, targetGroupId: target, ...rows[0] });
  }
  return {
    groups: targetGroups,
    linkId: link?.id ?? null,
    enabled: link?.enabled === 1,
    version: link?.version ?? 0,
    directions,
  };
}
