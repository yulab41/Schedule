import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { request, setUnauthorizedHandler, storeToken } from './client.js';

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
