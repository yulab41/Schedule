export type WechatSubscriptionResult = 'accept' | 'ban' | 'reject';

export interface WechatSubscriptionPort {
  requestSubscribeMessage?: (options: {
    readonly fail?: (error: unknown) => void;
    readonly success: (result: Readonly<Record<string, WechatSubscriptionResult>>) => void;
    readonly tmplIds: readonly string[];
  }) => void;
}

export type DutyReminderSubscriptionState =
  'accepted' | 'banned' | 'failed' | 'rejected' | 'unsupported';

export interface DutyReminderSubscriptionResult {
  readonly kind: DutyReminderSubscriptionState;
  readonly message: string;
}

export function requestDutyReminderSubscription(
  port: WechatSubscriptionPort,
  templateId: string,
): Promise<DutyReminderSubscriptionResult> {
  const requestSubscribeMessage = port.requestSubscribeMessage;
  if (requestSubscribeMessage === undefined)
    return Promise.resolve({ kind: 'unsupported', message: '当前微信版本不支持订阅消息。' });
  return new Promise((resolve) => {
    try {
      requestSubscribeMessage({
        fail: () => resolve({ kind: 'failed', message: '订阅申请未完成，请稍后重试。' }),
        success: (result) => {
          const status = result[templateId];
          if (status === 'accept') resolve({ kind: 'accepted', message: '已允许值班提醒订阅。' });
          else if (status === 'ban')
            resolve({ kind: 'banned', message: '该模板已被微信系统限制订阅。' });
          else resolve({ kind: 'rejected', message: '您未允许值班提醒订阅。' });
        },
        tmplIds: [templateId],
      });
    } catch {
      resolve({ kind: 'failed', message: '订阅申请未完成，请稍后重试。' });
    }
  });
}
