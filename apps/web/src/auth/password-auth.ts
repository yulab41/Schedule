import {
  passwordAuthResponseSchema,
  passwordChangeRequestSchema,
  passwordChangeResponseSchema,
  passwordLoginRequestSchema,
  passwordRegisterRequestSchema,
  passwordStatusResponseSchema,
  type PasswordAuthResponse,
  type PasswordChangeRequest,
  type PasswordChangeResponse,
  type PasswordStatusResponse,
} from '@schedule/contracts';

import { ApiClientError } from '../api/client.js';
import { localAuth, type AuthClient } from './local-auth.js';

export interface PasswordAuthClient {
  changePassword(input: PasswordChangeRequest): Promise<PasswordChangeResponse>;
  getStatus(): Promise<PasswordStatusResponse>;
  login(input: {
    readonly password: string;
    readonly username: string;
  }): Promise<PasswordAuthResponse>;
  register(input: {
    readonly password: string;
    readonly username: string;
  }): Promise<PasswordAuthResponse>;
}

export interface PasswordAuthClientOptions {
  readonly apiBaseUrl?: string;
  readonly auth?: Pick<AuthClient, 'getSession'>;
  readonly fetch?: typeof fetch;
}

export function createPasswordAuthClient(
  options: PasswordAuthClientOptions = {},
): PasswordAuthClient {
  const baseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
  const fetchImplementation = options.fetch ?? fetch;

  return {
    changePassword(input) {
      return requestProtectedPasswordAuth(
        fetchImplementation,
        baseUrl,
        options.auth,
        '/auth/password',
        {
          body: JSON.stringify(passwordChangeRequestSchema.parse(input)),
          method: 'PATCH',
        },
        passwordChangeResponseSchema,
      );
    },
    getStatus() {
      return requestProtectedPasswordAuth(
        fetchImplementation,
        baseUrl,
        options.auth,
        '/auth/password/status',
        { method: 'GET' },
        passwordStatusResponseSchema,
      );
    },
    login(input) {
      return requestPasswordAuth(
        fetchImplementation,
        baseUrl,
        '/auth/password/login',
        passwordLoginRequestSchema.parse(input),
      );
    },
    register(input) {
      return requestPasswordAuth(
        fetchImplementation,
        baseUrl,
        '/auth/password/register',
        passwordRegisterRequestSchema.parse(input),
      );
    },
  };
}

export const passwordAuth = createPasswordAuthClient({ auth: localAuth });

async function requestPasswordAuth(
  fetchImplementation: typeof fetch,
  baseUrl: string,
  path: string,
  input: { readonly password: string; readonly username: string },
): Promise<PasswordAuthResponse> {
  let response: Response;
  try {
    response = await fetchImplementation.call(globalThis, `${baseUrl.replace(/\/$/u, '')}${path}`, {
      body: JSON.stringify(input),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
    });
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
    });
  }

  const body = await readJson(response);
  if (!response.ok) {
    throw new ApiClientError({
      message: getErrorMessage(response.status, body),
      status: response.status,
    });
  }

  const parsed = passwordAuthResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiClientError({
      code: 'SERVICE_UNAVAILABLE',
      message: '服务返回了无效资料，请稍后重试。',
      status: response.status,
    });
  }
  return parsed.data;
}

async function requestProtectedPasswordAuth<Output>(
  fetchImplementation: typeof fetch,
  baseUrl: string,
  auth: Pick<AuthClient, 'getSession'> | undefined,
  path: string,
  init: { readonly body?: string; readonly method: 'GET' | 'PATCH' },
  schema: {
    safeParse(
      value: unknown,
    ): { readonly data: Output; readonly success: true } | { readonly success: false };
  },
): Promise<Output> {
  if (auth === undefined) {
    throw new ApiClientError({ message: '当前登录状态不可用，请重新登录。', status: 401 });
  }
  const sessionResult = await auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (sessionResult.error !== null && sessionResult.error !== undefined) {
    throw new ApiClientError({ message: '当前登录状态不可用，请重新登录。', status: 401 });
  }
  if (accessToken === undefined || accessToken.length === 0) {
    throw new ApiClientError({ message: '当前登录状态不可用，请重新登录。', status: 401 });
  }

  let response: Response;
  try {
    response = await fetchImplementation.call(globalThis, `${baseUrl.replace(/\/$/u, '')}${path}`, {
      ...(init.body === undefined ? {} : { body: init.body }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      method: init.method,
    });
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
    });
  }

  const body = await readJson(response);
  if (!response.ok) {
    throw new ApiClientError({
      message: getErrorMessage(response.status, body),
      status: response.status,
    });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiClientError({
      code: 'SERVICE_UNAVAILABLE',
      message: '服务返回了无效资料，请稍后重试。',
      status: response.status,
    });
  }
  return parsed.data;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function getErrorMessage(status: number, body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  ) {
    return body.error.message;
  }
  if (status === 401) {
    return '账号或密码不正确，请重试。';
  }
  if (status === 409) {
    return '该账号已存在，请换一个账号。';
  }
  return '登录服务暂时不可用，请稍后重试。';
}
