import { describe, expect, it } from 'vitest';

import {
  isCalendarRequest,
  isStaticAsset,
  maxScheduleCacheEntries,
  selectCacheKeysToRemove,
} from './cache-logic.js';

describe('Service worker cache rules', () => {
  it('recognizes calendar reads and static assets as the only read-only caches', () => {
    expect(
      isCalendarRequest(
        new URL('https://app.example/api/groups/group-1/calendar?businessMonth=2026-08'),
      ),
    ).toBe(true);
    expect(isCalendarRequest(new URL('https://app.example/api/groups/group-1/swaps'))).toBe(false);
    expect(isStaticAsset(new URL('https://app.example/assets/index-abc123.js'))).toBe(true);
    expect(isStaticAsset(new URL('https://app.example/icons/icon-192.png'))).toBe(true);
    expect(isStaticAsset(new URL('https://app.example/api/groups/group-1'))).toBe(false);
  });

  it('keeps only the newest twelve cached schedule reads', () => {
    const keys = Array.from(
      { length: 14 },
      (_, index) =>
        `https://app.example/api/groups/g/calendar?businessMonth=2026-${String(index + 1).padStart(2, '0')}`,
    );
    const removed = selectCacheKeysToRemove(keys, maxScheduleCacheEntries);
    expect(removed).toEqual(keys.slice(0, 2));
    expect(selectCacheKeysToRemove(keys, 20)).toEqual([]);
  });
});
