import type {
  ClientCapabilityQuery,
  ClientCapabilityResponse,
  ClientPlatform,
  ClientVersion,
} from '@schedule/contracts';

import { clientCapabilityResponseJsonSchema } from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

export const clientCapabilityResponseDecoder = createCompactDecoder<ClientCapabilityResponse>(
  clientCapabilityResponseJsonSchema,
);

export const clientCapabilityEndpoints = {
  status: defineClientEndpoint<ClientCapabilityQuery, ClientCapabilityResponse>({
    auth: 'public',
    decoder: clientCapabilityResponseDecoder,
    id: 'client-capabilities.read',
    method: 'GET',
    path: ({ platform, version }) =>
      `/client-capabilities?platform=${encodeURIComponent(platform)}&version=${encodeURIComponent(version)}`,
  }),
} as const;

export interface ClientCapabilityClient {
  get(platform: ClientPlatform, version: ClientVersion): Promise<ClientCapabilityResponse>;
}

export function createClientCapabilityClient(transport: ClientTransport): ClientCapabilityClient {
  return {
    get(platform, version) {
      return transport.request(clientCapabilityEndpoints.status, { platform, version });
    },
  };
}
