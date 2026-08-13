import { createDatabaseClient } from '@schedule/database';

import { loadEnvironment } from '../config/env.js';
import { recordJobRun } from './job-runs.js';
import { isJobName, jobNames, runJob, type JobName } from './runner.js';

const jobName = getJobName(process.argv.slice(2));
if (jobName === undefined) {
  console.error(`Usage: node dist/jobs/run-job.js --job=${jobNames.join('|')}`);
  process.exit(1);
}

const environment = loadEnvironment();
const client = createDatabaseClient({
  database: environment.MYSQL_DATABASE,
  host: environment.MYSQL_HOST,
  password: environment.MYSQL_PASSWORD,
  port: environment.MYSQL_PORT,
  user: environment.MYSQL_USER,
});

try {
  const { result, runId } = await recordJobRun(client, jobName, () =>
    runJob(jobName, client, environment),
  );
  console.log(JSON.stringify({ job: jobName, result, runId }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.close();
}

function getJobName(args: readonly string[]): JobName | undefined {
  const value = args.find((argument) => argument.startsWith('--job='))?.slice('--job='.length);
  return value !== undefined && isJobName(value) ? value : undefined;
}
