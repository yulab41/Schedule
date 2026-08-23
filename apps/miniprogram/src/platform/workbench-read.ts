import type {
  CalendarReadModel,
  GroupRole,
  GroupSummary,
  HolidayReadModel,
} from '@schedule/contracts';
import { requireClientCapability } from '../app/client-capability-store.js';
import { calendarReadModelDecoder, holidayReadModelDecoder } from '@schedule/client-core';

import { runtimeConfig } from './runtime-config.js';
import { createRuntimeCalendarReadClient } from './client-core-calendar.js';
import {
  awaitWechatSessionRecovery,
  finalizeWechatUnauthorized,
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
  getWechatSessionGeneration,
  recoverWechatSession,
} from './wechat-identity.js';
import {
  clearLegacyWorkbenchStorage,
  clearPrivateBusinessStorageForGroup,
  readStorageKeys,
  WORKBENCH_CACHE_V2_PREFIX,
  WORKBENCH_GROUP_SNAPSHOT_V2_PREFIX,
  WORKBENCH_GROUP_STORAGE_KEY,
} from './private-storage.js';
import {
  executeWxJsonRequest,
  WxRequestNetworkError,
  WxRequestStaleSessionError,
} from './wx-request-executor.js';

export const WORKBENCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export { WORKBENCH_GROUP_STORAGE_KEY };

export interface WorkbenchCacheEntry {
  readonly calendar: CalendarReadModel;
  readonly holidays: HolidayReadModel;
  readonly savedAt: number;
}

export interface WorkbenchMember {
  readonly id: string;
  readonly isCurrentUser: boolean;
  readonly realName: string;
  readonly role: GroupRole;
}

export class WorkbenchReadError extends Error {
  public readonly code: 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'HTTP_ERROR';
  public readonly status: number | undefined;

  public constructor(message: string, code: WorkbenchReadError['code'], status?: number) {
    super(message);
    this.name = 'WorkbenchReadError';
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRequiredString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function sanitizeCalendarForCache(calendar: CalendarReadModel): CalendarReadModel {
  return {
    ...calendar,
    members: calendar.members.map((member) => {
      const sanitized = { ...member };
      delete sanitized.mobilePhone;
      return sanitized;
    }),
  };
}

function decodeGroups(value: unknown): readonly GroupSummary[] {
  if (!Array.isArray(value)) {
    throw new WorkbenchReadError('群组响应无效，请稍后重试。', 'INVALID_RESPONSE');
  }
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new WorkbenchReadError('群组响应无效，请稍后重试。', 'INVALID_RESPONSE');
    }
    const id = readRequiredString(item.id);
    const name = readRequiredString(item.name);
    const role = item.role;
    const version = item.version;
    const groupCode = item.groupCode;
    const isDeveloperAdmin = item.isDeveloperAdmin;
    if (
      id === undefined ||
      name === undefined ||
      (role !== 'administrator' && role !== 'member' && role !== 'owner' && role !== 'guest') ||
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      version < 1 ||
      (groupCode !== undefined && (typeof groupCode !== 'string' || !/^\d{4}$/u.test(groupCode))) ||
      (isDeveloperAdmin !== undefined && typeof isDeveloperAdmin !== 'boolean')
    ) {
      throw new WorkbenchReadError('群组响应无效，请稍后重试。', 'INVALID_RESPONSE');
    }
    return {
      ...(groupCode === undefined ? {} : { groupCode }),
      id,
      ...(isDeveloperAdmin === undefined ? {} : { isDeveloperAdmin }),
      name,
      role,
      version,
    } satisfies GroupSummary;
  });
}

function decodeMembers(value: unknown): readonly WorkbenchMember[] {
  if (!Array.isArray(value)) {
    throw new WorkbenchReadError('成员响应无效，请稍后重试。', 'INVALID_RESPONSE');
  }
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new WorkbenchReadError('成员响应无效，请稍后重试。', 'INVALID_RESPONSE');
    }
    const id = readRequiredString(item.id);
    const realName = readRequiredString(item.realName);
    const role = item.role;
    if (
      id === undefined ||
      realName === undefined ||
      typeof item.isCurrentUser !== 'boolean' ||
      (role !== 'administrator' && role !== 'member' && role !== 'owner' && role !== 'guest')
    ) {
      throw new WorkbenchReadError('成员响应无效，请稍后重试。', 'INVALID_RESPONSE');
    }
    return { id, isCurrentUser: item.isCurrentUser, realName, role } satisfies WorkbenchMember;
  });
}

function requestJson(path: string): Promise<unknown> {
  return requestJsonWithSession(path);
}

