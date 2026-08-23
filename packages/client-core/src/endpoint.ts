import type { CompactDecoder } from './json-decoder.js';

export type ClientEndpointAuth = 'bearer' | 'public';

export interface ClientEndpoint<Input, Output> {
  readonly auth: ClientEndpointAuth;
  readonly body?: ((input: Input) => unknown) | undefined;
  readonly decoder: CompactDecoder<Output>;
  readonly id: string;
  readonly idempotencyKey?: ((input: Input) => string | undefined) | undefined;
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  readonly path: (input: Input) => string;
}

export interface ClientTransport {
  request<Input, Output>(endpoint: ClientEndpoint<Input, Output>, input: Input): Promise<Output>;
}

export function defineClientEndpoint<Input, Output>(
  endpoint: ClientEndpoint<Input, Output>,
): ClientEndpoint<Input, Output> {
  return endpoint;
}
