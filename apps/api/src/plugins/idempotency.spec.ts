import { describe, expect, it, vi } from 'vitest';

import type { DatabaseTransaction } from '@schedule/database';

import { withIdempotentOperation } from './idempotency.js';

function duplicateKeyError(): Error {
  return Object.assign(new Error('duplicate key'), { code: 'ER_DUP_ENTRY' });
}

function createTransaction(): {
  readonly insertValues: ReturnType<typeof vi.fn>;
  readonly transaction: DatabaseTransaction;
} {
  const insertValues = vi
    .fn()
    .mockRejectedValueOnce(duplicateKeyError())
    .mockRejectedValueOnce(duplicateKeyError());
  const transaction = {
    insert: vi.fn(() => ({ values: insertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            for: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  } as unknown as DatabaseTransaction;

  return { insertValues, transaction };
}

describe('withIdempotentOperation', () => {
  it('maps a duplicate key on the retry insert to 409 instead of a driver error', async () => {
    const { insertValues, transaction } = createTransaction();

    await expect(
      withIdempotentOperation(
        transaction,
        {
          actorUserId: 'user-1',
          operationId: 'operation-1',
          requestFingerprint: 'fingerprint-1',
          scope: 'scope-1',
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });

    expect(insertValues).toHaveBeenCalledTimes(2);
  });
});
