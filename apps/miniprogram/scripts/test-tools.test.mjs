import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'abc1234');
  vi.stubGlobal('__MINIPROGRAM_BUILD_DESCRIPTION__', 'audit-test-tools');
  vi.stubGlobal('__MINIPROGRAM_BUILD_DIRTY__', false);
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_TIME__', '2026-08-31T00:00:00.000Z');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', '0.1.0-test');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('safe Mini test tools', () => {
  it('shows only develop/trial and fails closed for release or unknown environments', async () => {
    const { isTestToolsRuntimeEnabled, readMiniProgramRuntimeIdentity } =
      await import('../src/platform/runtime-environment.ts');
    const runtime = (envVersion, version = '1.2.3') => ({
      getAccountInfoSync: () => ({ miniProgram: { envVersion, version } }),
    });

    expect(isTestToolsRuntimeEnabled(runtime('develop'))).toBe(true);
    expect(isTestToolsRuntimeEnabled(runtime('trial'))).toBe(true);
    expect(isTestToolsRuntimeEnabled(runtime('release'))).toBe(false);
    expect(isTestToolsRuntimeEnabled(runtime('unexpected'))).toBe(false);
    expect(isTestToolsRuntimeEnabled({})).toBe(false);
    expect(readMiniProgramRuntimeIdentity(runtime('release', '8.0.1'))).toEqual({
      envVersion: 'release',
      version: '8.0.1',
    });
  });

  it('keeps request/error/performance records bounded, in memory, and irreversibly redacted', async () => {
    const diagnostics = await import('../src/platform/runtime-diagnostics.ts');
    const store = diagnostics.createRuntimeDiagnosticsStore();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: store } }));

    for (let index = 0; index < 25; index += 1) {
      store.recordRequest({
        durationMs: 10 + index,
        endpoint: `https://example.test/api/groups/group-secret-${index}/members?token=secret-${index}`,
        method: 'GET',
        outcome: 'success',
        retryCount: 0,
        startedAt: 1_000 + index * 2_000,
        statusCode: 200,
      });
    }
    for (let index = 0; index < 14; index += 1) {
      store.recordError({
        code: 'NETWORK_ERROR',
        fingerprint: 'a'.repeat(64),
        page: 'workbench',
        recordedAt: 2_000 + index,
      });
      store.recordPerformance({
        durationMs: index,
        metric: 'core-ready',
        page: 'workbench',
        recordedAt: 3_000 + index,
      });
    }

    const snapshot = diagnostics.getRuntimeDiagnosticsSnapshot();
    expect(snapshot.requests).toHaveLength(20);
    expect(snapshot.errors).toHaveLength(10);
    expect(snapshot.performance).toHaveLength(12);
    expect(JSON.stringify(snapshot)).not.toMatch(/group-secret|token=|secret-/u);
    expect(snapshot.requests.at(-1)?.endpoint).toBe('/api/groups/:value/members');
    expect(snapshot.errors.at(-1)?.fingerprint).toBe('a'.repeat(64));
  });

  it('starts, stops, clears, and bounds privacy-safe directory search diagnostics', async () => {
    const diagnostics = await import('../src/platform/runtime-diagnostics.ts');
    const store = diagnostics.createRuntimeDiagnosticsStore();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: store } }));

    expect(store.isDirectorySearchRecording()).toBe(false);
    store.startDirectorySearchRecording();
    expect(store.isDirectorySearchRecording()).toBe(true);
    for (let index = 0; index < 24; index += 1) {
      store.recordDirectorySearch(directorySearchDiagnostic(index));
    }
    store.stopDirectorySearchRecording();

    const snapshot = diagnostics.getRuntimeDiagnosticsSnapshot();
    expect(snapshot.directorySearchRecording).toBe(false);
    expect(snapshot.directorySearches).toHaveLength(20);
    expect(snapshot.directorySearches.at(-1)).toMatchObject({
      diagnosticId: 'DIR-23',
      directoryKind: 'employee',
      requestId: 'request-23',
      searchTermLength: 5,
      searchType: 'employee-code',
    });
    expect(JSON.stringify(snapshot.directorySearches)).not.toMatch(
      /林医生|13800138000|employee-secret|account-|group-|permission-|cursor-/iu,
    );

    store.clearDirectorySearches();
    expect(store.getSnapshot().directorySearches).toEqual([]);
  });

  it('does not create the diagnostic store during release App initialization', async () => {
    let appDefinition;
    const request = vi.fn();
    vi.stubGlobal('wx', createWx('release', request));
    vi.stubGlobal('App', (value) => {
      appDefinition = value;
    });
    await import('../src/app.ts');

    expect(appDefinition.globalData).not.toHaveProperty('runtimeDiagnostics');
    expect(request).not.toHaveBeenCalled();
    expect(appDefinition).not.toHaveProperty('onNetworkStatusChange');
  });

  it('consumes the one-shot marker only on a new trial App launch and marks later resume warm', async () => {
    let appDefinition;
    const runtime = createWx('trial', vi.fn());
    vi.stubGlobal('wx', runtime);
    const launch = await import('../src/platform/runtime-diagnostics-launch.ts');
    expect(launch.armRuntimeDirectoryLaunchMarker(runtime)).toBe(true);
    vi.stubGlobal('App', (value) => {
      appDefinition = value;
    });
    await import('../src/app.ts');

    appDefinition.onShow();
    expect(launch.hasRuntimeDirectoryLaunchMarker(runtime)).toBe(true);
    expect(appDefinition.globalData.runtimeDiagnostics.directorySearchRecording).toBe(false);

    appDefinition.onLaunch();
    expect(launch.hasRuntimeDirectoryLaunchMarker(runtime)).toBe(false);
    expect(appDefinition.globalData.runtimeDiagnostics).toMatchObject({
      directorySearchRecording: true,
      launchMarkerConsumed: true,
      launchObserved: true,
      warmResumeObserved: false,
    });
    appDefinition.onShow();
    expect(appDefinition.globalData.runtimeDiagnostics.warmResumeObserved).toBe(false);
    appDefinition.onShow();
    expect(appDefinition.globalData.runtimeDiagnostics.warmResumeObserved).toBe(true);
  });

  it('clears an inherited one-shot marker without enabling diagnostics in release', async () => {
    let appDefinition;
    const runtime = createWx('release', vi.fn());
    vi.stubGlobal('wx', runtime);
    const launch = await import('../src/platform/runtime-diagnostics-launch.ts');
    expect(launch.armRuntimeDirectoryLaunchMarker(runtime)).toBe(true);
    vi.stubGlobal('App', (value) => {
      appDefinition = value;
    });
    await import('../src/app.ts');

    appDefinition.onLaunch();

    expect(launch.hasRuntimeDirectoryLaunchMarker(runtime)).toBe(false);
    expect(appDefinition.globalData).not.toHaveProperty('runtimeDiagnostics');
  });

  it('creates the bounded store in develop without adding runtime listeners', async () => {
    let appDefinition;
    vi.stubGlobal('wx', createWx('develop', vi.fn()));
    vi.stubGlobal('App', (value) => {
      appDefinition = value;
    });
    await import('../src/app.ts');

    expect(appDefinition.globalData.runtimeDiagnostics).toMatchObject({
      appLaunchAt: 0,
      directorySearches: [],
      errors: [],
      performance: [],
      requests: [],
    });
    expect(appDefinition.globalData.runtimeDiagnostics).not.toHaveProperty('recordRequest');
    appDefinition.onLaunch();
    expect(appDefinition.globalData.runtimeDiagnostics.launchObserved).toBe(true);
    expect(appDefinition.globalData.runtimeDiagnostics.appLaunchAt).toBeGreaterThan(0);
    expect(appDefinition).not.toHaveProperty('onNetworkStatusChange');
    expect(appDefinition).not.toHaveProperty('onMemoryWarning');
  });

  it('blocks the direct test-tools route in release before reading device, network, or storage', async () => {
    let definition;
    const redirectTo = vi.fn();
    const runtime = createWx('release', vi.fn());
    runtime.redirectTo = redirectTo;
    runtime.getDeviceInfo = vi.fn();
    runtime.getNetworkType = vi.fn();
    runtime.getStorageInfoSync = vi.fn();
    vi.stubGlobal('wx', runtime);
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');

    definition.onLoad.call(createPageInstance(definition));

    expect(redirectTo).toHaveBeenCalledWith({ url: '/pages/workbench/index' });
    expect(runtime.getDeviceInfo).not.toHaveBeenCalled();
    expect(runtime.getNetworkType).not.toHaveBeenCalled();
    expect(runtime.getStorageInfoSync).not.toHaveBeenCalled();
  });

  it('blocks the workbench handler in release without attempting navigation', async () => {
    let definition;
    const navigateTo = vi.fn();
    const runtime = createWx('release', vi.fn());
    runtime.navigateTo = navigateTo;
    vi.stubGlobal('wx', runtime);
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/pages/workbench/index.ts');
    const instance = createPageInstance(definition);

    definition.handleOpenTestCenter.call(instance);

    expect(instance.data.testCenterEnabled).toBe(false);
    expect(navigateTo).not.toHaveBeenCalled();
    expect(runtime.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '测试工具仅在开发版和体验版开放。' }),
    );
  });

  it('copies one stable structured Codex report without sensitive runtime content', async () => {
    let definition;
    const clipboard = vi.fn((options) => options.success?.());
    const storeModule = await import('../src/platform/runtime-diagnostics.ts');
    const runtimeDiagnostics = storeModule.createRuntimeDiagnosticsStore();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics } }));
    runtimeDiagnostics.recordRequest({
      durationMs: 88,
      endpoint:
        'https://example.test/api/groups/private-group-9/calendar?token=private-token&phone=13800138000',
      method: 'GET',
      outcome: 'success',
      retryCount: 1,
      startedAt: 1_000,
      statusCode: 200,
    });
    runtimeDiagnostics.recordError({
      code: 'NETWORK_ERROR',
      fingerprint: 'b'.repeat(64),
      page: 'workbench',
      recordedAt: 2_000,
    });
    const runtime = createWx('trial', vi.fn());
    runtime.setClipboardData = clipboard;
    vi.stubGlobal('wx', runtime);
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');
    const instance = createPageInstance(definition);

    definition.onLoad.call(instance);
    await Promise.resolve();
    definition.onReady.call(instance);
    definition.handleCopyCodexReport.call(instance);

    const report = clipboard.mock.calls.at(-1)?.[0].data;
    expect(report).toContain('[Codex 简化诊断报告 v1]');
    expect(report).toContain('[设备与屏幕]');
    expect(report).toContain('[脱敏网络结果]');
    expect(report).toContain('/api/groups/:value/calendar');
    expect(report).toContain('b'.repeat(64));
    expect(report).toContain('[测试场景结果]');
    expect(report).toContain('[生成时间]');
    expect(report).not.toMatch(
      /private-group|private-token|13800138000|Authorization|Cookie|openid|request body|response body/iu,
    );
  });

  it('controls directory recording and copies the recent structured search timeline', async () => {
    let definition;
    const clipboard = vi.fn((options) => options.success?.());
    const storeModule = await import('../src/platform/runtime-diagnostics.ts');
    const runtimeDiagnostics = storeModule.createRuntimeDiagnosticsStore();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics } }));
    const runtime = createWx('trial', vi.fn());
    runtime.setClipboardData = clipboard;
    vi.stubGlobal('wx', runtime);
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');
    const instance = createPageInstance(definition);
    definition.onLoad.call(instance);
    await Promise.resolve();

    definition.handleStartDirectoryRecording.call(instance);
    expect(runtimeDiagnostics.isDirectorySearchRecording()).toBe(true);
    runtimeDiagnostics.recordDirectorySearch(directorySearchDiagnostic(7));
    definition.handleRefresh.call(instance);
    await Promise.resolve();
    definition.handleStopDirectoryRecording.call(instance);
    definition.handleCopyLatestDirectorySearch.call(instance);

    const report = clipboard.mock.calls.at(-1)?.[0].data;
    expect(report).toContain('[通讯录性能诊断 v1]');
    expect(report).toContain('DIR-7');
    expect(report).toContain('阶段ms=');
    expect(report).toContain('profile=DNS 2ms');
    expect(report).toContain('服务端=总90ms');
    expect(report).toContain('排队不支持');
    expect(report).toContain('缓存none');
    expect(report).not.toMatch(
      /林医生|13800138000|employee-secret|account-|group-|permission-|cursor-/iu,
    );

    definition.handleClearDirectoryRecords.call(instance);
    expect(runtimeDiagnostics.getSnapshot().directorySearches).toEqual([]);
  });

  it('shares one session-only diagnostic slot between diagnostics and organization packages', async () => {
    let definition;
    const storeModule = await import('../src/platform/runtime-diagnostics.ts');
    const runtimeDiagnostics = storeModule.createRuntimeDiagnosticsStore();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics } }));
    vi.stubGlobal('wx', createWx('trial', vi.fn()));
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');
    const organization =
      await import('../src/subpackages/organization/components/directory-panel/directory-diagnostics-bridge.ts');
    const instance = createPageInstance(definition);
    definition.onLoad.call(instance);
    await Promise.resolve();
    definition.handleStartDirectoryRecording.call(instance);

    const trace = organization.beginDirectorySearchDiagnostic({
      directoryKind: 'internal',
      directoryPageLoadedAt: Date.now(),
      facetsReady: true,
      hasFilters: false,
      pageSessionSearchIndex: 1,
      publishedBatchConfirmed: true,
      searchQuery: 'sensitive query is not retained',
    });
    organization.completeDirectorySearchDiagnostic(trace, {
      completedResultReuse: true,
      inFlightRequestReuse: false,
      outcome: 'success',
    });
    definition.handleRefresh.call(instance);
    await Promise.resolve();

    expect(instance.data.directorySearchRows).toHaveLength(1);
    expect(runtimeDiagnostics.directorySearches).toHaveLength(1);
    expect(JSON.stringify(runtimeDiagnostics.directorySearches)).not.toContain('sensitive query');
  });

  it('bounds and redacts one oversized directory record', async () => {
    const diagnostics = await import('../src/platform/runtime-diagnostics.ts');
    const store = diagnostics.createRuntimeDiagnosticsStore();
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: store } }));
    store.recordDirectorySearch({
      ...directorySearchDiagnostic(1),
      requestId: `unsafe/request?query=${'secret'.repeat(100)}`,
      serverTiming: { raw: 'private-response'.repeat(1_000), supported: true },
    });

    const packed = store.directorySearches[0];
    const snapshot = store.getSnapshot().directorySearches[0];
    expect(Buffer.byteLength(JSON.stringify(packed), 'utf8')).toBeLessThanOrEqual(4096);
    expect(snapshot).toMatchObject({ requestId: 'unavailable', truncated: true });
    expect(JSON.stringify(snapshot)).not.toMatch(/private-response|unsafe\/request|query=/u);
  });

  it('hard-caps copied diagnostics text by UTF-8 bytes and appends a truncation notice', async () => {
    let definition;
    const clipboard = vi.fn((options) => options.success?.());
    const runtime = createWx('trial', vi.fn());
    runtime.setClipboardData = clipboard;
    vi.stubGlobal('wx', runtime);
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');
    const instance = createPageInstance(definition);
    definition.onLoad.call(instance);
    await Promise.resolve();
    instance.data.deviceRows = Array.from({ length: 12 }, (_, index) => ({
      impact: '',
      label: `oversized-${index}`,
      screenshot: '',
      status: 'good',
      statusLabel: '正常',
      value: '诊断文本'.repeat(4_000),
    }));

    definition.handleCopyCodexReport.call(instance);

    const report = clipboard.mock.calls.at(-1)?.[0].data;
    expect(Buffer.byteLength(report, 'utf8')).toBeLessThanOrEqual(24 * 1024);
    expect(report).toContain('[已安全截断：复制文本超过 24576 B 上限]');
  });

  it('keeps the page in a diagnostics subpackage and forbids raw payload or storage-value access', () => {
    const appConfig = JSON.parse(readSource('app.json'));
    const diagnosticsPackage = appConfig.subpackages.find(
      (subpackage) => subpackage.root === 'subpackages/diagnostics',
    );
    const pageSource = readSource('subpackages/diagnostics/pages/test-tools/index.ts');
    const buildTools = readFileSync(new URL('./build-tools.mjs', import.meta.url), 'utf8');
    const template = readSource('subpackages/diagnostics/pages/test-tools/index.wxml');
    const workbench = readSource('pages/workbench/index.wxml');
    const foundation = readSource('pages/index/index.wxml');

    expect(diagnosticsPackage.pages).toEqual(['pages/test-tools/index']);
    for (const modulePath of [
      'platform/runtime-diagnostics-bridge.ts',
      'platform/runtime-diagnostics.ts',
      'platform/runtime-environment.ts',
    ]) {
      expect(buildTools).toContain(`'${modulePath}'`);
    }
    expect(workbench).toContain('wx:if="{{testCenterEnabled}}"');
    expect(foundation).toContain('wx:if="{{testToolsEnabled}}"');
    expect(pageSource).not.toContain('getStorageSync(');
    expect(pageSource).not.toContain('Authorization');
    expect(pageSource).not.toContain('Idempotency-Key');
    expect(template).toContain(
      '不会显示或复制账号、姓名、手机号、群组成员、凭证、请求正文或原始堆栈',
    );
    expect(template).toContain('通讯录性能诊断');
    expect(template).toContain('开始记录');
    expect(template).toContain('停止记录');
    expect(template).toContain('复制最近一次');
    expect(template).toContain('复制最近 10 次');
  });

  it('updates one scenario immediately through the existing passed and issue event contract', async () => {
    let definition;
    vi.stubGlobal('wx', createWx('develop', vi.fn()));
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/subpackages/diagnostics/pages/test-tools/index.ts');
    const instance = createPageInstance(definition);
    const scenarioId = instance.data.scenarios[0].id;

    definition.handleScenarioResult.call(instance, {
      currentTarget: { dataset: { result: 'passed', scenarioId } },
    });
    expect(instance.data.scenarios[0]).toMatchObject({ result: 'passed', resultLabel: '正常' });

    definition.handleScenarioResult.call(instance, {
      currentTarget: { dataset: { result: 'issue', scenarioId } },
    });
    expect(instance.data.scenarios[0]).toMatchObject({
      result: 'issue',
      resultLabel: '发现异常',
    });
  });

  it('keeps the current diagnostics additions within the verified Skyline-safe layout contract', () => {
    const template = readSource('subpackages/diagnostics/pages/test-tools/index.wxml');
    const styles = readSource('subpackages/diagnostics/pages/test-tools/index.wxss');
    const pageConfig = JSON.parse(
      readSource('subpackages/diagnostics/pages/test-tools/index.json'),
    );

    expect(styles).not.toMatch(/display:\s*grid|grid-template-columns/iu);
    expect(styles).not.toContain('overflow-wrap: anywhere');
    expect(styles).not.toContain(':last-of-type');
    expect(styles.match(/word-break:\s*break-all/gu)).toHaveLength(4);

    expect(cssRule(styles, '.two-actions,\n.report-actions')).toMatch(
      /display:\s*flex[\s\S]*flex-wrap:\s*wrap/iu,
    );
    expect(cssRule(styles, '.two-actions > ui-button,\n.report-actions > ui-button')).toMatch(
      /min-width:\s*0[\s\S]*flex:\s*1/iu,
    );
    expect(cssRule(styles, '.scenario-actions')).toMatch(
      /display:\s*flex[\s\S]*flex-wrap:\s*wrap/iu,
    );
    expect(cssRule(styles, '.scenario-link')).toMatch(/min-width:\s*0[\s\S]*flex:\s*1/iu);
    expect(styles).toMatch(/\.scenario-mark\s*\{\s*width:\s*54px;\s*flex:\s*none;/iu);
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*340px\)[\s\S]*\.scenario-link\s*\{[^}]*flex-basis:\s*100%/iu,
    );

    for (const width of [320, 390, 412]) {
      const narrow = width <= 340;
      const pagePadding = narrow ? 24 : 32;
      const cardPadding = narrow ? 28 : 32;
      const innerWidth = width - pagePadding - cardPadding;
      const fixedScenarioControls = 54 * 2 + 8;
      expect(innerWidth).toBeGreaterThan(fixedScenarioControls);
      if (!narrow) {
        expect(innerWidth - fixedScenarioControls - 8).toBeGreaterThan(0);
      }
    }

    expect(template).toContain(
      '<text class="scenario-screenshot">应截图：{{item.screenshot}}</text>',
    );
    expect(template).toContain('data-result="passed" bindtap="handleScenarioResult">正常</view>');
    expect(template).toContain('data-result="issue" bindtap="handleScenarioResult">异常</view>');
    expect(pageConfig.disableScroll).toBe(false);
  });
});

