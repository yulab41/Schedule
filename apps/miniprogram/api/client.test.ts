import {
  buildCalendarReadEndpoint,
  buildGuestCalendarReadEndpoint,
  buildGuestGroupResolveEndpoint,
  buildGuestHolidayReadEndpoint,
  decodeScheduleEventPage,
} from '@schedule/client-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { request, requestEndpoint, setUnauthorizedHandler, storeToken } from './client.js';

const requestMock = vi.fn();
const reLaunchMock = vi.fn();
const storage = new Map<string, unknown>();

function respond(statusCode: number, data: unknown): void {
  const options = requestMock.mock.calls[0]?.[0] as WechatMiniprogram.RequestOption;
  options.success?.({
    cookies: [],
    data,
    header: {},
    statusCode,
  } as unknown as WechatMiniprogram.RequestSuccessCallbackResult);
}

beforeEach(() => {
  requestMock.mockReset();
  reLaunchMock.mockReset();
  storage.clear();
  vi.stubGlobal('wx', {
    getStorageSync: vi.fn((key: string) => storage.get(key)),
    reLaunch: reLaunchMock,
    removeStorageSync: vi.fn((key: string) => storage.delete(key)),
    request: requestMock,
    setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, value)),
  });
});

afterEach(() => {
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

describe('API client authentication expiry', () => {
  it('delegates protected-session purge to the injected handler and rejects the API error', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    storeToken('token');

    const result = request('/protected');
    respond(401, {
      error: { code: 'UNAUTHORIZED', message: 'Session expired', requestId: 'req-1' },
    });

    await expect(result).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Session expired',
      requestId: 'req-1',
      status: 401,
    });
    expect(storage.get('schedule.session')).toBe('token');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(reLaunchMock).not.toHaveBeenCalled();
  });

  it('does not clear the session or invoke the handler for a public 401 response', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    storeToken('token');

    const result = request('/public', { auth: false });
    respond(401, {
      error: { code: 'UNAUTHORIZED', message: 'Public request rejected', requestId: 'req-2' },
    });

    await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(storage.get('schedule.session')).toBe('token');
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(reLaunchMock).not.toHaveBeenCalled();
  });

  it('omits the stored bearer and preserves the session for every public visitor descriptor', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    storeToken('private-session-token');
    const requests = [
      () => requestEndpoint(buildGuestGroupResolveEndpoint('a'.repeat(32))),
      () => requestEndpoint(buildGuestCalendarReadEndpoint('group-1', 'a'.repeat(32), '2026-08')),
      () => requestEndpoint(buildGuestHolidayReadEndpoint(2026)),
    ];

    for (const [index, startRequest] of requests.entries()) {
      const result = startRequest();
      const options = requestMock.mock.calls[index]?.[0] as WechatMiniprogram.RequestOption;
      expect(options.header).not.toHaveProperty('Authorization');
      options.success?.({
        cookies: [],
        data: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Public request rejected',
            requestId: `public-${index}`,
          },
        },
        header: {},
        statusCode: 401,
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult);
      await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    }

    expect(storage.get('schedule.session')).toBe('private-session-token');
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(reLaunchMock).not.toHaveBeenCalled();
  });

  it('preserves the API rejection when the injected handler throws', async () => {
    setUnauthorizedHandler(() => {
      throw new Error('navigation failed');
    });

    const result = request('/protected');
    respond(401, {
      error: { code: 'UNAUTHORIZED', message: 'Session expired', requestId: 'req-3' },
    });

    await expect(result).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      requestId: 'req-3',
      status: 401,
    });
    expect(reLaunchMock).not.toHaveBeenCalled();
  });
});

