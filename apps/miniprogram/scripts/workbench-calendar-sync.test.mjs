import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarApiGoldenResponse } from '@schedule/client-core/testing';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const DAY = 24 * 60 * 60 * 1000;
const GROUP_ID = 'group-1';
const OWNER_ID = 'user-1';
const VISIBLE_WINDOW = [
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
  '2026-12',
];
const MONTH_PREFIX = `schedule.wechat.workbench.cache.v2:${OWNER_ID}:${GROUP_ID}:`;
const CURSOR_KEY = `schedule.wechat.workbench.calendar-cursor.v1:${OWNER_ID}:${GROUP_ID}`;
const HOLIDAY_KEY = 'schedule.workbench.holidays.v1';

let definition;

describe('MINI calendar incremental sync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-15T04:00:00.000Z'));
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders a warm cache, validates with one ledger request and refreshes only the viewed month', async () => {
    const holidays = holidayYear(2026, [holidayDate('2026-10-01', '国庆节')]);
    const storage = warmStorage(VISIBLE_WINDOW, holidays);
    const requests = [];
    const request = createRequest((options) => {
      requests.push(options.url);
      if (options.url.includes('/calendar-changes')) {
        options.success({ data: changes(12, false, [holidayVersion(2026, 1)]), statusCode: 200 });
        return true;
      }
      return false;
    });
    const instance = await startWorkbench(request, storage);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));

    // Every month renders straight from storage, but the *viewed* month is
    // re-read once because the stored copy deliberately has no mobile numbers.
    await vi.waitFor(() => expect(readBusinessMonths(requests)).toEqual(['2026-09']));
    expect(requests.filter((url) => url.includes('/calendar-changes'))).toHaveLength(1);
    expect(instance.monthResources.size).toBe(VISIBLE_WINDOW.length);
    expect(findMonthCell(instance, '2026-10-01')).toMatchObject({ isHoliday: true });
    expect(storage.get(CURSOR_KEY)).toMatchObject({ lastSeq: 12, revision: 12 });
  });

  it('re-reads the viewed month so a cache-rendered detail card keeps its mobile number', async () => {
    const holidays = holidayYear(2026, []);
    const storage = warmStorage(VISIBLE_WINDOW, holidays);
    storage.set(CURSOR_KEY, { lastSeq: 5, revision: 5, savedAt: Date.now() });
    const requests = [];
    const request = createRequest((options) => {
      requests.push(options.url);
      if (options.url.includes('/calendar-changes')) {
        options.success({ data: changes(5, false, [holidayVersion(2026, 1)]), statusCode: 200 });
        return true;
      }
      return false;
    });
    const instance = await startWorkbench(request, storage);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    await vi.waitFor(() => expect(readBusinessMonths(requests)).toEqual(['2026-09']));

    const refreshed = instance.monthResources.get('2026-09');
    expect(refreshed?.contactsIncomplete).toBeUndefined();
    expect(
      refreshed?.calendar.members.find((member) => member.membershipId === 'membership-1')
        ?.mobilePhone,
    ).toBe('13800138000');
    // Adjacent months keep their instant cache render and are not re-read.
    expect(instance.monthResources.get('2026-10')?.contactsIncomplete).toBe(true);
    // Storage stays sanitized and keeps only a reference to the shared year.
    const stored = storage.get(`${MONTH_PREFIX}2026-09`);
    expect(stored.holidayYear).toBe(2026);
    expect(stored.holidays).toBeUndefined();
    expect(
      stored.calendar.members.find((member) => member.membershipId === 'membership-1')?.mobilePhone,
    ).toBeUndefined();
  });

  it('re-reads only the business month the ledger reports as changed', async () => {
    const holidays = holidayYear(2026, []);
    const storage = warmStorage(['2026-08', '2026-09', '2026-10', '2026-11'], holidays);
    storage.set(CURSOR_KEY, { lastSeq: 5, revision: 5, savedAt: Date.now() });
    const requests = [];
    const request = createRequest((options) => {
      requests.push(options.url);
      if (options.url.includes('/calendar-changes')) {
        options.success({
          data: changes(
            6,
            false,
            [holidayVersion(2026, 1)],
            [
              {
                businessMonth: '2026-10',
                changedAt: '2026-09-15T03:00:00.000Z',
                kind: 'schedule',
                seq: 6,
              },
            ],
          ),
          statusCode: 200,
        });
        return true;
      }
      return false;
    });
    const instance = await startWorkbench(request, storage);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));

    expect(new Set(readBusinessMonths(requests))).toEqual(
      // Uncached months, the month the ledger reports as changed, and the
      // viewed month (whose stored copy has no mobile numbers).
      new Set(['2026-06', '2026-07', '2026-09', '2026-10', '2026-12']),
    );
    expect(storage.get(CURSOR_KEY)).toMatchObject({ lastSeq: 6, revision: 6 });
  });

  it('re-reads the visible window when the ledger asks for a resync', async () => {
    const holidays = holidayYear(2026, []);
    const storage = warmStorage(['2026-08', '2026-09', '2026-10', '2026-11'], holidays);
    storage.set(CURSOR_KEY, { lastSeq: 5, revision: 5, savedAt: Date.now() });
    const requests = [];
    const request = createRequest((options) => {
      requests.push(options.url);
      if (options.url.includes('/calendar-changes')) {
        options.success({
          data: changes(
            9,
            true,
            [holidayVersion(2026, 1)],
            [{ changedAt: '2026-09-15T03:00:00.000Z', kind: 'config', seq: 9 }],
          ),
          statusCode: 200,
        });
        return true;
      }
      return false;
    });
    const instance = await startWorkbench(request, storage);
    await vi.waitFor(() => expect(instance.monthResources.size).toBe(7));

    expect(new Set(readBusinessMonths(requests))).toEqual(new Set(VISIBLE_WINDOW));
    expect(storage.get(CURSOR_KEY)).toMatchObject({ lastSeq: 9, revision: 9 });
    expect(instance.data.state).toBe('ready');
  });

  it('falls back to the legacy window read when the ledger endpoint is unavailable', async () => {
    const holidays = holidayYear(2026, []);
    const storage = warmStorage(['2026-08', '2026-09', '2026-10', '2026-11'], holidays);
    storage.set(CURSOR_KEY, { lastSeq: 5, revision: 5, savedAt: Date.now() });
    const requests = [];
    const request = createRequest((options) => {
      requests.push(options.url);
      if (options.url.includes('/calendar-changes')) {
        options.success({ data: { error: { code: 'NOT_FOUND' } }, statusCode: 404 });
        return true;
      }
      return false;
    });
    const instance = await startWorkbench(request, storage);
    await vi.waitFor(() => expect(instance.monthResources.size).toBe(7));

    expect(readBusinessMonths(requests)).toHaveLength(7);
    expect(storage.get(CURSOR_KEY)).toMatchObject({ lastSeq: 5, revision: 5 });
  });

  it('re-reads a year of holidays when the published version advances', async () => {
    const staleHolidays = holidayYear(2026, []);
    const freshHolidays = holidayYear(2026, [holidayDate('2026-10-01', '国庆节')]);
    const storage = warmStorage(['2026-08', '2026-09', '2026-10', '2026-11'], staleHolidays);
    storage.set(HOLIDAY_KEY, {
      2026: { holidays: staleHolidays, savedAt: Date.now(), version: 1 },
    });
    let holidayRequests = 0;
    const request = createRequest((options) => {
      if (options.url.includes('/calendar-changes')) {
        options.success({ data: changes(2, false, [holidayVersion(2026, 2)]), statusCode: 200 });
        return true;
      }
      if (options.url.includes('/holidays')) {
        holidayRequests += 1;
        options.success({ data: freshHolidays, statusCode: 200 });
        return true;
      }
      return false;
    });
    const instance = await startWorkbench(request, storage);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    await vi.waitFor(() => expect(holidayRequests).toBe(1));

    expect(findMonthCell(instance, '2026-10-01')).toMatchObject({ isHoliday: true });
    expect(storage.get(HOLIDAY_KEY)['2026']).toMatchObject({ version: 2 });
  });

  it('bounds the persisted month cache so it cannot grow without limit', async () => {
    const storage = createStorage();
    vi.stubGlobal('wx', createWx(storage, vi.fn()));
    const platform = await import('../src/platform/workbench-read.ts');
    const months = [];
    for (let offset = 0; offset < 26; offset += 1) {
      const month = monthAt(offset);
      months.push(month);
      platform.writeWorkbenchCache(OWNER_ID, GROUP_ID, month, calendar(month), Date.now() + offset);
    }

    const cached = [...storage.keys()].filter((key) => key.startsWith(MONTH_PREFIX));
    expect(cached).toHaveLength(platform.WORKBENCH_MONTH_CACHE_LIMIT);
    // The two oldest months fall off; the newest ones stay.
    expect(storage.has(`${MONTH_PREFIX}${months[0]}`)).toBe(false);
    expect(storage.has(`${MONTH_PREFIX}${months[1]}`)).toBe(false);
    expect(storage.has(`${MONTH_PREFIX}${months.at(-1)}`)).toBe(true);
  });

  it('does not refetch calendar payloads when persisted contacts and the ledger are current', async () => {
    const storage = warmStorage(VISIBLE_WINDOW, holidayYear(2026, []));
    storage.set(`schedule.wechat.workbench.contacts.v1:${OWNER_ID}:${GROUP_ID}`, {
      contacts: calendar('2026-09').members.map(({ membershipId, mobilePhone, shortPhone }) => ({
        membershipId,
        mobilePhone,
        shortPhone,
      })),
    });
    const requests = [];
    const instance = await startWorkbench(
      createRequest((options) => {
        requests.push(options.url);
        if (!options.url.includes('/calendar-changes')) return false;
        options.success({ data: changes(0, false, [holidayVersion(2026, 1)]), statusCode: 200 });
        return true;
      }),
      storage,
    );
    await vi.waitFor(() => expect(storage.has(CURSOR_KEY)).toBe(true));
    expect(readBusinessMonths(requests)).toEqual([]);
    expect(instance.calendar.members[0].mobilePhone).toBe('13800138000');
  });

  it('invalidates a changed off-screen month before advancing the shared cursor', async () => {
    const storage = warmStorage([...VISIBLE_WINDOW, '2026-01'], holidayYear(2026, []));
    storage.set(CURSOR_KEY, { lastSeq: 5, revision: 5, savedAt: Date.now() });
    const instance = await startWorkbench(
      createRequest((options) => {
        if (!options.url.includes('/calendar-changes')) return false;
        options.success({
          data: changes(
            6,
            false,
            [holidayVersion(2026, 1)],
            [
              {
                businessMonth: '2026-01',
                kind: 'schedule',
                seq: 6,
                changedAt: '2026-09-15T03:00:00.000Z',
              },
            ],
          ),
          statusCode: 200,
        });
        return true;
      }),
      storage,
    );
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    await vi.waitFor(() => expect(storage.get(CURSOR_KEY).lastSeq).toBe(6));
    expect(storage.has(`${MONTH_PREFIX}2026-01`)).toBe(false);
  });

  it('does not advance the cursor when any stale adjacent month failed', async () => {
    const storage = warmStorage(VISIBLE_WINDOW, holidayYear(2026, []));
    storage.set(CURSOR_KEY, { lastSeq: 5, revision: 5, savedAt: Date.now() });
    const instance = await startWorkbench(
      createRequest((options) => {
        if (options.url.includes('/calendar-changes')) {
          options.success({ data: changes(6, true, [holidayVersion(2026, 1)]), statusCode: 200 });
          return true;
        }
        if (readBusinessMonth(options.url) === '2026-12') {
          options.success({ data: { error: { code: 'UNAVAILABLE' } }, statusCode: 503 });
          return true;
        }
        return false;
      }),
      storage,
    );
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    await new Promise((resolve) => setTimeout(resolve, 850));
    expect(storage.get(CURSOR_KEY).lastSeq).toBe(5);
  });
  it('silently refreshes changed contacts from a stream and disposes the connection on hide', async () => {
    const storage = warmStorage(VISIBLE_WINDOW, holidayYear(2026, []));
    let receive;
    let revision = 5;
    const abort = vi.fn();
    const stream = vi.fn(() => ({
      abort,
      onChunkReceived(fn) {
        receive = fn;
      },
      onHeadersReceived() {},
    }));
    const request = createRequest((options) => {
      if (options.url.endsWith('/calendar-change-stream')) return stream();
      if (options.url.includes('/calendar-changes')) {
        options.success({
          data: changes(revision, revision === 6, [holidayVersion(2026, 1)]),
          statusCode: 200,
        });
        return true;
      }
      const month = readBusinessMonth(options.url);
      if (month !== undefined && revision === 6) {
        const updated = calendar(month);
        delete updated.members[0].mobilePhone;
        options.success({ data: updated, statusCode: 200 });
        return true;
      }
      return false;
    });
    const instance = await startWorkbench(request, storage);
    await vi.waitFor(() => expect(stream).toHaveBeenCalledTimes(1));
    revision = 6;
    receive({ data: Uint8Array.from('data:changed\n\n', (c) => c.charCodeAt(0)).buffer });
    await vi.waitFor(() => expect(storage.get(CURSOR_KEY).lastSeq).toBe(6));
    expect(instance.data.state).toBe('ready');
    expect(instance.calendar.members[0]).not.toHaveProperty('mobilePhone');
    definition.onHide.call(instance);
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('clears persisted contacts when version validation denies group access', async () => {
    const storage = warmStorage(VISIBLE_WINDOW, holidayYear(2026, []));
    const contactKey = `schedule.wechat.workbench.contacts.v1:${OWNER_ID}:${GROUP_ID}`;
    storage.set(contactKey, { contacts: calendar('2026-09').members });
    const instance = await startWorkbench(
      createRequest((options) => {
        if (options.url.includes('/calendar-changes')) {
          options.success({ data: { error: { code: 'FORBIDDEN' } }, statusCode: 403 });
          return true;
        }
        return false;
      }),
      storage,
    );
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));
    expect(storage.has(contactKey)).toBe(false);
    expect(instance.calendar).toBeUndefined();
  });
});

