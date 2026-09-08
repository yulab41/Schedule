import { randomUUID } from 'node:crypto';
import {
  type DatabaseTransaction,
  groupMemberContacts,
  groupMemberships,
  users,
} from '@schedule/database';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { ApiError } from '../../plugins/error-handler.js';

export function normalizeAccountMobilePhone(value: string | null): string | null {
  return value === null
    ? null
    : value
        .normalize('NFKC')
        .trim()
        .replaceAll(/[\s()-]/gu, '') || null;
}

/** Caller owns the transaction. Lock the account before touching its contact rows. */
export async function setAccountMobilePhone(
  transaction: DatabaseTransaction,
  userId: string,
  value: string | null,
  skipMembershipId?: string,
): Promise<void> {
  const [account] = await transaction
    .select({ mobilePhone: users.mobilePhone })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)
    .for('update');
  if (account === undefined)
    throw new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage: '账号不存在。' });
  const phone = normalizeAccountMobilePhone(value);
  if (account.mobilePhone !== phone)
    await transaction
      .update(users)
      .set({
        mobilePhone: phone,
        mobilePhoneUpdatedAt: new Date(),
        version: sql`${users.version} + 1`,
      })
      .where(eq(users.id, userId));
  const memberships = await transaction
    .select({ id: groupMemberships.id })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.userId, userId), isNull(groupMemberships.deletedAt)))
    .orderBy(asc(groupMemberships.id))
    .for('update');
  for (const membership of memberships) {
    if (membership.id === skipMembershipId) continue;
    const [contact] = await transaction
      .select({ id: groupMemberContacts.id, mobilePhone: groupMemberContacts.mobilePhone })
      .from(groupMemberContacts)
      .where(
        and(
          eq(groupMemberContacts.membershipId, membership.id),
          isNull(groupMemberContacts.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (contact === undefined) {
      if (phone === null) continue;
      await transaction
        .insert(groupMemberContacts)
        .values({ id: randomUUID(), membershipId: membership.id, mobilePhone: phone });
    } else if (contact.mobilePhone !== phone) {
      await transaction
        .update(groupMemberContacts)
        .set({
          mobilePhone: phone,
          isConfirmed: 0,
          version: sql`${groupMemberContacts.version} + 1`,
        })
        .where(eq(groupMemberContacts.id, contact.id));
    }
  }
}

/** On identity merge, preserve the newest account phone; equal timestamps use stable user ids. */
export async function mergeAccountMobilePhone(
  transaction: DatabaseTransaction,
  sourceId: string,
  targetId: string,
): Promise<void> {
  if (sourceId === targetId) return;
  const accounts = [];
  for (const id of [sourceId, targetId].sort()) {
    const [row] = await transaction
      .select({ id: users.id, phone: users.mobilePhone, changedAt: users.mobilePhoneUpdatedAt })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .for('update');
    if (row !== undefined && (row.phone !== null || row.changedAt !== null)) accounts.push(row);
  }
  accounts.sort(
    (a, b) =>
      (b.changedAt?.getTime() ?? 0) - (a.changedAt?.getTime() ?? 0) || a.id.localeCompare(b.id),
  );
  await setAccountMobilePhone(transaction, targetId, accounts[0]?.phone ?? null);
  if (accounts[0] !== undefined)
    await transaction
      .update(users)
      .set({ mobilePhoneUpdatedAt: accounts[0].changedAt })
      .where(eq(users.id, targetId));
}
