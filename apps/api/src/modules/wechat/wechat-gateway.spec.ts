import { describe, expect, it, vi } from 'vitest';

import {
  createMockWechatGateway,
  createWechatGateway,
  mapWechatApiError,
  WechatApiGateway,
  WechatGatewayError,
} from './wechat-gateway.js';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function binaryResponse(bytes: readonly number[]): Response {
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'image/png' },
    status: 200,
  });
}

function createGateway(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
  now = () => 1_000_000,
): { gateway: WechatApiGateway; fetchFn: ReturnType<typeof vi.fn> } {
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(input, init),
  );
  const gateway = new WechatApiGateway({
    appId: 'app-id',
    appSecret: 'app-secret',
    fetchFn,
    now,
  });
  return { fetchFn, gateway };
}

describe('mock WeChat gateway', () => {
  it('is always configured and returns stable mock openids per code', async () => {
    const gateway = createMockWechatGateway();
    expect(gateway.isConfigured).toBe(true);

    await expect(gateway.exchangeCode('code-a')).resolves.toEqual({
      openid: 'mock-openid-code-a',
      sessionKey: undefined,
      unionid: undefined,
    });
    await expect(gateway.exchangeCode('code-a')).resolves.toMatchObject({
      openid: 'mock-openid-code-a',
    });
    await expect(gateway.exchangeCode('code-b')).resolves.toMatchObject({
      openid: 'mock-openid-code-b',
    });
  });

  it('returns placeholder PNG bytes for group QR codes', async () => {
    const gateway = createMockWechatGateway();
    const bytes = await gateway.getUnlimitedQr('v=abc', 'pages/guest/guest', 'develop');

    expect(bytes.length).toBeGreaterThan(0);
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('records and logs subscribe message sends', async () => {
    const log = vi.fn();
    const gateway = createMockWechatGateway({ log });

    const result = await gateway.sendSubscribeMessage('openid-1', 'template-1', {
      thing1: { value: '值班提醒' },
    });

    expect(result).toEqual({ messageId: 'mock-message-id' });
    expect(gateway.sentMessages).toEqual([
      { data: { thing1: { value: '值班提醒' } }, openid: 'openid-1', templateId: 'template-1' },
    ]);
    expect(log).toHaveBeenCalledWith({
      data: { thing1: { value: '值班提醒' } },
      openid: 'openid-1',
      templateId: 'template-1',
    });
  });

  it('selects the mock gateway from the environment factory', () => {
    const gateway = createWechatGateway({
      WECHAT_APPID: undefined,
      WECHAT_APPSECRET: undefined,
      WECHAT_MOCK_MODE: 'true',
    });

    expect(gateway.isConfigured).toBe(true);
  });
});

describe('real WeChat API gateway', () => {
  it('is not configured without credentials and fails closed', async () => {
    const gateway = new WechatApiGateway({ appId: undefined, appSecret: undefined });

    expect(gateway.isConfigured).toBe(false);
    await expect(gateway.exchangeCode('code')).rejects.toMatchObject({
      mappedCode: 'INTERNAL_ERROR',
    });
  });

  it('exchanges a login code through jscode2session', async () => {
    const { fetchFn, gateway } = createGateway(() =>
      jsonResponse({ openid: 'openid-1', session_key: 'session-1', unionid: 'union-1' }),
    );

    await expect(gateway.exchangeCode('code-1')).resolves.toEqual({
      openid: 'openid-1',
      sessionKey: 'session-1',
      unionid: 'union-1',
    });

    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/sns/jscode2session');
    expect(url.searchParams.get('appid')).toBe('app-id');
    expect(url.searchParams.get('js_code')).toBe('code-1');
    expect(url.searchParams.get('grant_type')).toBe('authorization_code');
  });

  it('maps invalid and reused login codes to WECHAT_LOGIN_FAILED', async () => {
    const invalid = createGateway(() => jsonResponse({ errcode: 40029, errmsg: 'invalid code' }));
    await expect(invalid.gateway.exchangeCode('code')).rejects.toMatchObject({
      errcode: 40029,
      mappedCode: 'WECHAT_LOGIN_FAILED',
    });

    const reused = createGateway(() => jsonResponse({ errcode: 40163, errmsg: 'code been used' }));
    await expect(reused.gateway.exchangeCode('code')).rejects.toMatchObject({
      errcode: 40163,
      mappedCode: 'WECHAT_LOGIN_FAILED',
    });
  });

  it('caches access tokens until five minutes before expiry', async () => {
    let now = 1_000_000;
    let tokenCalls = 0;
    const { gateway } = createGateway(
      (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/cgi-bin/token')) {
          tokenCalls += 1;
          return jsonResponse({ access_token: 'token-1', expires_in: 7200 });
        }
        if (url.pathname.endsWith('/getwxacodeunlimit')) {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            env_version: 'develop',
            page: 'pages/guest/guest',
            scene: 'v=abc',
          });
          return binaryResponse([0x89, 0x50, 0x4e, 0x47]);
        }
        throw new Error(`unexpected request: ${String(input)}`);
      },
      () => now,
    );

    await gateway.getUnlimitedQr('v=abc', 'pages/guest/guest', 'develop');
    await gateway.getUnlimitedQr('v=abc', 'pages/guest/guest', 'develop');
    expect(tokenCalls).toBe(1);

    now += 7_200_000 - 6 * 60_000; // 剩余 6 分钟 > 5 分钟刷新余量
    await gateway.getUnlimitedQr('v=abc', 'pages/guest/guest', 'develop');
    expect(tokenCalls).toBe(1);

    now += 2 * 60_000; // 剩余 4 分钟 < 5 分钟刷新余量
    await gateway.getUnlimitedQr('v=abc', 'pages/guest/guest', 'develop');
    expect(tokenCalls).toBe(2);
  });

  it('returns QR PNG bytes and maps QR API errors', async () => {
    const { gateway } = createGateway((input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/cgi-bin/token')) {
        return jsonResponse({ access_token: 'token-1', expires_in: 7200 });
      }
      return binaryResponse([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    });
    await expect(gateway.getUnlimitedQr('v=abc', 'p', 'develop')).resolves.toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    const rateLimited = createGateway((input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/cgi-bin/token')) {
        return jsonResponse({ access_token: 'token-1', expires_in: 7200 });
      }
      return jsonResponse({ errcode: 45009, errmsg: 'reach max api daily quota limit' });
    });
    await expect(rateLimited.gateway.getUnlimitedQr('v=abc', 'p', 'develop')).rejects.toMatchObject(
      { errcode: 45009, mappedCode: 'RATE_LIMITED' },
    );
  });

  it('sends subscribe messages and maps user refusal', async () => {
    let subscribeBody: unknown;
    const { gateway } = createGateway((input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/cgi-bin/token')) {
        return jsonResponse({ access_token: 'token-1', expires_in: 7200 });
      }
      subscribeBody = JSON.parse(String(init?.body));
      return jsonResponse({ errcode: 0, errmsg: 'ok' });
    });

    await expect(
      gateway.sendSubscribeMessage('openid-1', 'template-1', { thing1: { value: '值班' } }),
    ).resolves.toEqual({ messageId: null });
    expect(subscribeBody).toEqual({
      data: { thing1: { value: '值班' } },
      template_id: 'template-1',
      touser: 'openid-1',
    });

    const refused = createGateway((input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/cgi-bin/token')) {
        return jsonResponse({ access_token: 'token-1', expires_in: 7200 });
      }
      return jsonResponse({ errcode: 43101, errmsg: 'user refuse to accept the msg' });
    });
    await expect(
      refused.gateway.sendSubscribeMessage('openid-1', 'template-1', {}),
    ).rejects.toMatchObject({ errcode: 43101, mappedCode: 'WECHAT_MESSAGE_SEND_FAILED' });
  });

  it('maps unknown error codes and non-JSON responses to service unavailability', async () => {
    expect(mapWechatApiError(999999)).toBe('SERVICE_UNAVAILABLE');
    expect(mapWechatApiError(47003)).toBe('VALIDATION_FAILED');

    const nonJson = createGateway(() => new Response('not json', { status: 200 }));
    await expect(nonJson.gateway.exchangeCode('code')).rejects.toMatchObject({
      mappedCode: 'SERVICE_UNAVAILABLE',
    });

    const httpError = createGateway(() => new Response('boom', { status: 500 }));
    await expect(httpError.gateway.exchangeCode('code')).rejects.toMatchObject({
      mappedCode: 'SERVICE_UNAVAILABLE',
    });
  });

  it('maps aborted requests to service unavailability without leaking secrets', async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });
    const gateway = new WechatApiGateway({
      appId: 'app-id',
      appSecret: 'app-secret',
      fetchFn,
    });

    const error = (await gateway.exchangeCode('code').catch((caught: unknown) => caught)) as
      WechatGatewayError | undefined;
    expect(error).toBeInstanceOf(WechatGatewayError);
    expect(error?.mappedCode).toBe('SERVICE_UNAVAILABLE');
    expect(error?.message).not.toContain('app-secret');
  });
});
