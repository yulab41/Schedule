import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { createCloudbaseHandler } from './cloudbase-handler.js';
import { ApiError } from './plugins/error-handler.js';

const apps: FastifyInstance[] = [];

function createTestApp(): FastifyInstance {
  const app = createApp({ logger: false });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('API runtime', () => {
  it('returns the same health result through local and CloudBase adapters', async () => {
    const app = createTestApp();
    const localResponse = await app.inject({ method: 'GET', url: '/health' });
    const cloudbaseResponse = await createCloudbaseHandler(app)({
      httpMethod: 'GET',
      path: '/health',
    });

    expect(cloudbaseResponse.statusCode).toBe(localResponse.statusCode);
    expect(JSON.parse(cloudbaseResponse.body)).toEqual(localResponse.json());
    expect(cloudbaseResponse.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('provides a ready endpoint without creating a database connection', async () => {
    const response = await createTestApp().inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ component: 'api', ready: true });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('converts an unhandled exception into a safe error response', async () => {
    const app = createTestApp();
    app.get('/throws', () => {
      throw new Error('unhandled-token-should-not-reach-the-client');
    });

    const response = await app.inject({ method: 'GET', url: '/throws' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器暂时无法处理请求，请稍后重试。',
        requestId: response.headers['x-request-id'],
      },
    });
    expect(response.body).not.toContain('unhandled-token-should-not-reach-the-client');
  });

  it('returns 415 for unsupported content types instead of 500', async () => {
    const app = createTestApp();
    app.post('/echo', async (request) => ({ body: request.body }));

    const response = await app.inject({
      headers: { 'content-type': 'application/octet-stream' },
      method: 'POST',
      payload: 'hello=world',
      url: '/echo',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: '不支持的请求内容类型。',
        requestId: response.headers['x-request-id'],
      },
    });
  });

  it('returns 400 for an invalid JSON body instead of 500', async () => {
    const app = createTestApp();
    app.post('/echo', async (request) => ({ body: request.body }));

    const response = await app.inject({
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      payload: 'not-json',
      url: '/echo',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: '请求数据不符合要求。',
        requestId: response.headers['x-request-id'],
      },
    });
  });

  it('returns declared conflicts with the latest data summary', async () => {
    const app = createTestApp();
    app.get('/conflict', () => {
      throw new ApiError({
        code: 'CONFLICT',
        latestData: { version: 2 },
        statusCode: 409,
        userMessage: '数据已更新，请刷新后重试。',
      });
    });

    const response = await app.inject({ method: 'GET', url: '/conflict' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'CONFLICT',
        latestData: { version: 2 },
        message: '数据已更新，请刷新后重试。',
        requestId: response.headers['x-request-id'],
      },
    });
  });

  it('redacts passwords, tokens, and telephone details from logs', () => {
    const messages: string[] = [];
    const app = createApp({
      loggerStream: {
        write(message) {
          messages.push(message);
        },
      },
    });
    apps.push(app);

    app.log.info(
      {
        accessToken: 'token-value',
        password: 'password-value',
        phoneNumber: '13800138000',
        telephone: '010-12345678',
        metadata: {
          section: {
            row: {
              detail: {
                password: 'deep-password-value',
                phone: '13900139000',
                token: 'deep-token-value',
              },
            },
          },
        },
      },
      'testing redaction',
    );
    app.log.info('format payload: %j', {
      metadata: {
        section: {
          row: {
            detail: {
              password: 'format-password-value',
            },
          },
        },
      },
    });
    app.log
      .child({
        metadata: {
          section: {
            row: {
              detail: {
                password: 'child-password-value',
                phone: '13700137000',
                token: 'child-token-value',
              },
            },
          },
        },
      })
      .info('testing child binding redaction');

    const output = messages.join('');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('token-value');
    expect(output).not.toContain('password-value');
    expect(output).not.toContain('13800138000');
    expect(output).not.toContain('010-12345678');
    expect(output).not.toContain('deep-password-value');
    expect(output).not.toContain('13900139000');
    expect(output).not.toContain('deep-token-value');
    expect(output).not.toContain('format-password-value');
    expect(output).not.toContain('child-password-value');
    expect(output).not.toContain('13700137000');
    expect(output).not.toContain('child-token-value');
  });

  it('retains safe error diagnostics without logging error details', async () => {
    const messages: string[] = [];
    const app = createApp({
      loggerStream: {
        write(message) {
          messages.push(message);
        },
      },
    });
    apps.push(app);
    app.get('/throws-with-log', () => {
      throw new Error('unhandled-token-should-not-reach-the-log');
    });

    await app.inject({ method: 'GET', url: '/throws-with-log' });

    const output = messages.join('');
    expect(output).toContain('"type":"Error"');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('unhandled-token-should-not-reach-the-log');
  });
});
