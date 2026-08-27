import type { RuntimeWechatRequestAuthentication } from './client-core-calendar.js';

import { buildInfo } from './build-info.js';
import { runtimeConfig } from './runtime-config.js';
import { executeWxJsonRequest, type WxRequestAuthenticationPolicy } from './wx-request-executor.js';

export const PROFILE_AVATAR_CACHE_PREFIX = 'schedule.profile.avatar.v1:';

const MAX_AVATAR_BYTES = 1024 * 1024;
const BRIDGE_TIMEOUT_MS = 30_000;
const AVATAR_FILE_PREFIX = 'schedule-profile-avatar-';

interface ProfileAvatarCacheEntry {
  readonly avatarVersion: number;
  readonly contentType: ProfileAvatarContentType;
  readonly filePath: string;
  readonly ownerId: string;
}

type ProfileAvatarContentType = 'image/jpeg' | 'image/png' | 'image/webp';
type ProfileAvatarExtension = 'jpg' | 'png' | 'webp';

interface ValidatedProfileImage {
  readonly bytes: ArrayBuffer;
  readonly contentType: ProfileAvatarContentType;
  readonly extension: ProfileAvatarExtension;
}

interface ProfileMediaRuntimeState {
  readonly downloads: Map<string, Promise<string | undefined>>;
  pendingPath: string | undefined;
  uploadTail: Promise<void>;
}

interface ProfileMediaGlobalData {
  profileMediaRuntimeState?: ProfileMediaRuntimeState;
}

interface ProfileMediaApp {
  readonly globalData?: ProfileMediaGlobalData;
}

interface WxFileSystemManager {
  access(options: {
    readonly fail: (error: unknown) => void;
    readonly path: string;
    readonly success: () => void;
  }): unknown;
  getFileInfo(options: {
    readonly fail: (error: unknown) => void;
    readonly filePath: string;
    readonly success: (result: { readonly size: number }) => void;
  }): unknown;
  readFile(options: {
    readonly fail: (error: unknown) => void;
    readonly filePath: string;
    readonly success: (result: { readonly data: unknown }) => void;
  }): unknown;
  unlink(options: {
    readonly fail: (error: unknown) => void;
    readonly filePath: string;
    readonly success: () => void;
  }): unknown;
  unlinkSync?: ((filePath: string) => void) | undefined;
  writeFile(options: {
    readonly data: ArrayBuffer;
    readonly fail: (error: unknown) => void;
    readonly filePath: string;
    readonly success: () => void;
  }): unknown;
}

interface WxDownloadFileSuccess {
  readonly filePath?: string;
  readonly header?: Readonly<Record<string, unknown>>;
  readonly statusCode: number;
  readonly tempFilePath?: string;
}

interface WxProfileMediaBridge {
  readonly env: { readonly USER_DATA_PATH: string };
  downloadFile(options: {
    readonly fail: (error: unknown) => void;
    readonly header: Readonly<Record<string, string>>;
    readonly success: (result: WxDownloadFileSuccess) => void;
    readonly timeout: number;
    readonly url: string;
  }): unknown;
  getFileSystemManager(): WxFileSystemManager;
  getStorageInfoSync(): { readonly keys: readonly string[] };
  getStorageSync(key: string): unknown;
  removeStorageSync(key: string): void;
  request(options: Parameters<typeof wx.request>[0]): unknown;
  setStorageSync(key: string, value: unknown): void;
}

export type ProfileAvatarFlushResult =
  | { readonly status: 'empty' }
  | {
      readonly avatarVersion: number;
      readonly localPath: string;
      readonly status: 'uploaded';
    }
  | { readonly message: '本次头像未更新。'; readonly status: 'failed' };

export interface ProfileMediaClient {
  readonly flushPending: (ownerId: string) => Promise<ProfileAvatarFlushResult>;
  readonly remove: (ownerId: string) => Promise<{ readonly removed: boolean }>;
  readonly resolve: (
    ownerId: string,
    avatarVersion: number | undefined,
  ) => Promise<string | undefined>;
}

