import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const DAY = 24 * 60 * 60 * 1000;
const activeMonth = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);

describe('P6-A workbench runtime coordination', () => {
  let definition;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('commits the active month before starting best-effort adjacent reads and refreshes on resume', async () => {
    const storage = createStorage();
    let activeCalendarRequest;
    let activeHolidayRequest;
    let released = false;
    let instance;
    const adjacentStartStates = [];
    let groupReadCount = 0;
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups')) {
        groupReadCount += 1;
        options.success({ data: [groupSummary()], statusCode: 200 });
        return;
      }
      const month = readBusinessMonth(options.url);
      if (month === activeMonth && !released) {
        activeCalendarRequest = options;
        return;
      }
      if (options.url.includes('/holidays') && activeHolidayRequest === undefined && !released) {
        activeHolidayRequest = options;
        return;
      }
      adjacentStartStates.push(instance?.data.state);
      if (month !== undefined) {
        options.success({ data: calendar(month), statusCode: 200 });
      } else {
        options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
      }
    });
    vi.stubGlobal('wx', createWx(storage, request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    instance = createPageInstance(definition);

    definition.onLoad.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(activeCalendarRequest).toBeDefined());
    await vi.waitFor(() => expect(activeHolidayRequest).toBeDefined());
    expect(
      request.mock.calls.filter(([options]) => readBusinessMonth(options.url) !== undefined),
    ).toHaveLength(1);

    released = true;
    activeCalendarRequest.success({ data: calendar(activeMonth), statusCode: 200 });
    activeHolidayRequest.success({ data: holidayApiGoldenResponse, statusCode: 200 });
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    await vi.waitFor(() => expect(adjacentStartStates.length).toBeGreaterThan(0));
    await vi.waitFor(() => expect(instance.monthResources.size).toBeGreaterThan(1));
    expect(adjacentStartStates.every((state) => state === 'ready')).toBe(true);
    expect(instance.calendar?.businessMonth).toBe(activeMonth);

    const serialBeforeHide = instance.requestSerial;
    definition.onHide.call(instance);
    expect(instance.isVisible).toBe(false);
    expect(instance.requestSerial).toBe(serialBeforeHide + 1);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(groupReadCount).toBeGreaterThan(1));
    expect(instance.isVisible).toBe(true);
  });

  it('never serves a cached month after an online 403 and removes the departed group snapshot', async () => {
    const now = Date.now();
    const sanitizedCalendar = calendar(activeMonth);
    sanitizedCalendar.members = sanitizedCalendar.members.map((member) => {
      const sanitized = { ...member };
      delete sanitized.mobilePhone;
      return sanitized;
    });
    const storage = createStorage({
      [`schedule.wechat.workbench.cache.v2:user-1:group-1:${activeMonth}`]: {
        calendar: sanitizedCalendar,
        holidays: holidayApiGoldenResponse,
        savedAt: now,
      },
      'schedule.wechat.workbench.current-group': { groupId: 'group-1', ownerId: 'user-1' },
      'schedule.wechat.workbench.groups.v2:user-1': {
        groups: [groupSummary()],
        savedAt: now,
      },
    });
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups')) {
        options.success({ data: [groupSummary()], statusCode: 200 });
        return;
      }
      if (readBusinessMonth(options.url) !== undefined) {
        options.success({ data: {}, statusCode: 403 });
        return;
      }
      options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
    });
    vi.stubGlobal('wx', createWx(storage, request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);

    definition.onLoad.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));
    expect(instance.data.offlineNotice).toBe('');
    expect([...storage.keys()].some((key) => key.includes('cache.v2:user-1:group-1'))).toBe(false);
    expect(storage.has('schedule.wechat.workbench.groups.v2:user-1')).toBe(false);
  });

  it('cold-starts from the same-owner 24-hour snapshot when every network read fails', async () => {
    const now = Date.now();
    const cachedCalendar = calendar(activeMonth);
    cachedCalendar.members = cachedCalendar.members.map((member) => {
      const sanitized = { ...member };
      delete sanitized.mobilePhone;
      return sanitized;
    });
    const storage = createStorage({
      [`schedule.wechat.workbench.cache.v2:user-1:group-1:${activeMonth}`]: {
        calendar: cachedCalendar,
        holidays: holidayApiGoldenResponse,
        savedAt: now,
      },
      'schedule.wechat.workbench.current-group': { groupId: 'group-1', ownerId: 'user-1' },
      'schedule.wechat.workbench.groups.v2:user-1': {
        groups: [{ id: 'group-1', name: '急诊科', role: 'member', version: 1 }],
        savedAt: now,
      },
    });
    const request = vi.fn((options) => options.fail(new Error('offline')));
    vi.stubGlobal('wx', createWx(storage, request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);

    definition.onLoad.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('offline'), { timeout: 4_000 });
    expect(instance.data.currentGroupName).toBe('急诊科');
    expect(instance.data.offlineNotice).toContain('离线只读');
    expect(instance.calendar?.businessMonth).toBe(activeMonth);
  });
});

function createStorage(extra = {}) {
  return new Map([
    [
      'schedule.wechat.session',
      {
        expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
        profile: { id: 'user-1', realName: '林医生', version: 1 },
        token: 'test-token',
      },
    ],
    ...Object.entries(extra),
  ]);
}

function createWx(storage, request) {
  return {
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

function readBusinessMonth(url) {
  const match = /[?&]businessMonth=(\d{4}-\d{2})/u.exec(url);
  return match?.[1];
}
