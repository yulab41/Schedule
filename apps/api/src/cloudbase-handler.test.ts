import type { FastifyInstance, InjectOptions } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  cloudbaseApiPathPrefix,
  createCloudbaseHandler,
  normalizeCloudbasePath,
} from './cloudbase-handler.js';

describe('normalizeCloudbasePath', () => {
  it('strips the /api prefix when the gateway passes the full path', () => {
    expect(normalizeCloudbasePath('/api/health')).toBe('/health');
    expect(normalizeCloudbasePath('/api/users/me')).toBe('/users/me');
    expect(normalizeCloudbasePath('/api')).toBe('/');
  });

  it('keeps paths without the /api prefix untouched', () => {
    expect(normalizeCloudbasePath('/health')).toBe('/health');
    expect(normalizeCloudbasePath('/apix')).toBe('/apix');
    expect(normalizeCloudbasePath('/')).toBe('/');
  });
});

describe('createCloudbaseHandler', () => {
  it('forwards the normalized URL, headers, and query string to the runtime app', async () => {
    let capturedRequest: InjectOptions | undefined;
    const inject = vi.fn(async (request: InjectOptions) => {
      capturedRequest = request;
      return {
        body: '{"ok":true}',
        headers: { 'content-type': 'application/json', 'x-request-id': 'request-1' },
        statusCode: 200,
      };
    });
    const handle = createCloudbaseHandler({ inject } as unknown as FastifyInstance);

    const response = await handle({
      headers: { authorization: 'Bearer token' },
      httpMethod: 'GET',
      path: '/api/health',
      queryStringParameters: { year: '2026' },
    });

    expect(inject).toHaveBeenCalledTimes(1);
    expect(capturedRequest?.url).toBe('/health?year=2026');
    expect(capturedRequest?.method).toBe('GET');
    expect(capturedRequest?.headers).toEqual({ authorization: 'Bearer token' });
    expect(response).toEqual({
      body: '{"ok":true}',
      headers: { 'content-type': 'application/json', 'x-request-id': 'request-1' },
      isBase64Encoded: false,
      statusCode: 200,
    });
  });

  it('decodes base64 request bodies and keeps the /api prefix on the exported handler', async () => {
    let capturedRequest: InjectOptions | undefined;
    const inject = vi.fn(async (request: InjectOptions) => {
      capturedRequest = request;
      return {
        body: '',
        headers: {},
        statusCode: 204,
      };
    });
    const handle = createCloudbaseHandler({ inject } as unknown as FastifyInstance);
    const payload = Buffer.from('{"realName":"测试"}', 'utf8');

    await handle({
      body: payload.toString('base64'),
      httpMethod: 'POST',
      isBase64Encoded: true,
      path: `${cloudbaseApiPathPrefix}/users/me`,
    });

    expect(capturedRequest?.url).toBe('/users/me');
    expect(capturedRequest?.payload).toEqual(payload);
  });
});
