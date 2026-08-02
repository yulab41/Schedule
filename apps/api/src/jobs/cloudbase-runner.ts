import { createDatabaseClient } from '@schedule/database';

import { loadEnvironment } from '../config/env.js';
import { recordJobRun } from './job-runs.js';
import { runJob, type JobName } from './runner.js';

export interface CloudbaseTimerEvent {
  readonly Message?: unknown;
  readonly Time?: unknown;
  readonly TriggerName?: unknown;
  readonly Type?: unknown;
}

const jobByTriggerName: Readonly<Record<string, JobName>> = {
  schedule_database_backup: 'database-backup',
  schedule_duty_reminders: 'duty-reminders',
  schedule_export_jobs: 'export-jobs',
  schedule_group_recycle: 'group-recycle',
  schedule_holiday_alerts: 'holiday-alerts',
  schedule_notification_retry: 'notification-retry',
  schedule_statistics_rebuild: 'statistics-rebuild',
};

export function resolveScheduledJobName(event: CloudbaseTimerEvent): JobName | undefined {
  const triggerName = typeof event.TriggerName === 'string' ? event.TriggerName : '';
  return jobByTriggerName[triggerName];
}

export async function runScheduledCloudbaseJob(
  event: CloudbaseTimerEvent,
): Promise<{ readonly job: JobName; readonly runId: string }> {
  const jobName = resolveScheduledJobName(event);
  if (jobName === undefined) {
    throw new Error(`Unsupported CloudBase timer trigger: ${String(event.TriggerName ?? '')}`);
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
    const { result, runId } = await recordJobRun(client, jobName, () => runJob(jobName, client));
    console.log(JSON.stringify({ event: 'cloudbase_job_completed', job: jobName, result, runId }));
    return { job: jobName, runId };
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'cloudbase_job_failed',
        job: jobName,
      }),
    );
    throw error;
  } finally {
    await client.close();
  }
}
