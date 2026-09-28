import { runtimeConfig } from './runtime-config.js';
import { executeWxJsonRequest } from './wx-request-executor.js';
import {
  awaitWechatSessionRecovery,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from './wechat-identity.js';

export interface ExternalDutyCheck {
  readonly businessDate: string;
  readonly remoteName: string;
  readonly localName: string | null;
  readonly status: 'aligned' | 'pending' | 'processing' | 'blocked';
  readonly changeSource: 'initial' | 'remote' | 'local' | 'both';
  readonly blockReason: string | null;
  readonly fingerprint: string;
}

export interface ExternalDutyCandidate {
  readonly id: string;
  readonly date: string;
  readonly name: string | null;
  readonly shiftName: string;
}

export async function externalDutyRequest<T>(path: string, data?: unknown): Promise<T> {
  await awaitWechatSessionRecovery();
  const accessToken = getStoredWechatToken();
  if (!accessToken) throw new Error('请先登录。');
  const method = data === undefined ? 'GET' : 'POST';
  const response = await executeWxJsonRequest({
    capability: 'core',
    method,
    data,
    authentication: { accessToken, ...(method === 'GET' ? getWechatRequestAuthentication() : {}) },
    request: (options) => wx.request(options),
    url: `${runtimeConfig.apiBaseUrl.replace(/\/$/u, '')}/platform/external-duty${path}`,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      response.statusCode === 403
        ? '仅平台管理员可使用排班网页校对。'
        : response.statusCode === 409
          ? '排班已变化，请刷新后重新确认。'
          : `校对请求失败（HTTP ${response.statusCode}）。`,
    );
  }
  return response.data as T;
}
