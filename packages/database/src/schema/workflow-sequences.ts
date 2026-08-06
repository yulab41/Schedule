import { bigint, mysqlTable, timestamp } from 'drizzle-orm/mysql-core';

export const workflowSequenceAllocations = mysqlTable('workflow_sequence_allocations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  allocatedAt: timestamp('allocated_at', { fsp: 3 }).defaultNow().notNull(),
});
