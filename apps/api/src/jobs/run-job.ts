import { createDatabaseClient } from '@schedule/database';

import { loadEnvironment } from '../config/env.js';
import { parseHolidayAdminUids } from '../modules/holidays/holiday-admin.js';
import { createPushDispatcher } from '../modules/notifications/notification-dispatcher.js';
import { DutyReminderJob } from './duty-reminders.js';
import { HolidayAlertJob } from './holiday-alerts.js';
import { NotificationRetryJob } from './notification-retry.js';

const jobName = getJobName(process.argv.slice(2));
if (jobName === undefined) {
  console.error(
    'Usage: node dist/jobs/run-job.js --job=duty-reminders|notification-retry|holiday-alerts',
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
  const result =
    jobName === 'duty-reminders'
      ? await new DutyReminderJob(client).run()
      : jobName === 'notification-retry'
        ? await new NotificationRetryJob(client, createPushDispatcher(process.env)).run()
        : await new HolidayAlertJob(client, parseHolidayAdminUids(process.env)).run();
  console.log(JSON.stringify({ job: jobName, ...result }));
} finally {
  await client.close();
}

function getJobName(
  args: readonly string[],
): 'duty-reminders' | 'holiday-alerts' | 'notification-retry' | undefined {
  const value = args.find((argument) => argument.startsWith('--job='))?.slice('--job='.length);
  return value === 'duty-reminders' || value === 'holiday-alerts' || value === 'notification-retry'
    ? value
    : undefined;
}
