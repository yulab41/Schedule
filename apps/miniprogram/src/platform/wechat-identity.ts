import { runtimeConfig } from './runtime-config.js';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../app/client-capability-store.js';
import {
  clearPrivateBusinessStorage,
  clearWechatSessionStorage,
  WECHAT_SESSION_STORAGE_KEY,
} from './private-storage.js';
import {
  executeWxJsonRequest,
  isBearerAuthenticationRequired,
  WxRequestNetworkError,
} from './wx-request-executor.js';

const MAX_SESSION_LIFETIME_MS = 31 * 24 * 60 * 60 * 1000;
const utcIsoInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

interface StoredWechatSession {
  readonly expiresAt: string;
  readonly profile: WechatAuthenticatedProfile;
  readonly token: string;
}

let sessionRecoveryPromise: Promise<string | undefined> | undefined;
let sessionGeneration = 0;
let sessionInvalidated = false;

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
    !isAcceptableSessionExpiry(value.expiresAt) ||
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

async function postJson(
  path: string,
  data: Readonly<Record<string, string>>,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<unknown> {
  const baseUrl = runtimeConfig.apiBaseUrl.replace(/\/$/u, '');
  const idempotencyKey = readString(extraHeaders['Idempotency-Key']);
  try {
    const response = await executeWxJsonRequest({
      capability: 'core',
      data,
      header: { 'content-type': 'application/json', ...extraHeaders },
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      method: 'POST',
      request: (requestOptions) => wx.request(requestOptions),
      url: `${baseUrl}${path}`,
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw readApiError(response.data, response.statusCode);
    }
    return response.data;
  } catch (error) {
    if (error instanceof ClientCapabilityDisabledError) throw error;
    if (error instanceof WechatIdentityClientError) throw error;
    if (error instanceof WxRequestNetworkError) {
      throw new WechatIdentityClientError('网络连接失败，请稍后重试。');
    }
    throw new WechatIdentityClientError('操作未完成，请稍后重试。');
  }
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
  await requireClientCapability('core');
  return decodeLogin(await postJson('/auth/wechat/login', { code: await getWechatCode() }));
}

export async function linkWechatPassword(
  linkToken: string,
  username: string,
  password: string,
): Promise<WechatAuthenticatedResult> {
  await requireClientCapability('core');
  return decodeAuthenticated(
    await postJson('/auth/wechat/link-password', { linkToken, password, username }),
  );
}

export async function registerWechat(
  linkToken: string,
  realName: string,
): Promise<WechatAuthenticatedResult> {
  await requireClientCapability('core');
  return decodeAuthenticated(await postJson('/auth/wechat/register', { linkToken, realName }));
}

export async function previewAdminBinding(
  ticket: string,
): Promise<WechatAdminBindingPreviewResult> {
  await requireClientCapability('core');
  return decodePreview(await postJson('/auth/wechat/admin-bind/preview', { ticket }));
}

export async function confirmAdminBinding(ticket: string): Promise<WechatAuthenticatedResult> {
  await requireClientCapability('core');
  return decodeAuthenticated(
    await postJson('/auth/wechat/admin-bind/confirm', { code: await getWechatCode(), ticket }),
  );
}

export async function unbindWechatIdentity(idempotencyKey: string): Promise<WechatUnbindResult> {
  const accessToken = getStoredWechatToken();
  if (accessToken === undefined) {
    throw new WechatIdentityClientError('登录状态已失效，请重新登录。');
  }
  const baseUrl = runtimeConfig.apiBaseUrl.replace(/\/$/u, '');
  let response;
  try {
    response = await executeWxJsonRequest({
      authentication: {
        accessToken,
        finalizeUnauthorized: finalizeWechatUnauthorized,
        getSessionGeneration: getWechatSessionGeneration,
        isAuthenticationRequired: isBearerAuthenticationRequired,
        recoverAccessToken: recoverWechatSession,
        sessionGeneration: getWechatSessionGeneration(),
      },
      capability: 'bypass',
      data: { code: await getWechatCode() },
      header: { 'content-type': 'application/json' },
      idempotencyKey,
      method: 'POST',
      request: (requestOptions) => wx.request(requestOptions),
      url: `${baseUrl}/me/wechat/miniprogram/unbind`,
    });
  } catch (error) {
    if (error instanceof WxRequestNetworkError) {
      throw new WechatIdentityClientError('网络连接失败，请稍后重试。');
    }
    throw error;
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw readApiError(response.data, response.statusCode);
  }
  const value = response.data;
  if (!isRecord(value) || value.unbound !== true) {
    throw new WechatIdentityClientError('解绑响应无效。');
  }
  clearWechatSession(true);
  return { unbound: true };
}

export function persistWechatSession(result: WechatAuthenticatedResult): void {
  persistWechatSessionForOwner(result);
}

function persistWechatSessionForOwner(
  result: WechatAuthenticatedResult,
  preservedOwnerId?: string,
): void {
  if (!isAcceptableSessionExpiry(result.expiresAt)) {
    clearWechatSession(true);
    throw new WechatIdentityClientError('登录响应无效。');
  }
  const previous = readStoredWechatSession(Date.now(), false);
  if (
    (previous === undefined && preservedOwnerId !== result.profile.id) ||
    (previous !== undefined && previous.profile.id !== result.profile.id)
  ) {
    clearPrivateBusinessStorage();
  }
  sessionInvalidated = true;
  sessionGeneration += 1;
  wx.setStorageSync(WECHAT_SESSION_STORAGE_KEY, {
    expiresAt: result.expiresAt,
    profile: result.profile,
    token: result.token,
  } satisfies StoredWechatSession);
  sessionInvalidated = false;
}

export function getStoredWechatToken(now = Date.now()): string | undefined {
  return readStoredWechatSession(now)?.token;
}

export function getStoredWechatProfile(now = Date.now()): WechatAuthenticatedProfile | undefined {
  return readStoredWechatSession(now)?.profile;
}

export function clearWechatSession(includePrivateBusinessStorage = false): void {
  sessionInvalidated = true;
  clearWechatSessionStorage();
  if (includePrivateBusinessStorage) clearPrivateBusinessStorage();
  sessionGeneration += 1;
}

export function getWechatSessionGeneration(): number {
  return sessionGeneration;
}

export function getWechatRequestAuthentication(): {
  readonly awaitAccessToken: () => Promise<string | undefined>;
  readonly finalizeUnauthorized: (failedToken: string) => void;
  readonly getSessionGeneration: () => number;
  readonly recoverAccessToken: (failedToken: string) => Promise<string | undefined>;
} {
  return {
    awaitAccessToken: awaitWechatSessionRecovery,
    finalizeUnauthorized: finalizeWechatUnauthorized,
    getSessionGeneration: getWechatSessionGeneration,
    recoverAccessToken: recoverWechatSession,
  };
}

export async function awaitWechatSessionRecovery(): Promise<string | undefined> {
  return sessionRecoveryPromise;
}

export async function recoverWechatSession(failedToken: string): Promise<string | undefined> {
  const current = readStoredWechatSession(Date.now(), false);
  if (current !== undefined && current.token !== failedToken) return current.token;
  if (sessionRecoveryPromise !== undefined) return sessionRecoveryPromise;

  const previousOwnerId = current?.profile.id;
  clearWechatSession(false);
  const recovery = (async (): Promise<string | undefined> => {
    try {
      const result = await loginWithWechat();
      if (result.status !== 'authenticated') {
        clearWechatSession(true);
        return undefined;
      }
      if (previousOwnerId !== undefined && previousOwnerId !== result.profile.id) {
        clearPrivateBusinessStorage();
      }
      persistWechatSessionForOwner(result, previousOwnerId);
      return result.token;
    } catch {
      clearWechatSession(true);
      return undefined;
    }
  })();
  sessionRecoveryPromise = recovery;
  try {
    return await recovery;
  } finally {
    if (sessionRecoveryPromise === recovery) sessionRecoveryPromise = undefined;
  }
}

export function finalizeWechatUnauthorized(failedToken: string): void {
  const current = readStoredWechatSession(Date.now(), false);
  if (current !== undefined && current.token !== failedToken) return;
  clearWechatSession(true);
}

export function getIdentityErrorMessage(error: unknown): string {
  if (error instanceof ClientCapabilityDisabledError) return error.message;
  return error instanceof WechatIdentityClientError ? error.message : '操作未完成，请稍后重试。';
}

function readStoredWechatSession(
  now: number,
  clearInvalid = true,
): StoredWechatSession | undefined {
  if (sessionInvalidated) return undefined;
  let stored: unknown;
  try {
    stored = wx.getStorageSync(WECHAT_SESSION_STORAGE_KEY);
  } catch {
    stored = undefined;
  }
  if (!isRecord(stored) || !isRecord(stored.profile)) {
    if (stored !== undefined && clearInvalid) clearWechatSession(true);
    return undefined;
  }
  const token = readString(stored.token);
  const expiresAt = readString(stored.expiresAt);
  const id = readString(stored.profile.id);
  const realName = readString(stored.profile.realName);
  const version = stored.profile.version;
  if (
    token === undefined ||
    expiresAt === undefined ||
    id === undefined ||
    realName === undefined ||
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    !isAcceptableSessionExpiry(expiresAt, now)
  ) {
    if (clearInvalid) clearWechatSession(true);
    return undefined;
  }
  return { expiresAt, profile: { id, realName, version }, token };
}

function isAcceptableSessionExpiry(value: unknown, now = Date.now()): value is string {
  const expiresAt = readString(value);
  if (expiresAt === undefined || !utcIsoInstantPattern.test(expiresAt)) return false;
  const timestamp = Date.parse(expiresAt);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === expiresAt &&
    timestamp > now &&
    timestamp - now <= MAX_SESSION_LIFETIME_MS
  );
}
