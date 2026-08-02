import { randomUUID } from 'node:crypto';

import type { DatabaseTransaction } from '@schedule/database';
import { sql } from 'drizzle-orm';

export async function claimBatch(
  transaction: DatabaseTransaction,
  batchKey: string,
  jobType: string,
): Promise<boolean> {
  const [header] = await transaction.execute(
    sql`INSERT IGNORE INTO notification_batches (id, batch_key, job_type)
        VALUES (${randomUUID()}, ${batchKey}, ${jobType})`,
  );

  return header.affectedRows > 0;
}
