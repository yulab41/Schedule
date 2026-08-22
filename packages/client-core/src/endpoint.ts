import type { CompactDecoder } from './json-decoder.js';

export type ClientEndpointAuth = 'bearer' | 'public';

export interface ClientEndpoint<Input, Output> {
  readonly auth: ClientEndpointAuth;
  readonly decoder: CompactDecoder<Output>;
  readonly id: string;
  readonly method: 'GET';
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
