import {
  passwordAuthResponseSchema,
  passwordLoginRequestSchema,
  passwordRegisterRequestSchema,
  type PasswordAuthResponse,
} from '@schedule/contracts';

import { ApiClientError } from '../api/client.js';

export interface PasswordAuthClient {
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
  readonly fetch?: typeof fetch;
}

export function createPasswordAuthClient(
  options: PasswordAuthClientOptions = {},
): PasswordAuthClient {
  const baseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
  const fetchImplementation = options.fetch ?? fetch;

  return {
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

export const passwordAuth = createPasswordAuthClient();

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
