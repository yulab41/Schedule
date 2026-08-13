import { createDatabaseClient } from '@schedule/database';
import type { Environment } from '../config/env.js';

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
import { createWechatGateway } from '../modules/wechat/wechat-gateway.js';
import { WechatPushDispatcher } from '../modules/wechat/wechat-push-dispatcher.js';

export type JobName =
  | 'database-backup'
  | 'duty-reminders'
  | 'export-jobs'
  | 'group-recycle'
  | 'holiday-alerts'
  | 'notification-retry'
  | 'statistics-rebuild';

type JobRunner = (
  client: ReturnType<typeof createDatabaseClient>,
  environment: Environment,
) => Promise<unknown>;

// 穷举映射表：新增 JobName 后 TypeScript 会强制在此补充分支，
// 避免未知任务名被静默当作导出任务执行。
export const jobRunners: Readonly<Record<JobName, JobRunner>> = {
  'database-backup': (client) =>
    new DatabaseBackupJob(client, {
      encryptionKey: deriveBackupKey(process.env.BACKUP_ENCRYPTION_KEY ?? ''),
      storage: new LocalBackupStorage(process.env.BACKUP_DIR ?? './backups'),
    }).run(),
  'duty-reminders': (client) => new DutyReminderJob(client).run(),
  'export-jobs': (client) => new ExportJobProcessor(client).run(),
  'group-recycle': (client) => new GroupRecycleJob(client).run(),
  'holiday-alerts': (client) =>
    new HolidayAlertJob(client, parseHolidayAdminUids(process.env)).run(),
  'notification-retry': (client, environment) =>
    new NotificationRetryJob(
      client,
      createPushDispatcher(environment),
      new WechatPushDispatcher(
        client,
        createWechatGateway({
          WECHAT_APPID: process.env.WECHAT_APPID,
          WECHAT_APPSECRET: process.env.WECHAT_APPSECRET,
          WECHAT_MOCK_MODE: process.env.WECHAT_MOCK_MODE === 'true' ? 'true' : 'false',
        }),
      ),
    ).run(),
  'statistics-rebuild': (client) => new StatisticsRebuildJob(client).run(),
};

export const jobNames: readonly JobName[] = Object.keys(jobRunners) as readonly JobName[];

export function isJobName(value: string): value is JobName {
  return Object.hasOwn(jobRunners, value);
}

export async function runJob(
  jobName: JobName,
  client: ReturnType<typeof createDatabaseClient>,
  environment: Environment,
): Promise<unknown> {
  return jobRunners[jobName](client, environment);
}
