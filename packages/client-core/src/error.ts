import type { ApiErrorCode, JsonObject } from '@schedule/contracts';

import { generatedApiErrorCodes } from './generated/calendar-schemas.js';

export type ClientCoreErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'OFFLINE';

const knownApiErrorCodes = new Set<string>(generatedApiErrorCodes);

export class ClientCoreError extends Error {
  public readonly code: ClientCoreErrorCode | undefined;
  public readonly latestData: JsonObject | undefined;
  public readonly requestId: string | undefined;
  public readonly status: number | undefined;

  public constructor(input: {
    readonly code?: ClientCoreErrorCode;
    readonly latestData?: JsonObject;
    readonly message: string;
    readonly requestId?: string;
    readonly status?: number;
  }) {
    super(input.message);
    this.name = 'ClientCoreError';
    this.code = input.code;
    this.latestData = input.latestData;
    this.requestId = input.requestId;
    this.status = input.status;
  }
}

export function createAuthenticationRequiredError(): ClientCoreError {
  return new ClientCoreError({
    code: 'AUTHENTICATION_REQUIRED',
    message: '登录状态已失效，请重新登录。',
    status: 401,
  });
}

export function createHttpClientError(status: number, body: unknown): ClientCoreError {
  if (isApiErrorBody(body)) {
    return new ClientCoreError({
      code: body.error.code as ApiErrorCode,
      ...(body.error.latestData === undefined
        ? {}
        : { latestData: body.error.latestData as JsonObject }),
      message: body.error.message,
      requestId: body.error.requestId,
      status,
    });
  }
  return new ClientCoreError({ message: getHttpErrorMessage(status), status });
}

export function createInvalidResponseError(status: number): ClientCoreError {
  return new ClientCoreError({
    code: 'SERVICE_UNAVAILABLE',
    message: '服务返回了无效资料，请稍后重试。',
    status,
  });
}

export function createNetworkError(): ClientCoreError {
  return new ClientCoreError({
    code: 'NETWORK_ERROR',
    message: '无法连接到服务，请检查网络后重试。',
  });
}

function getHttpErrorMessage(status: number): string {
  if (status === 401) return '登录状态已失效，请重新登录。';
  if (status === 403) return '当前账户无权执行此操作。';
  if (status === 409) return '资料已发生变化，请刷新后重试。';
  return '服务暂时不可用，请稍后重试。';
}

function isApiErrorBody(value: unknown): value is {
  readonly error: {
    readonly code: string;
    readonly latestData?: unknown;
    readonly message: string;
    readonly requestId: string;
  };
} {
  if (value === null || typeof value !== 'object' || !('error' in value)) return false;
  const error = value.error;
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    knownApiErrorCodes.has(error.code) &&
    'message' in error &&
    typeof error.message === 'string' &&
    'requestId' in error &&
    typeof error.requestId === 'string'
  );
}
