import { runtimeConfig } from './runtime-config.js';

const SESSION_STORAGE_KEY = 'schedule.wechat.session';

export interface WechatAuthenticatedProfile {
  readonly id: string;
  readonly realName: string;
  readonly version: number;
}

export interface WechatAuthenticatedResult {
  readonly expiresAt: string;
  readonly profile: WechatAuthenticatedProfile;
  readonly status: 'authenticated';
  readonly token: string;
}

export interface WechatLinkRequiredResult {
  readonly expiresAt: string;
  readonly linkToken: string;
  readonly status: 'link_required';
}

export interface WechatAdminBindingPreviewResult {
  readonly expiresAt: string;
  readonly realNameMasked: string;
  readonly usernameMasked: string;
}

export interface WechatUnbindResult {
  readonly unbound: true;
}

export type WechatLoginResult = WechatAuthenticatedResult | WechatLinkRequiredResult;

export class WechatIdentityClientError extends Error {
  public readonly code: string | undefined;

  public constructor(message: string, code?: string) {
    super(message);
    this.name = 'WechatIdentityClientError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function decodeAuthenticated(value: unknown): WechatAuthenticatedResult {
  if (!isRecord(value)) throw new WechatIdentityClientError('登录响应无效。');
  const profile = value.profile;
  if (
    value.status !== 'authenticated' ||
    readString(value.token) === undefined ||
    readString(value.expiresAt) === undefined ||
    !isRecord(profile) ||
    readString(profile.id) === undefined ||
    readString(profile.realName) === undefined ||
    typeof profile.version !== 'number'
  ) {
    throw new WechatIdentityClientError('登录响应无效。');
  }
  return {
    expiresAt: value.expiresAt as string,
    profile: {
      id: profile.id as string,
      realName: profile.realName as string,
      version: profile.version,
    },
    status: 'authenticated',
    token: value.token as string,
  };
}

function decodeLogin(value: unknown): WechatLoginResult {
  if (!isRecord(value)) throw new WechatIdentityClientError('微信登录响应无效。');
  if (value.status === 'link_required') {
    const linkToken = readString(value.linkToken);
    const expiresAt = readString(value.expiresAt);
    if (linkToken === undefined || expiresAt === undefined) {
      throw new WechatIdentityClientError('微信登录响应无效。');
    }
    return { expiresAt, linkToken, status: 'link_required' };
  }
  return decodeAuthenticated(value);
}

function decodePreview(value: unknown): WechatAdminBindingPreviewResult {
  if (
    !isRecord(value) ||
    readString(value.expiresAt) === undefined ||
    readString(value.realNameMasked) === undefined ||
    readString(value.usernameMasked) === undefined
  ) {
    throw new WechatIdentityClientError('绑定预览响应无效。');
  }
  return {
    expiresAt: value.expiresAt as string,
    realNameMasked: value.realNameMasked as string,
    usernameMasked: value.usernameMasked as string,
  };
}

function readApiError(value: unknown, statusCode: number): WechatIdentityClientError {
  const error = isRecord(value) && isRecord(value.error) ? value.error : value;
  const code = isRecord(error) ? readString(error.code) : undefined;
  const knownMessages: Readonly<Record<string, string>> = {
    CONFLICT: '身份状态发生变化，请重新开始。',
    FORBIDDEN: '当前账号不满足这项操作条件。',
    SERVICE_UNAVAILABLE: '微信服务暂时不可用，请稍后重试。',
    VALIDATION_FAILED: '请检查填写内容。',
    WECHAT_LINK_TOKEN_EXPIRED: '绑定链接已过期，请重新获取。',
    WECHAT_LINK_TOKEN_INVALID: '绑定链接无效，请重新获取。',
    WECHAT_LINK_TOKEN_USED: '绑定链接已使用，请重新获取。',
  };
  return new WechatIdentityClientError(
    knownMessages[code ?? ''] ??
      (statusCode === 401 ? '账号或密码不正确。' : '操作未完成，请稍后重试。'),
    code,
  );
}

function postJson(
  path: string,
  data: Readonly<Record<string, string>>,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<unknown> {
  const baseUrl = runtimeConfig.apiBaseUrl.replace(/\/$/u, '');
  return new Promise((resolve, reject) => {
    try {
      wx.request({
        data,
        fail: () => reject(new WechatIdentityClientError('网络连接失败，请稍后重试。')),
        header: { 'content-type': 'application/json', ...extraHeaders },
        method: 'POST',
        success: (response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(readApiError(response.data, response.statusCode));
            return;
          }
          resolve(response.data);
        },
        url: `${baseUrl}${path}`,
      });
    } catch {
      reject(new WechatIdentityClientError('网络连接失败，请稍后重试。'));
    }
  });
}

function getWechatCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      wx.login({
        fail: () => reject(new WechatIdentityClientError('微信登录未完成，请重试。')),
        success: (response) => {
          const code = readString(response.code);
          if (code === undefined) reject(new WechatIdentityClientError('微信登录未完成，请重试。'));
          else resolve(code);
        },
      });
    } catch {
      reject(new WechatIdentityClientError('微信登录未完成，请重试。'));
    }
  });
}