const fallbackRuntimeState = createProfileMediaRuntimeState();

export function rememberPendingProfileAvatar(tempFilePath: string): void {
  if (!isUsableIdentifier(tempFilePath)) return;
  getProfileMediaRuntimeState().pendingPath = tempFilePath;
}

export function clearPendingProfileAvatar(): void {
  getProfileMediaRuntimeState().pendingPath = undefined;
}

export function hasPendingProfileAvatar(): boolean {
  return getProfileMediaRuntimeState().pendingPath !== undefined;
}

export function createProfileMediaClient(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
): ProfileMediaClient {
  return {
    flushPending(ownerId) {
      const selectedPath = takePendingProfileAvatar();
      if (selectedPath === undefined) return Promise.resolve({ status: 'empty' });
      const runtimeState = getProfileMediaRuntimeState();
      const upload = runtimeState.uploadTail.then(
        () => uploadProfileAvatar(ownerId, selectedPath, getAccessToken, authentication),
        () => uploadProfileAvatar(ownerId, selectedPath, getAccessToken, authentication),
      );
      runtimeState.uploadTail = upload.then(
        () => undefined,
        () => undefined,
      );
      return upload;
    },
    async remove(ownerId) {
      assertOwnerId(ownerId);
      const requestAuthentication = await createRequestAuthentication(
        getAccessToken,
        authentication,
      );
      const response = await executeWxJsonRequest({
        authentication: requestAuthentication,
        capability: 'core',
        method: 'DELETE',
        request: (requestOptions) => getWxBridge().request(requestOptions),
        url: `${apiBaseUrl()}/users/me/avatar`,
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new ProfileMediaError('头像恢复未完成，请稍后重试。');
      }
      if (!isRecord(response.data) || typeof response.data['removed'] !== 'boolean') {
        throw new ProfileMediaError('头像恢复未完成，请稍后重试。');
      }
      clearPendingProfileAvatar();
      clearLocalProfileAvatar(ownerId);
      return { removed: response.data['removed'] };
    },
    resolve(ownerId, avatarVersion) {
      return resolveProfileAvatar(ownerId, avatarVersion, getAccessToken, authentication);
    },
  };
}

export function clearLocalProfileAvatar(ownerId: string): void {
  if (!isUsableIdentifier(ownerId)) return;
  const key = getCacheKey(ownerId);
  const stored = readStorage(key);
  if (isRecord(stored) && typeof stored['filePath'] === 'string') {
    unlinkPrivateAvatarFileSync(stored['filePath']);
  }
  removeStorage(key);
}

export function clearAllLocalProfileAvatars(): void {
  clearPendingProfileAvatar();
  for (const key of readStorageKeys()) {
    if (!key.startsWith(PROFILE_AVATAR_CACHE_PREFIX)) continue;
    const stored = readStorage(key);
    if (isRecord(stored) && typeof stored['filePath'] === 'string') {
      unlinkPrivateAvatarFileSync(stored['filePath']);
    }
    removeStorage(key);
  }
}

export class ProfileMediaError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ProfileMediaError';
  }
}

function createProfileMediaRuntimeState(): ProfileMediaRuntimeState {
  return {
    downloads: new Map(),
    pendingPath: undefined,
    uploadTail: Promise.resolve(),
  };
}

function getProfileMediaRuntimeState(): ProfileMediaRuntimeState {
  if (typeof getApp !== 'function') return fallbackRuntimeState;
  try {
    const globalData = getApp<ProfileMediaApp>().globalData;
    if (globalData === undefined) return fallbackRuntimeState;
    const existing = globalData.profileMediaRuntimeState;
    if (existing !== undefined) return existing;
    const created = createProfileMediaRuntimeState();
    globalData.profileMediaRuntimeState = created;
    return created;
  } catch {
    return fallbackRuntimeState;
  }
}

