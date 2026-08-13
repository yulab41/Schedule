export const INVALID_RESPONSE = 'INVALID_RESPONSE' as const;

export interface DecodeError {
  readonly code: typeof INVALID_RESPONSE;
}

export type DecodeResult<T> =
  { readonly ok: true; readonly value: T } | { readonly error: DecodeError; readonly ok: false };

export type JsonEndpointMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
export type EndpointQueryValue = boolean | number | string;

export interface JsonEndpointDescriptor<T> {
  readonly auth: boolean;
  readonly body?: unknown;
  readonly decodeResponse: (value: unknown) => DecodeResult<T>;
  readonly method: JsonEndpointMethod;
  readonly path: string;
  readonly query?: Readonly<Record<string, EndpointQueryValue>>;
}

export type JsonValue = boolean | null | number | string | JsonObject | JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}
