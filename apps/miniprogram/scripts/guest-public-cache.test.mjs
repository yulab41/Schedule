import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import * as cache from '../src/platform/guest-public-cache.ts';

const groupId = '11111111-1111-4111-8111-111111111111';
const otherGroupId = '22222222-2222-4222-8222-222222222222';
const key = `schedule.guest.public.v1:${groupId}`;
const now = Date.parse('2026-10-03T00:00:00Z');
const day = 24 * 60 * 60 * 1000;
let storage;
const month = (businessMonth, extra = {}) => ({
  ...structuredClone(calendarApiGoldenResponse),
  groupId,
  businessMonth,
  ...extra,
});
const holidays = () =>
  new Map([[2026, { ...structuredClone(holidayApiGoldenResponse), year: 2026 }]]);
const corrupt = (mutate) => {
  const stored = JSON.parse(storage.get(key));
  mutate(stored);
  storage.set(key, JSON.stringify(stored));
};
const storedMonth = (stored, businessMonth) =>
  stored.months[businessMonth].calendar ?? stored.months[businessMonth];

beforeEach(() => {
  storage = new Map();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubGlobal('wx', {
    getStorageSync: (name) => storage.get(name),
    setStorageSync: vi.fn((name, value) => storage.set(name, value)),
    removeStorageSync: vi.fn((name) => storage.delete(name)),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bounded and decoded public visitor cache', () => {
  it('retains recent public months without private mobile numbers or changing live models', () => {
    const calendar = month('2026-10');
    calendar.members[0].mobilePhone = '13800000000';
    cache.writeGuestPublicCache(groupId, new Map([['2026-10', calendar]]), holidays());
    const restored = cache.readGuestPublicCache(groupId);
    expect(restored.months.get('2026-10')?.businessMonth).toBe('2026-10');
    expect(restored.holidays.get(2026)?.year).toBe(2026);
    expect(storage.get(key)).not.toContain('13800000000');
    expect(calendar.members[0].mobilePhone).toBe('13800000000');
  });
  it.each(['assignments', 'members'])(
    'drops a malformed %s month while retaining healthy months',
    (field) => {
      cache.writeGuestPublicCache(
        groupId,
        new Map([
          ['2026-09', month('2026-09')],
          ['2026-10', month('2026-10')],
        ]),
        holidays(),
      );
      corrupt((stored) => {
        storedMonth(stored, '2026-09')[field] = 'not-an-array';
      });
      const restored = cache.readGuestPublicCache(groupId);
      expect(restored.months.has('2026-09')).toBe(false);
      expect(restored.months.has('2026-10')).toBe(true);
    },
  );
  it.each([
    ['groupId', otherGroupId],
    ['businessMonth', '2027-01'],
  ])('rejects a cached calendar with a different %s', (field, value) => {
    cache.writeGuestPublicCache(groupId, new Map([['2026-10', month('2026-10')]]), holidays());
    corrupt((stored) => {
      storedMonth(stored, '2026-10')[field] = value;
    });
    expect(cache.readGuestPublicCache(groupId).months.size).toBe(0);
  });
  it('rejects future envelope time and oversized stored JSON before using it', () => {
    cache.writeGuestPublicCache(groupId, new Map([['2026-10', month('2026-10')]]), holidays());
    corrupt((stored) => {
      stored.updatedAt = now + day;
    });
    expect(cache.readGuestPublicCache(groupId).months.size).toBe(0);
    storage.set(
      key,
      JSON.stringify({
        updatedAt: now,
        months: { '2026-10': month('2026-10') },
        holidays: {},
        padding: 'x'.repeat(2 * 1024 * 1024),
      }),
    );
    expect(cache.readGuestPublicCache(groupId).months.size).toBe(0);
  });
  it('does not renew old months when another month refreshes', () => {
    cache.writeGuestPublicCache(groupId, new Map([['2026-09', month('2026-09')]]), holidays());
    const restored = cache.readGuestPublicCache(groupId);
    vi.setSystemTime(now + 6 * day);
    restored.months.set('2026-10', month('2026-10'));
    cache.writeGuestPublicCache(groupId, restored.months, restored.holidays);
    vi.setSystemTime(now + 8 * day);
    const later = cache.readGuestPublicCache(groupId);
    expect(later.months.has('2026-09')).toBe(false);
    expect(later.months.has('2026-10')).toBe(true);
  });
  it('bounds persisted months and actual UTF-8 bytes, including Chinese and supplementary characters', () => {
    const months = new Map(
      Array.from({ length: 60 }, (_, i) => {
        const businessMonth = `${2022 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
        const calendar = month(businessMonth);
        calendar.assignments = Array.from({ length: 100 }, (_, j) => ({
          ...calendar.assignments[0],
          id: `synthetic-${i}-${j}`,
          plannedMemberName: '合成姓名🙂'.repeat(80),
        }));
        return [businessMonth, calendar];
      }),
    );
    cache.writeGuestPublicCache(groupId, months, holidays());
    expect(Buffer.byteLength(storage.get(key), 'utf8')).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(cache.readGuestPublicCache(groupId).months.size).toBeLessThanOrEqual(12);
    expect(cache.readGuestPublicCache(groupId).months.has('2026-12')).toBe(true);
  });
  it('skips one oversized month and can still persist other usable months', () => {
    const large = month('2026-10');
    large.assignments = Array.from({ length: 3000 }, (_, i) => ({
      ...large.assignments[0],
      id: `synthetic-${i}`,
      plannedMemberName: 'x'.repeat(1024),
    }));
    cache.writeGuestPublicCache(
      groupId,
      new Map([
        ['2026-09', month('2026-09')],
        ['2026-10', large],
      ]),
      holidays(),
    );
    expect(cache.readGuestPublicCache(groupId).months.has('2026-09')).toBe(true);
    expect(cache.readGuestPublicCache(groupId).months.has('2026-10')).toBe(false);
    expect(large.assignments).toHaveLength(3000);
  });
  it('bounds memory history while keeping the five months required by the visible pager', () => {
    const months = new Map(
      Array.from({ length: 60 }, (_, i) => {
        const businessMonth = `${2022 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
        return [businessMonth, month(businessMonth)];
      }),
    );
    const years = new Map(
      Array.from({ length: 8 }, (_, i) => [
        2020 + i,
        { ...structuredClone(holidayApiGoldenResponse), year: 2020 + i },
      ]),
    );
    const visible = ['2022-01', '2022-02', '2022-03', '2022-04', '2022-05'];
    cache.pruneGuestPublicResources(months, years, visible);
    expect(months.size).toBeLessThanOrEqual(12);
    for (const businessMonth of visible) expect(months.has(businessMonth)).toBe(true);
    expect(years.size).toBeLessThanOrEqual(4);
    expect(years.has(2022)).toBe(true);
  });
  it('does not propagate storage pressure and invalidates only the selected public group', () => {
    storage.set('schedule.wechat.session', { token: 'synthetic-private' });
    globalThis.wx.setStorageSync.mockImplementation(() => {
      throw new Error('synthetic quota');
    });
    expect(() =>
      cache.writeGuestPublicCache(groupId, new Map([['2026-10', month('2026-10')]]), holidays()),
    ).not.toThrow();
    cache.clearGuestPublicCache(groupId);
    expect(storage.get('schedule.wechat.session')).toEqual({ token: 'synthetic-private' });
    expect(globalThis.wx.removeStorageSync).toHaveBeenCalledWith(key);
  });
  it('expires visible months and years without renewing them on a cache hit', () => {
    const calendar = month('2026-10');
    const months = new Map([['2026-10', calendar]]);
    const years = holidays();
    cache.pruneGuestPublicResources(months, years, ['2026-10']);
    vi.setSystemTime(now + 8 * day);
    expect(cache.isGuestPublicResourceFresh(calendar)).toBe(false);
    cache.pruneGuestPublicResources(months, years, ['2026-10']);
    expect(months.size).toBe(0);
    expect(years.size).toBe(0);
  });
  it.each([1, 2])(
    'enforces memory bytes and keeps only the visible exception with %i MiB models',
    (size) => {
      const months = new Map(
        Array.from({ length: 10 }, (_, i) => {
          const businessMonth = `2026-${String(i + 1).padStart(2, '0')}`;
          const calendar = month(businessMonth);
          calendar.assignments[0].plannedMemberName = 'x'.repeat(size * 1024 * 1024);
          return [businessMonth, calendar];
        }),
      );
      const visible = [...months.keys()].slice(0, 5);
      cache.pruneGuestPublicResources(months, holidays(), visible);
      for (const businessMonth of visible) expect(months.has(businessMonth)).toBe(true);
      const bytes = [...months.values()].reduce(
        (sum, model) => sum + Buffer.byteLength(JSON.stringify(model)),
        0,
      );
      if (size === 1) expect(bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
      else expect([...months.keys()]).toEqual(visible);
    },
  );
});