function takePendingProfileAvatar(): string | undefined {
  const runtimeState = getProfileMediaRuntimeState();
  const selectedPath = runtimeState.pendingPath;
  runtimeState.pendingPath = undefined;
  return selectedPath;
}

async function uploadProfileAvatar(
  ownerId: string,
  selectedPath: string,
  getAccessToken: () => string | undefined,
  authentication: RuntimeWechatRequestAuthentication | undefined,
): Promise<ProfileAvatarFlushResult> {
  try {
    assertOwnerId(ownerId);
    const image = await readValidatedProfileImage(selectedPath);
    const requestAuthentication = await createRequestAuthentication(getAccessToken, authentication);
    const response = await executeWxJsonRequest({
      authentication: requestAuthentication,
      capability: 'core',
      data: image.bytes,
      header: { 'content-type': image.contentType },
      method: 'PUT',
      request: (requestOptions) => getWxBridge().request(requestOptions),
      url: `${apiBaseUrl()}/users/me/avatar`,
    });
    const avatarVersion = decodeAvatarVersion(response.data, response.statusCode);
    const cachedPath = await persistProfileAvatar(ownerId, avatarVersion, image);
    return {
      avatarVersion,
      localPath: cachedPath ?? selectedPath,
      status: 'uploaded',
    };
  } catch {
    return { message: '本次头像未更新。', status: 'failed' };
  }
}

async function resolveProfileAvatar(
  ownerId: string,
  avatarVersion: number | undefined,
  getAccessToken: () => string | undefined,
  authentication: RuntimeWechatRequestAuthentication | undefined,
): Promise<string | undefined> {
  assertOwnerId(ownerId);
  if (avatarVersion === undefined) {
    clearLocalProfileAvatar(ownerId);
    return undefined;
  }
  if (!Number.isInteger(avatarVersion) || avatarVersion < 1) {
    clearLocalProfileAvatar(ownerId);
    return undefined;
  }
  const cached = await readCachedProfileAvatar(ownerId, avatarVersion);
  if (cached !== undefined) return cached;

  const runtimeState = getProfileMediaRuntimeState();
  const key = `${ownerId}:${avatarVersion}`;
  const existing = runtimeState.downloads.get(key);
  if (existing !== undefined) return existing;
  const download = downloadProfileAvatar(
    ownerId,
    avatarVersion,
    getAccessToken,
    authentication,
  ).finally(() => {
    if (runtimeState.downloads.get(key) === download) runtimeState.downloads.delete(key);
  });
  runtimeState.downloads.set(key, download);
  return download;
}

async function downloadProfileAvatar(
  ownerId: string,
  avatarVersion: number,
  getAccessToken: () => string | undefined,
  authentication: RuntimeWechatRequestAuthentication | undefined,
): Promise<string | undefined> {
  const requestAuthentication = await createRequestAuthentication(getAccessToken, authentication);
  let responseGeneration = authentication?.getSessionGeneration();
  let accessToken = requestAuthentication.accessToken;
  let result = await downloadProfileAvatarOnce(accessToken);
  if (result.statusCode === 401 && authentication?.recoverAccessToken !== undefined) {
    const recoveredToken = await authentication.recoverAccessToken(accessToken);
    if (recoveredToken !== undefined && recoveredToken.length > 0) {
      accessToken = recoveredToken;
      responseGeneration = authentication.getSessionGeneration?.();
      result = await downloadProfileAvatarOnce(accessToken);
    }
  }
  if (result.statusCode === 401) {
    authentication?.finalizeUnauthorized?.(accessToken);
    throw new ProfileMediaError('登录状态已失效，请重新登录。');
  }
  if (result.statusCode === 404) {
    clearLocalProfileAvatar(ownerId);
    return undefined;
  }
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new ProfileMediaError('头像暂时无法加载。');
  }
  if (
    responseGeneration !== undefined &&
    authentication?.getSessionGeneration !== undefined &&
    authentication.getSessionGeneration() !== responseGeneration
  ) {
    throw new ProfileMediaError('头像暂时无法加载。');
  }
  const tempFilePath = readDownloadedFilePath(result);
  const image = await readValidatedProfileImage(tempFilePath);
  const responseContentType = readResponseContentType(result.header);
  if (responseContentType === undefined || responseContentType !== image.contentType) {
    throw new ProfileMediaError('头像暂时无法加载。');
  }
  return (await persistProfileAvatar(ownerId, avatarVersion, image)) ?? tempFilePath;
}

