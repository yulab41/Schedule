import { randomUUID } from 'node:crypto';
import {
  notificationDeliveries,
  notifications,
  webPushSubscriptions,
  withTransaction,
  type DatabaseClient,
} from '@schedule/database';
import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';
import type { PushDispatcher } from '../modules/notifications/notification-dispatcher.js';
import type { WechatPushDispatcher } from '../modules/wechat/wechat-push-dispatcher.js';
import { WechatGatewayError } from '../modules/wechat/wechat-gateway.js';

const retryDelayMinutes = [5, 30] as const;
const claimLeaseMilliseconds = 10 * 60 * 1000;
type Outcome = 'failed' | 'sent' | 'skipped';
type Delivery = typeof notificationDeliveries.$inferSelect;
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
    private readonly wechatDispatcher: WechatPushDispatcher | undefined = undefined,
    private readonly options: { readonly batchSize?: number; readonly clock?: () => Date } = {},
  ) {}
  public async run(now = new Date()): Promise<NotificationRetryRunResult> {
    const started = performance.now();
    const clock =
      this.options.clock ?? (() => new Date(now.valueOf() + performance.now() - started));
    let preSkipped = 0;
    if (!this.dispatcher.isConfigured) preSkipped = await this.markBrowserPendingSkipped(now);
    const due = await this.databaseClient.database
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
          or(
            isNull(notificationDeliveries.claimedUntil),
            lte(notificationDeliveries.claimedUntil, now),
          ),
        ),
      )
      .orderBy(asc(notificationDeliveries.nextAttemptAt), asc(notificationDeliveries.id))
      .limit(this.options.batchSize ?? 100);
    const result = { attempted: 0, failed: 0, sent: 0, skipped: preSkipped };
    for (const row of due) {
      result.attempted++;
      result[await this.processDelivery(row.id, clock)]++;
    }
    return result;
  }
  private async markBrowserPendingSkipped(now: Date): Promise<number> {
    const [result] = await this.databaseClient.database
      .update(notificationDeliveries)
      .set({ status: 'skipped', lastError: '推送服务未配置', claimToken: null, claimedUntil: null })
      .where(
        and(
          eq(notificationDeliveries.channel, 'browser'),
          eq(notificationDeliveries.status, 'pending'),
          or(
            isNull(notificationDeliveries.nextAttemptAt),
            lte(notificationDeliveries.nextAttemptAt, now),
          ),
          or(
            isNull(notificationDeliveries.claimedUntil),
            lte(notificationDeliveries.claimedUntil, now),
          ),
        ),
      );
    return result.affectedRows;
  }
  private async processDelivery(id: string, clock: () => Date): Promise<Outcome> {
    const token = randomUUID();
    const delivery = await withTransaction(this.databaseClient, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.id, id))
        .limit(1)
        .for('update');
      const now = clock();
      if (
        !row ||
        row.status !== 'pending' ||
        row.attempts >= row.maxAttempts ||
        (row.nextAttemptAt && row.nextAttemptAt > now) ||
        (row.claimedUntil && row.claimedUntil > now)
      )
        return undefined;
      await transaction
        .update(notificationDeliveries)
        .set({ claimToken: token, claimedUntil: new Date(now.valueOf() + claimLeaseMilliseconds) })
        .where(eq(notificationDeliveries.id, id));
      return row;
    });
    if (!delivery) return 'skipped';
    // No database transaction or pooled connection stays open during remote send.
    const database = this.databaseClient.database;
    const [notification] = await database
      .select()
      .from(notifications)
      .where(eq(notifications.id, delivery.notificationId))
      .limit(1);
    if (!notification) {
      await this.finish(id, token, { status: 'skipped', lastError: '通知记录不存在' });
      return 'skipped';
    }
    if (delivery.channel === 'wechat')
      return this.processWechatDelivery(id, token, delivery, notification, clock);
    if (!this.dispatcher.isConfigured) {
      await this.finish(id, token, { status: 'skipped', lastError: '推送服务未配置' });
      return 'skipped';
    }
    const [subscription] = await database
      .select({
        auth: webPushSubscriptions.auth,
        endpoint: webPushSubscriptions.endpoint,
        p256dh: webPushSubscriptions.p256dh,
      })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.userId, notification.recipientUserId))
      .limit(1);
    if (!subscription) {
      await this.finish(id, token, { status: 'skipped', lastError: '推送订阅已失效' });
      return 'skipped';
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
      return (await this.finish(id, token, { lastError: null, sentAt: clock(), status: 'sent' }))
        ? 'sent'
        : 'skipped';
    } catch (error) {
      const attempts = delivery.attempts + 1,
        exhausted = attempts >= delivery.maxAttempts;
      return (await this.finish(id, token, {
        attempts,
        lastError: getErrorMessage(error).slice(0, 500),
        nextAttemptAt: exhausted ? null : addMinutes(clock(), getRetryDelay(attempts)),
        status: exhausted ? 'failed' : 'pending',
      }))
        ? 'failed'
        : 'skipped';
    }
  }
  private async processWechatDelivery(
    id: string,
    token: string,
    delivery: Delivery,
    notification: typeof notifications.$inferSelect,
    clock: () => Date,
  ): Promise<Outcome> {
    if (!this.wechatDispatcher?.isConfigured) {
      await this.finish(id, token, { status: 'skipped', lastError: '微信投递未配置' });
      return 'skipped';
    }
    try {
      const result = await this.wechatDispatcher.send({
        body: notification.body,
        id: notification.id,
        notificationType: notification.notificationType,
        objectType: notification.objectType,
        recipientUserId: notification.recipientUserId,
        shiftAssignmentId: notification.shiftAssignmentId,
        groupId: notification.groupId,
        title: notification.title,
        payload: notification.payload,
        createdAt: notification.createdAt,
      });
      return (await this.finish(id, token, {
        externalMessageId: result.messageId,
        lastError: null,
        sentAt: clock(),
        status: 'sent',
      }))
        ? 'sent'
        : 'skipped';
    } catch (error) {
      const attempts = delivery.attempts + 1,
        exhausted = attempts >= delivery.maxAttempts;
      const wechatError =
        error instanceof WechatGatewayError
          ? error
          : new WechatGatewayError(null, null, 'INTERNAL_ERROR', getErrorMessage(error));
      const skipped =
        wechatError.errcode === 43101 ||
        (wechatError.errcode === null && wechatError.mappedCode === 'WECHAT_MESSAGE_SEND_FAILED');
      const failed = wechatError.mappedCode === 'VALIDATION_FAILED';
      const status = skipped ? 'skipped' : failed || exhausted ? 'failed' : 'pending';
      const written = await this.finish(id, token, {
        attempts,
        lastError: wechatError.message.slice(0, 500),
        nextAttemptAt:
          skipped || failed || exhausted ? null : addMinutes(clock(), getRetryDelay(attempts)),
        status,
      });
      return !written || skipped ? 'skipped' : 'failed';
    }
  }
  private async finish(
    id: string,
    token: string,
    values: Partial<typeof notificationDeliveries.$inferInsert>,
  ): Promise<boolean> {
    const [result] = await this.databaseClient.database
      .update(notificationDeliveries)
      .set({ ...values, claimToken: null, claimedUntil: null })
      .where(
        and(
          eq(notificationDeliveries.id, id),
          eq(notificationDeliveries.claimToken, token),
          eq(notificationDeliveries.status, 'pending'),
        ),
      );
    return result.affectedRows === 1;
  }
}
function getRetryDelay(attempts: number): number {
  return retryDelayMinutes[attempts - 1] ?? 60;
}
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.valueOf() + minutes * 60000);
}
function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length ? error.message : '未知推送错误';
}
