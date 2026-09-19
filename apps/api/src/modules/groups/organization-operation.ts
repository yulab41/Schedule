import { createHash } from 'node:crypto';

import type { CalendarChangeKind, OrganizationMutationCompleted } from '@schedule/contracts';
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
import { recordCalendarChange } from '../calendar/calendar-change-log.js';
import { withRetriedTransaction } from '../concurrency/transaction-retry.js';

export interface OrganizationMutationActor {
  readonly id: string;
  readonly isDeveloperAdmin: boolean;
  readonly realName: string;
}

export async function runOrganizationMutation<Result>(options: {
  /**
   * Declares that a successful (non-replayed) mutation changes what the group
   * calendar renders. The change is recorded in the same transaction, so the
   * incremental calendar cursor can never advance past an uncommitted write.
   */
  readonly calendarChange?: {
    readonly businessMonth?: string | null | undefined;
    readonly groupId: string;
    readonly kind: CalendarChangeKind;
  };
  readonly databaseClient: DatabaseClient;
  readonly identity: AuthenticatedIdentity;
  readonly operationId: string;
  readonly requestFingerprint: string;
  readonly retryDeadlocks?: boolean;
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
  const transact = options.retryDeadlocks === true ? withRetriedTransaction : withTransaction;
  return transact(options.databaseClient, async (transaction) => {
    const actor = await lockOrganizationActor(transaction, options.identity);
    const result = await withIdempotentOperation(
      transaction,
      {
        actorUserId: actor.id,
        operationId: options.operationId,
        requestFingerprint: options.requestFingerprint,
        scope: options.scope,
      },
      async () => {
        const result = await options.run(transaction, actor);
        if (options.calendarChange !== undefined) {
          await recordCalendarChange(transaction, options.calendarChange.groupId, {
            businessMonth: options.calendarChange.businessMonth,
            kind: options.calendarChange.kind,
          });
        }
        return result;
      },
      options.resultCodec === undefined
        ? undefined
        : {
            deserialize: (stored) => options.resultCodec!.deserialize(stored, actor),
            serialize: (result) => options.resultCodec!.serialize(result, actor),
          },
    );
    return withoutRetiredGroupCode(result);
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

// Historical idempotency results remain stored verbatim. Only their retired public field is omitted.
export function withoutRetiredGroupCode<Result>(result: Result): Result {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) return result;
  const object = result as Record<string, unknown>;
  if (
    typeof object['id'] === 'string' &&
    typeof object['name'] === 'string' &&
    typeof object['role'] === 'string' &&
    'groupCode' in object
  ) {
    const current = { ...object };
    delete current['groupCode'];
    return current as Result;
  }
  if (typeof object['group'] === 'object' && object['group'] !== null) {
    const group = withoutRetiredGroupCode(object['group']);
    if (group !== object['group']) return { ...object, group } as Result;
  }
  return result;
}
