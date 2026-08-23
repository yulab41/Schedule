import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerErrorHandler } from '../../plugins/error-handler.js';
import { registerCalendarRoutes } from '../calendar/calendar-routes.js';
import type { CalendarQuery } from '../calendar/calendar-query.js';
import type { VisitorAccessLogService } from '../calendar/visitor-access-log.js';
import { registerHolidayRoutes } from '../holidays/holiday-routes.js';
import type { HolidayService } from '../holidays/holiday-service.js';
import { ClientCapabilityPolicy } from './client-capability-policy.js';

const VERSION = '0.1.0-p6.20260824.79';
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('public Mini guest route capability wiring', () => {
  it('blocks resolve, calendar, and guest holidays before their service calls', async () => {
    const resolveGroup = vi.fn();
    const readGuestMonthByGroupId = vi.fn();
    const getConfirmedPublic = vi.fn();
    const app = createPublicRouteApp({
      getConfirmedPublic,
      readGuestMonthByGroupId,
      resolveGroup,
    });
    const headers = {
      'x-schedule-client-platform': 'miniprogram',
      'x-schedule-client-version': VERSION,
    };

    const responses = await Promise.all([
      app.inject({
        headers,
        method: 'POST',
        payload: { visitorKey: 'a'.repeat(32) },
        url: '/guest/groups/resolve',
      }),
      app.inject({
        headers,
        method: 'GET',
        url: `/guest/groups/00000000-0000-4000-8000-000000000001/calendar?businessMonth=2026-08&visitorKey=${'a'.repeat(32)}`,
      }),
      app.inject({ headers, method: 'GET', url: '/guest/holidays?year=2026' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([503, 503, 503]);
    expect(resolveGroup).not.toHaveBeenCalled();
    expect(readGuestMonthByGroupId).not.toHaveBeenCalled();
    expect(getConfirmedPublic).not.toHaveBeenCalled();
  });

  it('preserves the existing headerless Web public guest behavior', async () => {
    const resolveGroup = vi.fn(async () => ({
      expiresAt: '2026-08-24T00:00:00.000Z',
      groupId: '00000000-0000-4000-8000-000000000001',
      token: 'guest-token',
    }));
    const readGuestMonthByGroupId = vi.fn(async () => ({ assignments: [] }));
    const getConfirmedPublic = vi.fn(async () => []);
    const app = createPublicRouteApp({
      getConfirmedPublic,
      readGuestMonthByGroupId,
      resolveGroup,
    });

    expect(
      (
        await app.inject({
          method: 'POST',
          payload: { visitorKey: 'a'.repeat(32) },
          url: '/guest/groups/resolve',
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/guest/holidays?year=2026' })).statusCode).toBe(
      200,
    );
    expect(resolveGroup).toHaveBeenCalledTimes(1);
    expect(getConfirmedPublic).toHaveBeenCalledWith(2026);
  });

  it('allows paired Mini guest requests when both global and guest are enabled', async () => {
    const resolveGroup = vi.fn(async () => ({
      expiresAt: '2026-08-24T00:00:00.000Z',
      groupId: '00000000-0000-4000-8000-000000000001',
      token: 'guest-token',
    }));
    const app = createPublicRouteApp(
      {
        getConfirmedPublic: vi.fn(async () => []),
        readGuestMonthByGroupId: vi.fn(async () => ({ assignments: [] })),
        resolveGroup,
      },
      true,
    );
    const response = await app.inject({
      headers: {
        'x-schedule-client-platform': 'miniprogram',
        'x-schedule-client-version': VERSION,
      },
      method: 'POST',
      payload: { visitorKey: 'a'.repeat(32) },
      url: '/guest/groups/resolve',
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(resolveGroup).toHaveBeenCalledTimes(1);
  });
});

function createPublicRouteApp(
  spies: {
    readonly getConfirmedPublic: ReturnType<typeof vi.fn>;
    readonly readGuestMonthByGroupId: ReturnType<typeof vi.fn>;
    readonly resolveGroup: ReturnType<typeof vi.fn>;
  },
  guestEnabled = false,
): FastifyInstance {
  const app = Fastify({ logger: false });
  apps.push(app);
  registerErrorHandler(app);
  app.decorateRequest('authenticatedIdentity', null);
  app.decorate('authenticate', async () => undefined);
  const policy = new ClientCapabilityPolicy({
    capabilities: {
      core: true,
      externalMessages: false,
      global: true,
      guest: guestEnabled,
      insights: false,
      organization: false,
      workflows: false,
    },
    legacyVersion: VERSION,
    supportedVersions: [VERSION],
  });
  registerCalendarRoutes(
    app,
    {
      readGuestMonthByGroupId: spies.readGuestMonthByGroupId,
    } as unknown as CalendarQuery,
    {
      recordAccess: vi.fn(),
      resolveGroup: spies.resolveGroup,
    } as unknown as VisitorAccessLogService,
    policy,
  );
  registerHolidayRoutes(
    app,
    { getConfirmedPublic: spies.getConfirmedPublic } as unknown as HolidayService,
    policy,
  );
  return app;
}
