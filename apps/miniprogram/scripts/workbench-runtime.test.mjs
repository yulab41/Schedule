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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('switches primary destinations in place and pushes secondary tools onto the Page stack', async () => {
    const storage = createStorage();
    const navigateTo = vi.fn();
    const runtime = createWx(storage, vi.fn());
    runtime.navigateTo = navigateTo;
    runtime.showToast = vi.fn();
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);
    Object.assign(instance.data, {
      canManageScheduleTools: true,
      canOpenGroupSettings: true,
      currentGroupId: 'group-1',
      groups: [groupSummary()],
      toolAccess: {
        ...instance.data.toolAccess,
        groupSettings: true,
        leave: true,
      },
      workflowPanelsMounted: true,
      workflowsEnabled: true,
    });

    definition.handleDirectoryNav.call(instance);
    expect(instance.data.activeWorkspace).toBe('directory');
    expect(instance.data.activeWorkspaceIndex).toBe(1);
    expect(instance.data.workspaceMounted.directory).toBe(true);
    expect(instance.data).not.toHaveProperty('directoryMounted');
    definition.handleProfileNav.call(instance);
    expect(instance.data.activeWorkspace).toBe('profile');
    expect(instance.data.activeWorkspaceIndex).toBe(3);
    expect(instance.data.workspaceMounted.profile).toBe(true);
    expect(instance.data).not.toHaveProperty('profileMounted');
    definition.handleSwapNav.call(instance);
    definition.handleWorkspaceSwiperChange.call(instance, { detail: { current: 1 } });
    expect(instance.data.activeWorkspace).toBe('swap');
    expect(instance.data.activeWorkspaceIndex).toBe(2);
    definition.handleDirectoryPanelReady.call(instance);
    definition.handleProfilePanelReady.call(instance);
    expect(instance.data).toMatchObject({
      directoryPanelReady: true,
      profilePanelReady: true,
    });
    definition.handleMoreNav.call(instance);
    expect(instance.data.activeWorkspace).toBe('more');

    instance.data.currentGroupId = '';
    definition.handleOpenTestCenter.call(instance);
    expect(navigateTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: '/pages/gesture-probe/index' }),
    );
    instance.data.currentGroupId = 'group-1';

    definition.handleOpenGroupSettings.call(instance);
    expect(navigateTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: '/subpackages/organization/pages/group-settings/index?groupId=group-1',
      }),
    );
    expect(instance.data.activeWorkspace).toBe('more');

    definition.handleOpenLeave.call(instance);
    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: '/subpackages/workflows/pages/leave/index?groupId=group-1',
        }),
      ),
    );
    expect(instance.data.activeWorkspace).toBe('more');
  });

  it('continues serial preload after an early-clicked workspace is already ready', async () => {
    const storage = createStorage();
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups')) {
        options.success({ data: [groupSummary()], statusCode: 200 });
        return;
      }
      const month = readBusinessMonth(options.url);
      options.success({
        data: month === undefined ? holidayApiGoldenResponse : calendar(month),
        statusCode: 200,
      });
    });
    vi.stubGlobal('wx', createWx(storage, request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);

    definition.onLoad.call(instance);
    definition.onShow.call(instance);
    definition.handleDirectoryNav.call(instance);
    definition.handleDirectoryPanelReady.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));

    expect(instance.data.workspaceReady).toMatchObject({ calendar: true, directory: true });
    expect(instance.data.workspacePreloadQueue).toEqual(['profile', 'swap']);
    expect(instance.data.workspaceMounted).toMatchObject({
      directory: true,
      profile: true,
      swap: false,
    });

    definition.handleProfilePanelReady.call(instance);
    expect(instance.data.workspacePreloadQueue).toEqual(['swap']);
    expect(instance.data.workspaceMounted.swap).toBe(true);
    definition.handleWorkspaceRequest.call(instance, {
      currentTarget: { dataset: { workspace: 'profile' } },
    });
    expect(instance.data.workspaceRequestCounts.profile).toBe(1);
    definition.handleWorkspaceReady.call(instance, {
      currentTarget: { dataset: { workspace: 'swap' } },
    });
    expect(instance.data.workspacePreloadQueue).toEqual([]);
    expect(instance.data.workspaceReady).toMatchObject({
      calendar: true,
      directory: true,
      more: true,
      profile: true,
      swap: true,
    });
    definition.handleWorkspaceReady.call(instance, {
      currentTarget: { dataset: { workspace: 'swap' } },
    });
    expect(instance.data.workspaceAttachedCounts.swap).toBe(2);
    expect(instance.data.workspaceReadyEventCounts.swap).toBe(2);
  });

  it('skips unauthorized heavy panels without blocking Profile preload', async () => {
    const storage = createStorage();
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups')) {
        options.success({
          data: [{ ...groupSummary(), role: 'guest' }],
          statusCode: 200,
        });
        return;
      }
      const month = readBusinessMonth(options.url);
      options.success({
        data: month === undefined ? holidayApiGoldenResponse : calendar(month),
        statusCode: 200,
      });
    });
    vi.stubGlobal('wx', createWx(storage, request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);

    definition.onLoad.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));

    expect(instance.data.workspacePreloadQueue).toEqual(['profile']);
    expect(instance.data.workspaceMounted).toMatchObject({
      directory: false,
      profile: true,
      swap: false,
    });
    expect(instance.data.workspaceRequestCounts).toMatchObject({ directory: 0, swap: 0 });
  });

  it('opens approved member tools and blocks every manager-only route at the handler boundary', async () => {
    const storage = createStorage();
    const navigateTo = vi.fn();
    const runtime = createWx(storage, vi.fn());
    runtime.navigateTo = navigateTo;
    runtime.showToast = vi.fn();
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);
    Object.assign(instance.data, {
      currentGroupId: 'group-1',
      groups: [groupSummary()],
      toolAccess: Object.fromEntries(
        Object.keys(instance.data.toolAccess).map((key) => [key, true]),
      ),
    });

    definition.handleOpenInsights.call(instance);
    expect(navigateTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: '/subpackages/insights/pages/insights/index?groupId=group-1',
      }),
    );
    definition.handleOpenNotifications.call(instance);
    expect(navigateTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: '/subpackages/insights/pages/notifications/index?groupId=group-1',
      }),
    );

    instance.data.toolAccess = Object.fromEntries(
      Object.keys(instance.data.toolAccess).map((key) => [key, true]),
    );
    const callCount = navigateTo.mock.calls.length;
    for (const handler of [
      definition.handleOpenManualSchedule,
      definition.handleOpenBackfill,
      definition.handleOpenSchedulingConfig,
      definition.handleOpenExports,
      definition.handleOpenInviteVisitor,
      definition.handleOpenVisitorAccess,
      definition.handleOpenPlatformAccounts,
    ]) {
      handler.call(instance);
    }
    expect(navigateTo).toHaveBeenCalledTimes(callCount);
    expect(runtime.showToast).toHaveBeenLastCalledWith({
      icon: 'none',
      title: '当前账号无权访问此工具。',
    });
  });

  it('drops administrator tool access synchronously when switching to a member group', async () => {
    const storage = createStorage();
    const runtime = createWx(
      storage,
      vi.fn((options) => options.fail?.(new Error('offline'))),
    );
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);
    Object.assign(instance.data, {
      currentGroupId: 'group-owner',
      groups: [{ id: 'group-owner', name: '管理群', role: 'owner', version: 1 }, groupSummary()],
      toolAccess: Object.fromEntries(
        Object.keys(instance.data.toolAccess).map((key) => [key, true]),
      ),
    });

    definition.handleGroupSelect.call(instance, {
      currentTarget: { dataset: { groupId: 'group-1' } },
    });

    expect(instance.data.currentGroupId).toBe('group-1');
    expect(instance.data.toolAccess).toMatchObject({
      groupSettings: true,
      insights: true,
      manualSchedule: false,
      platformAccounts: false,
    });
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));
    definition.onHide.call(instance);
  });

  it('opens the notification Sheet only for a current group and accepts unread updates', async () => {
    const storage = createStorage();
    const runtime = createWx(storage, vi.fn());
    runtime.showToast = vi.fn();
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    const instance = createPageInstance(definition);
    Object.assign(instance.data, {
      currentGroupId: 'group-1',
      filterOpen: true,
      groupOpen: true,
    });

    definition.handleNotification.call(instance);
    expect(instance.data).toMatchObject({
      filterOpen: false,
      groupOpen: false,
      notificationAnimating: true,
      notificationSheetOpen: true,
    });

    definition.handleNotificationUnreadChanged.call(instance, {
      detail: { unreadCount: 4 },
    });
    expect(instance.data.notificationUnreadCount).toBe(4);
    definition.handleNotificationClose.call(instance);
    expect(instance.data.notificationSheetOpen).toBe(false);

    instance.data.currentGroupId = '';
    definition.handleNotification.call(instance);
    expect(instance.data.notificationSheetOpen).toBe(false);
    expect(runtime.showToast).toHaveBeenLastCalledWith({
      icon: 'none',
      title: '当前群组尚未准备好，请刷新后重试。',
    });
  });

  it('loads and clears the current-group unread badge with the workbench lifecycle', async () => {
    const storage = createStorage();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups')) {
        options.success({ data: [groupSummary()], statusCode: 200 });
        return;
      }
      if (options.url.includes('/notifications/unread-count')) {
        options.success({ data: { unreadCount: 3 }, statusCode: 200 });
        return;
      }
      const month = readBusinessMonth(options.url);
      options.success({
        data: month === undefined ? holidayApiGoldenResponse : calendar(month),
        statusCode: 200,
      });
    });
    vi.stubGlobal('wx', createWx(storage, request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);

    definition.onLoad.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.notificationUnreadCount).toBe(3));
    expect(
      request.mock.calls.some(([options]) =>
        options.url.endsWith('/notifications/unread-count?groupId=group-1'),
      ),
    ).toBe(true);
    expect(setTimeoutSpy.mock.calls.some(([, milliseconds]) => milliseconds === 60_000)).toBe(true);

    instance.data.notificationSheetOpen = true;
    definition.onHide.call(instance);
    expect(instance.data.notificationSheetOpen).toBe(false);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(instance.data.profileRefreshRevision).toBe(0);
    definition.onShow.call(instance);
    expect(instance.data.profileRefreshRevision).toBe(1);
    definition.onHide.call(instance);
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

  it('measures cold-start through the first ready setData callback on the explicit route', async () => {
    const storage = createStorage();
    const now = vi
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(600)
      .mockReturnValueOnce(700)
      .mockReturnValueOnce(1100);
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups')) {
        options.success({ data: [groupSummary()], statusCode: 200 });
        return;
      }
      const month = readBusinessMonth(options.url);
      options.success({
        data: month === undefined ? holidayApiGoldenResponse : calendar(month),
        statusCode: 200,
      });
    });
    const runtime = createWx(storage, request);
    runtime.getPerformance = () => ({ now });
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);

    definition.onLoad.call(instance, { performance: '1' });
    definition.onShow.call(instance);

    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    expect(instance.data.performanceEvidence).toContain('工作台可交互 500ms');

    definition.onHide.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.performanceEvidence).toContain('前台恢复 400ms'));
    expect(now).toHaveBeenCalledTimes(4);
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
