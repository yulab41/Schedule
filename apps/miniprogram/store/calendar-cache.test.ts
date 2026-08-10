import { describe, expect, it } from 'vitest';

import { goldenCalendar, goldenHolidays } from '../features/calendar/calendar-golden-data.js';
import {
  buildCalendarCacheKey,
  calendarCacheFreshnessMilliseconds,
  createCalendarCache,
  isCalendarCacheFresh,
  type CalendarCacheIdentity,
} from './calendar-cache.js';

const identity: CalendarCacheIdentity = {
  businessMonth: '2026-08',
  groupId: 'group:1',
  groupRole: 'member',
  groupVersion: 7,
  userId: 'user:1',
};

describe('calendar read cache', () => {
  it('isolates identity, validates freshness, and round-trips read-only data', () => {
    const storage = new Map<string, unknown>();
    const port = {
      getStorageSync: (key: string) => storage.get(key),
      removeStorageSync: (key: string) => storage.delete(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    };
    const cache = createCalendarCache(port);
    const now = new Date('2026-08-10T00:00:00.000Z');

    cache.write(identity, goldenCalendar, goldenHolidays, now);
    const record = cache.read(identity);
    expect(record).toMatchObject({ identity, savedAt: now.toISOString(), schemaVersion: 1 });
    expect(record?.calendar).toBe(goldenCalendar);
    expect(buildCalendarCacheKey(identity)).toContain('user%3A1:group%3A1:member:7:2026-08');
    expect(buildCalendarCacheKey({ ...identity, groupVersion: 8 })).not.toBe(
      buildCalendarCacheKey(identity),
    );
    expect(
      isCalendarCacheFresh(record!, new Date(now.getTime() + calendarCacheFreshnessMilliseconds)),
    ).toBe(true);
    expect(
      isCalendarCacheFresh(
        record!,
        new Date(now.getTime() + calendarCacheFreshnessMilliseconds + 1),
      ),
    ).toBe(false);
  });

  it('rejects corrupt storage, wrong identities, and invalid keys without throwing', () => {
    const storage = new Map<string, unknown>();
    const port = {
      getStorageSync: (key: string) => storage.get(key),
      removeStorageSync: (key: string) => storage.delete(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    };
    const cache = createCalendarCache(port);
    const key = buildCalendarCacheKey(identity);
    storage.set(key, { schemaVersion: 1, identity, savedAt: 'bad', calendar: {}, holidays: {} });
    expect(cache.read(identity)).toBeUndefined();
    expect(cache.read({ ...identity, userId: 'other' })).toBeUndefined();
    expect(() => buildCalendarCacheKey({ ...identity, userId: '' })).toThrow();
    expect(() => buildCalendarCacheKey({ ...identity, groupVersion: 0 })).toThrow();
  });

  it('rejects nested contract violations and unknown cache fields', () => {
    const storage = new Map<string, unknown>();
    const port = {
      getStorageSync: (key: string) => storage.get(key),
      removeStorageSync: (key: string) => storage.delete(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    };
    const cache = createCalendarCache(port);
    const key = buildCalendarCacheKey(identity);

    storage.set(key, {
      calendar: {
        ...goldenCalendar,
        assignments: [
          {
            ...goldenCalendar.assignments[0],
            changeMarkers: ['swap', 'unsupported-marker'],
          },
        ],
      },
      holidays: goldenHolidays,
      identity,
      savedAt: '2026-08-10T00:00:00.000Z',
      schemaVersion: 1,
    });
    expect(cache.read(identity)).toBeUndefined();

    storage.set(key, {
      calendar: { ...goldenCalendar, unsupportedField: true },
      holidays: goldenHolidays,
      identity,
      savedAt: '2026-08-10T00:00:00.000Z',
      schemaVersion: 1,
    });
    expect(cache.read(identity)).toBeUndefined();

    storage.set(key, {
      calendar: goldenCalendar,
      holidays: {
        ...goldenHolidays,
        dates: [{ ...goldenHolidays.dates[0], isWorkday: 'yes' }],
      },
      identity,
      savedAt: '2026-08-10T00:00:00.000Z',
      schemaVersion: 1,
    });
    expect(cache.read(identity)).toBeUndefined();
  });

  it('treats storage exceptions as cache misses and removes one exact key', () => {
    const key = buildCalendarCacheKey(identity);
    const cache = createCalendarCache({
      getStorageSync: () => {
        throw new Error('storage unavailable');
      },
      removeStorageSync: (actualKey) => expect(actualKey).toBe(key),
      setStorageSync: () => undefined,
    });
    expect(cache.read(identity)).toBeUndefined();
    cache.remove(identity);
  });
});
