import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';
const key = 'a'.repeat(32);
const groupId = '11111111-1111-4111-8111-111111111111';

describe('anonymous native visitor calendar', () => {
  let definition, storage, requests, responseStatus, offline, deferred, populated;
  beforeEach(async () => {
    vi.resetModules();
    storage = new Map();
    requests = [];
    responseStatus = 200;
    offline = false;
    populated = false;
    deferred = undefined;
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('getCurrentPages', () => []);
    vi.stubGlobal('wx', {
      getStorageSync: (k) => storage.get(k),
      setStorageSync: (k, v) => storage.set(k, v),
      removeStorageSync: (k) => storage.delete(k),
      getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      makePhoneCall: vi.fn(),
      navigateBack: vi.fn(),
      reLaunch: vi.fn(),
      request: (options) => {
        requests.push(options);
        if (deferred) {
          deferred.push(options);
          return;
        }
        if (offline) return options.fail({ errMsg: 'offline' });
        if (responseStatus !== 200)
          return options.success({
            statusCode: responseStatus,
            data: { error: { code: 'FORBIDDEN', message: 'expired', requestId: 'fake-request' } },
          });
        let data;
        if (options.url.endsWith('/resolve')) data = { groupId, groupName: '访客测试群' };
        else if (options.url.includes('/guest/holidays?'))
          data = {
            ...holidayApiGoldenResponse,
            year: Number(new URL(options.url).searchParams.get('year')),
          };
        else if (/\/guest\/groups\/[^/]+\/calendar\/shifts\/[^/]+\/events\?/.test(options.url))
          data = { events: [] };
        else if (/\/guest\/groups\/[^/]+\/calendar\?/.test(options.url)) {
          const calendar = structuredClone(calendarApiGoldenResponse);
          calendar.groupId = groupId;
          calendar.businessMonth = new URL(options.url).searchParams.get('businessMonth');
          calendar.assignments = populated
            ? calendar.assignments.map((row) => ({
                ...row,
                id: `${calendar.businessMonth}-assignment`,
                businessDate: `${calendar.businessMonth}-22`,
                startsAt: `${calendar.businessMonth}-22T00:00:00.000+08:00`,
                endsAt: `${calendar.businessMonth}-23T00:00:00.000+08:00`,
              }))
            : [];
          calendar.members[0].shortPhone = '1234';
          calendar.members[0].mobilePhone = '13800000000';
          calendar.members[1].mobilePhone = '13800000000';
          calendar.members[1].shortPhone = '1234';
          data = { calendar, groupName: '访客测试群' };
        } else throw new Error('Unexpected member API');
        options.success({ statusCode: 200, data });
      },
    });
    await enableTestClientCapabilities();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function page(options = { scene: key }) {
    await import('../src/pages/guest/guest.ts');
    const instance = {
      ...definition,
      data: structuredClone(definition.data),
      selectComponent: () => undefined,
      setData(patch, callback) {
        Object.assign(this.data, patch);
        callback?.();
      },
    };
    definition.onLoad.call(instance, options);
    definition.onShow.call(instance);
    return instance;
  }
  it.each([320, 390])(
    'uses Skyline custom navigation and avoids the capsule at %s px',
    async (width) => {
      const config = JSON.parse(
        readFileSync(new URL('../src/pages/guest/guest.json', import.meta.url), 'utf8'),
      );
      expect(config.navigationStyle).toBe('custom');
      globalThis.wx.getWindowInfo = () => ({
        statusBarHeight: 32,
        windowHeight: 844,
        windowWidth: width,
      });
      globalThis.wx.getMenuButtonBoundingClientRect = () => ({
        width: 88,
        height: 32,
        left: width - 96,
        right: width - 8,
        top: 36,
        bottom: 68,
      });
      const instance = await page({ scene: '' });
      expect(instance.data.guestHeaderStyle).toContain('padding-top:32px');
      expect(instance.data.guestHeaderStyle).toContain('padding-right:104px');
      expect(instance.data.guestHeaderStyle).toContain('height:76px');
      expect(instance.data.guestViewportStyle).toBe('height:768px;');
      globalThis.wx.getWindowInfo = () => ({
        statusBarHeight: 24,
        windowHeight: 700,
        windowWidth: width,
      });
      definition.onResize.call(instance);
      expect(instance.data.guestViewportStyle).toBe('height:624px;');
      definition.onUnload.call(instance);
    },
  );

  it('registers the exact server QR route', () => {
    const app = JSON.parse(readFileSync(new URL('../src/app.json', import.meta.url), 'utf8'));
    expect(app.pages).toContain('pages/guest/guest');
  });
  it.each([false, true])(
    'resolves before reading, stays anonymous and preserves session (logged in: %s)',
    async (loggedIn) => {
      if (loggedIn)
        storage.set('schedule.wechat.session', {
          token: 'private-account-token',
          profile: { id: 'owner' },
        });
      storage.set('schedule.wechat.workbench.group', {
        groupId: 'original-group',
        ownerId: 'owner',
      });
      const before = structuredClone([...storage]);
      const instance = await page();
      await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
      expect(requests[0].url).toContain('/guest/groups/resolve');
      expect(requests.every((o) => !o.header?.Authorization)).toBe(true);
      expect(JSON.stringify(instance.data)).not.toContain(key);
      expect(JSON.stringify(instance.data)).not.toContain('13800000000');
      expect(instance.calendar.members[0].mobilePhone).toBe('13800000000');
      expect([...storage]).toEqual(before);
      definition.onUnload.call(instance);
      expect(instance.calendar).toBeUndefined();
      expect(instance.visitorKey).toBeUndefined();
    },
  );
  it('rejects malformed keys without a calendar or identity request', async () => {
    const instance = await page({ scene: '%ZZ' });
    expect(instance.data.state).toBe('error');
    expect(requests).toEqual([]);
  });
  it('handles cross-year month/week/list navigation and filters on the read-only model', async () => {
    const instance = await page();
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    instance.data.businessMonth = '2026-12';
    instance.data.selectedDate = '2026-12-31';
    definition.handleListMonthChange.call(instance, { currentTarget: { dataset: { delta: '1' } } });
    await vi.waitFor(() => expect(instance.data.businessMonth).toBe('2027-01'));
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    for (const view of ['week', 'list', 'month']) {
      definition.handleViewChange.call(instance, { currentTarget: { dataset: { view } } });
      await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
      expect(instance.data.viewMode).toBe(view);
    }
    definition.handleFilterOptionToggle.call(instance, {
      currentTarget: {
        dataset: { kind: 'member', value: instance.calendar.members[0].membershipId },
      },
    });
    expect(instance.data.activeFilterCount).toBe(1);
    definition.handleFilterClear.call(instance);
    expect(instance.data.activeFilterCount).toBe(0);
    definition.onUnload.call(instance);
  });
  it.each([403, 404, 410])(
    'clears prior data when the visitor code is rotated/revoked (%s)',
    async (status) => {
      const instance = await page();
      await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
      definition.onHide.call(instance);
      responseStatus = status;
      definition.onShow.call(instance);
      await vi.waitFor(() => expect(instance.data.state).toBe('error'));
      expect(instance.calendar).toBeUndefined();
      expect(instance.data.monthPanels).toEqual([]);
      expect(instance.data.errorMessage).toContain('访客码');
      definition.onUnload.call(instance);
    },
  );
  it('renders populated guest duties and applies member, role and shift filters with server-approved contacts', async () => {
    populated = true;
    const instance = await page();
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    const date = `${instance.data.businessMonth}-22`;
    definition.handleDateSelect.call(instance, { detail: { businessDate: date } });
    expect(instance.data.selectedDetails).toHaveLength(1);
    expect(instance.data.selectedDetails[0].rows[0].phoneOptions).toHaveLength(2);
    expect(
      instance.data.monthPanels
        .flatMap((panel) => panel.cells)
        .some((cell) => cell.businessDate === date && cell.person),
    ).toBe(true);
    for (const [kind, value] of [
      ['member', 'membership-2'],
      ['role', 'role-1'],
      ['shift', 'shift-1'],
    ]) {
      definition.handleFilterOptionToggle.call(instance, {
        currentTarget: { dataset: { kind, value } },
      });
    }
    expect(instance.data.activeFilterCount).toBe(3);
    expect(instance.data.selectedDetails).toHaveLength(1);
    definition.handleFilterOptionToggle.call(instance, {
      currentTarget: { dataset: { kind: 'member', value: 'membership-2' } },
    });
    definition.handleFilterOptionToggle.call(instance, {
      currentTarget: { dataset: { kind: 'member', value: 'missing-member' } },
    });
    expect(instance.data.selectedDetails).toEqual([]);
    definition.onUnload.call(instance);
  });
  it('ignores queued refresh actions while hidden and clears filter labels', async () => {
    const instance = await page();
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    definition.handleFilterOptionToggle.call(instance, {
      currentTarget: { dataset: { kind: 'member', value: 'membership-1' } },
    });
    expect(instance.data.filterMemberSummary).not.toBe('全部成员');
    definition.onHide.call(instance);
    expect(instance.data.filterMemberSummary).toBe('全部成员');
    const count = requests.length;
    definition.handleRetry.call(instance);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toHaveLength(count);
    definition.onUnload.call(instance);
  });
  it('sends no visitor request when the guest capability is disabled', async () => {
    const store = await import('../src/app/client-capability-store.ts');
    const enabled = store.getClientCapabilitySnapshot();
    store.configureRuntimeClientCapabilityReader(
      () => Promise.resolve({ ...enabled, guest: false }),
      'test',
    );
    await store.refreshClientCapabilities({ force: true });
    const instance = await page();
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));
    expect(requests).toEqual([]);
    expect(instance.data.errorMessage).toContain('暂停');
    definition.onUnload.call(instance);
  });
  it('dials only on a user tap and discards events after hiding the page', async () => {
    populated = true;
    const instance = await page();
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    definition.handleDateSelect.call(instance, {
      detail: { businessDate: `${instance.data.businessMonth}-22` },
    });
    expect(globalThis.wx.makePhoneCall).not.toHaveBeenCalled();
    definition.handleListCall.call(instance, {
      currentTarget: { dataset: { phone: '13800000000' } },
    });
    expect(globalThis.wx.makePhoneCall).toHaveBeenCalledTimes(1);
    globalThis.wx.makePhoneCall.mock.calls[0][0].fail({ errMsg: 'cancel' });
    expect(instance.data.announcement).toContain('未能');
    definition.handleListCall.call(instance, { currentTarget: { dataset: { phone: '999999' } } });
    expect(globalThis.wx.makePhoneCall).toHaveBeenCalledTimes(1);
    const id = instance.calendar.assignments[0].id;
    definition.handleOpenShiftEvents.call(instance, {
      currentTarget: { dataset: { assignmentId: id } },
    });
    await vi.waitFor(() => expect(instance.data.shiftEventState).toBe('empty'));
    expect(requests.some((o) => o.url.includes(`/calendar/shifts/${id}/events?`))).toBe(true);
    deferred = [];
    definition.handleShiftEventRetry.call(instance);
    await vi.waitFor(() => expect(deferred.length).toBe(1));
    definition.onHide.call(instance);
    deferred[0].success({ statusCode: 200, data: { events: [] } });
    await Promise.resolve();
    await Promise.resolve();
    expect(instance.data.shiftEventSheetOpen).toBe(false);
    expect(instance.calendar).toBeUndefined();
    expect([...storage.keys()].some((k) => k.includes('workbench.cache'))).toBe(false);
    definition.onUnload.call(instance);
  });
  it('registers calendar phone and event actions without login or group write controls', async () => {
    const instance = await page({ scene: '' });
    const markup = readFileSync(new URL('../src/pages/guest/guest.wxml', import.meta.url), 'utf8');
    for (const [, handler] of markup.matchAll(/(?:bind|catch)[a-z:]+="([A-Za-z]+)"/g))
      expect(typeof definition[handler], handler).toBe('function');
    expect(markup).not.toMatch(/handleReLogin|handleSave|handleDelete|handleOpenDirectory/);
    definition.onUnload.call(instance);
  });
  it('retries network failures without persistent fallback and ignores a detached resolve', async () => {
    offline = true;
    const instance = await page();
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));
    offline = false;
    definition.handleRetry.call(instance);
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    deferred = [];
    definition.handleRetry.call(instance);
    await vi.waitFor(() => expect(deferred.length).toBe(1));
    definition.onUnload.call(instance);
    const before = structuredClone(instance.data);
    deferred[0].success({ statusCode: 200, data: { groupId, groupName: 'late' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(instance.data).toEqual(before);
  });
});
