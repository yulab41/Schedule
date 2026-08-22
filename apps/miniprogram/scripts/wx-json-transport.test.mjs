import { readFileSync } from 'node:fs';

import { ClientCoreError, calendarReadEndpoints } from '@schedule/client-core';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { describe, expect, it, vi } from 'vitest';

import { createWxJsonTransport } from '../src/platform/client-core-calendar.js';

const appRoot = new URL('../', import.meta.url);

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
    expect(request.mock.calls[0]?.[0].header).toEqual({});
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

  it('maps callback and synchronous request failures without retrying', async () => {
    const callbackRequest = vi.fn((options) => {
      options.fail({ errMsg: 'request:fail timeout' });
    });
    const synchronousRequest = vi.fn(() => {
      throw new Error('request bridge failed');
    });

    for (const request of [callbackRequest, synchronousRequest]) {
      const transport = createWxJsonTransport({
        apiBaseUrl: 'https://example.test/api',
        getAccessToken: () => 'token',
        request,
      });
      const error = await transport
        .request(calendarReadEndpoints.holidays, { year: 2026 })
        .catch((reason) => reason);
      expect(error).toBeInstanceOf(ClientCoreError);
      expect(error).toMatchObject({ code: 'NETWORK_ERROR' });
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps the runtime adapter wired to wx.request without issuing a request at import time', () => {
    const source = readSource('src/platform/client-core-calendar.ts');
    expect(source).toContain('request: (requestOptions) => wx.request(requestOptions)');
    expect(source).toContain('apiBaseUrl: __MINIPROGRAM_API_BASE_URL__');
    expect(source).toContain('return createCalendarReadClient(');
    expect(source).not.toContain('setTimeout');
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, appRoot), 'utf8');
}
