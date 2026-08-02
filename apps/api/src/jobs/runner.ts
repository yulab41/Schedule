import { createDatabaseClient } from '@schedule/database';

import { parseHolidayAdminUids } from '../modules/holidays/holiday-admin.js';
import { createPushDispatcher } from '../modules/notifications/notification-dispatcher.js';
import { deriveBackupKey } from './backup-archive.js';
import { LocalBackupStorage } from './backup-storage.js';
import { DatabaseBackupJob } from './database-backup.js';
import { DutyReminderJob } from './duty-reminders.js';
import { ExportJobProcessor } from './export-jobs.js';
import { GroupRecycleJob } from './group-recycle.js';
import { HolidayAlertJob } from './holiday-alerts.js';
import { NotificationRetryJob } from './notification-retry.js';
import { StatisticsRebuildJob } from './statistics-rebuild.js';

export type JobName =
  | 'database-backup'
  | 'duty-reminders'
  | 'export-jobs'
  | 'group-recycle'
  | 'holiday-alerts'
  | 'notification-retry'
  | 'statistics-rebuild';

export const jobNames: readonly JobName[] = [
  'database-backup',
  'duty-reminders',
  'export-jobs',
  'group-recycle',
  'holiday-alerts',
  'notification-retry',
  'statistics-rebuild',
];

export async function runJob(
  jobName: JobName,
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
