import { randomUUID } from 'node:crypto';

import type { DatabaseTransaction } from '@schedule/database';
import { idempotencyKeys } from '@schedule/database';
import { and, eq, sql } from 'drizzle-orm';

import { ApiError } from './error-handler.js';
import { isDuplicateKeyError } from '../database-error.js';

const defaultIdempotencyLifetimeMilliseconds = 24 * 60 * 60 * 1000;

export interface IdempotentOperationInput {
  readonly actorUserId: string;
  readonly expiresAt?: Date;
  readonly operationId: string;
  readonly requestFingerprint: string;
  readonly scope: string;
}

export async function withIdempotentOperation<Result>(
  transaction: DatabaseTransaction,
  input: IdempotentOperationInput,
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    await insertIdempotencyKey(transaction, input);
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await readExistingOperation(transaction, input);
    if (existing === undefined) {
      try {
        await insertIdempotencyKey(transaction, input);
      } catch (retryError) {
        if (!isDuplicateKeyError(retryError)) {
          throw retryError;
        }
        throw operationConflict('相同请求正在处理中，请稍后重试。');
      }
    } else {
      if (existing.expiresAt.valueOf() <= Date.now()) {
        await deleteExistingOperation(transaction, input);
        await insertIdempotencyKey(transaction, input);
      } else {
        const resolved = await resolveExistingOperation<Result>(existing, input);
        if (resolved !== undefined) {
          return resolved;
        }
      }
    }
  }

  const result = await operation();
  await transaction
    .update(idempotencyKeys)
    .set({
      completedAt: new Date(),
      result: result as unknown as Record<string, unknown>,
      status: 'completed',
      version: sql`${idempotencyKeys.version} + 1`,
    })
    .where(
      and(
        eq(idempotencyKeys.actorUserId, input.actorUserId),
        eq(idempotencyKeys.operationKey, input.operationId),
        eq(idempotencyKeys.scope, input.scope),
      ),
    );

  return result;
}

async function deleteExistingOperation(
  transaction: DatabaseTransaction,
  input: IdempotentOperationInput,
): Promise<void> {
  await transaction
    .delete(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.actorUserId, input.actorUserId),
        eq(idempotencyKeys.operationKey, input.operationId),
        eq(idempotencyKeys.scope, input.scope),
      ),
    );
}

async function insertIdempotencyKey(
  transaction: DatabaseTransaction,
  input: IdempotentOperationInput,
): Promise<void> {
  await transaction.insert(idempotencyKeys).values({
    actorUserId: input.actorUserId,
    expiresAt: input.expiresAt ?? new Date(Date.now() + defaultIdempotencyLifetimeMilliseconds),
    id: randomUUID(),
    operationKey: input.operationId,
    requestFingerprint: input.requestFingerprint,
    scope: input.scope,
    status: 'processing',
  });
}

async function readExistingOperation(
  transaction: DatabaseTransaction,
  input: IdempotentOperationInput,
) {
  const [existing] = await transaction
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.actorUserId, input.actorUserId),
        eq(idempotencyKeys.operationKey, input.operationId),
        eq(idempotencyKeys.scope, input.scope),
      ),
    )
    .limit(1)
    .for('update');

  return existing;
}

async function resolveExistingOperation<Result>(
  existing: NonNullable<Awaited<ReturnType<typeof readExistingOperation>>>,
  input: IdempotentOperationInput,
): Promise<Result | undefined> {
  if (existing.requestFingerprint !== input.requestFingerprint) {
    throw operationConflict('该操作编号已用于其他请求，请使用新的操作编号。');
  }
  if (existing.status === 'completed' && existing.result !== null) {
    return existing.result as unknown as Result;
  }
  if (existing.status === 'processing' && existing.expiresAt.valueOf() > Date.now()) {
    throw operationConflict('相同请求正在处理中，请稍后重试。');
  }
  return undefined;
}

function operationConflict(userMessage: string): ApiError {
  return new ApiError({ code: 'CONFLICT', statusCode: 409, userMessage });
}
