import type { ApiErrorCode, ApiErrorResponse, UserProfile } from '@schedule/contracts';

import { getAuthenticatedSession, type CloudbaseAuthClient } from '../auth/cloudbase.js';

export interface ApiClient {
  createCurrentProfile(input: { readonly realName: string }): Promise<UserProfile>;
  getCurrentProfile(): Promise<UserProfile>;
}

export interface CreateApiClientOptions {
  readonly apiBaseUrl?: string;
  readonly auth: CloudbaseAuthClient;
  readonly fetch?: typeof fetch;
}

const knownApiErrorCodes = new Set<ApiErrorCode>([
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const baseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
  const fetchImplementation = options.fetch ?? fetch;

  return {
    createCurrentProfile(input) {
      return requestProfile(options.auth, fetchImplementation, baseUrl, '/users', {
        body: JSON.stringify(input),
        method: 'POST',
      });
    },
    getCurrentProfile() {
      return requestProfile(options.auth, fetchImplementation, baseUrl, '/users/me', {
        method: 'GET',
      });
    },
  };
}

export class ApiClientError extends Error {
  public readonly code: ApiErrorCode | 'NETWORK_ERROR' | undefined;
  public readonly requestId: string | undefined;
  public readonly status: number | undefined;

  public constructor(input: {
    readonly code?: ApiErrorCode | 'NETWORK_ERROR';
    readonly message: string;
    readonly requestId?: string;
    readonly status?: number;
  }) {
    super(input.message);
    this.name = 'ApiClientError';
    this.code = input.code;
    this.requestId = input.requestId;
    this.status = input.status;
  }
}

async function requestProfile(
  auth: CloudbaseAuthClient,
  fetchImplementation: typeof fetch,
  baseUrl: string,
  path: string,
  init: { readonly body?: string; readonly method: 'GET' | 'POST' },
): Promise<UserProfile> {
  const session = getAuthenticatedSession(await auth.getSession());

  if (session === undefined) {
    throw new ApiClientError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '登录状态已失效，请重新登录。',
      status: 401,
    });
  }

  let response: Response;
  try {
    response = await fetchImplementation(joinUrl(baseUrl, path), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      method: init.method,
      ...(init.body === undefined ? {} : { body: init.body }),
    });
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
    });
  }

  const body = await readJson(response);
  if (!response.ok) {
    throw toApiClientError(response.status, body);
  }

  if (!isUserProfile(body)) {
    throw new ApiClientError({
      code: 'SERVICE_UNAVAILABLE',
      message: '服务返回了无效资料，请稍后重试。',
      status: response.status,
    });
  }

  return body;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toApiClientError(status: number, body: unknown): ApiClientError {
  if (isApiErrorResponse(body)) {
    return new ApiClientError({
      code: body.error.code,
      message: body.error.message,
      requestId: body.error.requestId,
      status,
    });
  }

  return new ApiClientError({
    message: getHttpErrorMessage(status),
    status,
  });
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (value === null || typeof value !== 'object' || !('error' in value)) {
    return false;
  }

  const error = value.error;
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    knownApiErrorCodes.has(error.code as ApiErrorCode) &&
    'message' in error &&
    typeof error.message === 'string' &&
    'requestId' in error &&
    typeof error.requestId === 'string'
  );
}

function isUserProfile(value: unknown): value is UserProfile {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const profile = value as Partial<UserProfile>;
  return (
    typeof profile.id === 'string' &&
    profile.id.length > 0 &&
    typeof profile.realName === 'string' &&
    profile.realName.length > 0 &&
    typeof profile.version === 'number' &&
    Number.isInteger(profile.version) &&
    profile.version >= 1
  );
}

function getHttpErrorMessage(status: number): string {
  if (status === 401) {
    return '登录状态已失效，请重新登录。';
  }

  if (status === 403) {
    return '当前账户无权执行此操作。';
  }

  if (status === 409) {
    return '资料已发生变化，请刷新后重试。';
  }

  return '服务暂时不可用，请稍后重试。';
}
