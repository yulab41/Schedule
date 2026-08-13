import type { CalendarReadModel, GroupRole, HolidayReadModel } from '@schedule/contracts';

import { parseBusinessDate, parseBusinessMonth } from '../features/calendar/calendar-logic.js';
import { isCalendarReadModel, isHolidayReadModel } from './calendar-cache-validation.js';

export const calendarCacheKeyPrefix = 'schedule.calendarCache.v1:';
export const calendarCacheRegistryKeyPrefix = 'schedule.calendarCache.v1:index:';
export const calendarCacheFreshnessMilliseconds = 5 * 60 * 1000;

export interface CalendarCacheIdentity {
  readonly businessMonth: string;
  readonly groupId: string;
  readonly groupRole: GroupRole;
  readonly groupVersion: number;
  readonly userId: string;
}

export interface CalendarCacheRecord {
  readonly calendar: CalendarReadModel;
  readonly holidays: HolidayReadModel;
  readonly identity: CalendarCacheIdentity;
  readonly savedAt: string;
  readonly schemaVersion: 1;
}

export interface CalendarCachePort {
  getStorageSync(key: string): unknown;
  removeStorageSync(key: string): void;
  setStorageSync(key: string, value: unknown): void;
}

function assertIdentity(identity: CalendarCacheIdentity): void {
  if (
    typeof identity.userId !== 'string' ||
    identity.userId.length === 0 ||
    typeof identity.groupId !== 'string' ||
    identity.groupId.length === 0 ||
    !['administrator', 'member', 'owner', 'guest'].includes(identity.groupRole) ||
    !Number.isInteger(identity.groupVersion) ||
    identity.groupVersion <= 0
  ) {
    throw new Error('Calendar cache identity is invalid.');
  }
  parseBusinessMonth(identity.businessMonth);
}

export function buildCalendarCacheKey(identity: CalendarCacheIdentity): string {
  assertIdentity(identity);
  return `${calendarCacheKeyPrefix}${encodeURIComponent(identity.userId)}:${encodeURIComponent(identity.groupId)}:${identity.groupRole}:${identity.groupVersion}:${identity.businessMonth}`;
}

export function buildCalendarCacheRegistryKey(userId: string): string {
  if (typeof userId !== 'string' || userId.length === 0)
    throw new Error('Calendar cache userId is invalid.');
  return `${calendarCacheRegistryKeyPrefix}${encodeURIComponent(userId)}`;
}

export function isCalendarCacheFresh(record: CalendarCacheRecord, now = new Date()): boolean {
  const savedAt = new Date(record.savedAt);
  if (Number.isNaN(savedAt.getTime())) {
    return false;
  }
  const age = now.getTime() - savedAt.getTime();
  return age >= 0 && age <= calendarCacheFreshnessMilliseconds;
}

function matchesIdentity(left: CalendarCacheIdentity, right: CalendarCacheIdentity): boolean {
  return (
    left.businessMonth === right.businessMonth &&
    left.groupId === right.groupId &&
    left.groupRole === right.groupRole &&
    left.groupVersion === right.groupVersion &&
    left.userId === right.userId
  );
}

function dataMatchesIdentity(
  identity: CalendarCacheIdentity,
  calendar: CalendarReadModel,
  holidays: HolidayReadModel,
): boolean {
  if (calendar.groupId !== identity.groupId || calendar.businessMonth !== identity.businessMonth) {
    return false;
  }
  const { year } = parseBusinessMonth(identity.businessMonth);
  if (holidays.year !== year) return false;
  try {
    return holidays.dates.every(({ date }) => parseBusinessDate(date).year === year);
  } catch {
    return false;
  }
}

export interface CalendarCache {
  read(identity: CalendarCacheIdentity): CalendarCacheRecord | undefined;
  write(
    identity: CalendarCacheIdentity,
    calendar: CalendarReadModel,
    holidays: HolidayReadModel,
    now?: Date,
  ): void;
  remove(identity: CalendarCacheIdentity): void;
  removeForUser(userId: string): void;
  removeForUserGroup(userId: string, groupId: string): void;
}

export function removeCalendarCacheMonths(
  cache: Pick<CalendarCache, 'remove'>,
  context: Omit<CalendarCacheIdentity, 'businessMonth'>,
  businessMonths: readonly string[],
): void {
  for (const businessMonth of new Set(businessMonths)) cache.remove({ ...context, businessMonth });
}

