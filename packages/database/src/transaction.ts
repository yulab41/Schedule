import type { DatabaseClient, ScheduleDatabase } from './client.js';

export type DatabaseTransaction = Parameters<ScheduleDatabase['transaction']>[0] extends (
  transaction: infer Transaction,
) => Promise<unknown>
  ? Transaction
  : never;

export async function withTransaction<Result>(
  client: DatabaseClient,
  operation: (transaction: DatabaseTransaction) => Promise<Result>,
): Promise<Result> {
  return client.database.transaction(operation);
}
