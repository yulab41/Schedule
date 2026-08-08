import { describe, expect, it, vi } from 'vitest';

import {
  getWechatTemplateKind,
  readWechatTemplateIds,
  WechatPushDispatcher,
  type WechatTemplateIds,
} from './wechat-push-dispatcher.js';
import { WechatGatewayError, type WechatGateway } from './wechat-gateway.js';

describe('WeChat push dispatcher', () => {
  it('maps notification types to template kinds', () => {
    expect(getWechatTemplateKind('duty_reminder')).toBe('dutyReminder');
    expect(getWechatTemplateKind('leave_request_approved')).toBeUndefined();
    expect(getWechatTemplateKind('swap_request_rejected')).toBeUndefined();
    expect(getWechatTemplateKind('duty_adjustment_request_accepted')).toBeUndefined();
    expect(getWechatTemplateKind('schedule_published')).toBeUndefined();
    expect(getWechatTemplateKind('unknown_type')).toBeUndefined();
  });

  it('reads template ids from the process environment', () => {
    expect(
      readWechatTemplateIds({
        WECHAT_DUTY_REMINDER_TEMPLATE_ID: 'tpl-duty',
      }),
    ).toEqual({
      dutyReminder: 'tpl-duty',
    });
  });

  it('sends a subscribe message with the mapped template and data', async () => {
    const sendSubscribeMessage = vi.fn(async () => ({ messageId: 'mock-message-id' }));
    const gateway: WechatGateway = {
      isConfigured: true,
      async exchangeCode() {
        return { openid: 'openid', sessionKey: undefined, unionid: undefined };
      },
      async getUnlimitedQr() {
        return new Uint8Array();
      },
      sendSubscribeMessage,
    };
    const dispatcher = new WechatPushDispatcher(
      {} as never,
      gateway,
      { dutyReminder: 'tpl-duty' },
      async () => 'openid-1',
    );

    const result = await dispatcher.send({
      body: '您值班将在 2 小时后开始。',
      id: 'notification-1',
      notificationType: 'duty_reminder',
      recipientUserId: 'user-1',
      title: '值班提醒',
    });

    expect(result).toEqual({ messageId: 'mock-message-id' });
    expect(sendSubscribeMessage).toHaveBeenCalledWith('openid-1', 'tpl-duty', {
      thing1: { value: '值班提醒' },
      thing2: { value: '您值班将在 2 小时后开始。' },
    });
  });

  it('skips recipients without an openid or without a configured template', async () => {
    const templateIds: WechatTemplateIds = {
      dutyReminder: undefined,
    };
    const noOpenid = new WechatPushDispatcher(
      {} as never,
      configuredGateway(),
      templateIds,
      async () => null,
    );
    await expect(
      noOpenid.send({
        body: 'b',
        id: 'n',
        notificationType: 'duty_reminder',
        recipientUserId: 'u',
        title: 't',
      }),
    ).rejects.toMatchObject({ mappedCode: 'WECHAT_MESSAGE_SEND_FAILED' });

    const noTemplate = new WechatPushDispatcher(
      {} as never,
      configuredGateway(),
      templateIds,
      async () => 'openid-1',
    );
    await expect(
      noTemplate.send({
        body: 'b',
        id: 'n',
        notificationType: 'duty_reminder',
        recipientUserId: 'u',
        title: 't',
      }),
    ).rejects.toMatchObject({ mappedCode: 'WECHAT_MESSAGE_SEND_FAILED' });
  });

  it('fails closed when the gateway is not configured', async () => {
    const dispatcher = new WechatPushDispatcher(
      {} as never,
      { isConfigured: false } as WechatGateway,
      { dutyReminder: 'd' },
      async () => 'openid-1',
    );

    expect(dispatcher.isConfigured).toBe(false);
    await expect(
      dispatcher.send({
        body: 'b',
        id: 'n',
        notificationType: 'schedule_published',
        recipientUserId: 'u',
        title: 't',
      }),
    ).rejects.toMatchObject({ mappedCode: 'WECHAT_MESSAGE_SEND_FAILED' });
  });
});

function configuredGateway(): WechatGateway {
  return {
    isConfigured: true,
    async exchangeCode() {
      throw new WechatGatewayError(0, 'unused', 'INTERNAL_ERROR');
    },
    async getUnlimitedQr() {
      throw new WechatGatewayError(0, 'unused', 'INTERNAL_ERROR');
    },
    async sendSubscribeMessage() {
      return { messageId: null };
    },
  };
}
