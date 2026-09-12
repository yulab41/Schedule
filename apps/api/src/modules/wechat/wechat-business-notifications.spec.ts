import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWechatTemplateKind, WechatPushDispatcher } from './wechat-push-dispatcher.js';
import {
  automaticWechatTargetVersion,
  readBusinessTemplateConfiguration,
  buildBusinessTemplateData,
} from './wechat-business-template.js';

afterEach(() => vi.unstubAllEnvs());

describe('automatic business WeChat notifications', () => {
  it('fails closed on a malformed trial route rather than sending to the wrong version', () => {
    vi.stubEnv('WECHAT_TRIAL_GROUP_IDS', '11111111-1111-4111-8111-111111111111,invalid');
    expect(() => automaticWechatTargetVersion('11111111-1111-4111-8111-111111111111')).toThrow(
      'target group configuration invalid',
    );
  });
  it('requires a distinct real template and validates mappings before enabling business delivery', () => {
    const env = {
      WECHAT_DUTY_REMINDER_TEMPLATE_ID: 'duty',
      WECHAT_BUSINESS_TEMPLATE_ID: 'business',
      WECHAT_BUSINESS_TEMPLATE_FIELDS:
        '{"title":"thing1","summary":"thing2","status":"phrase3","occurredAt":"time4"}',
    };
    expect(readBusinessTemplateConfiguration(env)?.id).toBe('business');
    for (const fields of [
      '',
      '{}',
      '{"title":"time1"}',
      '{"title":"thing1","summary":"thing1"}',
      '{"unknown":"thing1"}',
      '[]',
    ])
      expect(
        readBusinessTemplateConfiguration({ ...env, WECHAT_BUSINESS_TEMPLATE_FIELDS: fields }),
      ).toBeUndefined();
    expect(
      readBusinessTemplateConfiguration({ ...env, WECHAT_BUSINESS_TEMPLATE_ID: 'duty' }),
    ).toBeUndefined();
    expect(
      readBusinessTemplateConfiguration({ ...env, WECHAT_BUSINESS_TEMPLATE_ID: '' }),
    ).toBeUndefined();
    const data = buildBusinessTemplateData(readBusinessTemplateConfiguration(env)!, {
      title: '排班已发布',
      notificationType: 'schedule_published',
      groupName: '测试群',
      memberName: '测试',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      payload: { businessMonth: '2026-09-01' },
    });
    expect(data).toEqual({
      thing1: { value: '排班已发布' },
      thing2: { value: '2026-09排班已发布' },
      phrase3: { value: '已更新' },
      time4: { value: '2026-09-01 08:00' },
    });
  });
  it('routes approved business events to a distinct template', () => {
    for (const type of [
      'schedule_published',
      'schedule_generated',
      'schedule_changed',
      'approval_pending',
      'swap_request_created',
      'swap_request_accepted',
      'swap_request_rejected',
      'swap_request_cancelled',
      'swap_revoked',
      'duty_adjustment_request_created',
      'duty_adjustment_request_accepted',
      'duty_adjustment_request_rejected',
      'duty_adjustment_request_cancelled',
      'duty_adjustment_revoked',
      'leave_request_approved',
      'leave_request_rejected',
      'leave_request_cancelled',
      'leave_request_revoked',
    ]) {
      expect(getWechatTemplateKind(type), type).toBe('business');
    }
    expect(getWechatTemplateKind('duty_reminder')).toBe('dutyReminder');
    expect(getWechatTemplateKind('conflict_detected')).toBeUndefined();
  });

  it('automatically targets only configured group IDs to trial without changing explicit diagnostics', async () => {
    const groupId = '11111111-1111-4111-8111-111111111111';
    vi.stubEnv('WECHAT_TRIAL_GROUP_IDS', groupId);
    const sendSubscribeMessage = vi.fn<(...args: unknown[]) => Promise<{ messageId: null }>>(
      async () => ({ messageId: null }),
    );
    const dispatcher = new WechatPushDispatcher(
      {} as never,
      { isConfigured: true, sendSubscribeMessage } as never,
      { dutyReminder: 'duty' },
      async () => 'openid',
    );
    const notification = {
      id: 'n',
      recipientUserId: 'u',
      groupId,
      notificationType: 'duty_reminder',
      title: '值班提醒',
      body: 'b',
      dutyReminder: {
        businessDate: '2026-10-01',
        memberName: '测试',
        shiftTypeName: '电脑班',
        changed: false,
      },
    };
    await dispatcher.send(notification);
    expect(sendSubscribeMessage.mock.calls[0]?.[4]).toBe('trial');
    await dispatcher.send(notification, undefined, undefined, 'formal');
    expect(sendSubscribeMessage.mock.calls[1]).toHaveLength(3);
    await dispatcher.send({ ...notification, groupId: '22222222-2222-4222-8222-222222222222' });
    expect(sendSubscribeMessage.mock.calls[2]).toHaveLength(3);
  });
});
