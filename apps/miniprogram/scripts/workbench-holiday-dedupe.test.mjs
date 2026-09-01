import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarApiGoldenResponse } from '@schedule/client-core/testing';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const DAY = 24 * 60 * 60 * 1000;
let definition;

describe('MINI-G1-002 workbench holiday request plan', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
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

  it('requests one annual holiday result for a five-month same-year window and preserves display data', async () => {
    vi.setSystemTime(new Date('2026-09-15T04:00:00.000Z'));
    const holidays2026 = holidayYear(2026, [
      holidayDate('2026-08-15', '中秋节'),
      holidayDate('2026-10-01', '国庆节'),
    ]);
    const request = createRequest(({ options, year }) => {
      options.success({ data: holidays2026, statusCode: 200 });
      expect(year).toBe(2026);
    });
    const instance = await startWorkbench(request);

    await vi.waitFor(() => expect(instance.monthResources.size).toBe(5));

    expect(readCalendarMonths(request)).toEqual([
      '2026-09',
      '2026-07',
      '2026-08',
      '2026-10',
      '2026-11',
    ]);
    expect(readHolidayYears(request)).toEqual([2026]);
    expect([...instance.monthResources.keys()]).toEqual([
      '2026-09',
      '2026-07',
      '2026-08',
      '2026-10',
      '2026-11',
    ]);
    expect([...instance.monthResources.values()].map((result) => result.holidays)).toEqual(
      Array.from({ length: 5 }, () => holidays2026),
    );
    expect(instance.holidays).toEqual(holidays2026);
    expect(findMonthCell(instance, '2026-10-01')).toMatchObject({
      holiday: '国庆',
      isHoliday: true,
    });
  });

  it('requests each unique year once across a year boundary, including one in-flight 2027 request', async () => {
    vi.setSystemTime(new Date('2026-12-15T04:00:00.000Z'));
    const holidays2026 = holidayYear(2026, [holidayDate('2026-12-25', '冬季假日')]);
    const holidays2027 = holidayYear(2027, [holidayDate('2027-01-01', '元旦')]);
    const pending2027 = [];
    const request = createRequest(({ options, year }) => {
      if (year === 2026) {
        options.success({ data: holidays2026, statusCode: 200 });
        return;
      }
      pending2027.push(options);
    });
    const instance = await startWorkbench(request);

    await vi.waitFor(() => expect(readCalendarMonths(request)).toHaveLength(5));
    await vi.waitFor(() => expect(pending2027.length).toBeGreaterThan(0));
    const peakConcurrent2027Requests = pending2027.length;
    for (const options of pending2027) {
      options.success({ data: holidays2027, statusCode: 200 });
    }
    await vi.waitFor(() => expect(instance.monthResources.size).toBe(5));

    expect(readHolidayYears(request)).toEqual([2026, 2027]);
    expect(peakConcurrent2027Requests).toBe(1);
    expect([...instance.monthResources.keys()]).toEqual([
      '2026-12',
      '2026-10',
      '2026-11',
      '2027-01',
      '2027-02',
    ]);
    expect(
      [...instance.monthResources].map(([businessMonth, result]) => [
        businessMonth,
        result.holidays.year,
      ]),
    ).toEqual([
      ['2026-12', 2026],
      ['2026-10', 2026],
      ['2026-11', 2026],
      ['2027-01', 2027],
      ['2027-02', 2027],
    ]);
    expect(instance.holidays).toEqual({
      confirmed: true,
      dates: [...holidays2026.dates, ...holidays2027.dates],
      year: 2026,
    });
    expect(findMonthCell(instance, '2026-12-25')).toMatchObject({
      holiday: '冬季',
      isHoliday: true,
    });
    expect(findMonthCell(instance, '2027-01-01')).toMatchObject({
      holiday: '元旦',
      isHoliday: true,
    });
  });

  it('starts a fresh annual request plan after failure while preserving the existing error and retry flow', async () => {
    vi.setSystemTime(new Date('2026-09-15T04:00:00.000Z'));
    const holidays2026 = holidayYear(2026, [holidayDate('2026-10-01', '国庆节')]);
    let holidayRequestCount = 0;
    const request = createRequest(({ options }) => {
      holidayRequestCount += 1;
      if (holidayRequestCount === 1) {
        options.success({ data: { error: { code: 'INTERNAL_ERROR' } }, statusCode: 500 });
        return;
      }
      options.success({ data: holidays2026, statusCode: 200 });
    });
    const instance = await startWorkbench(request);

    await vi.waitFor(() => expect(instance.data.state).toBe('error'));
    expect(instance.data.errorMessage).toBe('排班暂时无法加载，请检查网络连接后重试。');
    expect(holidayRequestCount).toBe(1);

    definition.handleRetry.call(instance);
    await vi.waitFor(() => expect(instance.monthResources.size).toBe(5));
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));

    expect(holidayRequestCount).toBe(2);
    expect(instance.data.errorMessage).toBe('');
    expect(instance.holidays).toEqual(holidays2026);
  });
});

async function startWorkbench(request) {
  vi.stubGlobal('wx', createWx(createStorage(), request));
  await import('../src/pages/workbench/index.ts');
  await enableTestClientCapabilities();
  const instance = createPageInstance(definition);
  definition.onLoad.call(instance);
  return instance;
}

function createRequest(handleHoliday) {
  return vi.fn((options) => {
    if (options.url.endsWith('/groups')) {
      options.success({ data: [groupSummary()], statusCode: 200 });
      return;
    }
    if (options.url.includes('/notifications/unread-count')) {
      options.success({ data: { unreadCount: 0 }, statusCode: 200 });
      return;
    }
    const businessMonth = readBusinessMonth(options.url);
    if (businessMonth !== undefined) {
      options.success({ data: calendar(businessMonth), statusCode: 200 });
      return;
    }
    const year = readHolidayYear(options.url);
    if (year !== undefined) {
      handleHoliday({ options, year });
      return;
    }
    throw new Error(`Unexpected request: ${options.url}`);
  });
}

function createStorage() {
  return new Map([
    [
      'schedule.wechat.session',
      {
        expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
        profile: { id: 'user-1', realName: '林医生', version: 1 },
        token: 'test-token',
      },
    ],
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
  return { groupCode: '2608', id: 'group-1', name: '急诊科', role: 'member', version: 1 };
}

function calendar(businessMonth) {
  return {
    ...structuredClone(calendarApiGoldenResponse),
    assignments: [],
    businessMonth,
    groupId: 'group-1',
  };
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

function readHolidayYear(url) {
  const match = /\/holidays\?year=(\d{4})/u.exec(url);
  return match === null ? undefined : Number(match[1]);
}

function readCalendarMonths(request) {
  return request.mock.calls.flatMap(([options]) => {
    const businessMonth = readBusinessMonth(options.url);
    return businessMonth === undefined ? [] : [businessMonth];
  });
}

function readHolidayYears(request) {
  return request.mock.calls.flatMap(([options]) => {
    const year = readHolidayYear(options.url);
    return year === undefined ? [] : [year];
  });
}
