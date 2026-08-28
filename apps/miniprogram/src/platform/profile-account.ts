import type { RuntimeWechatRequestAuthentication } from './client-core-calendar.js';

import { runtimeConfig } from './runtime-config.js';
import {
  executeWxJsonRequest,
  type WxRequestAuthenticationPolicy,
  WxRequestNetworkError,
} from './wx-request-executor.js';

export interface MiniProgramBindingStatus {
  readonly bound: boolean;
  readonly canUnbind: boolean;
}

export type ProfilePasswordChangeInput =
  | {
      readonly authMethod: 'password';
      readonly currentPassword: string;
      readonly newPassword: string;
    }
  | { readonly authMethod: 'wechat'; readonly newPassword: string };

export interface ProfileAccountClient {
  readonly changePassword: (
    input: ProfilePasswordChangeInput,
  ) => Promise<{ readonly passwordChanged: true }>;
  readonly getWechatBinding: () => Promise<MiniProgramBindingStatus>;
}

export class ProfileAccountError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ProfileAccountError';
  }
}

export function createProfileAccountClient(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
): ProfileAccountClient {
  return {
    async changePassword(input) {
      const requestAuthentication = await createRequestAuthentication(
        getAccessToken,
        authentication,
      );
      const data =
        input.authMethod === 'password'
          ? { currentPassword: input.currentPassword, newPassword: input.newPassword }
          : { code: await requestFreshWechatCode(), newPassword: input.newPassword };
      let response;
      try {
        response = await executeWxJsonRequest({
          authentication: requestAuthentication,
          capability: 'core',
          data,
          header: { 'content-type': 'application/json' },
          method: 'PUT',
          request: (requestOptions) => wx.request(requestOptions),
          url: `${apiBaseUrl()}/me/password`,
        });
      } catch {
        throw new ProfileAccountError('密码没有修改，请稍后重试。');
      }
      if (
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        !isRecord(response.data) ||
        response.data['passwordChanged'] !== true
      ) {
        throw new ProfileAccountError(readPasswordError(response.data, response.statusCode));
      }
      return { passwordChanged: true };
    },

    async getWechatBinding() {
      const requestAuthentication = await createRequestAuthentication(
        getAccessToken,
        authentication,
      );
      let response;
      try {
        response = await executeWxJsonRequest({
          authentication: requestAuthentication,
          capability: 'core',
          method: 'GET',
          request: (requestOptions) => wx.request(requestOptions),
          url: `${apiBaseUrl()}/me/wechat/miniprogram/binding`,
        });
      } catch (error) {
        if (error instanceof WxRequestNetworkError) {
          throw new ProfileAccountError('微信身份状态暂时无法读取。');
        }
        throw new ProfileAccountError('微信身份状态暂时无法读取。');
      }
      if (
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        !isRecord(response.data) ||
        typeof response.data['bound'] !== 'boolean' ||
        typeof response.data['canUnbind'] !== 'boolean'
      ) {
        throw new ProfileAccountError('微信身份状态暂时无法读取。');
      }
      return {
        bound: response.data['bound'],
        canUnbind: response.data['canUnbind'],
      };
    },
  };
}

async function createRequestAuthentication(
  getAccessToken: () => string | undefined,
  authentication: RuntimeWechatRequestAuthentication | undefined,
): Promise<WxRequestAuthenticationPolicy> {
  let accessToken = getAccessToken();
  if ((accessToken === undefined || accessToken.length === 0) && authentication !== undefined) {
    accessToken = await authentication.awaitAccessToken();
  }
  if (accessToken === undefined || accessToken.length === 0) {
    throw new ProfileAccountError('登录状态已失效，请重新登录。');
  }
  return {
    accessToken,
    ...(authentication?.finalizeUnauthorized === undefined
      ? {}
      : { finalizeUnauthorized: authentication.finalizeUnauthorized }),
    ...(authentication?.getSessionGeneration === undefined
      ? {}
      : {
          getSessionGeneration: authentication.getSessionGeneration,
          sessionGeneration: authentication.getSessionGeneration(),
        }),
    ...(authentication?.recoverAccessToken === undefined
      ? {}
      : { recoverAccessToken: authentication.recoverAccessToken }),
  };
}

function requestFreshWechatCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      wx.login({
        fail: () => reject(new ProfileAccountError('微信身份验证未完成，请重试。')),
        success: (response) => {
          if (typeof response.code !== 'string' || response.code.length === 0) {
            reject(new ProfileAccountError('微信身份验证未完成，请重试。'));
            return;
          }
          resolve(response.code);
        },
      });
    } catch {
      reject(new ProfileAccountError('微信身份验证未完成，请重试。'));
    }
  });
}

function readPasswordError(value: unknown, statusCode: number): string {
  const error = isRecord(value) && isRecord(value['error']) ? value['error'] : value;
  const code = isRecord(error) && typeof error['code'] === 'string' ? error['code'] : undefined;
  if (code === 'VALIDATION_FAILED') return '请检查当前密码和新密码。';
  if (statusCode === 401) return '身份验证失败，请重新登录后再试。';
  return '密码没有修改，请稍后重试。';
}

function apiBaseUrl(): string {
  return runtimeConfig.apiBaseUrl.replace(/\/$/u, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