async function startWorkbench(request, storage) {
  vi.stubGlobal('wx', createWx(storage, request));
  await import('../src/pages/workbench/index.ts');
  await enableTestClientCapabilities();
  const instance = createPageInstance(definition);
  definition.onLoad.call(instance);
  return instance;
}

function createRequest(handleSpecial) {
  return vi.fn((options) => {
    const handled = handleSpecial(options);
    if (handled) return handled === true ? undefined : handled;
    if (options.url.endsWith('/groups')) {
      options.success({ data: [groupSummary()], statusCode: 200 });
      return;
    }
    if (options.url.includes('/notifications/unread-count')) {
      options.success({ data: { unreadCount: 0 }, statusCode: 200 });
      return;
    }
    if (options.url.includes('/holidays')) {
      options.success({ data: holidayYear(2026, []), statusCode: 200 });
      return;
    }
    const businessMonth = readBusinessMonth(options.url);
    if (businessMonth !== undefined) {
      options.success({ data: calendar(businessMonth), statusCode: 200 });
      return;
    }
    throw new Error(`Unexpected request: ${options.url}`);
  });
}

function warmStorage(businessMonths, holidays) {
  const storage = createStorage();
  // Holidays live once per year next to the months that point at them.
  storage.set(HOLIDAY_KEY, {
    [String(holidays.year)]: { holidays, savedAt: Date.now(), version: 1 },
  });
  for (const businessMonth of businessMonths) {
    storage.set(`${MONTH_PREFIX}${businessMonth}`, {
      calendar: calendar(businessMonth),
      holidayYear: holidays.year,
      savedAt: Date.now(),
    });
  }
  return storage;
}

