import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const execute = vi.hoisted(() => vi.fn());
vi.mock('../src/platform/wx-request-executor.js', () => ({ executeWxJsonRequest: execute }));
vi.mock('../src/platform/wechat-identity.js', () => ({
  awaitWechatSessionRecovery: async () => undefined,
  getStoredWechatToken: () => 'synthetic-token',
  getWechatRequestAuthentication: () => ({}),
}));
beforeEach(() => {
  execute.mockReset();
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
});
afterEach(() => vi.unstubAllGlobals());
describe('external duty request errors', () => {
  it('keeps the server partial-completion explanation for a known conflict response', async () => {
    execute.mockResolvedValue({
      statusCode: 409,
      data: { error: { code: 'CONFLICT', message: '已提交 1 步，后续未完成。' } },
    });
    const { externalDutyRequest } = await import('../src/platform/external-duty-client.ts');
    await expect(externalDutyRequest('/resolve-apply', {})).rejects.toThrow(
      '已提交 1 步，后续未完成。',
    );
  });
  it.each([
    null,
    { error: { message: 'arbitrary' } },
    { error: { code: 'CONFLICT', message: 'x'.repeat(241) } },
  ])('uses a bounded fallback for malformed conflict data %j', async (data) => {
    execute.mockResolvedValue({ statusCode: 409, data });
    const { externalDutyRequest } = await import('../src/platform/external-duty-client.ts');
    await expect(externalDutyRequest('/resolve-apply', {})).rejects.toThrow('排班已变化');
  });
  it('does not display internal error details', async () => {
    execute.mockResolvedValue({
      statusCode: 500,
      data: { error: { code: 'CONFLICT', message: 'internal detail' } },
    });
    const { externalDutyRequest } = await import('../src/platform/external-duty-client.ts');
    await expect(externalDutyRequest('/resolve-apply', {})).rejects.toThrow('HTTP 500');
  });
});
