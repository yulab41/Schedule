import {
  type DatabaseClient,
  type DatabaseTransaction,
  wechatAdminBindingTickets,
  wechatLinkTokens,
  withTransaction,
} from '@schedule/database';
import { and, eq } from 'drizzle-orm';

import { getDatabaseErrorCode } from '../../database-error.js';

// Callers keep external effects outside, or memoize them across attempts (self-unbind).
export async function withWechatBindingTransaction<T>(
  client: DatabaseClient,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await withTransaction(client, operation);
    } catch (error) {
      if (attempt >= 2 || getDatabaseErrorCode(error) !== 'ER_LOCK_DEADLOCK') throw error;
    }
  }
}

// Lock the indexed identity range before a single token or account. Also serializes
// issuing a new token with binding/unbinding, including identities without a user.
export async function lockWechatBindingScope(
  transaction: DatabaseTransaction,
  appId: string,
  subject: string,
): Promise<void> {
  await transaction
    .select({ id: wechatLinkTokens.id })
    .from(wechatLinkTokens)
    .where(and(eq(wechatLinkTokens.appId, appId), eq(wechatLinkTokens.subject, subject)))
    .orderBy(wechatLinkTokens.id)
    .for('update');
}

export async function invalidateWechatBindingProofs(
  transaction: DatabaseTransaction,
  appId: string,
  subject: string,
  userId: string,
): Promise<void> {
  const consumedAt = new Date();
  await transaction
    .update(wechatLinkTokens)
    .set({ consumedAt, status: 'consumed' })
    .where(
      and(
        eq(wechatLinkTokens.appId, appId),
        eq(wechatLinkTokens.subject, subject),
        eq(wechatLinkTokens.status, 'pending'),
      ),
    );
  // Admin tickets are account scoped, including historical tickets without p8 authVersion.
  await transaction
    .update(wechatAdminBindingTickets)
    .set({ consumedAt, status: 'consumed' })
    .where(
      and(
        eq(wechatAdminBindingTickets.appId, appId),
        eq(wechatAdminBindingTickets.targetUserId, userId),
        eq(wechatAdminBindingTickets.status, 'pending'),
      ),
    );
}