async function downloadProfileAvatarOnce(accessToken: string): Promise<WxDownloadFileSuccess> {
  const bridge = getWxBridge();
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => settleFailure(), BRIDGE_TIMEOUT_MS);
    const settleFailure = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ProfileMediaError('头像暂时无法加载。'));
    };
    const settleSuccess = (result: WxDownloadFileSuccess): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    try {
      bridge.downloadFile({
        fail: settleFailure,
        header: clientHeaders(accessToken),
        success: settleSuccess,
        timeout: BRIDGE_TIMEOUT_MS,
        url: `${apiBaseUrl()}/users/me/avatar`,
      });
    } catch {
      settleFailure();
    }
  });
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
    throw new ProfileMediaError('登录状态已失效，请重新登录。');
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

async function readValidatedProfileImage(filePath: string): Promise<ValidatedProfileImage> {
  if (!isUsableIdentifier(filePath)) throw new ProfileMediaError('头像文件无效。');
  const fileSystem = getWxBridge().getFileSystemManager();
  const size = await getFileSize(fileSystem, filePath);
  if (!Number.isInteger(size) || size < 1 || size > MAX_AVATAR_BYTES) {
    throw new ProfileMediaError('头像文件无效。');
  }
  const bytes = await readFileBytes(fileSystem, filePath);
  if (bytes.byteLength !== size || bytes.byteLength < 1 || bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new ProfileMediaError('头像文件无效。');
  }
  const detected = detectProfileImage(bytes);
  if (detected === undefined) throw new ProfileMediaError('头像文件无效。');
  return { bytes, ...detected };
}

function getFileSize(fileSystem: WxFileSystemManager, filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => settleFailure(), BRIDGE_TIMEOUT_MS);
    const settleFailure = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ProfileMediaError('头像文件无效。'));
    };
    try {
      fileSystem.getFileInfo({
        fail: settleFailure,
        filePath,
        success: ({ size }) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(size);
        },
      });
    } catch {
      settleFailure();
    }
  });
}

function readFileBytes(fileSystem: WxFileSystemManager, filePath: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => settleFailure(), BRIDGE_TIMEOUT_MS);
    const settleFailure = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ProfileMediaError('头像文件无效。'));
    };
    try {
      fileSystem.readFile({
        fail: settleFailure,
        filePath,
        success: ({ data }) => {
          if (settled) return;
          if (!(data instanceof ArrayBuffer)) {
            settleFailure();
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(data);
        },
      });
    } catch {
      settleFailure();
    }
  });
}