async function requestJsonWithSession(path: string): Promise<unknown> {
  await requireClientCapability('core');
  let token = getStoredWechatToken();
  if (token === undefined) token = await awaitWechatSessionRecovery();
  if (token === undefined)
    throw new WorkbenchReadError('登录状态已失效，请重新登录。', 'AUTH_REQUIRED', 401);
  const baseUrl = runtimeConfig.apiBaseUrl.replace(/\/$/u, '');
  let response;
  try {
    response = await executeWxJsonRequest({
      authentication: {
        accessToken: token,
        finalizeUnauthorized: finalizeWechatUnauthorized,
        getSessionGeneration: getWechatSessionGeneration,
        recoverAccessToken: recoverWechatSession,
        sessionGeneration: getWechatSessionGeneration(),
      },
      capability: 'core',
      method: 'GET',
      request: (requestOptions) => wx.request(requestOptions),
      url: `${baseUrl}${path}`,
    });
  } catch (error) {
    if (error instanceof WxRequestNetworkError) {
      throw new WorkbenchReadError('网络连接失败，请稍后重试。', 'NETWORK_ERROR');
    }
    if (error instanceof WxRequestStaleSessionError) {
      throw new WorkbenchReadError('登录状态已变化，请重新读取。', 'AUTH_REQUIRED', 401);
    }
    throw error;
  }
  if (response.statusCode === 401) {
    throw new WorkbenchReadError('登录状态已失效，请重新登录。', 'AUTH_REQUIRED', 401);
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new WorkbenchReadError(
      response.statusCode === 403
        ? '当前账户无权查看这项排班。'
        : '排班数据暂时无法加载，请稍后重试。',
      'HTTP_ERROR',
      response.statusCode,
    );
  }
  return response.data;
}

export function createWorkbenchReadClient(): {
  readonly getCalendar: (groupId: string, businessMonth: string) => Promise<CalendarReadModel>;
  readonly getMembers: (groupId: string) => Promise<readonly WorkbenchMember[]>;
  readonly getHolidays: (year: number) => Promise<HolidayReadModel>;
  readonly listGroups: () => Promise<readonly GroupSummary[]>;
} {
  const calendarClient = createRuntimeCalendarReadClient(
    getStoredWechatToken,
    getWechatRequestAuthentication(),
  );
  return {
    getCalendar: (groupId, businessMonth) => calendarClient.getCalendar(groupId, businessMonth),
    getMembers: async (groupId) =>
      decodeMembers(await requestJson(`/groups/${encodeURIComponent(groupId)}/members`)),
    getHolidays: (year) => calendarClient.getHolidays(year),
    listGroups: async () => {
      const groups = decodeGroups(await requestJson('/groups'));
      const ownerId = getStoredWechatProfile()?.id;
      if (ownerId !== undefined) {
        writeWorkbenchGroupSnapshot(ownerId, groups);
        pruneWorkbenchCaches(ownerId, new Set(groups.map((group) => group.id)));
      }
      return groups;
    },
  };
}

export function getWorkbenchCacheKey(
  ownerId: string,
  groupId: string,
  businessMonth: string,
): string {
  return `${WORKBENCH_CACHE_V2_PREFIX}${ownerId}:${groupId}:${businessMonth}`;
}

export function readWorkbenchCache(
  ownerId: string,
  groupId: string,
  businessMonth: string,
  now = Date.now(),
): WorkbenchCacheEntry | undefined {
  clearLegacyWorkbenchStorage();
  const key = getWorkbenchCacheKey(ownerId, groupId, businessMonth);
  const value = readStorage(key);
  if (!isRecord(value)) {
    if (value !== undefined) removeStorage(key);
    return undefined;
  }
  const savedAt = value.savedAt;
  const calendar = value.calendar;
  const holidays = value.holidays;
  if (
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt > now ||
    now - savedAt >= WORKBENCH_CACHE_TTL_MS ||
    !isRecord(calendar) ||
    !isRecord(holidays)
  ) {
    removeStorage(key);
    return undefined;
  }
  const decodedCalendar = calendarReadModelDecoder.safeDecode(calendar);
  const decodedHolidays = holidayReadModelDecoder.safeDecode(holidays);
  if (
    !decodedCalendar.success ||
    !decodedHolidays.success ||
    decodedCalendar.data.groupId !== groupId ||
    decodedCalendar.data.businessMonth !== businessMonth
  ) {
    removeStorage(key);
    return undefined;
  }
  return {
    calendar: sanitizeCalendarForCache(decodedCalendar.data),
    holidays: decodedHolidays.data,
    savedAt,
  };
}

export function writeWorkbenchCache(
  ownerId: string,
  groupId: string,
  businessMonth: string,
  calendar: CalendarReadModel,
  holidays: HolidayReadModel,
  now = Date.now(),
): void {
  if (calendar.groupId !== groupId || calendar.businessMonth !== businessMonth) return;
  clearLegacyWorkbenchStorage();
  writeStorage(getWorkbenchCacheKey(ownerId, groupId, businessMonth), {
    calendar: sanitizeCalendarForCache(calendar),
    holidays,
    savedAt: now,
  } satisfies WorkbenchCacheEntry);
}

