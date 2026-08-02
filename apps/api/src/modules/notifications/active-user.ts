import type { DatabaseTransaction } from '@schedule/database';
import { users } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';

export async function requireActiveUser(
  transaction: DatabaseTransaction,
  identity: AuthenticatedIdentity,
): Promise<string> {
  const [user] = await transaction
    .select({ id: users.id })
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

  return user.id;
}
