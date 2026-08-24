import type {
  CalendarReadModel,
  GroupRole,
  GroupSummary,
  HolidayReadModel,
} from '@schedule/contracts';
import {
  calendarReadModelDecoder,
  groupSummaryListDecoder,
  holidayReadModelDecoder,
} from '@schedule/client-core';

import {
  createRuntimeCalendarReadClient,
  createRuntimeOrganizationReadClient,
} from './client-core-calendar.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from './wechat-identity.js';
import {
  clearLegacyWorkbenchStorage,
  clearPrivateBusinessStorageForGroup,
  readStorageKeys,
  WORKBENCH_CACHE_V2_PREFIX,
  WORKBENCH_GROUP_SNAPSHOT_V2_PREFIX,
  WORKBENCH_GROUP_STORAGE_KEY,
} from './private-storage.js';

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

export function createWorkbenchReadClient(): {
  readonly getCalendar: (groupId: string, businessMonth: string) => Promise<CalendarReadModel>;
  readonly getMembers: (groupId: string) => Promise<readonly WorkbenchMember[]>;
  readonly getHolidays: (year: number) => Promise<HolidayReadModel>;
  readonly listGroups: () => Promise<readonly GroupSummary[]>;
} {
  const authentication = getWechatRequestAuthentication();
  const calendarClient = createRuntimeCalendarReadClient(getStoredWechatToken, authentication);
  const organizationReadClient = createRuntimeOrganizationReadClient(
    getStoredWechatToken,
    authentication,
  );
  return {
    getCalendar: (groupId, businessMonth) => calendarClient.getCalendar(groupId, businessMonth),
    getMembers: async (groupId) =>
      (await organizationReadClient.listGroupMembers(groupId)).map(
        ({ id, isCurrentUser, realName, role }) => ({ id, isCurrentUser, realName, role }),
      ),
    getHolidays: (year) => calendarClient.getHolidays(year),
    listGroups: async () => {
      const groups = await organizationReadClient.listGroups();
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
  const decodedGroups = groupSummaryListDecoder.safeDecode(value.groups);
  if (!decodedGroups.success) {
    removeStorage(key);
    return undefined;
  }
  return decodedGroups.data;
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
