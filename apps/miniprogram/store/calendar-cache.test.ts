import { describe, expect, it, vi } from 'vitest';

import { goldenCalendar, goldenHolidays } from '../features/calendar/calendar-golden-data.js';
import {
  buildCalendarCacheKey,
  calendarCacheFreshnessMilliseconds,
  createCalendarCache,
  isCalendarCacheFresh,
  removeCalendarCacheMonths,
  type CalendarCacheIdentity,
} from './calendar-cache.js';

const identity: CalendarCacheIdentity = {
  businessMonth: '2026-08',
  groupId: goldenCalendar.groupId,
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
    expect(buildCalendarCacheKey({ ...identity, groupId: 'group:1' })).toContain(
      'user%3A1:group%3A1:member:7:2026-08',
    );
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

  it('rejects and removes shape-valid records whose nested data belongs to another identity', () => {
    const storage = new Map<string, unknown>();
    const removeStorageSync = vi.fn((key: string) => storage.delete(key));
    const cache = createCalendarCache({
      getStorageSync: (key) => storage.get(key),
      removeStorageSync,
      setStorageSync: (key, value) => storage.set(key, value),
    });
    const key = buildCalendarCacheKey(identity);
    const cases = [
      { calendar: { ...goldenCalendar, groupId: 'another-group' }, holidays: goldenHolidays },
      { calendar: { ...goldenCalendar, businessMonth: '2026-09' }, holidays: goldenHolidays },
      { calendar: goldenCalendar, holidays: { ...goldenHolidays, year: 2027 } },
      {
        calendar: goldenCalendar,
        holidays: {
          ...goldenHolidays,
          dates: [
            {
              date: '2027-01-01',
              holidayName: 'wrong-year',
              isOffDay: true,
              isWorkday: false,
            },
          ],
        },
      },
    ];

    for (const value of cases) {
      storage.set(key, {
        ...value,
        identity,
        savedAt: '2026-08-10T00:00:00.000Z',
        schemaVersion: 1,
      });
      expect(cache.read(identity)).toBeUndefined();
      expect(storage.has(key)).toBe(false);
    }
    expect(removeStorageSync).toHaveBeenCalledWith(key);
  });

  it('skips writes whose calendar or holiday data does not match the cache identity', () => {
    const setStorageSync = vi.fn();
    const cache = createCalendarCache({
      getStorageSync: () => undefined,
      removeStorageSync: () => undefined,
      setStorageSync,
    });

    expect(() =>
      cache.write(identity, { ...goldenCalendar, groupId: 'another-group' }, goldenHolidays),
    ).not.toThrow();
    expect(() =>
      cache.write(identity, goldenCalendar, { ...goldenHolidays, year: 2027 }),
    ).not.toThrow();
    expect(setStorageSync).not.toHaveBeenCalled();
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

  it('removes only explicitly named months for the current user and group context', () => {
    const remove = vi.fn();
    removeCalendarCacheMonths(
      { remove },
      {
        groupId: identity.groupId,
        groupRole: identity.groupRole,
        groupVersion: identity.groupVersion,
        userId: identity.userId,
      },
      ['2026-08', '2026-09', '2026-08'],
    );
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenNthCalledWith(1, { ...identity, businessMonth: '2026-08' });
    expect(remove).toHaveBeenNthCalledWith(2, { ...identity, businessMonth: '2026-09' });
  });

  it('uses the written identity registry to purge only one user or one user-group cache set', () => {
    const storage = new Map<string, unknown>();
    const port = {
      getStorageSync: (key: string) => storage.get(key),
      removeStorageSync: (key: string) => storage.delete(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    };
    const cache = createCalendarCache(port);
    const otherUser = { ...identity, userId: 'user:2' };
    const otherGroup = { ...identity, businessMonth: '2026-09', groupId: 'other-group' };
    const otherGroupCalendar = {
      ...goldenCalendar,
      businessMonth: otherGroup.businessMonth,
      groupId: otherGroup.groupId,
    };

    cache.write(identity, goldenCalendar, goldenHolidays);
    cache.write(otherUser, goldenCalendar, goldenHolidays);
    cache.write(otherGroup, otherGroupCalendar, goldenHolidays);
    cache.removeForUserGroup(identity.userId, identity.groupId);

    expect(cache.read(identity)).toBeUndefined();
    expect(cache.read(otherGroup)).toBeDefined();
    expect(cache.read(otherUser)).toBeDefined();

    cache.removeForUser(identity.userId);
    expect(cache.read(otherGroup)).toBeUndefined();
    expect(cache.read(otherUser)).toBeDefined();
  });

  it('contains corrupt registry and storage-removal failures without deleting another user cache', () => {
    const storage = new Map<string, unknown>();
    const otherUser = { ...identity, userId: 'user:2' };
    const cache = createCalendarCache({
      getStorageSync: (key) => storage.get(key),
      removeStorageSync: (key) => {
        if (key.includes('user%3A1')) throw new Error('storage unavailable');
        storage.delete(key);
      },
      setStorageSync: (key, value) => storage.set(key, value),
    });
    cache.write(identity, goldenCalendar, goldenHolidays);
    cache.write(otherUser, goldenCalendar, goldenHolidays);

    expect(() => cache.removeForUser(identity.userId)).not.toThrow();
    expect(cache.read(otherUser)).toBeDefined();
  });
});
