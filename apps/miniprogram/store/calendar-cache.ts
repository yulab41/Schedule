import type { CalendarReadModel, GroupRole, HolidayReadModel } from '@schedule/contracts';

import { parseBusinessMonth } from '../features/calendar/calendar-logic.js';
import { isCalendarReadModel, isHolidayReadModel } from './calendar-cache-validation.js';

export const calendarCacheKeyPrefix = 'schedule.calendarCache.v1:';
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

export interface CalendarCache {
  read(identity: CalendarCacheIdentity): CalendarCacheRecord | undefined;
  write(
    identity: CalendarCacheIdentity,
    calendar: CalendarReadModel,
    holidays: HolidayReadModel,
    now?: Date,
  ): void;
  remove(identity: CalendarCacheIdentity): void;
}

export function createCalendarCache(port: CalendarCachePort): CalendarCache {
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
      return candidate as unknown as CalendarCacheRecord;
    },
    remove(identity) {
      assertIdentity(identity);
      try {
        port.removeStorageSync(buildCalendarCacheKey(identity));
      } catch {
        return;
      }
    },
    write(identity, calendar, holidays, now = new Date()) {
      assertIdentity(identity);
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
    },
  };
}
