import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarApiGoldenResponse } from '@schedule/client-core/testing';

describe('bounded persistent workbench reads', () => {
  let storage;
  let runtime;
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    storage = new Map();
    runtime = {
      getStorageInfoSync: vi.fn(() => ({ keys: [...storage.keys()] })),
      getStorageSync: vi.fn((key) => storage.get(key)),
      setStorageSync: vi.fn((key, value) => storage.set(key, value)),
      removeStorageSync: vi.fn((key) => storage.delete(key)),
    };
    vi.stubGlobal('wx', runtime);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('persists one group contact snapshot and hydrates every cached month without a calendar request', async () => {
    const cache = await import('../src/platform/workbench-read.ts');
    const calendar = structuredClone(calendarApiGoldenResponse);
    cache.writeWorkbenchCache('owner', calendar.groupId, calendar.businessMonth, calendar);
    cache.writeWorkbenchCache('owner', calendar.groupId, '2026-09', {
      ...calendar,
      businessMonth: '2026-09',
    });
    const first = cache.readWorkbenchCache('owner', calendar.groupId, calendar.businessMonth);
    expect(first.calendar.members[0].mobilePhone).toBe(calendar.members[0].mobilePhone);
    expect(first.contactsIncomplete).not.toBe(true);
    const contactKeys = [...storage.keys()].filter((key) => key.includes('contacts.v1:'));
    expect(contactKeys).toHaveLength(1);
    for (const [key, value] of storage) {
      if (key.includes('cache.v2:'))
        expect(value.calendar.members[0]).not.toHaveProperty('mobilePhone');
    }
    expect(
      cache.readWorkbenchCache('another-owner', calendar.groupId, calendar.businessMonth),
    ).toBeUndefined();
    // An omitted/revoked phone replaces the snapshot; it must not merge the old phone back in.
    const changed = structuredClone(calendar);
    delete changed.members[0].mobilePhone;
    cache.writeWorkbenchCache('owner', calendar.groupId, calendar.businessMonth, changed);
    expect(
      cache.readWorkbenchCache('owner', calendar.groupId, '2026-09').calendar.members[0],
    ).not.toHaveProperty('mobilePhone');
    cache.clearWorkbenchGroupCaches('owner', calendar.groupId);
    expect(storage.has(contactKeys[0])).toBe(false);
  });

  it('does not enumerate every local key on repeated month reads or writes below the month limit', async () => {
    const cache = await import('../src/platform/workbench-read.ts');
    const calendar = structuredClone(calendarApiGoldenResponse);
    cache.writeWorkbenchCache('owner', calendar.groupId, calendar.businessMonth, calendar);
    runtime.getStorageInfoSync.mockClear();
    for (let i = 0; i < 20; i++)
      cache.readWorkbenchCache('owner', calendar.groupId, calendar.businessMonth);
    expect(runtime.getStorageInfoSync).not.toHaveBeenCalled();
    runtime.getStorageSync.mockClear();
    cache.writeWorkbenchCache('owner', calendar.groupId, '2026-09', {
      ...calendar,
      businessMonth: '2026-09',
    });
    expect(
      runtime.getStorageSync.mock.calls.filter(([key]) => key.includes('cache.v2:')),
    ).toHaveLength(0);
  });

  it('merges members from different months without reviving removed contact fields', async () => {
    const cache = await import('../src/platform/workbench-read.ts');
    const calendar = structuredClone(calendarApiGoldenResponse);
    cache.writeWorkbenchCache('owner', calendar.groupId, calendar.businessMonth, calendar);
    cache.writeWorkbenchCache('owner', calendar.groupId, '2026-09', {
      ...calendar,
      businessMonth: '2026-09',
      members: [],
    });
    expect(
      cache.readWorkbenchCache('owner', calendar.groupId, calendar.businessMonth).calendar
        .members[0].mobilePhone,
    ).toBe(calendar.members[0].mobilePhone);
    const changed = structuredClone(calendar);
    changed.members = [changed.members[0]];
    delete changed.members[0].mobilePhone;
    cache.writeWorkbenchCache('owner', calendar.groupId, '2026-10', {
      ...changed,
      businessMonth: '2026-10',
    });
    expect(
      cache.readWorkbenchCache('owner', calendar.groupId, calendar.businessMonth).calendar
        .members[0],
    ).not.toHaveProperty('mobilePhone');
  });

  it('keeps cached payloads for unaffected months and invalidates changed months outside the window', async () => {
    const cache = await import('../src/platform/workbench-read.ts');
    const calendar = structuredClone(calendarApiGoldenResponse);
    for (const month of ['2026-01', '2026-08'])
      cache.writeWorkbenchCache('owner', calendar.groupId, month, {
        ...calendar,
        businessMonth: month,
      });
    cache.invalidateWorkbenchMonths('owner', calendar.groupId, new Set(['2026-01']));
    expect(cache.readWorkbenchCache('owner', calendar.groupId, '2026-01')).toBeUndefined();
    expect(cache.readWorkbenchCache('owner', calendar.groupId, '2026-08')).toBeDefined();
  });

  it('limits background prefetch to two requests at a time', async () => {
    const { loadActiveThenAdjacent } = await import('../src/platform/workbench-read.ts');
    let inFlight = 0;
    let peak = 0;
    const pending = [];
    const staged = loadActiveThenAdjacent(['a', 'b', 'c', 'd', 'e', 'f'], 'a', async (key) => {
      if (key === 'a') return key;
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => pending.push(resolve));
      inFlight--;
      return key;
    });
    await staged.active;
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      pending.splice(0).forEach((resolve) => resolve());
    }
    expect(await staged.adjacent).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
