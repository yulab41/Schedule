import { runScheduledCloudbaseJob } from '../../../../../apps/api/src/jobs/cloudbase-runner.js';

export async function main(event) {
  return runScheduledCloudbaseJob(event);
}
