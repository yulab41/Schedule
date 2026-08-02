import { createDatabaseClient } from '@schedule/database';

import { loadEnvironment } from '../config/env.js';
import { parseHolidayAdminUids } from '../modules/holidays/holiday-admin.js';
import { createPushDispatcher } from '../modules/notifications/notification-dispatcher.js';
import { deriveBackupKey } from './backup-archive.js';
import { LocalBackupStorage } from './backup-storage.js';
import { DatabaseBackupJob } from './database-backup.js';
import { DutyReminderJob } from './duty-reminders.js';
import { ExportJobProcessor } from './export-jobs.js';
import { GroupRecycleJob } from './group-recycle.js';
import { HolidayAlertJob } from './holiday-alerts.js';
import { recordJobRun } from './job-runs.js';
import { NotificationRetryJob } from './notification-retry.js';
import { StatisticsRebuildJob } from './statistics-rebuild.js';

const jobName = getJobName(process.argv.slice(2));
if (jobName === undefined) {
  console.error(
    'Usage: node dist/jobs/run-job.js --job=duty-reminders|notification-retry|holiday-alerts|export-jobs|database-backup|statistics-rebuild|group-recycle',
  );
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
  const result = await recordJobRun(client, jobName, () => runJob(jobName, client));
  console.log(JSON.stringify({ job: jobName, result }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.close();
}

function getJobName(
  args: readonly string[],
):
  | 'database-backup'
  | 'duty-reminders'
  | 'export-jobs'
  | 'group-recycle'
  | 'holiday-alerts'
  | 'notification-retry'
  | 'statistics-rebuild'
  | undefined {
  const value = args.find((argument) => argument.startsWith('--job='))?.slice('--job='.length);
  return value === 'database-backup' ||
    value === 'duty-reminders' ||
    value === 'export-jobs' ||
    value === 'group-recycle' ||
    value === 'holiday-alerts' ||
    value === 'notification-retry' ||
    value === 'statistics-rebuild'
    ? value
    : undefined;
}

async function runJob(
  jobName: NonNullable<ReturnType<typeof getJobName>>,
  client: ReturnType<typeof createDatabaseClient>,
): Promise<unknown> {
  if (jobName === 'database-backup') {
    return new DatabaseBackupJob(client, {
      encryptionKey: deriveBackupKey(process.env.BACKUP_ENCRYPTION_KEY ?? ''),
      storage: new LocalBackupStorage(process.env.BACKUP_DIR ?? './backups'),
    }).run();
  }
  if (jobName === 'statistics-rebuild') {
    return new StatisticsRebuildJob(client).run();
  }
  if (jobName === 'group-recycle') {
    return new GroupRecycleJob(client).run();
  }
  if (jobName === 'duty-reminders') {
    return new DutyReminderJob(client).run();
  }
  if (jobName === 'notification-retry') {
    return new NotificationRetryJob(client, createPushDispatcher(process.env)).run();
  }
  if (jobName === 'holiday-alerts') {
    return new HolidayAlertJob(client, parseHolidayAdminUids(process.env)).run();
  }
  return new ExportJobProcessor(client).run();
}
