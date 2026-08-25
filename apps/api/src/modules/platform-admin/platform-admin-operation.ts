import { createHash } from 'node:crypto';

import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { withTransaction } from '@schedule/database';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { requirePlatformAdmin } from './platform-admin.js';

export async function runPlatformAdminMutation<Result>(options: {
  readonly allowedCloudbaseUids: ReadonlySet<string>;
  readonly databaseClient: DatabaseClient;
  readonly identity: AuthenticatedIdentity;
  readonly operationId: string;
  readonly requestFingerprint: string;
  readonly resultCodec?: {
    readonly deserialize: (
      stored: Record<string, unknown>,
      actorUserId: string,
      transaction: DatabaseTransaction,
    ) => Promise<Result> | Result;
    readonly serialize: (result: Result, actorUserId: string) => Record<string, unknown>;
  };
  readonly run: (transaction: DatabaseTransaction, actorUserId: string) => Promise<Result>;
  readonly scope: string;
}): Promise<Result> {
  return withTransaction(options.databaseClient, async (transaction) => {
    const actorUserId = await requirePlatformAdmin(
      transaction,
      options.identity,
      options.allowedCloudbaseUids,
      { lock: true },
    );
    return withIdempotentOperation(
      transaction,
      {
        actorUserId,
        operationId: options.operationId,
        requestFingerprint: options.requestFingerprint,
        scope: options.scope,
      },
      () => options.run(transaction, actorUserId),
      options.resultCodec === undefined
        ? undefined
        : {
            deserialize: (stored) =>
              options.resultCodec!.deserialize(stored, actorUserId, transaction),
            serialize: (result) => options.resultCodec!.serialize(result, actorUserId),
          },
    );
  });
}

export function createPlatformAdminFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeJsonValue(value)))
    .digest('hex');
}

export function assertExpectedAuthVersion(input: {
  readonly actualAuthVersion: number;
  readonly expectedAuthVersion: number;
  readonly userId: string;
}): void {
  if (input.actualAuthVersion === input.expectedAuthVersion) return;
  throw new ApiError({
    code: 'CONFLICT',
    latestData: {
      authVersion: input.actualAuthVersion,
      id: input.userId,
      objectType: 'platform_user',
    },
    statusCode: 409,
    userMessage: '账号身份状态已更新，请刷新后重新确认。',
  });
}

function normalizeJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeJsonValue(item)]),
    );
  }
  throw new Error('Platform admin operation payload must contain only JSON values.');
}