function cssRule(styles, selector) {
  const start = styles.indexOf(`${selector} {`);
  expect(start, `missing CSS rule ${selector}`).toBeGreaterThanOrEqual(0);
  const end = styles.indexOf('}', start);
  expect(end, `unterminated CSS rule ${selector}`).toBeGreaterThan(start);
  return styles.slice(start, end + 1);
}

function directorySearchDiagnostic(index) {
  return {
    appLaunchToConfirmMs: 120,
    autoStartedByLaunchMarker: index === 0,
    cardBuildMs: 4,
    completedResultReuse: false,
    confirmedAt: 1_000 + index,
    contextWaitMs: 0,
    diagnosticId: `DIR-${index}`,
    diagnosticSerializationMs: 3,
    directoryKind: 'employee',
    directoryPageLoadToConfirmMs: 80,
    duplicateRequestIntercepted: false,
    eventHandlerStartMs: 0,
    facetsOrReleaseWaitMs: 2,
    facetsReady: true,
    firstSearchInPageSession: index === 0,
    hasFilters: false,
    hasNextPage: false,
    inFlightRequestReuse: false,
    networkProfile: {
      connectMs: 3,
      dnsMs: 2,
      downloadMs: 5,
      supported: true,
      tlsMs: 1,
      ttfbMs: 8,
    },
    networkRequestStartMs: 3,
    networkResponseMs: 18,
    newAppLaunchObserved: index === 0,
    nextRenderCycleMs: 28,
    outcome: 'success',
    pageSessionSearchIndex: index + 1,
    profileEnabled: true,
    publishedBatchConfirmed: true,
    recordedAt: 2_000 + index,
    requestId: `request-${index}`,
    responseBytes: 888,
    responseBytesEstimated: true,
    responseToConversionMs: 2,
    resultCount: 3,
    searchTermLength: 5,
    searchType: 'employee-code',
    serverTiming: {
      aliasMs: 1,
      authMs: 4,
      batchMs: 2,
      cache: 'none',
      coldStart: false,
      contactsMs: 3,
      countMs: 12,
      databaseWaitMs: 7,
      instanceAgeMs: 12_345,
      permissionMs: 8,
      queryMs: 46,
      queueSupported: false,
      rowsMs: 30,
      serializationMs: 2,
      supported: true,
      totalMs: 90,
      transformMs: 1,
    },
    setDataBytesEstimated: true,
    setDataCallCount: 2,
    setDataCommitMs: 26,
    setDataMaxBytes: 500,
    setDataTotalBytes: 700,
    totalMs: 28,
    truncated: false,
    unsafeContext: 'employee-secret account-1 group-1 permission-x cursor-x',
    deviceModel: 'Xiaomi 14 林医生 13800138000',
  };
}

