import { sql } from 'drizzle-orm';

import { workflowSequenceAllocations, type DatabaseTransaction } from '@schedule/database';

export async function allocateWorkflowSequence(transaction: DatabaseTransaction): Promise<number> {
  await transaction.insert(workflowSequenceAllocations).values({ allocatedAt: new Date() });
  const rows = (
    await transaction.execute(sql`SELECT LAST_INSERT_ID() AS sequenceId`)
  )[0] as unknown as readonly { sequenceId: number }[];
  const sequenceId = rows[0]?.sequenceId;
  if (sequenceId === undefined) {
    throw new Error('Workflow sequence allocation returned no id.');
  }
  return sequenceId;
}
