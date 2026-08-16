import type { DatabaseTransaction } from '@schedule/database';
import { users } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';

export async function requirePlatformAdmin(
  transaction: DatabaseTransaction,
  identity: AuthenticatedIdentity,
  allowedCloudbaseUids: ReadonlySet<string>,
): Promise<string> {
  const [user] = await transaction
    .select({ id: users.id, isDeveloperAdmin: users.isDeveloperAdmin })
    .from(users)
    .where(
      and(
        eq(users.cloudbaseUid, identity.cloudbaseUid),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (user === undefined) {
    throw new ApiError({
      code: 'NOT_FOUND',
      statusCode: 404,
      userMessage: '当前账号尚不可用。',
    });
  }

  if (!allowedCloudbaseUids.has(identity.cloudbaseUid) && user.isDeveloperAdmin !== 1) {
    throw new ApiError({
      code: 'FORBIDDEN',
      statusCode: 403,
      userMessage: '仅平台管理员可执行该操作。',
    });
  }

  return user.id;
}

export function parsePlatformAdminUids(values: NodeJS.ProcessEnv): ReadonlySet<string> {
  const raw = values.PLATFORM_ADMIN_UIDS;
  if (raw === undefined || raw.trim().length === 0) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}
