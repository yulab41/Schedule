import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';

describe('P10 native directory controller', () => {
  let definition;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
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
      { count: 0, label: '全部', value: '' },
      { count: 1, label: '本部院区', value: 'main' },
    ]);

    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(lastRequest().url).toContain('q=%E7%97%85%E6%A1%88');
    expect(page.data.entries).toHaveLength(1);
    expect(page.data.nextCursor).toBe('cursor-1');

    definition.methods.handleFilterChange.call(page, {
      currentTarget: { dataset: { filter: 'campusCode' } },
      detail: { value: 1 },
    });
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(lastRequest().url).toContain('campusCode=main');

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
    const contact = page.data.entries[0]?.contacts[0];
    expect(contact).toMatchObject({ dialable: true, dialNumber: '075400000000' });
    expect(page.data.entries[0]?.contacts.some((item) => item.dialable === false)).toBe(true);
    definition.methods.handleCall.call(page, {
      currentTarget: { dataset: { number: contact?.dialNumber } },
    });
    expect(globalThis.wx.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: '075400000000' });
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
    campuses: [{ count: 1, label: '本部院区', value: 'main' }],
    departments: [{ count: 1, label: '医疗服务部', value: '医疗服务部' }],
    entryKinds: [{ count: 1, label: '科室', value: 'department' }],
    floors: [{ count: 1, label: '5楼', value: '5楼' }],
    paths: [],
    publishedEffectiveOn: '2026-08-01',
    publishedImportVersion: 'controller-fixture-v1',
    sections: [{ count: 1, label: '行政服务区', value: '行政服务区' }],
    subunits: [{ count: 1, label: '病案服务台', value: '病案服务台' }],
    totalCount: 1,
  };
}

function page(withoutCursor) {
  return {
    entries: [
      {
        campus: { code: 'main', name: '本部院区' },
        contacts: [
          {
            displayOrder: 0,
            fullNumber: '0754-00000000',
            id: '10000000-0000-4000-8000-000000000001',
            internalExtension: '6101',
            isPrimary: true,
            type: 'voice',
          },
          {
            displayOrder: 1,
            id: '10000000-0000-4000-8000-000000000002',
            internalExtension: '6102',
            isPrimary: false,
            type: 'voice',
          },
        ],
        department: '医疗服务部',
        displayOrder: withoutCursor ? 2 : 1,
        entryKind: 'department',
        id: withoutCursor
          ? '20000000-0000-4000-8000-000000000002'
          : '20000000-0000-4000-8000-000000000001',
        section: '行政服务区',
        subunit: '病案服务台',
      },
    ],
    ...(withoutCursor ? {} : { nextCursor: 'cursor-1' }),
    totalCount: 2,
  };
}