export function writeWorkbenchGroupSnapshot(
  ownerId: string,
  groups: readonly GroupSummary[],
  now = Date.now(),
): void {
  clearLegacyWorkbenchStorage();
  const sanitizedGroups = groups.map((group) => {
    const sanitized = { ...group };
    delete sanitized.groupCode;
    return sanitized;
  });
  writeStorage(getWorkbenchGroupSnapshotKey(ownerId), { groups: sanitizedGroups, savedAt: now });
}

export function readWorkbenchGroupSnapshot(
  ownerId: string,
  now = Date.now(),
): readonly GroupSummary[] | undefined {
  clearLegacyWorkbenchStorage();
  const key = getWorkbenchGroupSnapshotKey(ownerId);
  const value = readStorage(key);
  if (!isRecord(value)) {
    if (value !== undefined) removeStorage(key);
    return undefined;
  }
  const savedAt = value.savedAt;
  if (
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt > now ||
    now - savedAt >= WORKBENCH_CACHE_TTL_MS
  ) {
    removeStorage(key);
    return undefined;
  }
  try {
    return decodeGroups(value.groups);
  } catch {
    removeStorage(key);
    return undefined;
  }
}

export function pruneWorkbenchCaches(ownerId: string, activeGroupIds: ReadonlySet<string>): void {
  clearLegacyWorkbenchStorage();
  const ownerPrefix = `${WORKBENCH_CACHE_V2_PREFIX}${ownerId}:`;
  for (const key of readStorageKeys()) {
    if (!key.startsWith(ownerPrefix)) continue;
    const groupId = key.slice(ownerPrefix.length).split(':', 1)[0];
    if (groupId !== undefined && !activeGroupIds.has(groupId)) {
      clearPrivateBusinessStorageForGroup(ownerId, groupId);
    }
  }
  const selectedGroupId = readStoredWorkbenchGroupId(ownerId);
  if (selectedGroupId !== undefined && !activeGroupIds.has(selectedGroupId)) {
    clearPrivateBusinessStorageForGroup(ownerId, selectedGroupId);
  }
}

export function clearWorkbenchGroupCaches(ownerId: string, groupId: string): void {
  clearPrivateBusinessStorageForGroup(ownerId, groupId);
  const groups = readWorkbenchGroupSnapshot(ownerId);
  if (groups === undefined) return;
  const remaining = groups.filter((group) => group.id !== groupId);
  if (remaining.length === 0) removeStorage(getWorkbenchGroupSnapshotKey(ownerId));
  else writeWorkbenchGroupSnapshot(ownerId, remaining);
}

export function readStoredWorkbenchGroupId(ownerId: string): string | undefined {
  const value = readStorage(WORKBENCH_GROUP_STORAGE_KEY);
  if (!isRecord(value) || value.ownerId !== ownerId) return undefined;
  return readRequiredString(value.groupId);
}

export function writeStoredWorkbenchGroupId(ownerId: string, groupId: string): void {
  writeStorage(WORKBENCH_GROUP_STORAGE_KEY, { groupId, ownerId });
}

export function canUseWorkbenchOfflineFallback(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === 'NETWORK_ERROR') return true;
  return error.status === 502 || error.status === 503 || error.status === 504;
}

export function loadActiveThenAdjacent<T>(
  keys: readonly string[],
  activeKey: string,
  load: (key: string) => Promise<T>,
): { readonly active: Promise<T>; readonly adjacent: Promise<readonly T[]> } {
  const active = load(activeKey);
  const adjacentKeys = [...new Set(keys)].filter((key) => key !== activeKey);
  const adjacent = active.then(
    async () => {
      await Promise.resolve();
      const results = await Promise.allSettled(adjacentKeys.map((key) => load(key)));
      const fatal = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected' && !canUseWorkbenchOfflineFallback(result.reason),
      );
      if (fatal !== undefined) throw fatal.reason;
      return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    },
    () => [],
  );
  return { active, adjacent };
}

function getWorkbenchGroupSnapshotKey(ownerId: string): string {
  return `${WORKBENCH_GROUP_SNAPSHOT_V2_PREFIX}${ownerId}`;
}

function readStorage(key: string): unknown {
  try {
    return wx.getStorageSync(key);
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    wx.setStorageSync(key, value);
  } catch {
    // A storage quota failure must never turn a successful online read into an error.
  }
}

function removeStorage(key: string): void {
  try {
    wx.removeStorageSync(key);
  } catch {
    // Invalid private cache entries remain unusable even if physical cleanup fails.
  }
}
