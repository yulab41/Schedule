import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('../src/platform/runtime-config.ts', () => ({
  runtimeConfig: { apiBaseUrl: 'https://example.test/api' },
}));
vi.mock('../src/platform/wx-request-executor.ts', () => ({ executeWxJsonRequest: mock.execute }));
vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatToken: () => 'token',
  getWechatRequestAuthentication: () => ({ sessionGeneration: 1 }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('wx', {});
});
afterEach(() => vi.unstubAllGlobals());
describe('small WeChat diagnostic clients', () => {
  it.each([400, 403, 429])(
    'keeps the safe HTTP status %s without raw response text',
    async (status) => {
      const { sendWechatNotificationTest, WechatDiagnosticHttpError } =
        await import('../src/platform/wechat-notification-client.ts');
      mock.execute.mockResolvedValue({ statusCode: status, data: { message: 'PRIVATE' } });
      await expect(sendWechatNotificationTest('group', 'operation', 123)).rejects.toBeInstanceOf(
        WechatDiagnosticHttpError,
      );
      await expect(sendWechatNotificationTest('group', 'operation', 123)).rejects.not.toThrow(
        'PRIVATE',
      );
    },
  );
  it('distinguishes absent configuration from an invalid successful response', async () => {
    const { loadWechatSubscriptionTemplates } =
      await import('../src/platform/wechat-notification-client.ts');
    mock.execute.mockResolvedValue({ statusCode: 200, data: { dutyReminderTemplateId: null } });
    expect(await loadWechatSubscriptionTemplates()).toEqual([]);
    for (const data of [{}, { dutyReminderTemplateId: 'unsafe space' }, null]) {
      mock.execute.mockResolvedValue({ statusCode: 200, data });
      await expect(loadWechatSubscriptionTemplates()).rejects.toThrow('响应无效');
    }
  });
  it('requires a positive preference acknowledgement and retains session handling', async () => {
    const { saveWechatReceivingPreference } =
      await import('../src/platform/wechat-notification-client.ts');
    mock.execute.mockResolvedValue({ statusCode: 200, data: {} });
    await expect(saveWechatReceivingPreference('group')).rejects.toThrow('未确认');
    mock.execute.mockResolvedValue({ statusCode: 200, data: { wechatNotificationsEnabled: true } });
    await saveWechatReceivingPreference('group');
    expect(mock.execute.mock.lastCall[0]).toMatchObject({
      method: 'PUT',
      capability: 'externalMessages',
      authentication: { sessionGeneration: 1 },
    });
  });
  it('sends the idempotency header while disabling automatic test request retries', async () => {
    const { sendWechatNotificationTest } =
      await import('../src/platform/wechat-notification-client.ts');
    mock.execute.mockResolvedValue({ statusCode: 200, data: { outcome: 'unknown' } });
    await sendWechatNotificationTest('group', 'operation', 123);
    expect(mock.execute.mock.lastCall[0]).toMatchObject({
      method: 'POST',
      header: { 'Idempotency-Key': 'operation' },
      data: { groupId: 'group', issuedAt: 123 },
    });
    expect(mock.execute.mock.lastCall[0]).not.toHaveProperty('idempotencyKey');
  });
  it('preserves the workbench selection reader owner, null, empty and failure semantics', async () => {
    const { readStoredWorkbenchGroupId } = await import('../src/platform/workbench-selection.ts');
    for (const value of [
      undefined,
      null,
      {},
      { ownerId: 'other', groupId: 'g' },
      { ownerId: 'a', groupId: '' },
    ]) {
      globalThis.wx.getStorageSync = () => value;
      expect(readStoredWorkbenchGroupId('a')).toBeUndefined();
    }
    globalThis.wx.getStorageSync = () => ({ ownerId: 'a', groupId: ' ' });
    expect(readStoredWorkbenchGroupId('a')).toBe(' ');
    globalThis.wx.getStorageSync = () => {
      throw new Error('storage');
    };
    expect(readStoredWorkbenchGroupId('a')).toBeUndefined();
  });
});