function createWx(envVersion, request) {
  const storage = new Map();
  return {
    getAccountInfoSync: () => ({ miniProgram: { envVersion, version: '1.2.3' } }),
    getAppBaseInfo: () => ({
      SDKVersion: '3.17.1',
      fontSizeSetting: 16,
      theme: 'light',
      version: '8.0.60',
    }),
    getDeviceInfo: () => ({
      benchmarkLevel: 8,
      brand: 'Xiaomi',
      model: 'Xiaomi 14',
      platform: 'android',
      system: 'Android 15',
    }),
    getMenuButtonBoundingClientRect: () => ({
      bottom: 56,
      height: 32,
      left: 300,
      right: 380,
      top: 24,
      width: 80,
    }),
    getNetworkType: (options) => options.success({ networkType: 'wifi' }),
    getStorageInfoSync: () => ({ currentSize: 12, keys: ['cache.v2:private'], limitSize: 10240 }),
    getStorageSync: (key) => storage.get(key),
    getSystemSetting: () => ({ deviceOrientation: 'portrait' }),
    getWindowInfo: () => ({
      pixelRatio: 3,
      safeArea: { bottom: 840, left: 0, right: 390, top: 24 },
      screenHeight: 844,
      screenWidth: 390,
      statusBarHeight: 24,
      windowHeight: 820,
      windowWidth: 390,
    }),
    redirectTo: vi.fn(),
    request,
    removeStorageSync: (key) => storage.delete(key),
    setStorageSync: (key, value) => storage.set(key, value),
    showToast: vi.fn(),
  };
}

function createPageInstance(definition) {
  const data = structuredClone(definition.data);
  return {
    data,
    setData(patch, callback) {
      Object.assign(data, patch);
      callback?.();
    },
  };
}