export function createCalendarCache(port: CalendarCachePort): CalendarCache {
  const readRegistry = (userId: string): CalendarCacheIdentity[] => {
    let value: unknown;
    try {
      value = port.getStorageSync(buildCalendarCacheRegistryKey(userId));
    } catch {
      return [];
    }
    if (!Array.isArray(value)) return [];
    const identities: CalendarCacheIdentity[] = [];
    for (const candidate of value) {
      if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue;
      try {
        assertIdentity(candidate as CalendarCacheIdentity);
      } catch {
        continue;
      }
      const identity = candidate as CalendarCacheIdentity;
      if (identity.userId === userId) identities.push(identity);
    }
    return identities;
  };
  const writeRegistry = (userId: string, identities: readonly CalendarCacheIdentity[]): void => {
    try {
      const key = buildCalendarCacheRegistryKey(userId);
      if (identities.length === 0) port.removeStorageSync(key);
      else port.setStorageSync(key, identities);
    } catch {
      return;
    }
  };
  const removeStoredIdentity = (identity: CalendarCacheIdentity): void => {
    try {
      port.removeStorageSync(buildCalendarCacheKey(identity));
    } catch {
      return;
    }
  };
  const withoutIdentity = (
    identities: readonly CalendarCacheIdentity[],
    target: CalendarCacheIdentity,
  ): CalendarCacheIdentity[] => identities.filter((identity) => !matchesIdentity(identity, target));

  return {
    read(identity) {
      assertIdentity(identity);
      let value: unknown;
      try {
        value = port.getStorageSync(buildCalendarCacheKey(identity));
      } catch {
        return undefined;
      }
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return undefined;
      }
      const candidate = value as Record<string, unknown>;
      if (candidate.schemaVersion !== 1 || typeof candidate.savedAt !== 'string') {
        return undefined;
      }
      if (
        typeof candidate.identity !== 'object' ||
        candidate.identity === null ||
        Array.isArray(candidate.identity) ||
        !matchesIdentity(candidate.identity as CalendarCacheIdentity, identity)
      ) {
        return undefined;
      }
      if (!isCalendarReadModel(candidate.calendar)) {
        return undefined;
      }
      if (!isHolidayReadModel(candidate.holidays)) {
        return undefined;
      }
      if (
        !dataMatchesIdentity(
          identity,
          candidate.calendar as CalendarReadModel,
          candidate.holidays as HolidayReadModel,
        )
      ) {
        removeStoredIdentity(identity);
        writeRegistry(identity.userId, withoutIdentity(readRegistry(identity.userId), identity));
        return undefined;
      }
      return candidate as unknown as CalendarCacheRecord;
    },
    remove(identity) {
      assertIdentity(identity);
      removeStoredIdentity(identity);
      writeRegistry(identity.userId, withoutIdentity(readRegistry(identity.userId), identity));
    },
    removeForUser(userId) {
      const identities = readRegistry(userId);
      for (const identity of identities) removeStoredIdentity(identity);
      writeRegistry(userId, []);
    },
    removeForUserGroup(userId, groupId) {
      if (typeof groupId !== 'string' || groupId.length === 0)
        throw new Error('Calendar cache groupId is invalid.');
      const identities = readRegistry(userId);
      const toRemove = identities.filter((identity) => identity.groupId === groupId);
      for (const identity of toRemove) removeStoredIdentity(identity);
      writeRegistry(
        userId,
        identities.filter((identity) => identity.groupId !== groupId),
      );
    },
    write(identity, calendar, holidays, now = new Date()) {
      assertIdentity(identity);
      if (!dataMatchesIdentity(identity, calendar, holidays)) {
        return;
      }
      const record: CalendarCacheRecord = {
        calendar,
        holidays,
        identity,
        savedAt: now.toISOString(),
        schemaVersion: 1,
      };
      try {
        port.setStorageSync(buildCalendarCacheKey(identity), record);
      } catch {
        return;
      }
      const registry = readRegistry(identity.userId);
      writeRegistry(identity.userId, [...withoutIdentity(registry, identity), identity]);
    },
  };
}
