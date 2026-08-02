import { randomUUID } from 'node:crypto';

import { type DatabaseClient, platformJobRuns, withTransaction } from '@schedule/database';
import { eq } from 'drizzle-orm';

export type JobRunOutcome = 'completed' | 'failed';

export interface JobRunRecord<Result> {
  readonly result: Result;
  readonly runId: string;
}

export async function recordJobRun<Result>(
  client: DatabaseClient,
  jobName: string,
  operation: () => Promise<Result>,
  now = new Date(),
): Promise<JobRunRecord<Result>> {
  const runId = randomUUID();
  await withTransaction(client, async (transaction) => {
    await transaction.insert(platformJobRuns).values({
      id: runId,
      jobName,
      startedAt: now,
      status: 'running',
    });
  });

  try {
    const result = await operation();
    await finishRun(client, runId, 'completed', summarize(result));
    return { result, runId };
  } catch (error) {
    await finishRun(client, runId, 'failed', getErrorMessage(error));
    throw error;
  }
}

async function finishRun(
  client: DatabaseClient,
  runId: string,
  outcome: JobRunOutcome,
  summary: string,
): Promise<void> {
  await withTransaction(client, async (transaction) => {
    await transaction
      .update(platformJobRuns)
      .set({
        finishedAt: new Date(),
        status: outcome,
        summary: summary.slice(0, 500),
      })
      .where(eq(platformJobRuns.id, runId));
  });
}

function summarize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return String(value);
  }
  return JSON.stringify(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}
