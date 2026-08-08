import type { DatabaseClient, DatabaseTransaction, ScheduleDatabase } from '@schedule/database';
import { users } from '@schedule/database';
import { eq } from 'drizzle-orm';

import {
  WechatGatewayError,
  type WechatGateway,
  type WechatSubscribeMessageData,
} from './wechat-gateway.js';

export type WechatTemplateKind = 'dutyReminder';

export interface WechatTemplateIds {
  readonly dutyReminder: string | undefined;
}

export function getWechatTemplateKind(notificationType: string): WechatTemplateKind | undefined {
  if (notificationType === 'duty_reminder') {
    return 'dutyReminder';
  }
  return undefined;
}

export function readWechatTemplateIds(values: NodeJS.ProcessEnv = process.env): WechatTemplateIds {
  return {
    dutyReminder: values.WECHAT_DUTY_REMINDER_TEMPLATE_ID,
  };
}

export interface WechatNotificationRecord {
  readonly body: string;
  readonly id: string;
  readonly notificationType: string;
  readonly recipientUserId: string;
  readonly title: string;
}

type OpenidLookup = (
  userId: string,
  database?: ScheduleDatabase | DatabaseTransaction,
) => Promise<string | null>;

export class WechatPushDispatcher {
  public readonly isConfigured: boolean;

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly gateway: WechatGateway,
    private readonly templateIds: WechatTemplateIds = readWechatTemplateIds(),
    private readonly findOpenid: OpenidLookup = defaultFindOpenid(databaseClient),
  ) {
    this.isConfigured = gateway.isConfigured;
  }

  public async send(
    notification: WechatNotificationRecord,
    database?: ScheduleDatabase | DatabaseTransaction,
  ): Promise<{ readonly messageId: string | null }> {
    if (!this.gateway.isConfigured) {
      throw new WechatGatewayError(
        null,
        null,
        'WECHAT_MESSAGE_SEND_FAILED',
        'WeChat gateway is not configured.',
      );
    }

    const openid = await this.findOpenid(notification.recipientUserId, database);
    if (openid === null || openid === undefined) {
      throw new WechatGatewayError(
        null,
        null,
        'WECHAT_MESSAGE_SEND_FAILED',
        'Recipient has no WeChat openid.',
      );
    }

    const kind = getWechatTemplateKind(notification.notificationType);
    const templateId = kind === undefined ? undefined : this.templateIds[kind];
    if (templateId === undefined || templateId.length === 0) {
      throw new WechatGatewayError(
        null,
        null,
        'WECHAT_MESSAGE_SEND_FAILED',
        'WeChat template is not configured.',
      );
    }

    return this.gateway.sendSubscribeMessage(
      openid,
      templateId,
      buildSubscribeMessageData(notification.title, notification.body),
    );
  }
}

function defaultFindOpenid(databaseClient: DatabaseClient): OpenidLookup {
  return async (userId, database) => {
    const db = database ?? databaseClient.database;
    const [user] = await db
      .select({ wechatOpenid: users.wechatOpenid })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.wechatOpenid ?? null;
  };
}

function buildSubscribeMessageData(title: string, body: string): WechatSubscribeMessageData {
  return {
    thing1: { value: title.slice(0, 20) },
    thing2: { value: body.slice(0, 20) },
  };
}