export async function loginWithWechat(): Promise<WechatLoginResult> {
  return decodeLogin(await postJson('/auth/wechat/login', { code: await getWechatCode() }));
}

export async function linkWechatPassword(
  linkToken: string,
  username: string,
  password: string,
): Promise<WechatAuthenticatedResult> {
  return decodeAuthenticated(
    await postJson('/auth/wechat/link-password', { linkToken, password, username }),
  );
}

export async function registerWechat(
  linkToken: string,
  realName: string,
): Promise<WechatAuthenticatedResult> {
  return decodeAuthenticated(await postJson('/auth/wechat/register', { linkToken, realName }));
}

export async function previewAdminBinding(
  ticket: string,
): Promise<WechatAdminBindingPreviewResult> {
  return decodePreview(await postJson('/auth/wechat/admin-bind/preview', { ticket }));
}

export async function confirmAdminBinding(ticket: string): Promise<WechatAuthenticatedResult> {
  return decodeAuthenticated(
    await postJson('/auth/wechat/admin-bind/confirm', { code: await getWechatCode(), ticket }),
  );
}

export async function unbindWechatIdentity(idempotencyKey: string): Promise<WechatUnbindResult> {
  const value = await postJson(
    '/me/wechat/miniprogram/unbind',
    { code: await getWechatCode() },
    { 'Idempotency-Key': idempotencyKey },
  );
  if (!isRecord(value) || value.unbound !== true) {
    throw new WechatIdentityClientError('解绑响应无效。');
  }
  return { unbound: true };
}

export function persistWechatSession(result: WechatAuthenticatedResult): void {
  wx.setStorageSync(SESSION_STORAGE_KEY, {
    expiresAt: result.expiresAt,
    profile: result.profile,
    token: result.token,
  });
}

export function getStoredWechatToken(): string | undefined {
  const stored = wx.getStorageSync(SESSION_STORAGE_KEY);
  if (!isRecord(stored)) return undefined;
  return readString(stored.token);
}

export function getStoredWechatProfile(): WechatAuthenticatedProfile | undefined {
  const stored = wx.getStorageSync(SESSION_STORAGE_KEY);
  if (!isRecord(stored) || !isRecord(stored.profile)) return undefined;
  const id = readString(stored.profile.id);
  const realName = readString(stored.profile.realName);
  const version = stored.profile.version;
  if (
    id === undefined ||
    realName === undefined ||
    typeof version !== 'number' ||
    !Number.isInteger(version)
  ) {
    return undefined;
  }
  return { id, realName, version };
}

export function getIdentityErrorMessage(error: unknown): string {
  return error instanceof WechatIdentityClientError ? error.message : '操作未完成，请稍后重试。';
}
