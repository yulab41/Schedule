import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const secondGroupId = '22222222-2222-4222-8222-222222222222';

describe('P10 native directory controller', () => {
  let definition;
  let requests;
  let deferNextListRequest;
  let deferFacetRequests;
  let deferredListRequest;
  let deferredFacetRequests;
  let facetsResponse;
  let failFacetKinds;
  let failListRequestsRemaining;
  let invalidCursorNext;
  let unauthorizedNextFacets;
  let unauthorizedNextList;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    deferNextListRequest = false;
    deferFacetRequests = false;
    deferredListRequest = undefined;
    deferredFacetRequests = [];
    facetsResponse = facets();
    failFacetKinds = new Set();
    failListRequestsRemaining = 0;
    invalidCursorNext = false;
    unauthorizedNextFacets = false;
    unauthorizedNextList = false;
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
          options.url.endsWith(`/groups/${groupId}/employee-directory/facets`) ||
          options.url.endsWith(`/groups/${secondGroupId}/directory/facets`) ||
          options.url.endsWith(`/groups/${secondGroupId}/employee-directory/facets`)
        ) {
          const facetKind = options.url.includes('/employee-directory/') ? 'employee' : 'internal';
          if (unauthorizedNextFacets) {
            unauthorizedNextFacets = false;
            options.success({
              data: {
                error: {
                  code: 'FORBIDDEN',
                  message: '当前账户无权读取通讯录。',
                  requestId: 'request-facets-forbidden',
                },
              },
              statusCode: 403,
            });
            return;
          }
          if (failFacetKinds.has(facetKind)) {
            options.fail({ errMsg: 'request:fail facets offline' });
            return;
          }
          if (deferFacetRequests) {
            deferredFacetRequests.push(options);
            return;
          }
          options.success({ data: facetsResponse, statusCode: 200 });
          return;
        }
        if (options.url.includes(`/groups/${groupId}/directory?`)) {
          if (unauthorizedNextList) {
            unauthorizedNextList = false;
            options.success({
              data: {
                error: {
                  code: 'FORBIDDEN',
                  message: '当前账户无权读取通讯录。',
                  requestId: 'request-forbidden',
                },
              },
              statusCode: 403,
            });
            return;
          }
          if (invalidCursorNext) {
            invalidCursorNext = false;
            options.success({
              data: {
                error: {
                  code: 'VALIDATION_FAILED',
                  message: 'cursor 游标无效，请从头刷新。',
                  requestId: 'request-invalid-cursor',
                },
              },
              statusCode: 400,
            });
            return;
          }
          if (failListRequestsRemaining > 0) {
            failListRequestsRemaining -= 1;
            options.fail({ errMsg: 'request:fail list offline' });
            return;
          }
          if (deferNextListRequest) {
            deferNextListRequest = false;
            deferredListRequest = options;
            return;
          }
          const cursor = new URL(options.url).searchParams.get('cursor');
          const query = new URL(options.url).searchParams.get('q');
          options.success({
            data:
              query === '空结果'
                ? { entries: [], totalCount: 0 }
                : page(cursor === 'cursor-1' || query === '新查询'),
            statusCode: 200,
          });
          return;
        }
        if (options.url.includes(`/groups/${groupId}/employee-directory?`)) {
          options.success({
            data: page(true),
            header: { 'x-request-id': 'directory-request-employee-1' },
            profile: {
              SSLconnectionEnd: 8,
              SSLconnectionStart: 7,
              connectEnd: 9,
              connectStart: 4,
              domainLookUpEnd: 4,
              domainLookUpStart: 2,
              requestStart: 9,
              responseEnd: 24,
              responseStart: 20,
            },
            statusCode: 200,
          });
          return;
        }
        throw new Error(`unexpected request ${options.method} ${options.url}`);
      }),
    });
    const module =
      await import('../src/subpackages/organization/components/directory-panel/controller.ts');
    const diagnostics =
      await import('../src/subpackages/organization/components/directory-panel/directory-diagnostics-bridge.ts');
    definition = module.createDirectoryPanelControllerDefinition(
      diagnostics.directoryDiagnosticsBridge,
    );
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for 500ms of quiet input and sends only the latest automatic search', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    definition.methods.handleSearchInput.call(page, { detail: { value: '李' } });
    await vi.advanceTimersByTimeAsync(265);
    definition.methods.handleSearchInput.call(page, { detail: { value: '李四' } });
    await vi.advanceTimersByTimeAsync(450);
    definition.methods.handleSearchInput.call(page, { detail: { value: '李四五' } });
    await vi.advanceTimersByTimeAsync(499);
    expect(listRequests()).toHaveLength(listRequestCount);

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(listRequests()).toHaveLength(listRequestCount + 1);
    expect(lastRequest().url).toContain('q=%E6%9D%8E%E5%9B%9B%E4%BA%94');
  });

  it('does not auto-send a slowly typed partial full-pinyin query', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    for (const value of ['x', 'xu', 'xum', 'xuma', 'xuman', 'xumanb', 'xumanbi', 'xumanbin']) {
      definition.methods.handleSearchInput.call(page, { detail: { value } });
      await vi.advanceTimersByTimeAsync(600);
    }

    expect(listRequests()).toHaveLength(listRequestCount);
  });

  it('does not auto-send slowly typed ASCII initials without confirmation', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    for (const value of ['x', 'xm', 'xmb']) {
      definition.methods.handleSearchInput.call(page, { detail: { value } });
      await vi.advanceTimersByTimeAsync(600);
    }

    expect(listRequests()).toHaveLength(listRequestCount);
  });

  it('does not auto-send one-character or intermediate numeric input', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    for (const value of ['0', '04', '046', '0468']) {
      definition.methods.handleSearchInput.call(page, { detail: { value } });
      await vi.advanceTimersByTimeAsync(600);
    }

    expect(listRequests()).toHaveLength(listRequestCount);
  });

  it('does not auto-send phone or ASCII-numeric mixed input', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    for (const value of ['7', '70', '700', '7000', '70000000001', 'D0468', 'xmb0468']) {
      definition.methods.handleSearchInput.call(page, { detail: { value } });
      await vi.advanceTimersByTimeAsync(600);
    }

    expect(listRequests()).toHaveLength(listRequestCount);
  });

  it('uses one handler for the visible search action and keyboard confirmation', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;

    definition.methods.handleSearchInput.call(page, { detail: { value: 'xmb' } });
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    expect(listRequests()).toHaveLength(listRequestCount + 1);

    definition.methods.handleSearchInput.call(page, { detail: { value: 'xumanbin' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    expect(listRequests()).toHaveLength(listRequestCount + 2);
  });

  it('reuses one in-flight request across visible-button and keyboard confirmation', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: 'xmb' } });
    deferNextListRequest = true;

    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());
    expect(listRequests()).toHaveLength(1);

    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
  });

  it('keeps a single Han character eligible for the 500ms automatic search', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    definition.methods.handleSearchInput.call(page, { detail: { value: '徐' } });
    await vi.advanceTimersByTimeAsync(499);
    expect(listRequests()).toHaveLength(listRequestCount);
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(listRequests()).toHaveLength(listRequestCount + 1);
    expect(lastRequest().url).toContain('q=%E5%BE%90');
  });

  it('cancels the Han debounce when keyboard confirmation starts the same search', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    definition.methods.handleSearchInput.call(page, { detail: { value: '徐' } });
    definition.methods.handleSearch.call(page);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(600);
    await flushPromises();

    expect(listRequests()).toHaveLength(listRequestCount + 1);
  });

  it('clears an unexpired Han debounce when the query is cleared', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    definition.methods.handleSearchInput.call(page, { detail: { value: '徐' } });
    await vi.advanceTimersByTimeAsync(250);
    definition.methods.handleClearSearch.call(page);
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(listRequests()).toHaveLength(listRequestCount);
    expect(page.data.internalPane.searchQuery).toBe('');
  });

  it('clears an unexpired debounce when switching directory modes', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    definition.methods.handleSearchInput.call(page, { detail: { value: '徐' } });
    await vi.advanceTimersByTimeAsync(250);
    definition.methods.handleEmployeeMode.call(page);
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(listRequests()).toHaveLength(listRequestCount);
    expect(page.data.directoryKind).toBe('employee');
  });

  it('lets a filter search replace an unexpired debounce without a second request', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const listRequestCount = listRequests().length;
    vi.useFakeTimers();

    definition.methods.handleSearchInput.call(page, { detail: { value: '徐' } });
    await vi.advanceTimersByTimeAsync(250);
    definition.methods.handleFilterOption.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'internal', filter: 'campusCode', value: 'main' },
      },
    });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(listRequests()).toHaveLength(listRequestCount + 1);
    expect(lastRequest().url).toContain('campusCode=main');
  });

  it('loads facets, searches by text, filters independently, and loads a cursor page', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    expect(
      requests.some((request) => request.url.endsWith(`/groups/${groupId}/directory/facets`)),
    ).toBe(true);
    definition.methods.handleOpenFilters.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    expect(
      page.data.activeSheet.sections.find((section) => section.key === 'campusCode')?.options,
    ).toEqual([
      { count: 2, label: '全部', value: '' },
      { count: 1, label: '本部院区', value: 'main' },
      { count: 1, label: '东院区', value: 'east' },
    ]);
    expect(page.data.internalPane.guideStops.map((section) => section.key)).toEqual([
      'campusCode',
      'section',
      'floor',
      'department',
      'subunit',
      'entryKind',
    ]);

    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    expect(lastRequest().url).toContain('q=%E7%97%85%E6%A1%88');
    expect(page.data.internalPane.entries).toHaveLength(1);
    expect(page.data.internalPane.entries[0]).toMatchObject({
      mergeCountLabel: '2 项同号',
      merged: true,
    });
    expect(page.data.internalPane.resultSummary).toContain('已合并 1 组同号条目');
    expect(page.data.internalPane.hasMore).toBe(true);

    definition.methods.handleFilterOption.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'internal', filter: 'campusCode', value: 'main' },
      },
    });
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    expect(lastRequest().url).toContain('campusCode=main');
    expect(page.data.internalPane.activeFilterCount).toBe(1);
    expect(page.data.internalPane.guideStops.map((section) => section.key)).toEqual(['campusCode']);

    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.loadingMore).toBe(false));
    expect(lastRequest().url).toContain('cursor=cursor-1');
    expect(page.data.internalPane.entries).toHaveLength(2);
  });

  it('makes complete numbers dialable but keeps extension-only contacts read-only', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    const numbers =
      page.data.internalPane.entries[0]?.contacts.flatMap((contact) => contact.numbers) ?? [];
    const fullNumber = numbers.find((number) => number.id.endsWith(':full'));
    const extension = numbers.find((number) => number.number === '6101');
    expect(fullNumber).toMatchObject({ dialable: true, dialNumber: '075400000000' });
    expect(extension).toMatchObject({ dialable: false, label: '短号' });
    definition.methods.handleCall.call(page, {
      currentTarget: {
        dataset: {
          directoryKind: 'internal',
          groupId: page.data.internalPane.entries[0]?.id,
          number: fullNumber?.dialNumber,
        },
      },
    });
    expect(globalThis.wx.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: '075400000000' });
    expect(globalThis.wx.setStorageSync).toHaveBeenCalledTimes(1);
    const [preferenceKey, preferenceValue] = globalThis.wx.setStorageSync.mock.calls[0];
    expect(preferenceKey).toBe(`schedule.directory.preferences.v1:user-1:${groupId}:internal`);
    expect(preferenceValue).not.toContain('0754-00000000');
  });

  it('preserves the current result and pagination when foreground context and facets are unchanged', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    definition.methods.handleMainScroll.call(page, { detail: { scrollTop: 236 } });

    const card = page.data.internalPane.entries[0];
    const dialNumber = card.contacts
      .flatMap((contact) => contact.numbers)
      .find((number) => Boolean(number.dialNumber))?.dialNumber;
    definition.methods.handleCall.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'internal', groupId: card.id, number: dialNumber },
      },
    });
    const entries = page.data.internalPane.entries;
    const listRequestCount = listRequests().length;
    const setDataCount = page.setDataCalls.length;

    page.properties = { ...page.properties, contextRefreshRevision: 2 };
    definition.observers.contextRefreshRevision.call(page);
    await vi.waitFor(() =>
      expect(
        requests.filter((request) => request.url.endsWith(`/groups/${groupId}/directory/facets`)),
      ).toHaveLength(2),
    );
    await flushPromises();

    expect(listRequests()).toHaveLength(listRequestCount);
    expect(page.setDataCalls).toHaveLength(setDataCount);
    expect(page.data.directoryKind).toBe('internal');
    expect(page.data.internalPane.searchQuery).toBe('病案');
    expect(page.data.internalPane.entries).toBe(entries);
    expect(page.data.internalPane.hasMore).toBe(true);
    expect(page._modeRuntimes.internal.nextCursor).toBe('cursor-1');
    expect(page._modeRuntimes.internal.mainScrollTop).toBe(236);
  });

  it('revalidates a standalone foreground return without clearing an unchanged query', async () => {
    const page = createPageInstance(definition, runtimeProperties({ embedded: false }));
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    const entries = page.data.internalPane.entries;
    const listRequestCount = listRequests().length;

    definition.methods.handleForegroundRefresh.call(page);
    await vi.waitFor(() =>
      expect(
        requests.filter((request) => request.url.endsWith(`/groups/${groupId}/directory/facets`)),
      ).toHaveLength(2),
    );
    await flushPromises();

    expect(listRequests()).toHaveLength(listRequestCount);
    expect(page.data.internalPane.searchQuery).toBe('病案');
    expect(page.data.internalPane.entries).toBe(entries);
  });

  it('keeps one close path for the finish button and handle swipe after a filter applies', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleOpenFilters.call(page);
    definition.methods.handleFilterOption.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'internal', filter: 'campusCode', value: 'main' },
      },
    });
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

    definition.methods.handleFilterSheetSwipeDismiss.call(page);

    expect(page.data.filterSheetOpen).toBe(false);
    expect(page.data.activeSheet.open).toBe(false);
    expect(page.data.internalPane.activeFilterCount).toBe(1);
    expect(lastRequest().url).toContain('campusCode=main');
  });

  it('clears sensitive results when foreground facets revalidation returns 403', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

    unauthorizedNextFacets = true;
    definition.methods.handleForegroundRefresh.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('error'));

    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.data.internalPane.guideStops).toEqual([]);
    expect(page.data.employeePane.entries).toEqual([]);
    expect(page.data.employeePane.guideStops).toEqual([]);
  });

  it('toggles a merged Web-equivalent card favorite without storing phone data', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

    const card = page.data.internalPane.entries[0];
    expect(card.favorite).toBe(false);
    definition.methods.handleToggleFavorite.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal', groupId: card.id } },
    });
    expect(page.data.internalPane.entries[0].favorite).toBe(true);
    expect(page.data.internalPane.prioritySections[0]).toMatchObject({
      key: 'favorites',
      title: '收藏通讯录',
    });
    const stored = globalThis.wx.setStorageSync.mock.calls.at(-1)?.[1];
    expect(stored).toContain(card.id);
    expect(stored).not.toContain('0754-00000000');
  });

  it('switches employee mode and relabels filters as organization levels', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => {
      expect(page.data.internalPane.state).toBe('idle');
      expect(page.data.employeePane.state).toBe('idle');
    });
    definition.methods.handleEmployeeMode.call(page);
    expect(page.data.directoryKind).toBe('employee');
    expect(page.data.employeePane.guideStops.map((section) => section.label)).toEqual([
      '组织根',
      '一级组织',
      '三级组织',
      '四级组织',
      '五级组织',
      '类型',
    ]);
    expect(
      requests.some((request) =>
        request.url.endsWith(`/groups/${groupId}/employee-directory/facets`),
      ),
    ).toBe(true);
  });

  it('preloads both modes once and preserves each mode state across clicks and swipes', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);

    await vi.waitFor(() => {
      expect(page.data.internalPane?.state).toBe('idle');
      expect(page.data.employeePane?.state).toBe('idle');
    });
    expect(
      requests.filter((request) => request.url.endsWith(`/groups/${groupId}/directory/facets`)),
    ).toHaveLength(1);
    expect(
      requests.filter((request) =>
        request.url.endsWith(`/groups/${groupId}/employee-directory/facets`),
      ),
    ).toHaveLength(1);

    definition.methods.handleSearchInput.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
      detail: { value: '病案' },
    });
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    await vi.waitFor(() => expect(page.data.internalPane?.state).toBe('ready'));
    const internalEntries = page.data.internalPane.entries;
    const internalRequestCount = requests.length;

    definition.methods.handleEmployeeMode.call(page);
    expect(page.data.directoryKind).toBe('employee');
    expect(page.data.internalPane.searchQuery).toBe('病案');
    expect(page.data.internalPane.entries).toEqual([]);

    definition.methods.handleModeSwiperChange.call(page, { detail: { current: 0 } });
    expect(page.data.directoryKind).toBe('internal');
    expect(page.data.internalPane.searchQuery).toBe('病案');
    expect(page.data.internalPane.entries).toEqual(internalEntries);
    expect(requests).toHaveLength(internalRequestCount);
  });

  it('lets an inactive-mode request settle into its own pane without contaminating the active pane', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane?.state).toBe('idle'));

    deferNextListRequest = true;
    definition.methods.handleSearchInput.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
      detail: { value: '病案' },
    });
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());

    definition.methods.handleEmployeeMode.call(page);
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await flushPromises();

    expect(page.data.directoryKind).toBe('employee');
    expect(page.data.employeePane.entries).toEqual([]);
    expect(page.data.internalPane.state).toBe('ready');
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page._modeRuntimes.internal.rawEntries).toHaveLength(2);
    definition.methods.handleInternalMode.call(page);
    expect(page.data.internalPane.entries).toHaveLength(1);
  });

  it('invalidates both mode caches when the group changes while a request is pending', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));

    deferNextListRequest = true;
    definition.methods.handleSearchInput.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
      detail: { value: '病案' },
    });
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());

    page.properties = { ...page.properties, groupId: secondGroupId };
    definition.observers.groupId.call(page);
    await vi.waitFor(() => {
      expect(page.data.groupId).toBe(secondGroupId);
      expect(page.data.internalPane.state).toBe('idle');
      expect(page.data.employeePane.state).toBe('idle');
    });
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await flushPromises();

    expect(page.data.internalPane.searchQuery).toBe('');
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.data.employeePane.entries).toEqual([]);
    expect(
      requests.filter(
        (request) =>
          request.url.includes(`/groups/${secondGroupId}/`) && request.url.endsWith('/facets'),
      ),
    ).toHaveLength(2);
  });

  it('keeps filter disclosure state per mode and scrolls the sheet to the requested level', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));

    definition.methods.handleOpenFilterAt.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'internal', filter: 'department' },
      },
    });
    expect(page.data.filterSheetOpen).toBe(true);
    expect(page.data.activeSheet.open).toBe(true);
    expect(page.data.activeSheet.scrollTarget).toBe('directory-filter-internal-department');

    definition.methods.handleToggleFilterSection.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'internal', filter: 'department' },
      },
    });
    expect(
      page.data.activeSheet.sections.find((section) => section.key === 'department')?.expanded,
    ).toBe(false);

    definition.methods.handleCloseFilters.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    definition.methods.handleOpenFilterAt.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'employee', filter: 'department' },
      },
    });
    expect(
      page.data.activeSheet.sections.find((section) => section.key === 'department')?.expanded,
    ).toBe(true);

    definition.methods.handleCloseFilters.call(page, {
      currentTarget: { dataset: { directoryKind: 'employee' } },
    });
    expect(page.data.filterSheetOpen).toBe(false);
    expect(page.data.activeSheet.open).toBe(false);
  });

  it('does not open a blank filter sheet while facets are still loading', async () => {
    deferFacetRequests = true;
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);

    definition.methods.handleOpenFilters.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });

    expect(page.data.filterSheetOpen).toBe(false);
    expect(page.data.activeSheet.open).toBe(false);
    expect(page.data.internalPane.facetsLoading).toBe(true);
  });

  it('builds only the active sheet and releases all option nodes when it closes', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));

    expect(page.data.internalPane.guideStops.length).toBeGreaterThan(0);
    expect(page.data.employeePane.guideStops.length).toBeGreaterThan(0);
    expect(page.data.activeSheet.sections).toEqual([]);
    definition.methods.handleOpenFilters.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    expect(page.data.activeSheet.directoryKind).toBe('internal');
    expect(page.data.activeSheet.sections.length).toBeGreaterThan(0);
    expect(page.data.activeSheet.sections.every((section) => section.options.length > 0)).toBe(
      true,
    );

    definition.methods.handleCloseFilters.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    expect(page.data.filterSheetOpen).toBe(false);
    expect(page.data.activeSheet.open).toBe(false);
    expect(page.data.activeSheet.sections).toEqual([]);
  });

  it('shows an explicit no-filter message instead of an empty sheet', async () => {
    facetsResponse = emptyFacets();
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));

    definition.methods.handleOpenFilters.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });

    expect(page.data.activeSheet.open).toBe(true);
    expect(page.data.activeSheet.sections).toEqual([]);
    expect(page.data.activeSheet.emptyMessage).toBe('当前无需筛选');
  });

  it('shares an identical first-page request and reuses its completed result', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });

    deferNextListRequest = true;
    definition.methods.handleSearch.call(page);
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());
    expect(listRequests()).toHaveLength(1);
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

    const requestCount = listRequests().length;
    const setDataCount = page.setDataCalls.length;
    definition.methods.handleSearch.call(page);
    await flushPromises();
    expect(listRequests()).toHaveLength(requestCount);
    expect(page.setDataCalls).toHaveLength(setDataCount);
  });

  it('keeps a multi-page result complete when the same search is confirmed again', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.loadingMore).toBe(false));
    expect(page.data.internalPane.entries).toHaveLength(2);

    const requestCount = listRequests().length;
    definition.methods.handleSearch.call(page);
    await flushPromises();
    expect(listRequests()).toHaveLength(requestCount);
    expect(page.data.internalPane.entries).toHaveLength(2);
  });

  it('shares a double-tapped pagination request without appending the page twice', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

    deferNextListRequest = true;
    definition.methods.handleLoadMore.call(page);
    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());
    expect(
      listRequests().filter((request) => request.url.includes('cursor=cursor-1')),
    ).toHaveLength(1);
    deferredListRequest.success({ data: pageResponse(true), statusCode: 200 });
    await vi.waitFor(() => expect(page.data.internalPane.loadingMore).toBe(false));
    expect(page.data.internalPane.entries).toHaveLength(2);
  });

  it('bypasses completed reuse for an explicit from-start refresh', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    const requestCount = listRequests().length;

    definition.methods.handleRefreshFromStart.call(page);
    await vi.waitFor(() => expect(listRequests()).toHaveLength(requestCount + 1));
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
  });

  it('does not complete-reuse results while permission context is unknown', async () => {
    const page = createPageInstance(definition, {
      directoryKind: 'internal',
      embedded: false,
      groupId,
    });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    const requestCount = listRequests().length;

    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(listRequests()).toHaveLength(requestCount + 1));
  });

  it('reuses a successful empty result when permission and facets version are known', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '空结果' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('empty'));
    const requestCount = listRequests().length;
    const setDataCount = page.setDataCalls.length;

    definition.methods.handleSearch.call(page);
    await flushPromises();
    expect(listRequests()).toHaveLength(requestCount);
    expect(page.setDataCalls).toHaveLength(setDataCount);
  });

  it('releases a failed request so retry makes a real request', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    failListRequestsRemaining = 3;
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('error'));
    expect(page.data.internalPane.retryKind).toBe('search');
    const requestCount = listRequests().length;

    definition.methods.handleRetry.call(page);
    await vi.waitFor(() => expect(listRequests()).toHaveLength(requestCount + 1));
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
  });

  it('discards an older first-page response after a newer search completes', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '旧查询' } });
    deferNextListRequest = true;
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());

    definition.methods.handleSearchInput.call(page, { detail: { value: '新查询' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    expect(page.data.internalPane.entries[0]?.merged).toBe(false);
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await flushPromises();
    expect(page.data.internalPane.entries[0]?.merged).toBe(false);
  });

  it('invalidates both modes when the permission fingerprint changes', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

    page.properties = {
      ...page.properties,
      contextRefreshRevision: 2,
      groupRole: 'administrator',
    };
    definition.observers.groupRole.call(page);
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.data.employeePane.entries).toEqual([]);
    await vi.waitFor(() => {
      expect(page.data.internalPane.facetsLoading).toBe(false);
      expect(page.data.employeePane.facetsLoading).toBe(false);
    });
    expect(page.data.internalPane.searchQuery).toBe('');
  });

  it('keeps successful pages and cursor after pagination failure, then retries that page', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    const originalEntries = page.data.internalPane.entries;
    failListRequestsRemaining = 3;
    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.retryKind).toBe('pagination'));
    expect(page.data.internalPane.entries).toBe(originalEntries);
    expect(page.data.internalPane.hasMore).toBe(true);

    const requestCount = listRequests().length;
    definition.methods.handleRetry.call(page);
    await vi.waitFor(() => expect(listRequests()).toHaveLength(requestCount + 1));
    await vi.waitFor(() => expect(page.data.internalPane.loadingMore).toBe(false));
    expect(page.data.internalPane.entries).toHaveLength(2);
  });

  it('offers from-start refresh for an invalid pagination cursor', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    invalidCursorNext = true;
    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.canRefreshFromStart).toBe(true));
    expect(page.data.internalPane.retryKind).toBe('pagination');
    expect(page.data.internalPane.entries).toHaveLength(1);
  });

  it('keeps keyword search available after one mode facets fails without reusing it', async () => {
    failFacetKinds.add('employee');
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => {
      expect(page.data.internalPane.facetsLoading).toBe(false);
      expect(page.data.employeePane.facetsLoading).toBe(false);
    });
    expect(page.data.internalPane.facetsErrorMessage).toBe('');
    expect(page.data.employeePane.facetsErrorMessage).not.toBe('');
    definition.methods.handleSearchInput.call(page, {
      currentTarget: { dataset: { directoryKind: 'employee' } },
      detail: { value: '林医生' },
    });
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'employee' } },
    });
    await vi.waitFor(() => expect(page.data.employeePane.state).toBe('ready'));
    const requestCount = listRequests().length;
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'employee' } },
    });
    await vi.waitFor(() => expect(listRequests()).toHaveLength(requestCount + 1));
  });

  it('clears both modes immediately after a 403 response', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    unauthorizedNextList = true;
    definition.methods.handleRefreshFromStart.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('error'));
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.data.internalPane.guideStops).toEqual([]);
    expect(page.data.employeePane.entries).toEqual([]);
    expect(page.data.employeePane.guideStops).toEqual([]);
  });

  it('restores sheet scroll only for the same facets version and lets a target level win', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleOpenFilters.call(page);
    const setDataCount = page.setDataCalls.length;
    definition.methods.handleSheetScroll.call(page, { detail: { scrollTop: 180 } });
    expect(page.setDataCalls).toHaveLength(setDataCount);
    definition.methods.handleCloseFilters.call(page);
    definition.methods.handleOpenFilters.call(page);
    expect(page.data.activeSheet.scrollTop).toBe(180);
    definition.methods.handleCloseFilters.call(page);
    definition.methods.handleOpenFilterAt.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal', filter: 'department' } },
    });
    expect(page.data.activeSheet.scrollTarget).toBe('directory-filter-internal-department');

    definition.methods.handleCloseFilters.call(page);
    facetsResponse = { ...facets(), publishedImportVersion: 'controller-fixture-v2' };
    page.properties = { ...page.properties, contextRefreshRevision: 2 };
    definition.observers.contextRefreshRevision.call(page);
    await vi.waitFor(() =>
      expect(
        requests.filter((request) => request.url.endsWith(`/groups/${groupId}/directory/facets`)),
      ).toHaveLength(3),
    );
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleOpenFilters.call(page);
    expect(page.data.activeSheet.scrollTop).toBe(0);
  });

  it('drops a delayed scroll clamp after the sheet has already closed', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleOpenFilters.call(page);
    definition.methods.handleSheetScroll.call(page, { detail: { scrollTop: 180 } });
    definition.methods.handleCloseFilters.call(page);

    let queryCallback;
    const query = {
      exec(callback) {
        queryCallback = callback;
      },
      in() {
        return query;
      },
      select() {
        return { boundingClientRect: () => query };
      },
    };
    page.createSelectorQuery = () => query;
    definition.methods.handleOpenFilters.call(page);
    expect(queryCallback).toBeTypeOf('function');
    definition.methods.handleCloseFilters.call(page);
    const setDataCount = page.setDataCalls.length;
    queryCallback([{ height: 600 }, { height: 300 }]);

    expect(page.setDataCalls).toHaveLength(setDataCount);
    expect(page.data.activeSheet.sections).toEqual([]);
  });

  it('keeps transition cards visible but disables call and favorite side effects', async () => {
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.facetsLoading).toBe(false));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    const card = page.data.internalPane.entries[0];
    const dialNumber = card.contacts
      .flatMap((contact) => contact.numbers)
      .find((number) => Boolean(number.dialNumber))?.dialNumber;
    deferNextListRequest = true;
    definition.methods.handleSearchInput.call(page, { detail: { value: '新查询' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.interactionDisabled).toBe(true));
    expect(page.data.internalPane.entries).toHaveLength(1);

    definition.methods.handleToggleFavorite.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal', groupId: card.id } },
    });
    definition.methods.handleCall.call(page, {
      currentTarget: {
        dataset: { directoryKind: 'internal', groupId: card.id, number: dialNumber },
      },
    });
    expect(globalThis.wx.setStorageSync).not.toHaveBeenCalled();
    expect(globalThis.wx.makePhoneCall).not.toHaveBeenCalled();
  });

  it('returns to the Web idle state without another list request after clearing the last criterion', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));

    definition.methods.handleSearchInput.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
      detail: { value: '病案' },
    });
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    const requestCount = requests.length;

    definition.methods.handleClearSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'internal' } },
    });

    expect(page.data.internalPane.state).toBe('idle');
    expect(page.data.internalPane.hasCriteria).toBe(false);
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.data.internalPane.resultSummary).toBe('');
    expect(requests).toHaveLength(requestCount);
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
    await vi.waitFor(() => {
      expect(page.data.internalPane.state).toBe('disabled');
      expect(page.data.employeePane.state).toBe('disabled');
    });
    expect(requests).toHaveLength(0);
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.data.employeePane.entries).toEqual([]);
  });

  it('waits for an uninitialized capability before issuing one directory request', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const capabilityStore = await import('../src/app/client-capability-store.ts');
    let resolveCapability;
    const pendingCapability = new Promise((resolve) => {
      resolveCapability = resolve;
    });
    capabilityStore.configureRuntimeClientCapabilityReader(() => pendingCapability, 'test');

    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await flushPromises();
    expect(listRequests()).toHaveLength(0);

    resolveCapability(enabledCapabilities());
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));
    expect(listRequests()).toHaveLength(1);
    expect(page._modeRuntimes.internal.inFlightPages.size).toBe(0);
  });

  it('keeps the disabled error mapping and sends no request when capability loading fails', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const capabilityStore = await import('../src/app/client-capability-store.ts');
    capabilityStore.configureRuntimeClientCapabilityReader(
      () => Promise.reject(new Error('capability service unavailable')),
      'test',
    );

    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('disabled'));

    expect(page.data.internalPane.errorMessage).toBe('当前版本的这项功能已暂停，请稍后重试。');
    expect(listRequests()).toHaveLength(0);
    expect(page._modeRuntimes.internal.inFlightPages.size).toBe(0);
  });

  it('invalidates a capability-waiting search on detach without request, cache, or UI effects', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const capabilityStore = await import('../src/app/client-capability-store.ts');
    let resolveCapability;
    const pendingCapability = new Promise((resolve) => {
      resolveCapability = resolve;
    });
    capabilityStore.configureRuntimeClientCapabilityReader(() => pendingCapability, 'test');

    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await flushPromises();
    const oldRuntime = page._modeRuntimes.internal;
    expect(oldRuntime.inFlightPages.size).toBe(1);
    definition.lifetimes.detached.call(page);
    const setDataCountAfterDetach = page.setDataCalls.length;

    resolveCapability(enabledCapabilities());
    await flushPromises();
    await flushPromises();

    expect(listRequests()).toHaveLength(0);
    expect(page.setDataCalls).toHaveLength(setDataCountAfterDetach);
    expect(oldRuntime.rawEntries).toEqual([]);
    expect(oldRuntime.completedBaseQueryKey).toBeUndefined();
    expect(oldRuntime.inFlightPages.size).toBe(0);
    expect(globalThis.wx.setStorageSync).not.toHaveBeenCalled();
    expect(globalThis.wx.makePhoneCall).not.toHaveBeenCalled();
  });

  it('does not issue an old-group request after capability wait when context changes', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    const capabilityStore = await import('../src/app/client-capability-store.ts');
    let resolveCapability;
    const pendingCapability = new Promise((resolve) => {
      resolveCapability = resolve;
    });
    capabilityStore.configureRuntimeClientCapabilityReader(() => pendingCapability, 'test');

    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await flushPromises();
    const oldRuntime = page._modeRuntimes.internal;
    page.properties = { ...page.properties, groupId: secondGroupId };
    definition.observers.groupId.call(page);

    resolveCapability(enabledCapabilities());
    await vi.waitFor(() => expect(page.data.groupId).toBe(secondGroupId));
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));

    expect(
      requests.filter((request) => request.url.includes(`/groups/${groupId}/directory?`)),
    ).toHaveLength(0);
    expect(oldRuntime.rawEntries).toEqual([]);
    expect(oldRuntime.completedBaseQueryKey).toBeUndefined();
    expect(oldRuntime.inFlightPages.size).toBe(0);
  });

  it('does not commit a pending search response after detaching', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));

    deferNextListRequest = true;
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());
    definition.lifetimes.detached.call(page);
    const setDataCountAfterDetach = page.setDataCalls.length;
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await flushPromises();

    expect(page.data.internalPane.state).toBe('loading');
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.setDataCalls).toHaveLength(setDataCountAfterDetach);
  });

  it('keeps a pending load-more response scoped to its inactive mode', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

    deferNextListRequest = true;
    definition.methods.handleLoadMore.call(page);
    await vi.waitFor(() => expect(deferredListRequest).toBeDefined());
    definition.methods.handleEmployeeMode.call(page);
    expect(page.data.employeePane.state).toBe('idle');
    deferredListRequest.success({ data: pageResponse(false), statusCode: 200 });
    await flushPromises();

    expect(page.data.directoryKind).toBe('employee');
    expect(page.data.employeePane.entries).toEqual([]);
    expect(page.data.internalPane.loadingMore).toBe(false);
    expect(page.data.internalPane.entries).toEqual([]);
    expect(page._modeRuntimes.internal.rawEntries.length).toBeGreaterThan(0);
    definition.methods.handleInternalMode.call(page);
    expect(page.data.internalPane.entries.length).toBeGreaterThan(0);
  });

  it('clears directory results when a later read loses the organization capability', async () => {
    const page = createPageInstance(definition, { groupId, directoryKind: 'internal' });
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));
    definition.methods.handleSearchInput.call(page, { detail: { value: '病案' } });
    definition.methods.handleSearch.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('ready'));

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
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('disabled'));

    expect(page.data.internalPane.entries).toEqual([]);
    expect(page.data.internalPane.prioritySections).toEqual([]);
    expect(page.data.employeePane.entries).toEqual([]);
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
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));

    expect(page.data.largeText).toBe(true);
  });

  it('records a privacy-safe real-search timeline without waiting for employee facets', async () => {
    const diagnostics = await import('../src/platform/runtime-diagnostics.ts');
    const store = diagnostics.createRuntimeDiagnosticsStore();
    store.startDirectorySearchRecording();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: store } }));
    globalThis.wx.getAccountInfoSync = () => ({
      miniProgram: { envVersion: 'trial', version: '1.2.3' },
    });
    globalThis.wx.getAppBaseInfo = () => ({ SDKVersion: '3.17.1', version: '8.0.60' });
    globalThis.wx.getDeviceInfo = () => ({ model: 'Xiaomi 14', system: 'Android 15' });
    globalThis.wx.getNetworkType = (options) => options.success({ networkType: 'wifi' });
    globalThis.wx.nextTick = (callback) => callback();
    const page = createPageInstance(definition, runtimeProperties());
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.employeePane.facetsLoading).toBe(false));
    definition.methods.handleEmployeeMode.call(page);
    definition.methods.handleSearchInput.call(page, {
      currentTarget: { dataset: { directoryKind: 'employee' } },
      detail: { value: 'D0468' },
    });
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'employee' } },
    });

    await vi.waitFor(() => expect(store.getSnapshot().directorySearches).toHaveLength(1));
    const recorded = store.getSnapshot().directorySearches[0];
    expect(recorded).toMatchObject({
      autoStartedByLaunchMarker: false,
      directoryKind: 'employee',
      facetsReady: true,
      firstSearchInPageSession: true,
      pageSessionSearchIndex: 1,
      outcome: 'success',
      profileEnabled: true,
      publishedBatchConfirmed: true,
      requestId: 'directory-request-employee-1',
      responseBytesEstimated: true,
      searchTermLength: 5,
      searchType: 'employee-code',
      setDataBytesEstimated: true,
      truncated: false,
    });
    expect(recorded.setDataCallCount).toBeGreaterThanOrEqual(3);
    expect(recorded.setDataTotalBytes).toBeGreaterThan(0);
    expect(recorded.networkProfile).toMatchObject({ supported: true, dnsMs: 2, ttfbMs: 11 });
    expect(JSON.stringify(recorded)).not.toMatch(/D0468|林医生|session-token|11111111/iu);

    const requestCount = listRequests().length;
    definition.methods.handleSearch.call(page, {
      currentTarget: { dataset: { directoryKind: 'employee' } },
    });
    await vi.waitFor(() => expect(store.getSnapshot().directorySearches).toHaveLength(2));
    expect(listRequests()).toHaveLength(requestCount);
    expect(store.getSnapshot().directorySearches[1]).toMatchObject({
      completedResultReuse: true,
      duplicateRequestIntercepted: true,
      firstSearchInPageSession: false,
      inFlightRequestReuse: false,
      setDataCallCount: 0,
    });
  });

  it('sizes the filter sheet from the live window and safe area, then follows rotation', async () => {
    let resizeHandler;
    let windowInfo = {
      safeArea: { bottom: 840, height: 816, left: 0, right: 390, top: 24, width: 390 },
      screenHeight: 844,
      statusBarHeight: 24,
      windowHeight: 820,
      windowWidth: 390,
    };
    globalThis.wx.getWindowInfo = () => windowInfo;
    globalThis.wx.onWindowResize = vi.fn((handler) => {
      resizeHandler = handler;
    });
    globalThis.wx.offWindowResize = vi.fn();
    const page = createPageInstance(definition, runtimeProperties());

    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.internalPane.state).toBe('idle'));

    expect(page.data.filterSheetStyle).toBe('height:410px;');
    expect(globalThis.wx.onWindowResize).toHaveBeenCalledTimes(1);

    windowInfo = {
      safeArea: { bottom: 390, height: 366, left: 0, right: 844, top: 24, width: 844 },
      screenHeight: 390,
      statusBarHeight: 24,
      windowHeight: 390,
      windowWidth: 844,
    };
    resizeHandler();
    expect(page.data.filterSheetStyle).toBe('height:195px;');

    definition.lifetimes.detached.call(page);
    expect(globalThis.wx.offWindowResize).toHaveBeenCalledWith(resizeHandler);
  });

  function lastRequest() {
    return requests.at(-1);
  }

  function listRequests() {
    return requests.filter(
      (request) =>
        request.url.includes('/directory?') || request.url.includes('/employee-directory?'),
    );
  }
});

