import { describe, expect, it, vi } from 'vitest';
import { WechatPushDispatcher } from './wechat-push-dispatcher.js';

describe('feedback8 verified duty reminder template', () => {
  it('classifies invalid template data as a failed validation instead of an expired reminder', async () => {
    const sendSubscribeMessage = vi.fn();
    const dispatcher = new WechatPushDispatcher(
      {} as never,
      { isConfigured: true, sendSubscribeMessage } as never,
      { dutyReminder: 'fixture' },
      async () => 'recipient',
    );
    await expect(
      dispatcher.send({
        id: 'n',
        recipientUserId: 'u',
        notificationType: 'duty_reminder',
        title: 't',
        body: 'b',
        dutyReminder: {
          businessDate: '2026-11-01',
          memberName: '名'.repeat(21),
          shiftTypeName: '全天班',
          changed: false,
        },
      }),
    ).rejects.toMatchObject({ mappedCode: 'VALIDATION_FAILED' });
    expect(sendSubscribeMessage).not.toHaveBeenCalled();
  });
  it('matches all four actual platform fields with their own business meaning', async () => {
    const sendSubscribeMessage = vi.fn(async () => ({ messageId: null }));
    const dispatcher = new WechatPushDispatcher(
      {} as never,
      { isConfigured: true, sendSubscribeMessage } as never,
      { dutyReminder: 'template-fixture' },
      async () => 'recipient-fixture',
    );
    await dispatcher.send({
      id: 'n',
      recipientUserId: 'u',
      notificationType: 'duty_reminder',
      title: '值班提醒',
      body: '不应解析通知文案拼凑模板数据',
      dutyReminder: {
        businessDate: '2026-11-01',
        memberName: '测试成员',
        shiftTypeName: '全天班',
        changed: true,
      },
    });
    expect(sendSubscribeMessage).toHaveBeenCalledWith('recipient-fixture', 'template-fixture', {
      thing6: { value: '是' },
      character_string7: { value: '2026-11-01' },
      thing9: { value: '测试成员' },
      thing8: { value: '全天班' },
    });
  });
  it('does not send invented duty details when a stored assignment is missing', async () => {
    const sendSubscribeMessage = vi.fn();
    const dispatcher = new WechatPushDispatcher(
      {} as never,
      { isConfigured: true, sendSubscribeMessage } as never,
      { dutyReminder: 'template-fixture' },
      async () => 'recipient-fixture',
    );
    await expect(
      dispatcher.send({
        id: 'n',
        recipientUserId: 'u',
        notificationType: 'duty_reminder',
        title: 't',
        body: 'b',
      }),
    ).rejects.toThrow();
    expect(sendSubscribeMessage).not.toHaveBeenCalled();
  });
});
