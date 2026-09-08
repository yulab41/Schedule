import { type DatabaseClient, type DatabaseTransaction, withTransaction } from '@schedule/database';
import { getDatabaseErrorCode } from '../../database-error.js';

/** Retry the complete transaction only; external effects must remain outside or be memoized. */
export async function withRetriedTransaction<T>(
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
