import { clientCapabilityResponseSchema } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  clientCapabilityEndpoints,
  clientCapabilityResponseDecoder,
  createClientCapabilityClient,
  type ClientEndpoint,
  type ClientTransport,
} from '../src/index.js';
import { clientCapabilityGoldenResponse } from '../src/testing/client-capability-api-golden.js';

const platform = 'miniprogram';
const version = '0.1.0-p6.20260824.79';

describe('client capability client', () => {
  it('defines the public version-scoped capability endpoint', () => {
    expect(clientCapabilityEndpoints.status).toMatchObject({
      auth: 'public',
      id: 'client-capabilities.read',
      method: 'GET',
    });
    expect(clientCapabilityEndpoints.status.path({ platform, version })).toBe(
      `/client-capabilities?platform=miniprogram&version=${encodeURIComponent(version)}`,
    );
    expect(clientCapabilityEndpoints.status.path({ platform, version: '1.2.3+build/one' })).toBe(
      '/client-capabilities?platform=miniprogram&version=1.2.3%2Bbuild%2Fone',
    );
  });

  it('preserves the transport receiver, response identity, rejection, and one-call semantics', async () => {
    const rejection = new Error('network unavailable');
    const transport = {
      calls: 0,
      request<Input, Output>(endpoint: ClientEndpoint<Input, Output>): Promise<Output> {
        expect(this).toBe(transport);
        expect(endpoint).toBe(clientCapabilityEndpoints.status);
        this.calls += 1;
        if (this.calls === 2) return Promise.reject(rejection);
        return Promise.resolve(clientCapabilityGoldenResponse as Output);
      },
    } satisfies ClientTransport & { calls: number };
    const client = createClientCapabilityClient(transport);

    await expect(client.get(platform, version)).resolves.toBe(clientCapabilityGoldenResponse);
    await expect(client.get(platform, version)).rejects.toBe(rejection);
    expect(transport.calls).toBe(2);
  });

  it('matches Web Zod decoding and fails closed for missing, invalid, and extra fields', () => {
    const decoded = clientCapabilityResponseDecoder.safeDecode(clientCapabilityGoldenResponse);
    expect(decoded.success).toBe(true);
    if (decoded.success) expect(decoded.data).toBe(clientCapabilityGoldenResponse);
    expect(clientCapabilityResponseSchema.parse(clientCapabilityGoldenResponse)).toEqual(
      clientCapabilityGoldenResponse,
    );

    const missingWorkflows: Record<string, unknown> = { ...clientCapabilityGoldenResponse };
    delete missingWorkflows['workflows'];
    for (const value of [
      missingWorkflows,
      { ...clientCapabilityGoldenResponse, platform: 'web' },
      { ...clientCapabilityGoldenResponse, global: 1 },
      { ...clientCapabilityGoldenResponse, version: '1.2' },
      { ...clientCapabilityGoldenResponse, extra: false },
    ]) {
      expect(clientCapabilityResponseDecoder.safeDecode(value).success).toBe(false);
      expect(clientCapabilityResponseSchema.safeParse(value).success).toBe(false);
    }
  });
});
