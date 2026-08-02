import type { DatabaseClient } from '@schedule/database';
import {
  notificationDeliveries,
  notifications,
  webPushSubscriptions,
  withTransaction,
} from '@schedule/database';
import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';

import type { PushDispatcher } from '../modules/notifications/notification-dispatcher.js';

const retryDelayMinutes = [5, 30] as const;

export interface NotificationRetryRunResult {
  readonly attempted: number;
  readonly failed: number;
  readonly sent: number;
  readonly skipped: number;
}

export class NotificationRetryJob {
  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly dispatcher: PushDispatcher,
    private readonly options: { readonly batchSize?: number } = {},
  ) {}

  public async run(now = new Date()): Promise<NotificationRetryRunResult> {
    if (!this.dispatcher.isConfigured) {
      return {
        attempted: 0,
        failed: 0,
        sent: 0,
        skipped: await this.markPendingSkipped(now),
      };
    }

    const batchSize = this.options.batchSize ?? 100;
    const dueDeliveries = await withTransaction(this.databaseClient, (transaction) =>
      transaction
        .select({ id: notificationDeliveries.id })
        .from(notificationDeliveries)
        .where(
          and(
            eq(notificationDeliveries.status, 'pending'),
            lt(notificationDeliveries.attempts, notificationDeliveries.maxAttempts),
            or(
              isNull(notificationDeliveries.nextAttemptAt),
              lte(notificationDeliveries.nextAttemptAt, now),
            ),
          ),
        )
        .orderBy(asc(notificationDeliveries.nextAttemptAt))
        .limit(batchSize),
    );

    let attempted = 0;
    let failed = 0;
    let sent = 0;
    for (const delivery of dueDeliveries) {
      attempted += 1;
      const outcome = await this.processDelivery(delivery.id, now);
      if (outcome === 'sent') {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    return { attempted, failed, sent, skipped: 0 };
  }

  private async markPendingSkipped(now: Date): Promise<number> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [result] = await transaction
        .update(notificationDeliveries)
        .set({ status: 'skipped', lastError: '推送服务未配置' })
        .where(
          and(
            eq(notificationDeliveries.status, 'pending'),
            or(
              isNull(notificationDeliveries.nextAttemptAt),
              lte(notificationDeliveries.nextAttemptAt, now),
            ),
          ),
        );

      return result.affectedRows;
    });
  }

  private async processDelivery(deliveryId: string, now: Date): Promise<'failed' | 'sent'> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [delivery] = await transaction
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.id, deliveryId))
        .limit(1)
        .for('update');
      if (delivery === undefined || delivery.status !== 'pending') {
        return 'failed';
      }

      const [notification] = await transaction
        .select()
        .from(notifications)
        .where(eq(notifications.id, delivery.notificationId))
        .limit(1);
      if (notification === undefined) {
        await transaction
          .update(notificationDeliveries)
          .set({ status: 'skipped', lastError: '通知记录不存在' })
          .where(eq(notificationDeliveries.id, deliveryId));
        return 'failed';
      }
      const [subscription] = await transaction
        .select({
          auth: webPushSubscriptions.auth,
          endpoint: webPushSubscriptions.endpoint,
          p256dh: webPushSubscriptions.p256dh,
        })
        .from(webPushSubscriptions)
        .where(eq(webPushSubscriptions.userId, notification.recipientUserId))
        .limit(1);
      if (subscription === undefined) {
        await transaction
          .update(notificationDeliveries)
          .set({ status: 'skipped', lastError: '推送订阅已失效' })
          .where(eq(notificationDeliveries.id, deliveryId));
        return 'failed';
      }

      try {
        await this.dispatcher.send(subscription, {
          body: '排班信息有更新',
          data: {
            notificationId: notification.id,
            ...(notification.groupId === null ? {} : { groupId: notification.groupId }),
          },
          title: '排班信息有更新',
          url: '/',
        });
        await transaction
          .update(notificationDeliveries)
          .set({
            lastError: null,
            sentAt: now,
            status: 'sent',
          })
          .where(eq(notificationDeliveries.id, deliveryId));
        return 'sent';
      } catch (error) {
        const nextAttempts = delivery.attempts + 1;
        const exhausted = nextAttempts >= delivery.maxAttempts;
        await transaction
          .update(notificationDeliveries)
          .set({
            attempts: nextAttempts,
            lastError: getErrorMessage(error).slice(0, 500),
            nextAttemptAt: exhausted ? null : addMinutes(now, getRetryDelay(nextAttempts)),
            status: exhausted ? 'failed' : 'pending',
          })
          .where(eq(notificationDeliveries.id, deliveryId));
        return 'failed';
      }
    });
  }
}

function getRetryDelay(attempts: number): number {
  return retryDelayMinutes[attempts - 1] ?? 60;
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.valueOf() + minutes * 60 * 1000);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : '未知推送错误';
}
