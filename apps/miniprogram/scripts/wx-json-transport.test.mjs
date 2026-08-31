import { readFileSync } from 'node:fs';

import {
  ClientCoreError,
  calendarReadEndpoints,
  createCompactDecoder,
  defineClientEndpoint,
} from '@schedule/client-core';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { describe, expect, it, vi } from 'vitest';

import { createWxJsonTransport as createRawWxJsonTransport } from '../src/platform/client-core-calendar.js';

const appRoot = new URL('../', import.meta.url);

function createWxJsonTransport(options) {
  return createRawWxJsonTransport({ capability: 'bypass', ...options });
}

describe('P2 Mini wx.request JSON transport', () => {
  it('sends one bearer GET and decodes the original calendar response', async () => {
    const getAccessToken = vi.fn(() => 'mini-token');
    const request = vi.fn((options) => {
      options.success({ data: calendarApiGoldenResponse, statusCode: 200 });
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api/',
      getAccessToken,
      request,
    });

    await expect(
      transport.request(calendarReadEndpoints.calendar, {
        businessMonth: '2026-08',
        groupId: 'group-1',
      }),
    ).resolves.toBe(calendarApiGoldenResponse);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      header: { Authorization: 'Bearer mini-token' },
      method: 'GET',
      url: 'https://example.test/api/groups/group-1/calendar?businessMonth=2026-08',
    });
    expect(request.mock.calls[0]?.[0]).not.toHaveProperty('enableProfile');
  });

  it('keeps public holiday requests token-free', async () => {
    const getAccessToken = vi.fn(() => 'must-not-be-read');
    const request = vi.fn((options) => {
      options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      getAccessToken,
      request,
    });

    await expect(
      transport.request(calendarReadEndpoints.guestHolidays, { year: 2026 }),
    ).resolves.toBe(holidayApiGoldenResponse);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(request.mock.calls[0]?.[0].header).toEqual({
      'X-Schedule-Client-Platform': 'miniprogram',
      'X-Schedule-Client-Version': 'test',
    });
  });

  it('forwards JSON bodies and idempotency keys for protected writes', async () => {
    const request = vi.fn((options) => {
      options.success({ data: 'ok', statusCode: 200 });
    });
    const endpoint = defineClientEndpoint({
      auth: 'bearer',
      body: (input) => input.body,
      decoder: createCompactDecoder({ type: 'string' }),
      id: 'test.write',
      idempotencyKey: (input) => input.operationId,
      method: 'POST',
      path: () => '/write',
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      getAccessToken: () => 'mini-token',
      request,
    });

    await expect(
      transport.request(endpoint, {
        body: { operationId: 'operation-1', value: 7 },
        operationId: 'operation-1',
      }),
    ).resolves.toBe('ok');
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      data: { operationId: 'operation-1', value: 7 },
      header: {
        Authorization: 'Bearer mini-token',
        'Idempotency-Key': 'operation-1',
      },
      method: 'POST',
      url: 'https://example.test/api/write',
    });
  });

  it('rejects a missing bearer before wx.request', async () => {
    const request = vi.fn();
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      getAccessToken: () => undefined,
      request,
    });

    await expect(
      transport.request(calendarReadEndpoints.holidays, { year: 2026 }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED', status: 401 });
    expect(request).not.toHaveBeenCalled();
  });

  it('maps non-2xx API errors and malformed successful bodies', async () => {
    const conflictRequest = vi.fn((options) => {
      options.success({
        data: {
          error: {
            code: 'CONFLICT',
            latestData: { version: 4 },
            message: '资料版本冲突。',
            requestId: 'request-4',
          },
        },
        statusCode: 409,
      });
    });
    const invalidRequest = vi.fn((options) => {
      options.success({ data: { businessMonth: '2026-08' }, statusCode: 200 });
    });

    await expect(
      createWxJsonTransport({
        apiBaseUrl: 'https://example.test/api',
        getAccessToken: () => 'token',
        request: conflictRequest,
      }).request(calendarReadEndpoints.calendar, {
        businessMonth: '2026-08',
        groupId: 'group-1',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      latestData: { version: 4 },
      requestId: 'request-4',
      status: 409,
    });
    await expect(
      createWxJsonTransport({
        apiBaseUrl: 'https://example.test/api',
        getAccessToken: () => 'token',
        request: invalidRequest,
      }).request(calendarReadEndpoints.calendar, {
        businessMonth: '2026-08',
        groupId: 'group-1',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 200 });
  });

  it('settles when the wx.request bridge never calls success or fail', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn();
      const endpoint = defineClientEndpoint({
        auth: 'bearer',
        body: (input) => input,
        decoder: createCompactDecoder({ type: 'string' }),
        id: 'test.never-settles',
        method: 'POST',
        path: () => '/never-settles',
      });
      const transport = createWxJsonTransport({
        apiBaseUrl: 'https://example.test/api',
        getAccessToken: () => 'token',
        request,
        timeout: 5,
      });
      const pending = expect(transport.request(endpoint, { value: 1 })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
      await vi.advanceTimersByTimeAsync(5);
      await pending;
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries bearer GET network failures with finite exponential backoff', async () => {
    const delay = vi.fn(() => Promise.resolve());
    const request = vi.fn((options) => {
      if (request.mock.calls.length < 3) options.fail({ errMsg: 'request:fail timeout' });
      else options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      delay,
      getAccessToken: () => 'token',
      request,
    });

    await expect(transport.request(calendarReadEndpoints.holidays, { year: 2026 })).resolves.toBe(
      holidayApiGoldenResponse,
    );
    expect(request).toHaveBeenCalledTimes(3);
    expect(delay.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([200, 400]);
    expect(request.mock.calls.map(([options]) => options.header.Authorization)).toEqual([
      'Bearer token',
      'Bearer token',
      'Bearer token',
    ]);
  });

  it('retries only writes protected by a non-empty idempotency key with the same snapshot', async () => {
    const decoder = createCompactDecoder({ type: 'string' });
    const idempotentEndpoint = defineClientEndpoint({
      auth: 'bearer',
      body: (input) => input.body,
      decoder,
      id: 'test.idempotent-write',
      idempotencyKey: (input) => input.operationId,
      method: 'POST',
      path: () => '/idempotent-write',
    });
    const unsafeEndpoint = defineClientEndpoint({
      auth: 'bearer',
      body: (input) => input,
      decoder,
      id: 'test.unsafe-write',
      method: 'POST',
      path: () => '/unsafe-write',
    });
    const delay = vi.fn(() => Promise.resolve());
    const body = { operationId: 'operation-1', value: 7 };
    const request = vi.fn((options) => {
      if (request.mock.calls.length === 1) options.fail({ errMsg: 'request:fail timeout' });
      else options.success({ data: 'ok', statusCode: 200 });
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      delay,
      getAccessToken: () => 'token',
      request,
    });

    await expect(
      transport.request(idempotentEndpoint, { body, operationId: 'operation-1' }),
    ).resolves.toBe('ok');
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0].data).toBe(body);
    expect(request.mock.calls[1]?.[0].data).toBe(body);
    expect(request.mock.calls.map(([options]) => options.header['Idempotency-Key'])).toEqual([
      'operation-1',
      'operation-1',
    ]);

    request.mockClear();
    request.mockImplementation((options) => options.fail({ errMsg: 'request:fail timeout' }));
    await expect(transport.request(unsafeEndpoint, { value: 8 })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(request).toHaveBeenCalledTimes(1);

    const emptyKeyEndpoint = defineClientEndpoint({
      auth: 'bearer',
      body: (input) => input,
      decoder,
      id: 'test.empty-key-write',
      idempotencyKey: () => '',
      method: 'POST',
      path: () => '/empty-key-write',
    });
    request.mockClear();
    await expect(transport.request(emptyKeyEndpoint, { value: 9 })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0].header).not.toHaveProperty('Idempotency-Key');
  });

  it.each([502, 503, 504])('retries transient HTTP %s but not ordinary 4xx', async (statusCode) => {
    const delay = vi.fn(() => Promise.resolve());
    const request = vi.fn((options) => {
      if (request.mock.calls.length === 1) options.success({ data: {}, statusCode });
      else options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      delay,
      getAccessToken: () => 'token',
      request,
    });

    await expect(transport.request(calendarReadEndpoints.holidays, { year: 2026 })).resolves.toBe(
      holidayApiGoldenResponse,
    );
    expect(request).toHaveBeenCalledTimes(2);

    request.mockClear();
    request.mockImplementation((options) =>
      options.success({ data: { error: { code: 'FORBIDDEN' } }, statusCode: 403 }),
    );
    await expect(
      transport.request(calendarReadEndpoints.holidays, { year: 2026 }),
    ).rejects.toMatchObject({ status: 403 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not retry malformed 2xx responses and still maps synchronous bridge failures', async () => {
    const invalidRequest = vi.fn((options) => {
      options.success({ data: { year: 2026 }, statusCode: 200 });
    });
    const invalidTransport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      delay: () => Promise.resolve(),
      getAccessToken: () => 'token',
      request: invalidRequest,
    });
    await expect(
      invalidTransport.request(calendarReadEndpoints.holidays, { year: 2026 }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 200 });
    expect(invalidRequest).toHaveBeenCalledTimes(1);

    const callbackRequest = vi.fn((options) => {
      options.fail({ errMsg: 'request:fail timeout' });
    });
    const synchronousRequest = vi.fn(() => {
      throw new Error('request bridge failed');
    });

    for (const request of [callbackRequest, synchronousRequest]) {
      const transport = createWxJsonTransport({
        apiBaseUrl: 'https://example.test/api',
        delay: () => Promise.resolve(),
        getAccessToken: () => 'token',
        request,
      });
      const error = await transport
        .request(calendarReadEndpoints.holidays, { year: 2026 })
        .catch((reason) => reason);
      expect(error).toBeInstanceOf(ClientCoreError);
      expect(error).toMatchObject({ code: 'NETWORK_ERROR' });
      expect(request).toHaveBeenCalledTimes(3);
    }
  });

  it('keeps the runtime adapter wired to wx.request without issuing a request at import time', () => {
    const source = readSource('src/platform/client-core-calendar.ts');
    expect(source).toContain('request: (requestOptions) => wx.request(requestOptions)');
    expect(source).toContain('apiBaseUrl: __MINIPROGRAM_API_BASE_URL__');
    expect(source).toContain('return createCalendarReadClient(');
    expect(source).toContain('executeWxJsonRequest');
  });

  it('captures supported request profile phases and a sanitized server request id only while recording', async () => {
    const diagnostics = await import('../src/platform/runtime-diagnostics.ts');
    const store = diagnostics.createRuntimeDiagnosticsStore();
    store.startDirectorySearchRecording();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: store } }));
    const request = vi.fn((options) => {
      options.success({
        data: holidayApiGoldenResponse,
        header: { 'x-request-id': 'request-safe-1', Authorization: 'must-not-be-recorded' },
        profile: {
          SSLconnectionEnd: 9,
          SSLconnectionStart: 7,
          connectEnd: 10,
          connectStart: 4,
          domainLookUpEnd: 4,
          domainLookUpStart: 1,
          requestStart: 10,
          responseEnd: 26,
          responseStart: 20,
        },
        statusCode: 200,
      });
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      getAccessToken: () => 'token',
      request,
    });

    await transport.request(calendarReadEndpoints.holidays, { year: 2026 });

    expect(request.mock.calls[0]?.[0].enableProfile).toBe(true);
    const recorded = store.getSnapshot().requests.at(-1);
    expect(recorded).toMatchObject({
      networkProfile: {
        connectMs: 6,
        dnsMs: 3,
        downloadMs: 6,
        supported: true,
        tlsMs: 2,
        ttfbMs: 10,
      },
      requestId: 'request-safe-1',
    });
    expect(JSON.stringify(recorded)).not.toMatch(/Authorization|must-not-be-recorded|token/iu);
  });

  it('requests and retains only fixed directory Server-Timing fields while recording', async () => {
    const diagnostics = await import('../src/platform/runtime-diagnostics.ts');
    const store = diagnostics.createRuntimeDiagnosticsStore();
    store.startDirectorySearchRecording();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: store } }));
    const endpoint = defineClientEndpoint({
      auth: 'bearer',
      decoder: createCompactDecoder({ type: 'string' }),
      id: 'test.directory-timing',
      method: 'GET',
      path: () => '/groups/group-1/employee-directory?q=redacted',
    });
    const request = vi.fn((options) => {
      options.success({
        data: 'ok',
        header: {
          Authorization: 'must-not-be-recorded',
          'Server-Timing':
            'queue;desc="unsupported", cold;desc="warm", instance_age;dur=12345, cache;desc="none", auth;dur=4, db_wait;dur=7, permission;dur=8, batch;dur=2, alias;dur=1, rows;dur=30, contacts;dur=3, count;dur=12, query;dur=46, transform;dur=1, serialize;dur=2, total;dur=90, unsafe;dur=999;desc="secret"',
          'x-request-id': 'directory-request-safe-1',
        },
        statusCode: 200,
      });
    });
    const transport = createWxJsonTransport({
      apiBaseUrl: 'https://example.test/api',
      getAccessToken: () => 'token',
      request,
    });

    await transport.request(endpoint, undefined);

    expect(request.mock.calls[0]?.[0].header).toMatchObject({
      'X-Schedule-Directory-Diagnostics': 'v1',
    });
    const recorded = store.getSnapshot().requests.at(-1);
    expect(recorded?.serverTiming).toEqual({
      aliasMs: 1,
      authMs: 4,
      batchMs: 2,
      cache: 'none',
      coldStart: false,
      contactsMs: 3,
      countMs: 12,
      databaseWaitMs: 7,
      instanceAgeMs: 12345,
      permissionMs: 8,
      queryMs: 46,
      queueSupported: false,
      rowsMs: 30,
      serializationMs: 2,
      supported: true,
      totalMs: 90,
      transformMs: 1,
    });
    expect(JSON.stringify(recorded)).not.toMatch(
      /Authorization|must-not-be-recorded|unsafe|secret|redacted/iu,
    );
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, appRoot), 'utf8');
}
