// Single source for the error-code protocol: the union is derived from the
// runtime list so server handlers and client guards can never drift apart.
export const apiErrorCodes = [
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'UNSUPPORTED_MEDIA_TYPE',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export type JsonValue = boolean | null | number | string | JsonObject | JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface ApiErrorDetails {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly requestId: string;
  readonly latestData?: JsonObject;
}

export interface ApiErrorResponse {
  readonly error: ApiErrorDetails;
}
