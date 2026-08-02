import type { DatabaseClient } from '@schedule/database';
import { holidayCalendarVersions, users, withTransaction } from '@schedule/database';
import { getChinaStandardTimeBusinessDate } from '@schedule/scheduling-domain';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { NotificationWriter } from '../modules/notifications/notification-writer.js';
import { claimBatch } from './notification-batch.js';

export interface HolidayAlertRunResult {
  readonly adminCount: number;
  readonly created: number;
  readonly duplicate: number;
}

export class HolidayAlertJob {
  private readonly notificationWriter = new NotificationWriter();

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly allowedCloudbaseUids: ReadonlySet<string>,
  ) {}

  public async run(now = new Date()): Promise<HolidayAlertRunResult> {
    if (this.allowedCloudbaseUids.size === 0) {
      return { adminCount: 0, created: 0, duplicate: 0 };
    }

    const nextYear = Number(getChinaStandardTimeBusinessDate(now).slice(0, 4)) + 1;
    const adminUserIds = await this.loadAdminUserIds();
    if (adminUserIds.length === 0) {
      return { adminCount: 0, created: 0, duplicate: 0 };
    }

    const hasConfirmedCalendar = await this.hasConfirmedCalendar(nextYear);
    if (hasConfirmedCalendar) {
      return { adminCount: adminUserIds.length, created: 0, duplicate: 0 };
    }

    const batchKey = `holiday-alert:${nextYear}`;
    const outcome = await withTransaction(this.databaseClient, async (transaction) => {
      if (!(await claimBatch(transaction, batchKey, 'holiday_alert'))) {
        return 'duplicate' as const;
      }
      await this.notificationWriter.append(transaction, {
        body: `下一年度（${nextYear}）的官方节假日安排尚未导入并确认。`,
        notificationType: 'holiday_data_missing',
        payload: { year: nextYear },
        recipientUserIds: adminUserIds,
        title: '节假日数据待导入',
      });
      return 'created' as const;
    });

    return {
      adminCount: adminUserIds.length,
      created: outcome === 'created' ? 1 : 0,
      duplicate: outcome === 'duplicate' ? 1 : 0,
    };
  }

  private async loadAdminUserIds(): Promise<readonly string[]> {
    if (this.allowedCloudbaseUids.size === 0) {
      return [];
    }

    return withTransaction(this.databaseClient, (transaction) =>
      transaction
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            inArray(users.cloudbaseUid, [...this.allowedCloudbaseUids]),
            eq(users.status, 'active'),
            isNull(users.deletedAt),
          ),
        ),
    ).then((rows) => rows.map((row) => row.id));
  }

  private async hasConfirmedCalendar(year: number): Promise<boolean> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [row] = await transaction
        .select({ id: holidayCalendarVersions.id })
        .from(holidayCalendarVersions)
        .where(
          and(
            eq(holidayCalendarVersions.year, year),
            eq(holidayCalendarVersions.status, 'confirmed'),
            isNull(holidayCalendarVersions.deletedAt),
          ),
        )
        .limit(1);
      return row !== undefined;
    });
  }
}
