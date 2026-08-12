import { describe, expect, it, vi } from 'vitest';

import { requestDutyReminderSubscription } from './wechat-subscription-adapter.js';

describe('wechat duty reminder subscription adapter', () => {
  it('requests only the configured duty reminder template after an explicit user action', async () => {
    const requestSubscribeMessage = vi.fn((options) =>
      options.success({ 'template-duty': 'accept' }),
    );

    await expect(
      requestDutyReminderSubscription({ requestSubscribeMessage }, 'template-duty'),
    ).resolves.toEqual({ kind: 'accepted', message: '已允许值班提醒订阅。' });
    expect(requestSubscribeMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tmplIds: ['template-duty'] }),
    );
  });

  it.each([
    ['reject', { kind: 'rejected', message: '您未允许值班提醒订阅。' }],
    ['ban', { kind: 'banned', message: '该模板已被微信系统限制订阅。' }],
  ] as const)('reports %s without changing server preferences', async (status, expected) => {
    await expect(
      requestDutyReminderSubscription(
        { requestSubscribeMessage: (options) => options.success({ 'template-duty': status }) },
        'template-duty',
      ),
    ).resolves.toEqual(expected);
  });

  it('distinguishes unsupported clients and API failures', async () => {
    await expect(requestDutyReminderSubscription({}, 'template-duty')).resolves.toEqual({
      kind: 'unsupported',
      message: '当前微信版本不支持订阅消息。',
    });
    await expect(
      requestDutyReminderSubscription(
        { requestSubscribeMessage: (options) => options.fail?.({ errMsg: 'request failed' }) },
        'template-duty',
      ),
    ).resolves.toEqual({ kind: 'failed', message: '订阅申请未完成，请稍后重试。' });
  });
});