function createStorage() {
  return new Map([
    [
      'schedule.wechat.session',
      {
        clientVersion: 'test',
        expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
        profile: { id: OWNER_ID, realName: '林医生', version: 1 },
        token: 'test-token',
      },
    ],
    ['schedule.wechat.workbench.current-group', { groupId: GROUP_ID, ownerId: OWNER_ID }],
  ]);
}

function createWx(storage, request) {
  return {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop', version: 'test' } }),
    getMenuButtonBoundingClientRect: () => ({
      bottom: 56,
      height: 32,
      left: 300,
      right: 380,
      top: 24,
      width: 80,
    }),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    getStorageSync: (key) => storage.get(key),
    getWindowInfo: () => ({
      safeArea: { bottom: 844, height: 820, left: 0, right: 390, top: 24, width: 390 },
      screenHeight: 844,
      statusBarHeight: 24,
      windowHeight: 844,
      windowWidth: 390,
    }),
    removeStorageSync: (key) => storage.delete(key),
    request,
    setStorageSync: (key, value) => storage.set(key, value),
  };
}

function createPageInstance(pageDefinition) {
  const data = structuredClone(pageDefinition.data);
  return {
    ...pageDefinition,
    calendar: undefined,
    hasShown: false,
    holidays: undefined,
    isVisible: true,
    monthLocateTarget: undefined,
    monthResources: new Map(),
    pendingListTarget: undefined,
    pendingScrollTarget: undefined,
    pendingWeekTarget: undefined,
    requestSerial: 0,
    selectComponent: () => undefined,
    data,
    setData(patch, callback) {
      Object.assign(data, patch);
      callback?.();
    },
  };
}

