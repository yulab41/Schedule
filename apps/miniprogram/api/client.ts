import type { JsonObject } from '@schedule/contracts';

import { appConfig } from '../config/index.js';

export interface ApiErrorPayload {
  readonly code: string;
  readonly latestData?: unknown;
  readonly message: string;
  readonly requestId: string;
}

export class ApiClientError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly requestId: string | undefined,
    public readonly latestData?: JsonObject,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface RequestOptions {
  readonly auth?: boolean;
  readonly data?: object;
  readonly method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
}

const sessionStorageKey = 'schedule.session';
const apiBaseUrlStorageKey = 'apiBaseUrl';

export type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | undefined;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}

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

function getApiBaseUrl(): string {
  try {
    const value = wx.getStorageSync<string>(apiBaseUrlStorageKey);
    if (typeof value === 'string' && value.length > 0) {
      // 本地直连 API 时填 API 源地址（如 http://127.0.0.1:3000，不带 /api）；
      // 默认值带 /api 是因为正式入口经 nginx 转发会剥离该前缀。
      return value;
    }
  } catch {
    // storage 不可用时回退到默认地址
  }
  return appConfig.apiBaseUrl;
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: `${getApiBaseUrl()}${path}`,
      data: options.data as unknown as WechatMiniprogram.IAnyObject,
      header: {
        'content-type': 'application/json',
        ...(options.auth === false ? {} : { Authorization: `Bearer ${getStoredToken() ?? ''}` }),
      },
      method: (options.method ?? 'GET') as WechatMiniprogram.RequestOption['method'],
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T);
          return;
        }
        const payload = response.data as { error?: ApiErrorPayload } | undefined;
        if (response.statusCode === 401 && options.auth !== false) {
          storeToken(undefined);
          try {
            unauthorizedHandler?.();
          } catch {
            // The request must still reject with the original API error if navigation fails.
          }
        }
        reject(
          new ApiClientError(
            payload?.error?.code ?? 'UNKNOWN_ERROR',
            payload?.error?.message ?? '请求失败，请稍后重试。',
            payload?.error?.requestId,
            payload?.error?.latestData as JsonObject | undefined,
            response.statusCode,
          ),
        );
      },
      fail: () => {
        reject(
          new ApiClientError('NETWORK_ERROR', '无法连接到服务，请检查网络后重试。', undefined),
        );
      },
    });
  });
}
