import { describe, expect, it, vi } from 'vitest';
import { get } from 'node:http';
import Fastify from 'fastify';
import {
  CalendarChangeSignals,
  isCalendarWrite,
  registerCalendarChangeStream,
} from './calendar-change-stream.js';
import { ApiError, registerErrorHandler } from '../../plugins/error-handler.js';

describe('calendar change signals', () => {
  it('notifies only the affected group, supports global invalidation and unsubscribes', () => {
    const signals = new CalendarChangeSignals(2);
    const a = vi.fn();
    const b = vi.fn();
    const stop = signals.subscribe('a', a);
    signals.subscribe('b', b);
    expect(() => signals.subscribe('c', vi.fn())).toThrow();
    signals.publish('a');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    stop();
    signals.publish();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
  it('does not turn reads, failed writes, login or diagnostics into invalidations', () => {
    expect(isCalendarWrite('PUT', '/groups/:groupId/members/:id/contact', 200)).toBe(true);
    expect(isCalendarWrite('PATCH', '/users/me', 200)).toBe(true);
    expect(isCalendarWrite('POST', '/holidays/versions/:id/confirm', 200)).toBe(true);
    expect(isCalendarWrite('GET', '/groups/:groupId/calendar', 200)).toBe(false);
    expect(isCalendarWrite('PUT', '/groups/:groupId/name', 409)).toBe(false);
    expect(isCalendarWrite('POST', '/auth/wechat/login', 200)).toBe(false);
    expect(isCalendarWrite('POST', '/client-telemetry', 204)).toBe(false);
  });
});

describe('calendar stream HTTP lifecycle', () => {
  it('gates access, ignores failed writes, rechecks permissions and releases connections on shutdown', async () => {
    const group = '00000000-0000-4000-8000-000000000001';
    const app = Fastify();
    registerErrorHandler(app);
    app.decorateRequest('authenticatedIdentity', null);
    app.decorate('authenticate', async (request) => {
      if (request.headers.authorization !== 'Bearer test')
        throw new ApiError({
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401,
          userMessage: 'unauthorized',
        });
      request.authenticatedIdentity = { cloudbaseUid: 'test-owner' };
    });
    // A route registered before the stream must receive the same invalidation hook.
    app.put('/groups/:groupId/contact', async (_request, reply) => reply.code(204).send());
    app.put('/groups/:groupId/schedule', async (_request, reply) => reply.code(204).send());
    const authorize = vi.fn(async () => {});
    registerCalendarChangeStream(app, authorize);
    app.post('/groups/:groupId/rejected', async (_request, reply) => reply.code(409).send());
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const messages: string[] = [];
    const clients: ReturnType<typeof get>[] = [];
    const connect = () =>
      clients.push(
        get(
          `${address}/groups/${group}/calendar-change-stream`,
          { headers: { authorization: 'Bearer test' } },
          (response) => {
            expect(response.headers['x-accel-buffering']).toBe('no');
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => messages.push(chunk));
          },
        ),
      );
    try {
      expect(
        (await app.inject({ method: 'GET', url: `/groups/${group}/calendar-change-stream` }))
          .statusCode,
      ).toBe(401);
      connect();
      await vi.waitFor(() => expect(messages.join('')).toContain('data:ready'));
      await app.inject({ method: 'POST', url: `/groups/${group}/rejected` });
      await app.inject({
        method: 'PUT',
        url: '/groups/00000000-0000-4000-8000-000000000002/schedule',
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(messages.join('')).not.toContain('data:changed');
      // Account phones can change calendars in other groups as well.
      await app.inject({
        method: 'PUT',
        url: '/groups/00000000-0000-4000-8000-000000000002/contact',
      });
      await vi.waitFor(() => expect(messages.join('')).toContain('data:changed'));
      authorize.mockRejectedValueOnce(new Error('temporary database outage'));
      await app.inject({ method: 'PUT', url: `/groups/${group}/contact` });
      await vi.waitFor(() => expect(clients[0]?.destroyed).toBe(true));
      expect(messages.join('')).not.toContain('data:revoked');
      connect();
      await vi.waitFor(() =>
        expect(messages.filter((message) => message.includes('data:ready'))).toHaveLength(2),
      );
      authorize.mockRejectedValueOnce(
        new ApiError({ code: 'FORBIDDEN', statusCode: 403, userMessage: 'revoked' }),
      );
      await app.inject({ method: 'PUT', url: `/groups/${group}/contact` });
      await vi.waitFor(() => expect(messages.join('')).toContain('data:revoked'));
      connect();
      await vi.waitFor(() =>
        expect(messages.filter((message) => message.includes('data:ready'))).toHaveLength(3),
      );
      await app.close();
      await vi.waitFor(() => expect(clients.every((client) => client.destroyed)).toBe(true));
    } finally {
      clients.forEach((client) => client.destroy());
      await app.close();
    }
  });
});
