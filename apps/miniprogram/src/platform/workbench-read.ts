import type {
  CalendarReadModel,
  GroupRole,
  GroupSummary,
  HolidayReadModel,
} from '@schedule/contracts';
import { calendarReadModelDecoder, holidayReadModelDecoder } from '@schedule/client-core';

import { runtimeConfig } from './runtime-config.js';
import { createRuntimeCalendarReadClient } from './client-core-calendar.js';
import { getStoredWechatToken } from './wechat-identity.js';

export const WORKBENCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const WORKBENCH_GROUP_STORAGE_KEY = 'schedule.wechat.workbench.current-group';

const WORKBENCH_CACHE_KEY_PREFIX = 'schedule.wechat.workbench.cache.v1:';

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

interface WorkbenchRequestOptions {
  readonly fail: (error: unknown) => void;
  readonly header: Readonly<Record<string, string>>;
  readonly method: 'GET';
  readonly success: (response: { readonly data: unknown; readonly statusCode: number }) => void;
  readonly url: string;
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
  const token = getStoredWechatToken();
  if (token === undefined) {
    return Promise.reject(
      new WorkbenchReadError('登录状态已失效，请重新登录。', 'AUTH_REQUIRED', 401),
    );
  }
  const baseUrl = runtimeConfig.apiBaseUrl.replace(/\/$/u, '');
  return new Promise((resolve, reject) => {
    try {
      const options: WorkbenchRequestOptions = {
        fail: () => reject(new WorkbenchReadError('网络连接失败，请稍后重试。', 'NETWORK_ERROR')),
        header: { Authorization: `Bearer ${token}` },
        method: 'GET',
        success: (response) => {
          if (response.statusCode === 401) {
            reject(new WorkbenchReadError('登录状态已失效，请重新登录。', 'AUTH_REQUIRED', 401));
            return;
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new WorkbenchReadError(
                '排班数据暂时无法加载，请稍后重试。',
                'HTTP_ERROR',
                response.statusCode,
              ),
            );
            return;
          }
          resolve(response.data);
        },
        url: `${baseUrl}${path}`,
      };
      wx.request(options);
    } catch {
      reject(new WorkbenchReadError('网络连接失败，请稍后重试。', 'NETWORK_ERROR'));
    }
  });
}

export function createWorkbenchReadClient(): {
  readonly getCalendar: (groupId: string, businessMonth: string) => Promise<CalendarReadModel>;
  readonly getMembers: (groupId: string) => Promise<readonly WorkbenchMember[]>;
  readonly getHolidays: (year: number) => Promise<HolidayReadModel>;
  readonly listGroups: () => Promise<readonly GroupSummary[]>;
} {
  const calendarClient = createRuntimeCalendarReadClient(getStoredWechatToken);
  return {
    getCalendar: (groupId, businessMonth) => calendarClient.getCalendar(groupId, businessMonth),
    getMembers: async (groupId) =>
      decodeMembers(await requestJson(`/groups/${encodeURIComponent(groupId)}/members`)),
    getHolidays: (year) => calendarClient.getHolidays(year),
    listGroups: async () => decodeGroups(await requestJson('/groups')),
  };
}

export function getWorkbenchCacheKey(groupId: string, businessMonth: string): string {
  return `${WORKBENCH_CACHE_KEY_PREFIX}${groupId}:${businessMonth}`;
}

export function readWorkbenchCache(
  groupId: string,
  businessMonth: string,
  now = Date.now(),
): WorkbenchCacheEntry | undefined {
  const value = wx.getStorageSync(getWorkbenchCacheKey(groupId, businessMonth));
  if (!isRecord(value)) return undefined;
  const savedAt = value.savedAt;
  const calendar = value.calendar;
  const holidays = value.holidays;
  if (
    typeof savedAt !== 'number' ||
    now - savedAt >= WORKBENCH_CACHE_TTL_MS ||
    !isRecord(calendar) ||
    !isRecord(holidays)
  ) {
    return undefined;
  }
  const decodedCalendar = calendarReadModelDecoder.safeDecode(calendar);
  const decodedHolidays = holidayReadModelDecoder.safeDecode(holidays);
  if (!decodedCalendar.success || !decodedHolidays.success) return undefined;
  return {
    calendar: decodedCalendar.data,
    holidays: decodedHolidays.data,
    savedAt,
  };
}

export function writeWorkbenchCache(
  groupId: string,
  businessMonth: string,
  calendar: CalendarReadModel,
  holidays: HolidayReadModel,
  now = Date.now(),
): void {
  wx.setStorageSync(getWorkbenchCacheKey(groupId, businessMonth), {
    calendar: sanitizeCalendarForCache(calendar),
    holidays,
    savedAt: now,
  } satisfies WorkbenchCacheEntry);
}
