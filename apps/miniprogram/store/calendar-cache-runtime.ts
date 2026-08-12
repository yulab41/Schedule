import type { CalendarCache, CalendarCacheIdentity } from './calendar-cache.js';
import { createCalendarCache, removeCalendarCacheMonths } from './calendar-cache.js';
import {
  calendarInvalidationRegistry,
  type CalendarInvalidationRegistry,
} from './calendar-invalidation.js';

export interface CalendarCacheRuntime {
  readonly cache: CalendarCache;
  invalidate(identity: CalendarCacheIdentity): number;
  removeForUser(userId: string): void;
  removeForUserGroup(userId: string, groupId: string): void;
}

export interface CalendarCacheRuntimeOptions {
  readonly cache: CalendarCache;
  readonly registry: CalendarInvalidationRegistry;
}

export function createCalendarCacheRuntime(
  options: CalendarCacheRuntimeOptions,
): CalendarCacheRuntime {
  return {
    cache: options.cache,
    invalidate(identity) {
      removeCalendarCacheMonths(options.cache, identity, [identity.businessMonth]);
      return options.registry.invalidate(identity);
    },
    removeForUser(userId) {
      options.cache.removeForUser(userId);
    },
    removeForUserGroup(userId, groupId) {
      options.cache.removeForUserGroup(userId, groupId);
    },
  };
}

let sharedRuntime: CalendarCacheRuntime | undefined;

export function getCalendarCacheRuntime(): CalendarCacheRuntime {
  if (sharedRuntime !== undefined) return sharedRuntime;
  const cache = createCalendarCache({
    getStorageSync: (key) => wx.getStorageSync(key),
    removeStorageSync: (key) => wx.removeStorageSync(key),
    setStorageSync: (key, value) => wx.setStorageSync(key, value),
  });
  sharedRuntime = createCalendarCacheRuntime({ cache, registry: calendarInvalidationRegistry });
  return sharedRuntime;
}
