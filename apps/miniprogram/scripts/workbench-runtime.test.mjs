import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const DAY = 24 * 60 * 60 * 1000;
const activeMonth = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
let livePages = [];

describe('P6-A workbench runtime coordination', () => {
  let definition;

  beforeEach(() => {
    livePages = [];
    vi.resetModules();
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  });

  afterEach(async () => {
    // Invalidate pending reads before replacing the global wx transport for the next case.
    for (const instance of livePages) instance.onHide?.call(instance);
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['month', 'week', 'list'])(
    'locates the current duty day after a long-lived %s page crosses handover',
    async (viewMode) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-07T23:59:59.000Z'));
      vi.stubGlobal('wx', createWx(createStorage(), vi.fn()));
      await import('../src/pages/workbench/index.ts');
      const instance = createPageInstance(definition);
      instance.data.viewMode = viewMode;
      vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
      definition.handleLocateToday.call(instance);
      expect(instance.data.selectedDate).toBe('2026-10-01');
      expect(instance.data.businessMonth).toBe('2026-10');
    },
  );

  it('defaults each single-member shift open and preserves manual collapse on reselection', async () => {
    vi.stubGlobal('wx', createWx(createStorage(), vi.fn()));
    await import('../src/pages/workbench/index.ts');
    const instance = createPageInstance(definition);
    const source = calendarApiGoldenResponse.assignments[0];
    instance.calendar = {
      ...calendarApiGoldenResponse,
      assignments: [
        {
          ...source,
          id: 'day-row',
          businessDate: '2026-09-07',
          shiftTypeId: 'day',
          actualMembershipId: 'member-a',
        },
        {
          ...source,
          id: 'night-row',
          businessDate: '2026-09-07',
          shiftTypeId: 'night',
          actualMembershipId: 'member-a',
        },
      ],
    };
    instance.holidays = holidayApiGoldenResponse;
    instance.data.currentGroupId = 'group-1';
    const event = { currentTarget: { dataset: { businessDate: '2026-09-07' } } };
    definition.handleWeekDaySelect.call(instance, event);
    expect(instance.data.detailExpansion.expanded).toEqual({ 'day-row': true, 'night-row': true });
    definition.handleDetailPhoneToggle.call(instance, {
      currentTarget: { dataset: { key: 'day-row' } },
    });
    definition.handleWeekDaySelect.call(instance, event);
    expect(instance.data.detailExpansion.expanded).toEqual({ 'day-row': false, 'night-row': true });
  });

  it('discards an old account calendar response before committing any group state', async () => {
    const storage = createStorage();
    let pendingGroups;
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups')) pendingGroups = options;
      else options.success({ data: holidayApiGoldenResponse, statusCode: 200 });
    });
    vi.stubGlobal('wx', createWx(storage, request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);
    definition.onLoad.call(instance);
    await vi.waitFor(() => expect(pendingGroups).toBeDefined());
    const oldSession = storage.get('schedule.wechat.session');
    storage.set('schedule.wechat.session', {
      ...oldSession,
      profile: { ...oldSession.profile, id: 'account-b' },
    });
    pendingGroups.success({ data: [groupSummary()], statusCode: 200 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(instance.data.currentGroupId).toBe('');
    expect(instance.data.detailExpansion.expanded).toEqual({});
  });

  it.each(['member', 'administrator', 'guest'])(
    'denies direct test-tool navigation for an ungranted %s',
    async (role) => {
      const runtime = createWx(createStorage(), vi.fn());
      runtime.navigateTo = vi.fn();
      runtime.showToast = vi.fn();
      vi.stubGlobal('wx', runtime);
      await import('../src/pages/workbench/index.ts');
      await enableTestClientCapabilities();
      const instance = createPageInstance(definition);
      instance.data.currentGroupRoleKind = role;
      instance.data.currentGroupIsDeveloperAdmin = true;
      await definition.handleOpenTestCenter.call(instance);
      expect(runtime.navigateTo).not.toHaveBeenCalled();
      expect(instance.data.testCenterEnabled).toBe(false);
    },
  );

  it('does not navigate after a granted lookup outlives the visible page', async () => {
    const runtime = createWx(createStorage(), vi.fn());
    let pending;
    runtime.request = (options) => {
      pending = options;
    };
    runtime.navigateTo = vi.fn();
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);
    const opening = definition.handleOpenTestCenter.call(instance);
    await vi.waitFor(() => expect(pending).toBeDefined());
    definition.onHide.call(instance);
    pending.success({ data: { allowed: true }, statusCode: 200 });
    await opening;
    expect(runtime.navigateTo).not.toHaveBeenCalled();
    expect(instance.data.testCenterEnabled).toBe(false);
  });

  it('keeps a granted More section mounted across navigation but revokes it on permission loss', async () => {
    const runtime = createWx(createStorage(), vi.fn(), true);
    runtime.navigateTo = vi.fn();
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const instance = createPageInstance(definition);
    definition.onLoad.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.testCenterEnabled).toBe(true));
    const { refreshDiagnosticsAccess } = await import('../src/platform/diagnostics-access.ts');
    const { invalidateDiagnosticsPermission } =
      await import('../src/platform/diagnostics-permission-state.ts');
    instance.data.activeWorkspace = 'more';
    definition.onHide.call(instance);
    // wx:if removing this final section clamps a scrolled More viewport during the route animation.
    expect(instance.data.testCenterEnabled).toBe(true);
    await refreshDiagnosticsAccess();
    expect(instance.data.testCenterEnabled).toBe(true);
    await definition.handleOpenTestCenter.call(instance);
    expect(runtime.navigateTo).not.toHaveBeenCalled();
    definition.onShow.call(instance);
    expect(instance.data.testCenterEnabled).toBe(true);
    definition.onHide.call(instance);
    invalidateDiagnosticsPermission();
    expect(instance.data.testCenterEnabled).toBe(false);
    await refreshDiagnosticsAccess();
    // A newly granted hidden page must not mount a new section either.
    expect(instance.data.testCenterEnabled).toBe(false);
    definition.onUnload.call(instance);
  });

  it('switches primary destinations in place and pushes secondary tools onto the Page stack', async () => {
    const storage = createStorage();
    const navigateTo = vi.fn();
    const runtime = createWx(storage, vi.fn(), true);
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
    expect(definition).not.toHaveProperty('handleWorkspaceSwiperChange');
    expect(definition).not.toHaveProperty('shouldPrimaryWorkspaceRespond');
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
    await definition.handleOpenTestCenter.call(instance);
    expect(navigateTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: '/subpackages/diagnostics/pages/test-tools/index' }),
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

  it('invalidates old reads synchronously and clears all private surfaces on guest selection', async () => {
    const storage = createStorage();
    vi.stubGlobal('wx', createWx(storage, vi.fn()));
    await import('../src/pages/workbench/index.ts');
    const instance = createPageInstance(definition);
    instance.calendar = calendar(activeMonth);
    instance.holidays = holidayApiGoldenResponse;
    instance.monthResources.set(activeMonth, {
      calendar: instance.calendar,
      holidays: instance.holidays,
      offline: false,
    });
    Object.assign(instance.data, {
      groups: [
        groupSummary(),
        { ...groupSummary(), id: 'guest-group', role: 'guest', isDeveloperAdmin: true },
      ],
      currentGroupId: 'group-1',
      activeWorkspace: 'directory',
      activeWorkspaceIndex: 1,
      state: 'ready',
      selectedDetails: [{ phoneOptions: ['private'] }],
      monthPanels: [{}],
      filterOpen: true,
      filterMemberOptions: [{ label: 'private' }],
      notificationSheetOpen: true,
      workspacePreloadQueue: ['directory', 'swap'],
    });
    const serial = instance.requestSerial;
    definition.handleGroupSelect.call(instance, {
      currentTarget: { dataset: { groupId: 'guest-group' } },
    });
    expect(instance.requestSerial).toBeGreaterThan(serial);
    expect(instance.data).toMatchObject({
      state: 'loading',
      selectedDetails: [],
      monthPanels: [],
      filterOpen: false,
      filterMemberOptions: [],
      notificationSheetOpen: false,
      activeWorkspace: 'calendar',
      toolAccess: {
        groupSettings: false,
        leave: false,
        notifications: false,
        manualSchedule: false,
      },
    });
    expect(instance.monthResources.size).toBe(0);
    definition.onHide.call(instance);
  });

  it('reauthorizes a same-group role downgrade with guest contacts and no member cache', async () => {
    const storage = createStorage();
    let role = 'member';
    let guestOffline = false;
    const request = vi.fn((options) => {
      if (options.url.endsWith('/groups'))
        return options.success({ data: [{ ...groupSummary(), role }], statusCode: 200 });
      const month = readBusinessMonth(options.url);
      if (!month)
        return options.success({
          data: options.url.includes('unread') ? { unreadCount: 0 } : holidayApiGoldenResponse,
          statusCode: 200,
        });
      if (role === 'guest' && !options.url.includes('/guest-calendar?'))
        return options.success({
          data: { error: { code: 'FORBIDDEN', message: 'guest', requestId: 'forbidden' } },
          statusCode: 403,
        });
      if (guestOffline) return options.fail({ errMsg: 'offline' });
      const payload = calendar(month);
      payload.members[0].shortPhone = '1234';
      payload.members[0].mobilePhone = '13800000000';
      options.success({
        data: role === 'guest' ? { calendar: payload, groupName: '访客群' } : payload,
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
    role = 'guest';
    definition.onHide.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.currentGroupRoleKind).toBe('guest'));
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    expect(instance.calendar.members[0].mobilePhone).toBe('13800000000');
    expect(
      [...storage.keys()].filter((key) => key.startsWith('schedule.wechat.workbench.cache.v2:')),
    ).toEqual([]);
    const memberRequestCount = request.mock.calls.filter(([o]) =>
      o.url.includes('/calendar?'),
    ).length;
    guestOffline = true;
    definition.onHide.call(instance);
    definition.onShow.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));
    expect(instance.data.selectedDetails).toEqual([]);
    expect(instance.calendar).toBeUndefined();
    expect(request.mock.calls.filter(([o]) => o.url.includes('/calendar?'))).toHaveLength(
      memberRequestCount,
    );
    definition.onUnload.call(instance);
  });

  it.each([200, 403])(
    'discards a late guest response after a rapid member return (%s)',
    async (status) => {
      const storage = createStorage();
      const pendingGuest = [];
      const groups = [groupSummary(), { ...groupSummary(), id: 'guest-group', role: 'guest' }];
      const request = vi.fn((options) => {
        if (options.url.endsWith('/groups'))
          return options.success({ statusCode: 200, data: groups });
        if (options.url.includes('/guest-calendar?')) {
          pendingGuest.push(options);
          return;
        }
        if (options.url.includes('/guest-group/calendar?'))
          return options.success({
            statusCode: 403,
            data: { error: { code: 'FORBIDDEN', message: 'guest', requestId: 'denied' } },
          });
        const month = readBusinessMonth(options.url);
        options.success({
          statusCode: 200,
          data: month
            ? calendar(month)
            : options.url.includes('unread')
              ? { unreadCount: 0 }
              : holidayApiGoldenResponse,
        });
      });
      vi.stubGlobal('wx', createWx(storage, request));
      await import('../src/pages/workbench/index.ts');
      await enableTestClientCapabilities();
      const instance = createPageInstance(definition);
      definition.onLoad.call(instance);
      definition.onShow.call(instance);
      await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
      definition.handleGroupSelect.call(instance, {
        currentTarget: { dataset: { groupId: 'guest-group' } },
      });
      await vi.waitFor(() => expect(pendingGuest.length).toBe(1));
      const guestReads = request.mock.calls.filter(([o]) => o.url.includes('guest-group'));
      expect(
        guestReads.every(
          ([o]) =>
            o.url.includes('/guest-calendar?') ||
            o.url.endsWith('/guest-calendar/display-settings'),
        ),
      ).toBe(true);
      definition.handleGroupSelect.call(instance, {
        currentTarget: { dataset: { groupId: 'group-1' } },
      });
      await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
      const before = structuredClone(instance.data);
      const saved = structuredClone([...storage]);
      pendingGuest[0].success({
        statusCode: status,
        data:
          status === 200
            ? { calendar: { ...calendar(activeMonth), groupId: 'guest-group' }, groupName: 'late' }
            : { error: { code: 'FORBIDDEN', message: 'revoked', requestId: 'late' } },
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(instance.data.currentGroupId).toBe('group-1');
      expect(instance.calendar.groupId).toBe('group-1');
      expect(instance.data.selectedDetails).toEqual(before.selectedDetails);
      expect([...storage]).toEqual(saved);
      definition.onUnload.call(instance);
    },
  );

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
        data:
          month === undefined
            ? holidayApiGoldenResponse
            : options.url.includes('/guest-calendar?')
              ? { calendar: calendar(month), groupName: '访客群' }
              : { error: { code: 'FORBIDDEN', message: '仅成员可访问', requestId: 'guest-403' } },
        statusCode: month === undefined || options.url.includes('/guest-calendar?') ? 200 : 403,
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
      if (options.url.endsWith('/calendar-preferences')) {
        options.fail({ errMsg: 'request:fail test preferences unavailable' });
        return;
      }
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

  it.each(['switch', 'hide'])(
    'scopes a slow group preference independently of calendar navigation (%s)',
    async (action) => {
      const groupId = '00000000-0000-4000-8000-000000000001';
      const officeId = '00000000-0000-4000-8000-000000000002';
      const aId = '00000000-0000-4000-8000-000000000003';
      let preferencesRequest;
      const request = vi.fn((options) => {
        if (options.url.endsWith('/groups'))
          return options.success({
            statusCode: 200,
            data: [{ ...groupSummary(), id: groupId, name: '头颈外科护士' }],
          });
        if (options.url.endsWith('/calendar-preferences')) {
          preferencesRequest = options;
          return;
        }
        const month = readBusinessMonth(options.url);
        if (month)
          return options.success({
            statusCode: 200,
            data: {
              ...calendar(month),
              groupId,
              shiftTypes: [
                {
                  ...calendarApiGoldenResponse.shiftTypes[0],
                  id: aId,
                  name: 'A班',
                  abbreviation: 'A',
                },
                {
                  ...calendarApiGoldenResponse.shiftTypes[0],
                  id: officeId,
                  name: '电脑班',
                  abbreviation: '电脑',
                },
              ],
              assignments: [
                {
                  ...calendarApiGoldenResponse.assignments[0],
                  businessDate: `${month}-12`,
                  shiftTypeId: aId,
                  shiftTypeName: 'A班',
                  shiftTypeAbbreviation: 'A',
                  actualMemberName: '人员甲',
                },
                {
                  ...calendarApiGoldenResponse.assignments[0],
                  id: 'office-row',
                  businessDate: `${month}-12`,
                  shiftTypeId: officeId,
                  shiftTypeName: '电脑班',
                  shiftTypeAbbreviation: '电脑',
                  actualMemberName: '人员乙',
                },
              ],
            },
          });
        return options.success({ statusCode: 200, data: holidayApiGoldenResponse });
      });
      vi.stubGlobal('wx', createWx(createStorage(), request));
      await import('../src/pages/workbench/index.ts');
      await enableTestClientCapabilities();
      const instance = createPageInstance(definition);
      definition.onLoad.call(instance);
      await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
      const response = {
        canManageGroupDefaults: false,
        effectiveMonthShiftTypeId: aId,
        effectiveView: 'month',
        groupDefaultMonthShiftTypeId: officeId,
        groupDefaultView: 'month',
        groupId,
        memberDefaultMonthShiftTypeId: aId,
        memberDefaultView: 'month',
        membershipId: groupId,
      };
      if (action === 'hide') {
        definition.onHide.call(instance);
        preferencesRequest.success({ statusCode: 200, data: response });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(instance._groupMonthShiftTypeId).toBeUndefined();
        return;
      }
      definition.handleViewChange.call(instance, { currentTarget: { dataset: { view: 'week' } } });
      preferencesRequest.success({ statusCode: 200, data: response });
      await vi.waitFor(() => expect(instance._groupMonthShiftTypeId).toBe(officeId));
      await vi.waitFor(() =>
        expect(
          instance.data.monthPanels
            .flatMap((p) => p.cells)
            .find((c) => c.businessDate === `${activeMonth}-12`).person,
        ).toBe('人员乙'),
      );
      definition.onHide.call(instance);
    },
  );

  it('refreshes nurse status at the next boundary, clears timers on hide and resets manual card expansion', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T11:59:59+08:00'));
    vi.stubGlobal('wx', createWx(createStorage(), vi.fn()));
    await import('../src/pages/workbench/index.ts');
    const instance = createPageInstance(definition);
    instance.requestOwnerId = 'user-1';
    instance.calendar = {
      ...calendarApiGoldenResponse,
      assignments: [
        {
          ...calendarApiGoldenResponse.assignments[0],
          businessDate: '2026-09-12',
          shiftTypeId: 'D',
          shiftTypeName: 'D班',
          shiftTypeAbbreviation: 'D',
        },
      ],
    };
    instance.holidays = holidayApiGoldenResponse;
    instance.data.currentGroupName = '头颈外科护士';
    instance.data.currentGroupId = 'group-1';
    definition.handleWeekDaySelect.call(instance, {
      currentTarget: { dataset: { businessDate: '2026-09-12' } },
    });
    expect(instance.data.selectedDetails[0].dutyState).toBe('working');
    await vi.advanceTimersByTimeAsync(1000);
    expect(instance.data.selectedDetails[0].dutyState).toBe('rest');
    expect(instance.data.shiftCardExpansion.expanded.D).toBe(false);
    definition.handleShiftCardToggle.call(instance, { currentTarget: { dataset: { key: 'D' } } });
    expect(instance.data.shiftCardExpansion.expanded.D).toBe(true);
    definition.onHide.call(instance);
    expect(instance._dutyTimer).toBeUndefined();
    definition.onShow.call(instance);
    expect(instance.data.shiftCardExpansion.expanded.D).toBe(false);
    definition.onHide.call(instance);
    await vi.advanceTimersByTimeAsync(0);
  });

  it('clears the previous account before the foreground status refresh', async () => {
    vi.stubGlobal('wx', createWx(createStorage(), vi.fn()));
    await import('../src/pages/workbench/index.ts');
    const instance = createPageInstance(definition);
    instance.requestOwnerId = 'previous-account';
    instance.calendar = calendar(activeMonth);
    instance.holidays = holidayApiGoldenResponse;
    definition.onShow.call(instance);
    expect(instance.calendar).toBeUndefined();
    expect(instance.data.selectedDetails).toEqual([]);
  });

  it.each(['2026-09-07', '2026-08-31'])(
    'keeps measured week height on date selection and leaves space below the lowest card (%s)',
    async (weekStart) => {
      const ticks = [];
      const measurements = [];
      const runtime = createWx(createStorage(), vi.fn());
      runtime.nextTick = (callback) => ticks.push(callback);
      runtime.createSelectorQuery = () => ({
        in: () => ({
          selectAll: () => ({
            boundingClientRect: (callback) => ({ exec: () => measurements.push(callback) }),
          }),
        }),
      });
      vi.stubGlobal('wx', runtime);
      await import('../src/pages/workbench/index.ts');
      const instance = createPageInstance(definition);
      instance.calendar = calendar(activeMonth);
      instance.holidays = holidayApiGoldenResponse;
      instance.data.viewMode = 'week';
      instance.data.weekStart = weekStart;
      instance.data.businessMonth = weekStart.slice(0, 7);
      instance.data.selectedDate = weekStart;
      definition.onResize.call(instance);
      ticks.splice(0).forEach((callback) => callback());
      measurements.splice(0).forEach((callback) => callback([{ height: 500 }]));
      expect(instance.data.weekGridHeight).toBe(528);
      const heights = [];
      const selectionPatches = [];
      const setData = instance.setData;
      instance.setData = function (patch, callback) {
        selectionPatches.push(patch);
        if ('weekGridHeight' in patch) heights.push(patch.weekGridHeight);
        setData.call(this, patch, callback);
      };
      definition.handleWeekDaySelect.call(instance, {
        currentTarget: {
          dataset: { businessDate: instance.data.weekPanels[1].days[1].businessDate },
        },
      });
      expect(instance.data.weekGridHeight).toBe(528);
      expect(heights.every((height) => height === 528)).toBe(true);
      expect(
        selectionPatches.some((patch) => 'weekPanels' in patch || 'weekGridHeight' in patch),
      ).toBe(false);
      expect(instance.data.monthPanels.every((panel) => panel.rowHeight === 62)).toBe(true);
      expect(ticks).toHaveLength(0);
      definition.onResize.call(instance);
      const resizeEstimate = instance.data.weekGridHeight;
      ticks.splice(0).forEach((callback) => callback());
      measurements.splice(0).forEach((callback) => callback([]));
      expect(instance.data.weekGridHeight).toBe(resizeEstimate);
    },
  );

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

  it('measures only the current week after rendering and discards old content measurements', async () => {
    const ticks = [],
      measurements = [],
      selectors = [],
      rendered = [];
    const runtime = createWx(createStorage(), vi.fn());
    runtime.nextTick = (callback) => ticks.push(callback);
    runtime.createSelectorQuery = () => ({
      in: () => ({
        selectAll: (selector) => {
          selectors.push(selector);
          return {
            boundingClientRect: (callback) => ({ exec: () => measurements.push(callback) }),
          };
        },
      }),
    });
    vi.stubGlobal('wx', runtime);
    await import('../src/pages/workbench/index.ts');
    const instance = createPageInstance(definition);
    instance.calendar = calendar('2026-09');
    const sample = structuredClone(calendarApiGoldenResponse.assignments[0]);
    instance.calendar.assignments = Array.from({ length: 50 }, (_, i) => ({
      ...sample,
      id: `neighbor-${i}`,
      actualMemberName: '邻周长姓名',
      businessDate: '2026-09-15',
    }));
    instance.holidays = { year: 2026, confirmed: true, dates: [] };
    Object.assign(instance.data, {
      viewMode: 'week',
      weekStart: '2026-09-07',
      selectedDate: '2026-09-07',
      businessMonth: '2026-09',
    });
    const baseSetData = instance.setData;
    instance.setData = function (patch, callback) {
      baseSetData.call(this, patch);
      if (callback) rendered.push(callback);
    };
    definition.onResize.call(instance);
    expect(instance.data.weekGridHeight).toBeLessThan(200);
    expect(ticks).toHaveLength(0);
    rendered.splice(0).forEach((callback) => callback());
    ticks.splice(0).forEach((callback) => callback());
    expect(selectors).toEqual(['.week-panel-current .week-day-content']);
    const old = measurements.shift();
    instance.calendar.assignments.push({ ...sample, id: 'current', businessDate: '2026-09-07' });
    definition.onResize.call(instance);
    const estimate = instance.data.weekGridHeight;
    old([{ height: 2000 }]);
    expect(instance.data.weekGridHeight).toBe(estimate);
    rendered.splice(0).forEach((callback) => callback());
    ticks.splice(0).forEach((callback) => callback());
    measurements.shift()([{ height: 180 }]);
    expect(instance.data.weekGridHeight).toBe(208);
    instance.calendar.assignments.push({
      ...sample,
      id: 'neighbor-new',
      businessDate: '2026-09-15',
    });
    definition.onResize.call(instance);
    expect(instance.data.weekGridHeight).toBe(208);
    rendered.splice(0).forEach((callback) => callback());
    expect(ticks).toHaveLength(0);
    definition.handleWeekDaySelect.call(instance, {
      currentTarget: { dataset: { businessDate: '2026-09-08' } },
    });
    definition.handleWeekDaySelect.call(instance, {
      currentTarget: { dataset: { businessDate: '2026-09-09' } },
    });
    expect(
      instance.data.weekPanels[1].days
        .filter((day) => day.isSelected)
        .map((day) => day.businessDate),
    ).toEqual(['2026-09-09']);
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
        clientVersion: 'test',
        expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
        profile: { id: 'user-1', realName: '林医生', version: 1 },
        token: 'test-token',
      },
    ],
    ...Object.entries(extra),
  ]);
}

function createWx(storage, request, diagnosticsAllowed = false) {
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
    request: (options) =>
      options.url.endsWith('/me/diagnostics-access')
        ? options.success({ data: { allowed: diagnosticsAllowed }, statusCode: 200 })
        : request(options),
    setStorageSync: (key, value) => storage.set(key, value),
  };
}

function createPageInstance(pageDefinition) {
  const data = structuredClone(pageDefinition.data);
  const instance = {
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
      for (const [key, value] of Object.entries(patch)) {
        const segments = key.replace(/\[(\d+)\]/gu, '.$1').split('.');
        let target = data;
        for (const segment of segments.slice(0, -1)) target = target[segment];
        target[segments.at(-1)] = value;
      }
      callback?.();
    },
  };
  livePages.push(instance);
  return instance;
}

function groupSummary() {
  return { id: 'group-1', name: '急诊科', role: 'member', version: 1 };
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
