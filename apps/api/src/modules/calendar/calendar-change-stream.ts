import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';

/** Small invalidation hints only: no calendar, contact, credential or identity payload. */
export class CalendarChangeSignals {
  private readonly listeners = new Map<() => void, string>();
  public constructor(private readonly limit = 200) {}
  public subscribe(groupId: string, notify: () => void): () => void {
    if (this.listeners.size >= this.limit)
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '实时同步暂忙，请稍后重试。',
      });
    this.listeners.set(notify, groupId);
    return () => {
      this.listeners.delete(notify);
    };
  }
  public publish(groupId?: string): void {
    for (const [notify, group] of this.listeners)
      if (groupId === undefined || groupId === group) notify();
  }
}

export function isCalendarWrite(method: string, route: string, status: number): boolean {
  return (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    status >= 200 &&
    status < 300 &&
    (route.startsWith('/groups/') ||
      route === '/users/me' ||
      route.startsWith('/holidays/') ||
      route.startsWith('/platform-admin/') ||
      route === '/invites/accept' ||
      route === '/auth/wechat/link-password')
  );
}

export function registerCalendarChangeStream(
  app: FastifyInstance,
  authorize: (identity: AuthenticatedIdentity, groupId: string) => Promise<void>,
): void {
  const signals = new CalendarChangeSignals();
  const owners = new Map<string, number>();
  const connections = new Set<() => void>();
  // A successful response follows the business transaction commit. Rejected or
  // rolled-back writes never publish. Non-HTTP jobs are covered by reconnect validation.
  app.addHook('onResponse', async (request, reply) => {
    if (!isCalendarWrite(request.method, request.routeOptions.url ?? '', reply.statusCode)) return;
    const params = request.params as { groupId?: unknown } | undefined;
    // Account phones are shared across memberships; a contact edit can affect
    // groups other than the one named by the request.
    const crossGroup = request.routeOptions.url?.endsWith('/contact') === true;
    signals.publish(
      !crossGroup && typeof params?.groupId === 'string' ? params.groupId : undefined,
    );
  });
  app.addHook('preClose', async () => {
    for (const close of connections) close();
  });
  app.get(
    '/groups/:groupId/calendar-change-stream',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const identity = request.authenticatedIdentity;
      if (identity === null)
        throw new ApiError({
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401,
          userMessage: '请先登录。',
        });
      const parsed = z.object({ groupId: z.string().uuid() }).safeParse(request.params);
      if (!parsed.success)
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: '群组无效。',
        });
      const groupId = parsed.data.groupId;
      await authorize(identity, groupId);
      const owner = identity.cloudbaseUid;
      if ((owners.get(owner) ?? 0) >= 2)
        throw new ApiError({
          code: 'SERVICE_UNAVAILABLE',
          statusCode: 503,
          userMessage: '实时连接已达到上限。',
        });
      let closed = false;
      let checking = false;
      let pending = false;
      let debounce: ReturnType<typeof setTimeout> | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let expiry: ReturnType<typeof setTimeout> | undefined;
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearTimeout(debounce);
        clearInterval(heartbeat);
        clearTimeout(expiry);
        heartbeat = undefined;
        expiry = undefined;
        connections.delete(close);
        const count = (owners.get(owner) ?? 1) - 1;
        if (count === 0) owners.delete(owner);
        else owners.set(owner, count);
        if (!reply.raw.destroyed) reply.raw.end();
      };
      const send = (value: 'ready' | 'changed' | 'revoked') => {
        if (closed) return;
        // Slow consumers are disconnected rather than accumulating an unbounded buffer.
        if (!reply.raw.write(`data:${value}\n\n`)) close();
      };
      const notify = () => {
        pending = true;
        if (closed || checking || debounce !== undefined) return;
        debounce = setTimeout(() => {
          debounce = undefined;
          checking = true;
          pending = false;
          void authorize(identity, groupId)
            .then(
              () => send('changed'),
              (error: unknown) => {
                if (error instanceof ApiError && [401, 403, 404].includes(error.statusCode))
                  send('revoked');
                close();
              },
            )
            .finally(() => {
              checking = false;
              if (pending && !closed) notify();
            });
        }, 100);
        debounce.unref();
      };
      const unsubscribe = signals.subscribe(groupId, notify);
      owners.set(owner, (owners.get(owner) ?? 0) + 1);
      connections.add(close);
      request.raw.once('aborted', close);
      reply.raw.once('close', close);
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });
      send('ready'); // Closes the race between the preceding version read and subscription.
      if (closed) return reply;
      heartbeat = setInterval(() => {
        if (!closed && !reply.raw.write(':keepalive\n\n')) close();
      }, 15_000);
      heartbeat.unref();
      // Bound authorization lifetime, including writes performed in another process.
      expiry = setTimeout(close, 110_000);
      expiry.unref();
      return reply;
    },
  );
}
