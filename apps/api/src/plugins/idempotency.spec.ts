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

  it('deletes an expired completed row and allows the key to be reused with a new payload', async () => {
    const insertValues = vi
      .fn()
      .mockRejectedValueOnce(duplicateKeyError())
      .mockResolvedValueOnce(undefined);
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn(async () => ({ generation: 2 }));
    const transaction = {
      delete: vi.fn(() => ({ where: deleteWhere })),
      insert: vi.fn(() => ({ values: insertValues })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              for: vi.fn(() =>
                Promise.resolve([
                  {
                    actorUserId: 'user-1',
                    completedAt: new Date(Date.now() - 60_000),
                    expiresAt: new Date(Date.now() - 1),
                    operationKey: 'operation-1',
                    requestFingerprint: 'old-fingerprint',
                    result: { generation: 1 },
                    scope: 'scope-1',
                    status: 'completed',
                  },
                ]),
              ),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
    } as unknown as DatabaseTransaction;

    await expect(
      withIdempotentOperation(
        transaction,
        {
          actorUserId: 'user-1',
          operationId: 'operation-1',
          requestFingerprint: 'new-fingerprint',
          scope: 'scope-1',
        },
        operation,
      ),
    ).resolves.toEqual({ generation: 2 });

    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });
});
