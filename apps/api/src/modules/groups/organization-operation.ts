import { createHash } from 'node:crypto';

import type { OrganizationMutationCompleted } from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';

export interface OrganizationMutationActor {
  readonly id: string;
  readonly isDeveloperAdmin: boolean;
  readonly realName: string;
}

export async function runOrganizationMutation<Result>(options: {
  readonly databaseClient: DatabaseClient;
  readonly identity: AuthenticatedIdentity;
  readonly operationId: string;
  readonly requestFingerprint: string;
  readonly resultCodec?: {
    readonly deserialize: (
      stored: Record<string, unknown>,
      actor: OrganizationMutationActor,
    ) => Promise<Result> | Result;
    readonly serialize: (
      result: Result,
      actor: OrganizationMutationActor,
    ) => Record<string, unknown>;
  };
  readonly run: (
    transaction: DatabaseTransaction,
    actor: OrganizationMutationActor,
  ) => Promise<Result>;
  readonly scope: string;
}): Promise<Result> {
  return withTransaction(options.databaseClient, async (transaction) => {
    const actor = await lockOrganizationActor(transaction, options.identity);
    return withIdempotentOperation(
      transaction,
      {
        actorUserId: actor.id,
        operationId: options.operationId,
        requestFingerprint: options.requestFingerprint,
        scope: options.scope,
      },
      () => options.run(transaction, actor),
      options.resultCodec === undefined
        ? undefined
        : {
            deserialize: (stored) => options.resultCodec!.deserialize(stored, actor),
            serialize: (result) => options.resultCodec!.serialize(result, actor),
          },
    );
  });
}

export function createOrganizationFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeJsonValue(value)))
    .digest('hex');
}

export function organizationMutationCompleted(): OrganizationMutationCompleted {
  return { completed: true };
}

async function lockOrganizationActor(
  transaction: DatabaseTransaction,
  identity: AuthenticatedIdentity,
): Promise<OrganizationMutationActor> {
  const [actor] = await transaction
    .select({
      id: users.id,
      isDeveloperAdmin: users.isDeveloperAdmin,
      realName: userProfiles.realName,
      status: users.status,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.cloudbaseUid, identity.cloudbaseUid),
        isNull(users.deletedAt),
        isNull(userProfiles.deletedAt),
      ),
    )
    .limit(1)
    .for('update');
  if (actor === undefined) {
    throw new ApiError({
      code: 'NOT_FOUND',
      statusCode: 404,
      userMessage: '当前账号尚未完成个人资料。',
    });
  }
  if (actor.status !== 'active') {
    throw new ApiError({
      code: 'FORBIDDEN',
      statusCode: 403,
      userMessage: '当前账号无法执行群组操作。',
    });
  }
  return {
    id: actor.id,
    isDeveloperAdmin: actor.isDeveloperAdmin === 1,
    realName: actor.realName,
  };
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
  throw new Error('Organization operation payload must contain only JSON values.');
}