describe('API client response decoding', () => {
  it('rejects a malformed 2xx response without exposing the raw body', async () => {
    const rawBody = { events: [], privateDiagnostic: 'do-not-leak' };
    const decodeResponse = vi.fn(decodeScheduleEventPage);

    const result = request('/groups/group-1/events', { decodeResponse });
    respond(200, rawBody);

    const error = await result.catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      code: 'INVALID_RESPONSE',
      message: '服务返回的数据格式异常，请稍后重试。',
      requestId: undefined,
      status: 200,
    });
    expect(error).toHaveProperty('latestData', undefined);
    expect(String(error)).not.toContain('do-not-leak');
    expect(JSON.stringify(error)).not.toContain('do-not-leak');
    expect(decodeResponse).toHaveBeenCalledTimes(1);
    expect(decodeResponse).toHaveBeenCalledWith(rawBody);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('resolves the decoder value and invokes the transport and decoder exactly once', async () => {
    const rawBody = { wire: true };
    const decodedValue = { events: [] };
    const decodeResponse = vi.fn(() => ({ ok: true as const, value: decodedValue }));

    const result = request('/groups/group-1/events', { decodeResponse });
    respond(200, rawBody);

    await expect(result).resolves.toBe(decodedValue);
    expect(decodeResponse).toHaveBeenCalledTimes(1);
    expect(decodeResponse).toHaveBeenCalledWith(rawBody);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a structurally valid 2xx calendar for a different request identity', async () => {
    const result = requestEndpoint(buildCalendarReadEndpoint('group-1', '2026-08'));
    respond(200, {
      assignments: [],
      businessMonth: '2026-09',
      groupId: 'group-1',
      members: [],
      roles: [],
      shiftTypes: [],
    });

    await expect(result).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('keeps undecoded endpoints on their existing raw-response path', async () => {
    const rawBody = { existingEndpoint: true };

    const result = request('/existing-endpoint');
    respond(200, rawBody);

    await expect(result).resolves.toBe(rawBody);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('converts a throwing decoder to the same safe invalid-response error', async () => {
    const decodeResponse = vi.fn(() => {
      throw new Error('raw decoder details');
    });

    const result = request('/groups/group-1/events', { decodeResponse });
    respond(204, undefined);

    const error = await result.catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      code: 'INVALID_RESPONSE',
      message: '服务返回的数据格式异常，请稍后重试。',
      requestId: undefined,
      status: 204,
    });
    expect(String(error)).not.toContain('raw decoder details');
    expect(decodeResponse).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('does not decode non-2xx responses or change their API error semantics', async () => {
    const decodeResponse = vi.fn(() => ({ ok: true as const, value: { events: [] } }));

    const result = request('/groups/group-1/events', { decodeResponse });
    respond(409, {
      error: {
        code: 'VERSION_CONFLICT',
        latestData: { version: 2 },
        message: '请刷新后重试',
        requestId: 'req-conflict',
      },
    });

    await expect(result).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      latestData: { version: 2 },
      message: '请刷新后重试',
      requestId: 'req-conflict',
      status: 409,
    });
    expect(decodeResponse).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('keeps transport failures on the existing asynchronous network-error path', async () => {
    const decodeResponse = vi.fn(() => ({ ok: true as const, value: { events: [] } }));

    const result = request('/groups/group-1/events', { decodeResponse });
    const options = requestMock.mock.calls[0]?.[0] as WechatMiniprogram.RequestOption;
    options.fail?.({
      errMsg: 'request:fail timeout',
    } as unknown as WechatMiniprogram.RequestFailCallbackErr);

    await expect(result).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
      requestId: undefined,
    });
    expect(decodeResponse).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('adapts a JSON endpoint descriptor to one wx request without pre-encoding query values', async () => {
    const decodedValue = { events: [] };
    const decodeResponse = vi.fn(() => ({ ok: true as const, value: decodedValue }));
    const descriptor = {
      auth: true,
      decodeResponse,
      method: 'GET' as const,
      path: '/groups/group%2F1/events',
      query: { cursor: 'cursor/+=', eventTypes: 'swap_completed,duty_adjustment_completed' },
    };

    const result = requestEndpoint(descriptor);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.instances[0]).toBe(wx);
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: descriptor.query,
        method: 'GET',
        url: expect.stringMatching(/\/groups\/group%2F1\/events$/),
      }),
    );

    respond(200, { events: [] });
    await expect(result).resolves.toBe(decodedValue);
    expect(decodeResponse).toHaveBeenCalledTimes(1);
  });

  it('rejects descriptor query/body combinations the current transport cannot represent', async () => {
    const decodeResponse = vi.fn(() => ({ ok: true as const, value: { saved: true } }));

    const result = requestEndpoint({
      auth: true,
      body: { name: '值班组' },
      decodeResponse,
      method: 'POST',
      path: '/groups',
      query: { dryRun: true },
    });

    await expect(result).rejects.toThrow(
      '小程序请求描述同时包含 query 和 body，当前传输层无法安全发送。',
    );
    expect(requestMock).not.toHaveBeenCalled();
    expect(decodeResponse).not.toHaveBeenCalled();
  });

  it('rejects descriptor data placed in the wrong HTTP-method slot', async () => {
    const decodeResponse = vi.fn(() => ({ ok: true as const, value: { saved: true } }));

    const result = requestEndpoint({
      auth: true,
      decodeResponse,
      method: 'POST',
      path: '/groups',
      query: { dryRun: true },
    });

    await expect(result).rejects.toThrow('小程序请求描述的 query/body 与 HTTP 方法不匹配。');
    expect(requestMock).not.toHaveBeenCalled();
    expect(decodeResponse).not.toHaveBeenCalled();
  });
});
