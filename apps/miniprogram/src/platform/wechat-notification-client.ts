import { runtimeConfig } from './runtime-config.js';
import { executeWxJsonRequest } from './wx-request-executor.js';
import {
  awaitWechatSessionRecovery,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from './wechat-identity.js';

export class WechatDiagnosticHttpError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 403
        ? '当前账号无诊断权限或不是有效群成员。'
        : status === 429
          ? '每分钟最多发送一次本人测试，请稍后再试。'
          : `请求被拒绝（HTTP ${status}），请刷新检查。`,
    );
    this.name = 'WechatDiagnosticHttpError';
  }
}

async function request(
  path: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  data?: unknown,
  operationId?: string,
): Promise<unknown> {
  await awaitWechatSessionRecovery();
  const accessToken = getStoredWechatToken();
  if (!accessToken) throw new Error('请先登录。');
  const response = await executeWxJsonRequest({
    capability: method === 'GET' ? 'core' : 'externalMessages',
    method,
    data,
    request: (options) => wx.request(options),
    url: runtimeConfig.apiBaseUrl.replace(/\/$/u, '') + path,
    // The test POST is not automatically retried. Replaying its key is an explicit user action.
    ...(operationId ? { header: { 'Idempotency-Key': operationId } } : {}),
    authentication: { accessToken, ...(method !== 'POST' ? getWechatRequestAuthentication() : {}) },
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    if (response.statusCode >= 400 && response.statusCode < 500)
      throw new WechatDiagnosticHttpError(response.statusCode);
    throw new Error(
      response.statusCode === 403
        ? '当前账号无诊断权限或不是有效群成员。'
        : response.statusCode === 429
          ? '每分钟最多发送一次本人测试，请稍后再试。'
          : `检查未完成（HTTP ${response.statusCode}），请刷新重试。`,
    );
  }
  return response.data;
}
export async function loadWechatSubscriptionTemplates(): Promise<readonly string[]> {
  const value = (await request('/notifications/wechat-subscription-config')) as {
    dutyReminderTemplateId?: unknown;
  } | null;
  const id = value?.dutyReminderTemplateId;
  if (id === null) return [];
  if (typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(id)) return [id];
  throw new Error('微信订阅配置响应无效，请刷新重试。');
}
export async function inspectWechatNotifications(groupId: string): Promise<unknown> {
  return request(`/me/wechat-notification-diagnostics?groupId=${encodeURIComponent(groupId)}`);
}
export async function saveWechatReceivingPreference(groupId: string): Promise<void> {
  const value = await request(
    `/groups/${encodeURIComponent(groupId)}/notification-preferences/mine`,
    'PUT',
    { wechatNotificationsEnabled: true },
  );
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { wechatNotificationsEnabled?: unknown }).wechatNotificationsEnabled !== true
  )
    throw new Error('服务器未确认接收偏好已开启，请刷新检查。');
}
export async function sendWechatNotificationTest(
  groupId: string,
  operationId: string,
  issuedAt: number,
): Promise<unknown> {
  return request('/me/wechat-notification-test', 'POST', { groupId, issuedAt }, operationId);
}