function groupSummary() {
  return { id: GROUP_ID, name: '急诊科', role: 'member', version: 1 };
}

function calendar(businessMonth) {
  return {
    ...structuredClone(calendarApiGoldenResponse),
    assignments: [],
    businessMonth,
    groupId: GROUP_ID,
  };
}

function changes(revision, resync, holidayVersions, entries = []) {
  return { changes: entries, holidayVersions, resync, revision };
}

function holidayVersion(year, version) {
  return { version, year };
}

function holidayDate(date, holidayName) {
  return { date, holidayName, isOffDay: true, isWorkday: false };
}

function holidayYear(year, dates) {
  return { confirmed: true, dates, year };
}

function findMonthCell(instance, businessDate) {
  return instance.data.monthPanels
    .flatMap((panel) => panel.cells)
    .find((cell) => cell.businessDate === businessDate);
}

function readBusinessMonth(url) {
  const match = /[?&]businessMonth=(\d{4}-\d{2})/u.exec(url);
  return match?.[1];
}

function readBusinessMonths(urls) {
  return urls.flatMap((url) => {
    const businessMonth = readBusinessMonth(url);
    return businessMonth === undefined ? [] : [businessMonth];
  });
}

function monthAt(offset) {
  const year = 2026 + Math.floor(offset / 12);
  const month = (offset % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}
