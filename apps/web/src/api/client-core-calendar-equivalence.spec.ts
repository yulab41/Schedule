import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  calendarReadEndpoints,
  calendarReadModelDecoder,
  createCalendarReadClient,
  createHttpClientError,
  createInvalidResponseError,
  createNetworkError,
  holidayReadModelDecoder,
  type ClientTransport,
} from '@schedule/client-core';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { calendarReadModelSchema, holidayReadModelSchema } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { AuthClient } from '../auth/local-auth.js';
import { createApiClient } from './client.js';

describe('client-core calendar vertical slice', () => {
  it('keeps endpoint authentication and encoded paths exact', () => {
    expect(calendarReadEndpoints.calendar.auth).toBe('bearer');
    expect(
      calendarReadEndpoints.calendar.path({ businessMonth: '2026-08', groupId: 'group /一' }),
    ).toBe('/groups/group%20%2F%E4%B8%80/calendar?businessMonth=2026-08');
    expect(calendarReadEndpoints.holidays.auth).toBe('bearer');
    expect(calendarReadEndpoints.holidays.path({ year: 2026 })).toBe('/holidays?year=2026');
    expect(calendarReadEndpoints.guestHolidays.auth).toBe('public');
    expect(calendarReadEndpoints.guestHolidays.path({ year: 2026 })).toBe(
      '/guest/holidays?year=2026',
    );
    expect(
      Object.values(calendarReadEndpoints).every((endpoint) => endpoint.method === 'GET'),
    ).toBe(true);
  });

  it('returns the same valid calendar and holiday data as Web Zod without cloning inputs', () => {
    const calendarZod = calendarReadModelSchema.safeParse(calendarApiGoldenResponse);
    const calendarCompact = calendarReadModelDecoder.safeDecode(calendarApiGoldenResponse);
    expect(calendarZod.success).toBe(true);
    expect(calendarCompact.success).toBe(true);
    if (calendarZod.success && calendarCompact.success) {
      expect(calendarCompact.data).toEqual(calendarZod.data);
      expect(calendarCompact.data).toBe(calendarApiGoldenResponse);
    }

    const holidayZod = holidayReadModelSchema.safeParse(holidayApiGoldenResponse);
    const holidayCompact = holidayReadModelDecoder.safeDecode(holidayApiGoldenResponse);
    expect(holidayZod.success).toBe(true);
    expect(holidayCompact.success).toBe(true);
    if (holidayZod.success && holidayCompact.success) {
      expect(holidayCompact.data).toEqual(holidayZod.data);
      expect(holidayCompact.data).toBe(holidayApiGoldenResponse);
    }
  });

  it('rejects the same malformed calendar and holiday payloads as Web Zod', () => {
    const invalidPayloads = [
      { schema: calendarReadModelSchema, decoder: calendarReadModelDecoder, value: {} },
      {
        schema: calendarReadModelSchema,
        decoder: calendarReadModelDecoder,
        value: { ...calendarApiGoldenResponse, unexpected: true },
      },
      {
        schema: calendarReadModelSchema,
        decoder: calendarReadModelDecoder,
        value: { ...calendarApiGoldenResponse, businessMonth: '2026-8' },
      },
      {
        schema: calendarReadModelSchema,
        decoder: calendarReadModelDecoder,
        value: {
          ...calendarApiGoldenResponse,
          assignments: [
            { ...calendarApiGoldenResponse.assignments[0], changeMarkers: ['removed-marker'] },
          ],
        },
      },
      {
        schema: calendarReadModelSchema,
        decoder: calendarReadModelDecoder,
        value: {
          ...calendarApiGoldenResponse,
          shiftTypes: [{ ...calendarApiGoldenResponse.shiftTypes[0], color: 'blue' }],
        },
      },
      {
        schema: holidayReadModelSchema,
        decoder: holidayReadModelDecoder,
        value: { ...holidayApiGoldenResponse, year: 2026.5 },
      },
      {
        schema: holidayReadModelSchema,
        decoder: holidayReadModelDecoder,
        value: { ...holidayApiGoldenResponse, extra: 'forbidden' },
      },
      {
        schema: holidayReadModelSchema,
        decoder: holidayReadModelDecoder,
        value: { confirmed: true, year: 2026 },
      },
    ] as const;

    for (const fixture of invalidPayloads) {
      expect(fixture.schema.safeParse(fixture.value).success).toBe(false);
      expect(fixture.decoder.safeDecode(fixture.value).success).toBe(false);
    }
  });

  it('routes all three service methods through one transport without adding calls', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) =>
      endpoint.id === 'calendar.read' ? calendarApiGoldenResponse : holidayApiGoldenResponse,
    );
    const transport = { request } as unknown as ClientTransport;
    const client = createCalendarReadClient(transport);

    await expect(client.getCalendar('group-1', '2026-08')).resolves.toBe(calendarApiGoldenResponse);
    await expect(client.getHolidays(2026)).resolves.toBe(holidayApiGoldenResponse);
    await expect(client.getGuestHolidays(2026)).resolves.toBe(holidayApiGoldenResponse);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.map(([endpoint]) => endpoint.id)).toEqual([
      'calendar.read',
      'holidays.read',
      'holidays.guest-read',
    ]);
    expect(request.mock.contexts).toEqual([transport, transport, transport]);
  });

  it('forwards the exact transport rejection without retrying or wrapping it', async () => {
    const expectedError = new Error('transport failed');
    const request = vi.fn().mockRejectedValue(expectedError);
    const client = createCalendarReadClient({ request } as unknown as ClientTransport);

    await expect(client.getCalendar('group-1', '2026-08')).rejects.toBe(expectedError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('preserves bearer/public headers, fetch count, and response shape in Web', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(calendarApiGoldenResponse), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(holidayApiGoldenResponse), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(holidayApiGoldenResponse), { status: 200 }),
      );
    const client = createApiClient({ auth: createAuthClient(), fetch: fetchImplementation });

    await expect(client.getCalendar('group-1', '2026-08')).resolves.toEqual(
      calendarApiGoldenResponse,
    );
    await expect(client.getHolidays(2026)).resolves.toEqual(holidayApiGoldenResponse);
    await expect(client.getGuestHolidays(2026)).resolves.toEqual(holidayApiGoldenResponse);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(fetchImplementation.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer signed-in-token',
    });
    expect(fetchImplementation.mock.calls[1]?.[1]?.headers).toEqual({
      Authorization: 'Bearer signed-in-token',
    });
    expect(fetchImplementation.mock.calls[2]?.[1]?.headers).toEqual({});
  });

  it('keeps shared Mini error mapping equal to the existing Web pipeline', async () => {
    const conflictBody = {
      error: {
        code: 'CONFLICT',
        latestData: { version: 3 },
        message: '资料版本冲突。',
        requestId: 'request-3',
      },
    };
    const conflictClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(conflictBody), { status: 409 })),
    });
    const invalidClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
    });
    const networkClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('network down')),
    });

    expect(
      errorSnapshot(await conflictClient.getCalendar('group-1', '2026-08').catch((error) => error)),
    ).toEqual(errorSnapshot(createHttpClientError(409, conflictBody)));
    expect(
      errorSnapshot(await invalidClient.getCalendar('group-1', '2026-08').catch((error) => error)),
    ).toEqual(errorSnapshot(createInvalidResponseError(200)));
    expect(
      errorSnapshot(await networkClient.getCalendar('group-1', '2026-08').catch((error) => error)),
    ).toEqual(errorSnapshot(createNetworkError()));
  });

  it('wires only the selected Web methods while preserving the existing fetch pipeline', () => {
    const source = readFileSync(fileURLToPath(new URL('./client.ts', import.meta.url)), 'utf8');
    const webPackage = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { readonly dependencies?: Readonly<Record<string, string>> };

    expect(webPackage.dependencies?.['@schedule/client-core']).toBe('workspace:*');
    expect(source).toContain('const sharedClientTransport = {');
    expect(source).toContain('createCalendarReadClient(sharedClientTransport)');
    expect(source).toContain('createPastScheduleClient(sharedClientTransport)');
    expect(source).toContain('return calendarReadClient.getCalendar(groupId, businessMonth);');
    expect(source).toContain('return calendarReadClient.getHolidays(year);');
    expect(source).toContain('return calendarReadClient.getGuestHolidays(year);');
    expect(source).toContain('options.fetchImplementation.call(');
    expect(source).toContain('globalThis,');
    expect(source).toContain('getOfflineSubmitError(options.isOnline(), options.init.method)');
  });
});

function createAuthClient(): AuthClient {
  return {
    clearDevIdentity() {},
    getSession: () => Promise.resolve({ data: { session: { access_token: 'signed-in-token' } } }),
    setDevIdentity() {},
    setSession() {},
    signInWithPassword: () => Promise.resolve({}),
    signOut: () => Promise.resolve({}),
  };
}

function errorSnapshot(error: unknown) {
  const candidate = error as {
    readonly code?: unknown;
    readonly latestData?: unknown;
    readonly message?: unknown;
    readonly requestId?: unknown;
    readonly status?: unknown;
  };
  return {
    code: candidate.code,
    latestData: candidate.latestData,
    message: candidate.message,
    requestId: candidate.requestId,
    status: candidate.status,
  };
}
