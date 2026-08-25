import {
  visitorAccessAggregatePageSchema,
  visitorAccessLogPageSchema,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createVisitorAccessReadClient,
  visitorAccessAggregatePageDecoder,
  visitorAccessLogPageDecoder,
  visitorAccessReadEndpoints,
} from './visitor-access-read-client.js';
import { visitorAccessAggregateGoldenResponse, visitorAccessApiGoldenResponse } from './testing/visitor-access-api-golden.js';
import type { ClientTransport } from './endpoint.js';

describe('P9 visitor access shared read boundary', () => {
  it('keeps bearer auth, encoded group paths, cursor and page size exact', () => {
    const groupId = 'group /一';
    expect(
      visitorAccessReadEndpoints.logs.path({ groupId, cursor: 'cursor /一', pageSize: 25 }),
    ).toBe('/groups/group%20%2F%E4%B8%80/visitor-access-logs?cursor=cursor%20%2F%E4%B8%80&pageSize=25');
    expect(
      visitorAccessReadEndpoints.aggregates.path({ groupId, pageSize: 10 }),
    ).toBe('/groups/group%20%2F%E4%B8%80/visitor-access-aggregates?pageSize=10');
    expect(Object.values(visitorAccessReadEndpoints).every((endpoint) => endpoint.auth === 'bearer')).toBe(true);
    expect(Object.values(visitorAccessReadEndpoints).every((endpoint) => endpoint.method === 'GET')).toBe(true);
  });

  it('matches Web Zod for valid payloads without cloning and rejects strict extras', () => {
    for (const [schema, decoder, value] of [
      [visitorAccessLogPageSchema, visitorAccessLogPageDecoder, visitorAccessApiGoldenResponse],
      [visitorAccessAggregatePageSchema, visitorAccessAggregatePageDecoder, visitorAccessAggregateGoldenResponse],
    ] as const) {
      const zodResult = schema.safeParse(value);
      const compactResult = decoder.safeDecode(value);
      expect(zodResult.success).toBe(true);
      expect(compactResult.success).toBe(true);
      if (zodResult.success && compactResult.success) {
        expect(compactResult.data).toEqual(zodResult.data);
        expect(compactResult.data).toBe(value);
      }
    }
    expect(
      visitorAccessLogPageDecoder.safeDecode({
        ...visitorAccessApiGoldenResponse,
        logs: [{ ...visitorAccessApiGoldenResponse.logs[0], extra: true }],
      }).success,
    ).toBe(false);
    expect(
      visitorAccessAggregatePageDecoder.safeDecode({
        aggregates: [{ ...visitorAccessAggregateGoldenResponse.aggregates[0], accessCount: '0' }],
      }).success,
    ).toBe(false);
  });

  it('uses the transport receiver exactly once and preserves page identity', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) =>
      endpoint.id.endsWith('logs')
        ? visitorAccessApiGoldenResponse
        : visitorAccessAggregateGoldenResponse,
    );
    const client = createVisitorAccessReadClient({ request } as unknown as ClientTransport);
    await expect(client.listLogs('group-1', { cursor: 'next', pageSize: 20 })).resolves.toBe(
      visitorAccessApiGoldenResponse,
    );
    await expect(client.listAggregates('group-1', { pageSize: 10 })).resolves.toBe(
      visitorAccessAggregateGoldenResponse,
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.contexts).toEqual([request.mock.contexts[0], request.mock.contexts[1]]);
  });
});
