import type { JsonObject } from '@schedule/contracts';
import {
  INVALID_RESPONSE,
  type DecodeResult,
  type JsonEndpointDescriptor,
} from '@schedule/client-core';

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

export interface RequestOptions<T> {
  readonly auth?: boolean;
  readonly data?: unknown;
  readonly decodeResponse?: (value: unknown) => DecodeResult<T>;
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

const invalidResponseMessage = '服务返回的数据格式异常，请稍后重试。';

function createInvalidResponseError(status: number): ApiClientError {
  return new ApiClientError(INVALID_RESPONSE, invalidResponseMessage, undefined, undefined, status);
}

export function request<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
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
          if (options.decodeResponse === undefined) {
            resolve(response.data as T);
            return;
          }
          try {
            const decoded = options.decodeResponse(response.data);
            if (!decoded.ok) {
              reject(createInvalidResponseError(response.statusCode));
              return;
            }
            resolve(decoded.value);
          } catch {
            reject(createInvalidResponseError(response.statusCode));
          }
          return;
        }
        const payload = response.data as { error?: ApiErrorPayload } | undefined;
        if (response.statusCode === 401 && options.auth !== false) {
          try {
            if (unauthorizedHandler !== undefined) unauthorizedHandler();
            else storeToken(undefined);
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

export function requestEndpoint<T>(descriptor: JsonEndpointDescriptor<T>): Promise<T> {
  if (descriptor.query !== undefined && descriptor.body !== undefined) {
    return Promise.reject(
      new Error('小程序请求描述同时包含 query 和 body，当前传输层无法安全发送。'),
    );
  }

  const data = descriptor.method === 'GET' ? descriptor.query : descriptor.body;
  if (
    (descriptor.method === 'GET' && descriptor.body !== undefined) ||
    (descriptor.method !== 'GET' && descriptor.query !== undefined)
  ) {
    return Promise.reject(new Error('小程序请求描述的 query/body 与 HTTP 方法不匹配。'));
  }

  return request<T>(descriptor.path, {
    auth: descriptor.auth,
    data,
    decodeResponse: descriptor.decodeResponse,
    method: descriptor.method,
  });
}