function detectProfileImage(
  bytes: ArrayBuffer,
): Pick<ValidatedProfileImage, 'contentType' | 'extension'> | undefined {
  const value = new Uint8Array(bytes);
  if (value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    value.length >= 8 &&
    value[0] === 0x89 &&
    value[1] === 0x50 &&
    value[2] === 0x4e &&
    value[3] === 0x47 &&
    value[4] === 0x0d &&
    value[5] === 0x0a &&
    value[6] === 0x1a &&
    value[7] === 0x0a
  ) {
    return { contentType: 'image/png', extension: 'png' };
  }
  if (
    value.length >= 12 &&
    value[0] === 0x52 &&
    value[1] === 0x49 &&
    value[2] === 0x46 &&
    value[3] === 0x46 &&
    value[8] === 0x57 &&
    value[9] === 0x45 &&
    value[10] === 0x42 &&
    value[11] === 0x50
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return undefined;
}

async function persistProfileAvatar(
  ownerId: string,
  avatarVersion: number,
  image: ValidatedProfileImage,
): Promise<string | undefined> {
  const oldEntry = readCacheEntry(ownerId);
  const filePath = getAvatarFilePath(ownerId, avatarVersion, image.extension);
  try {
    await writeFileBytes(getWxBridge().getFileSystemManager(), filePath, image.bytes);
  } catch {
    return undefined;
  }
  const stored = writeStorage(getCacheKey(ownerId), {
    avatarVersion,
    contentType: image.contentType,
    filePath,
    ownerId,
  } satisfies ProfileAvatarCacheEntry);
  if (!stored) {
    unlinkPrivateAvatarFileSync(filePath);
    return undefined;
  }
  if (oldEntry !== undefined && oldEntry.filePath !== filePath) {
    unlinkPrivateAvatarFileSync(oldEntry.filePath);
  }
  return filePath;
}

function writeFileBytes(
  fileSystem: WxFileSystemManager,
  filePath: string,
  bytes: ArrayBuffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => settleFailure(), BRIDGE_TIMEOUT_MS);
    const settleFailure = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ProfileMediaError('头像缓存不可用。'));
    };
    try {
      fileSystem.writeFile({
        data: bytes,
        fail: settleFailure,
        filePath,
        success: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        },
      });
    } catch {
      settleFailure();
    }
  });
}

async function readCachedProfileAvatar(
  ownerId: string,
  avatarVersion: number,
): Promise<string | undefined> {
  const entry = readCacheEntry(ownerId);
  if (entry === undefined) return undefined;
  if (entry.avatarVersion !== avatarVersion) {
    clearLocalProfileAvatar(ownerId);
    return undefined;
  }
  const exists = await fileExists(entry.filePath);
  if (!exists) {
    removeStorage(getCacheKey(ownerId));
    return undefined;
  }
  return entry.filePath;
}

function readCacheEntry(ownerId: string): ProfileAvatarCacheEntry | undefined {
  const key = getCacheKey(ownerId);
  const stored = readStorage(key);
  if (
    !isRecord(stored) ||
    stored['ownerId'] !== ownerId ||
    typeof stored['avatarVersion'] !== 'number' ||
    !Number.isInteger(stored['avatarVersion']) ||
    stored['avatarVersion'] < 1 ||
    !isProfileAvatarContentType(stored['contentType']) ||
    typeof stored['filePath'] !== 'string'
  ) {
    if (stored !== undefined) removeStorage(key);
    return undefined;
  }
  const extension = extensionForContentType(stored['contentType']);
  const expectedPath = getAvatarFilePath(ownerId, stored['avatarVersion'], extension);
  if (stored['filePath'] !== expectedPath) {
    removeStorage(key);
    return undefined;
  }
  return {
    avatarVersion: stored['avatarVersion'],
    contentType: stored['contentType'],
    filePath: stored['filePath'],
    ownerId,
  };
}

function fileExists(filePath: string): Promise<boolean> {
  const fileSystem = getWxBridge().getFileSystemManager();
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => settle(false), BRIDGE_TIMEOUT_MS);
    const settle = (result: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    try {
      fileSystem.access({ fail: () => settle(false), path: filePath, success: () => settle(true) });
    } catch {
      settle(false);
    }
  });
}

function unlinkPrivateAvatarFileSync(filePath: string): void {
  if (!isPrivateAvatarFilePath(filePath)) return;
  try {
    const fileSystem = getWxBridge().getFileSystemManager();
    if (fileSystem.unlinkSync !== undefined) {
      fileSystem.unlinkSync(filePath);
      return;
    }
    fileSystem.unlink({ fail: () => undefined, filePath, success: () => undefined });
  } catch {
    // Cache cleanup is best effort; metadata is removed even if physical cleanup fails.
  }
}

