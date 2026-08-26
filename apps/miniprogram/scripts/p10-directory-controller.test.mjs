import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';

describe('P10 native directory controller', () => {
  let definition;
  let requests;
  let deferNextListRequest;
  let deferredListRequest;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    deferNextListRequest = false;
    deferredListRequest = undefined;
    const makePhoneCall = vi.fn();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn((key) => (key === 'schedule.wechat.session' ? session() : undefined)),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
      makePhoneCall,
      setStorageSync: vi.fn(),
      request: vi.fn((options) => {
        requests.push(options);
        if (
          options.url.endsWith(`/groups/${groupId}/directory/facets`) ||
          options.url.endsWith(`/groups/${groupId}/employee-directory/facets`)
        ) {
          options.success({ data: facets(), statusCode: 200 });
          return;
        }
        if (options.url.includes(`/groups/${groupId}/directory?`)) {
          if (deferNextListRequest) {
            deferNextListRequest = false;
            deferredListRequest = options;
            return;
          }
          const cursor = new URL(options.url).searchParams.get('cursor');
          options.success({ data: page(cursor === 'cursor-1'), statusCode: 200 });
          return;
        }
        throw new Error(`unexpected request ${options.method} ${options.url}`);
      }),
    });
    const module =
      await import('../src/subpackages/organization/components/directory-panel/controller.ts');
    definition = module.createDirectoryPanelControllerDefinition();
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads facets, searches by text, filters independently, and loads a cursor page', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    expect(requests[0]?.url).toContain(`/groups/${groupId}/directory/facets`);
    expect(page.data.campusOptions).toEqual([
      { count: 2, label: '全部', value: '' },
      { count: 1, label: '本部院区', value: 'main' },
      { count: 1, label: '东院区', value: 'east' },
    ]);
    expect(page.data.filterSections.map((section) => section.key)).toEqual([
      'campusCode',
      'section',
      'floor',
      'department',
      'subunit',
      'entryKind',
    ]);

    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(lastRequest().url).toContain('q=%E7%97%85%E6%A1%88');
    expect(page.data.entries).toHaveLength(1);
    expect(page.data.entries[0]).toMatchObject({ mergeCountLabel: '2 项同号', merged: true });
    expect(page.data.resultSummary).toContain('已合并 1 组同号条目');
    expect(page.data.nextCursor).toBe('cursor-1');

    definition.methods.handleFilterChange.call(page, {
      currentTarget: { dataset: { filter: 'campusCode' } },
      detail: { value: 1 },
    });
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(lastRequest().url).toContain('campusCode=main');
    expect(page.data.activeFilterCount).toBe(1);
    expect(page.data.filterSections.map((section) => section.key)).toEqual(['campusCode']);

    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(page.data.loadingMore).toBe(false));
    expect(lastRequest().url).toContain('cursor=cursor-1');
    expect(page.data.entries).toHaveLength(2);
  });

  it('makes complete numbers dialable but keeps extension-only contacts read-only', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    const numbers = page.data.entries[0]?.contacts.flatMap((contact) => contact.numbers) ?? [];
    const fullNumber = numbers.find((number) => number.id.endsWith(':full'));
    const extension = numbers.find((number) => number.number === '6101');
    expect(fullNumber).toMatchObject({ dialable: true, dialNumber: '075400000000' });
    expect(extension).toMatchObject({ dialable: false, label: '短号' });
    definition.methods.handleCall.call(page, {
      currentTarget: {
        dataset: { groupId: page.data.entries[0]?.id, number: fullNumber?.dialNumber },
      },
    });
    expect(globalThis.wx.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: '075400000000' });
    expect(globalThis.wx.setStorageSync).toHaveBeenCalledTimes(1);
    const [preferenceKey, preferenceValue] = globalThis.wx.setStorageSync.mock.calls[0];
    expect(preferenceKey).toBe(`schedule.directory.preferences.v1:user-1:${groupId}:internal`);
    expect(preferenceValue).not.toContain('0754-00000000');
  });

  it('toggles a merged Web-equivalent card favorite without storing phone data', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    const card = page.data.entries[0];
    expect(card.favorite).toBe(false);
    definition.methods.handleToggleFavorite.call(page, {
      currentTarget: { dataset: { groupId: card.id } },
    });
    expect(page.data.entries[0].favorite).toBe(true);
    expect(page.data.prioritySections[0]).toMatchObject({ key: 'favorites', title: '收藏通讯录' });
    const stored = globalThis.wx.setStorageSync.mock.calls.at(-1)?.[1];
    expect(stored).toContain(card.id);
    expect(stored).not.toContain('0754-00000000');
  });

  it('switches employee mode and relabels filters as organization levels', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    definition.methods.handleEmployeeMode.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    expect(page.data).toMatchObject({
      campusFilterLabel: '组织根',
      directoryKind: 'employee',
      sectionFilterLabel: '一级组织',
      subunitFilterLabel: '五级组织',
    });
    expect(lastRequest().url).toContain(`/groups/${groupId}/employee-directory/facets`);
  });

  it('fails closed before a request when organization capability is disabled', async () => {
    const capabilityStore = await import('../src/app/client-capability-store.ts');
    capabilityStore.configureRuntimeClientCapabilityReader(
      () =>
        Promise.resolve({
          core: true,
          externalMessages: false,
          global: true,
          guest: true,
          insights: false,
          organization: false,
          platform: 'miniprogram',
          version: 'test',
          workflows: true,
        }),
      'test',
    );
    await capabilityStore.refreshClientCapabilities({ force: true });
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('disabled'));
    expect(requests).toHaveLength(0);
    expect(page.data.entries).toEqual([]);
  });

  it('does not commit a pending search response after detaching', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));

    deferNextListRequest = true;
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());
    definition.lifetimes.detached.call(page);
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await flushPromises();

    expect(page.data.state).toBe('loading');
    expect(page.data.entries).toEqual([]);
  });

  it('ignores a stale load-more response after switching directory modes', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    deferNextListRequest = true;
    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());
    definition.methods.handleEmployeeMode.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await flushPromises();

    expect(page.data.directoryKind).toBe('employee');
    expect(page.data.entries).toEqual([]);
  });

  it('clears directory results when a later read loses the organization capability', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    const capabilityStore = await import('../src/app/client-capability-store.ts');
    capabilityStore.configureRuntimeClientCapabilityReader(
      () =>
        Promise.resolve({
          core: true,
          externalMessages: false,
          global: true,
          guest: true,
          insights: false,
          organization: false,
          platform: 'miniprogram',
          version: 'test',
          workflows: true,
        }),
      'test',
    );
    await capabilityStore.refreshClientCapabilities({ force: true });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('disabled'));

    expect(page.data.entries).toEqual([]);
    expect(page.data.prioritySections).toEqual([]);
  });

  it('marks the directory page as large text when the system font setting requests it', async () => {
    globalThis.wx.getWindowInfo = () => ({
      fontSizeSetting: 20,
      statusBarHeight: 24,
      windowHeight: 844,
      windowWidth: 390,
    });
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('empty'));

    expect(page.data.largeText).toBe(true);
  });

  function lastRequest() {
    return requests.at(-1);
  }
});

