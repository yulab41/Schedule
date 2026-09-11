import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createP9InsightsActionsClient } from '../../../packages/client-core/src/p9-insights-actions-client.ts';
import { registerNotificationRoutes } from '../../api/src/modules/notifications/notification-routes.ts';
import { registerErrorHandler } from '../../api/src/plugins/error-handler.ts';
import { createWxJsonTransport } from '../src/platform/client-core-calendar.ts';

const Fastify = createRequire(new URL('../../api/package.json', import.meta.url))('fastify');
const id = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const record = {
  id,
  groupId,
  recipientUserId: 'fixture',
  title: '排班已发布',
  body: 'fixture',
  notificationType: 'schedule_published',
  isRead: true,
  createdAt: '2026-09-11T00:00:00.000Z',
};

describe('feedback11 native JSON notification request crosses the real API parser', () => {
  let app, markRead, client, issued;
  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.decorate('authenticate', async (request) => {
      request.authenticatedIdentity = { cloudbaseUid: 'fixture' };
    });
    markRead = vi.fn(async () => record);
    registerNotificationRoutes(app, { markRead, markAllRead: async () => ({ count: 1 }) }, {});
    registerErrorHandler(app);
    await app.ready();
    issued = [];
    client = createP9InsightsActionsClient(
      createWxJsonTransport({
        apiBaseUrl: 'https://fixture.test',
        capability: 'bypass',
        getAccessToken: () => 'fixture',
        request(options) {
          issued.push(options);
          // Reproduce wx.request JSON serialization and default JSON content type.
          void app
            .inject({
              method: options.method,
              url: new URL(options.url).pathname,
              headers: { 'content-type': 'application/json', ...options.header },
              ...(options.data === undefined ? {} : { payload: JSON.stringify(options.data) }),
            })
            .then((response) =>
              options.success({ statusCode: response.statusCode, data: response.json() }),
            );
        },
      }),
    );
  });
  afterEach(async () => {
    await app.close();
  });
  it('reproduces the old empty JSON body error before route execution', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/notifications/${id}/read`,
      headers: { 'content-type': 'application/json' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toBe('请求数据不符合要求。');
    expect(markRead).not.toHaveBeenCalled();
  });
  it('marks a single notification read through the native transport', async () => {
    await expect(client.markNotificationRead(id)).resolves.toEqual(record);
    expect(issued[0].data).toEqual({});
    expect(markRead).toHaveBeenCalledExactlyOnceWith({ cloudbaseUid: 'fixture' }, id);
    await expect(client.markNotificationRead(id)).resolves.toEqual(record);
    expect(issued).toHaveLength(2);
  });
  it('keeps invalid notification IDs rejected by the API', async () => {
    await expect(client.markNotificationRead('invalid')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(markRead).not.toHaveBeenCalled();
    expect(issued).toHaveLength(1);
  });
});
