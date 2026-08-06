export type ApiErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

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