function createPageInstance(controller, properties) {
  const page = {
    data: { ...controller.data },
    properties,
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  return page;
}

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function session() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'session-token',
  };
}

function facets() {
  return {
    buildings: [],
    campuses: [
      { count: 1, label: '本部院区', value: 'main' },
      { count: 1, label: '东院区', value: 'east' },
    ],
    departments: [
      { count: 1, label: '医疗服务部', value: '医疗服务部' },
      { count: 1, label: '健康管理部', value: '健康管理部' },
    ],
    entryKinds: [
      { count: 1, label: '科室', value: 'department' },
      { count: 1, label: '服务点', value: 'service' },
    ],
    floors: [
      { count: 1, label: '5楼', value: '5楼' },
      { count: 1, label: '2楼', value: '2楼' },
    ],
    paths: [
      {
        campusCode: 'main',
        count: 1,
        department: '医疗服务部',
        entryKind: 'department',
        floor: '5楼',
        section: '行政服务区',
        subunit: '病案服务台',
      },
      {
        campusCode: 'east',
        count: 1,
        department: '健康管理部',
        entryKind: 'service',
        floor: '2楼',
        section: '门诊服务区',
        subunit: '预约服务台',
      },
    ],
    publishedEffectiveOn: '2026-08-01',
    publishedImportVersion: 'controller-fixture-v1',
    sections: [
      { count: 1, label: '行政服务区', value: '行政服务区' },
      { count: 1, label: '门诊服务区', value: '门诊服务区' },
    ],
    subunits: [
      { count: 1, label: '病案服务台', value: '病案服务台' },
      { count: 1, label: '预约服务台', value: '预约服务台' },
    ],
    totalCount: 2,
  };
}

function page(withoutCursor) {
  const primary = {
    campus: { code: 'main', name: '本部院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber: withoutCursor ? '0754-00000001' : '0754-00000000',
        id: withoutCursor
          ? '10000000-0000-4000-8000-000000000005'
          : '10000000-0000-4000-8000-000000000001',
        internalExtension: withoutCursor ? '6201' : '6101',
        isPrimary: true,
        type: 'voice',
      },
      {
        displayOrder: 1,
        id: withoutCursor
          ? '10000000-0000-4000-8000-000000000006'
          : '10000000-0000-4000-8000-000000000002',
        internalExtension: withoutCursor ? '6202' : '6102',
        isPrimary: false,
        type: 'voice',
      },
    ],
    department: '医疗服务部',
    displayOrder: withoutCursor ? 3 : 1,
    entryKind: 'department',
    id: withoutCursor
      ? '20000000-0000-4000-8000-000000000003'
      : '20000000-0000-4000-8000-000000000001',
    section: '行政服务区',
    subunit: withoutCursor ? '病案服务台二' : '病案服务台',
  };
  return {
    entries: withoutCursor
      ? [primary]
      : [
          primary,
          {
            ...primary,
            contacts: [
              {
                ...primary.contacts[0],
                fullNumber: '(0754) 0000 0000',
                id: '10000000-0000-4000-8000-000000000003',
              },
              { ...primary.contacts[1], id: '10000000-0000-4000-8000-000000000004' },
            ],
            displayOrder: 2,
            id: '20000000-0000-4000-8000-000000000002',
            subunit: '病案值班室',
          },
        ],
    ...(withoutCursor ? {} : { nextCursor: 'cursor-1' }),
    totalCount: 3,
  };
}

function pageResponse(withoutCursor) {
  return page(withoutCursor);
}