function createPageInstance(controller, properties) {
  const page = {
    data: structuredClone(controller.data),
    properties,
    setDataCalls: [],
    setData(patch, callback) {
      this.setDataCalls.push(patch);
      for (const [path, value] of Object.entries(patch)) setPath(this.data, path, value);
      callback?.();
    },
  };
  return page;
}

function runtimeProperties(overrides = {}) {
  return {
    contextRefreshRevision: 1,
    directoryKind: 'internal',
    embedded: true,
    groupId,
    groupIsDeveloperAdmin: false,
    groupRole: 'member',
    groupVersion: 3,
    permissionContextReady: true,
    ...overrides,
  };
}

function enabledCapabilities() {
  return {
    core: true,
    externalMessages: true,
    global: true,
    guest: true,
    insights: true,
    organization: true,
    platform: 'miniprogram',
    version: 'test',
    workflows: true,
  };
}

function setPath(target, path, value) {
  const segments = path.split('.');
  const leaf = segments.pop();
  let current = target;
  for (const segment of segments) current = current[segment];
  current[leaf] = value;
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

function emptyFacets() {
  return {
    buildings: [],
    campuses: [],
    departments: [],
    entryKinds: [],
    floors: [],
    paths: [],
    publishedEffectiveOn: '2026-08-01',
    publishedImportVersion: 'controller-empty-v1',
    sections: [],
    subunits: [],
    totalCount: 0,
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