function getCacheKey(ownerId: string): string {
  return `${PROFILE_AVATAR_CACHE_PREFIX}${encodePathSegment(ownerId)}`;
}

function getAvatarFilePath(
  ownerId: string,
  avatarVersion: number,
  extension: ProfileAvatarExtension,
): string {
  return `${userDataPath()}/${AVATAR_FILE_PREFIX}${encodePathSegment(ownerId)}-${avatarVersion}.${extension}`;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/gu,
    (character) => `%${character.codePointAt(0)?.toString(16).toUpperCase() ?? ''}`,
  );
}

function isPrivateAvatarFilePath(filePath: string): boolean {
  const prefix = `${userDataPath()}/${AVATAR_FILE_PREFIX}`;
  if (!filePath.startsWith(prefix)) return false;
  const name = filePath.slice(prefix.length);
  return /^[A-Za-z0-9%_.~-]+-[1-9]\d*\.(?:jpg|png|webp)$/u.test(name);
}

function userDataPath(): string {
  const value = getWxBridge().env.USER_DATA_PATH.replace(/\/+$/u, '');
  if (value.length === 0) throw new ProfileMediaError('头像缓存不可用。');
  return value;
}

function decodeAvatarVersion(value: unknown, statusCode: number): number {
  if (
    statusCode < 200 ||
    statusCode >= 300 ||
    !isRecord(value) ||
    typeof value['avatarVersion'] !== 'number' ||
    !Number.isInteger(value['avatarVersion']) ||
    value['avatarVersion'] < 1
  ) {
    throw new ProfileMediaError('头像上传响应无效。');
  }
  return value['avatarVersion'];
}

function readDownloadedFilePath(result: WxDownloadFileSuccess): string {
  const value = result.filePath ?? result.tempFilePath;
  if (!isUsableIdentifier(value)) throw new ProfileMediaError('头像暂时无法加载。');
  return value;
}

function readResponseContentType(
  headers: Readonly<Record<string, unknown>> | undefined,
): ProfileAvatarContentType | undefined {
  if (headers === undefined) return undefined;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'content-type' || typeof value !== 'string') continue;
    const normalized = value.split(';', 1)[0]?.trim().toLowerCase();
    return isProfileAvatarContentType(normalized) ? normalized : undefined;
  }
  return undefined;
}

function isProfileAvatarContentType(value: unknown): value is ProfileAvatarContentType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function extensionForContentType(contentType: ProfileAvatarContentType): ProfileAvatarExtension {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  return 'webp';
}

function clientHeaders(accessToken: string): Readonly<Record<string, string>> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Schedule-Client-Platform': 'miniprogram',
    'X-Schedule-Client-Version': buildInfo.buildVersion,
  };
}

function apiBaseUrl(): string {
  return runtimeConfig.apiBaseUrl.replace(/\/$/u, '');
}

function assertOwnerId(ownerId: string): void {
  if (!isUsableIdentifier(ownerId) || ownerId.length > 128) {
    throw new ProfileMediaError('头像账号无效。');
  }
}

function isUsableIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('\0');
}

function readStorageKeys(): readonly string[] {
  try {
    const keys = getWxBridge().getStorageInfoSync().keys;
    return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function readStorage(key: string): unknown {
  try {
    return getWxBridge().getStorageSync(key);
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: unknown): boolean {
  try {
    getWxBridge().setStorageSync(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key: string): void {
  try {
    getWxBridge().removeStorageSync(key);
  } catch {
    // Invalid cache metadata remains unusable even if physical cleanup fails.
  }
}

function getWxBridge(): WxProfileMediaBridge {
  return wx as unknown as WxProfileMediaBridge;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
