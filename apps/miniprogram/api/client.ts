import { appConfig } from '../config/index.js';

export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}

export class ApiClientError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly requestId: string | undefined,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface RequestOptions {
  readonly auth?: boolean;
  readonly data?: Record<string, unknown>;
  readonly method?: 'DELETE' | 'GET' | 'POST' | 'PUT';
}

const sessionStorageKey = 'schedule.session';

export function getStoredToken(): string | undefined {
  const raw = wx.getStorageSync<string>(sessionStorageKey);
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }
  return raw;
}

export function storeToken(token: string | undefined): void {
  if (token === undefined) {
    wx.removeStorageSync(sessionStorageKey);
  } else {
    wx.setStorageSync(sessionStorageKey, token);
  }
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    wx.request({
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...(options.auth === false ? {} : { Authorization: `Bearer ${getStoredToken() ?? ''}` }),
      },
      method: options.method ?? 'GET',
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }
        const payload = response.data as { error?: ApiErrorPayload } | undefined;
        if (response.statusCode === 401) {
          storeToken(undefined);
          if (options.auth !== false) {
            wx.reLaunch({ url: '/pages/login/login' });
          }
        }
        reject(
          new ApiClientError(
            payload?.error?.code ?? 'UNKNOWN_ERROR',
            payload?.error?.message ?? '请求失败，请稍后重试。',
            payload?.error?.requestId,
          ),
        );
      },
      fail: () => {
        reject(
          new ApiClientError('NETWORK_ERROR', '无法连接到服务，请检查网络后重试。', undefined),
        );
      },
      url: `${appConfig.apiBaseUrl}${path}`,
    });
  });
}
