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

  it('creates the bounded store in develop without adding runtime listeners', async () => {
    let appDefinition;
    vi.stubGlobal('wx', createWx('develop', vi.fn()));
    vi.stubGlobal('App', (value) => {
      appDefinition = value;
    });
    await import('../src/app.ts');

    expect(appDefinition.globalData.runtimeDiagnostics).toMatchObject({
      errors: [],
      performance: [],
      requests: [],
    });
    expect(appDefinition.globalData.runtimeDiagnostics.recordRequest).toEqual(expect.any(Function));
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
    expect(report).not.toMatch(
      /林医生|13800138000|employee-secret|account-|group-|permission-|cursor-/iu,
    );

    definition.handleClearDirectoryRecords.call(instance);
    expect(runtimeDiagnostics.getSnapshot().directorySearches).toEqual([]);
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
});

function directorySearchDiagnostic(index) {
  return {
    cardBuildMs: 4,
    completedResultReuse: false,
    confirmedAt: 1_000 + index,
    contextWaitMs: 0,
    diagnosticId: `DIR-${index}`,
    directoryKind: 'employee',
    duplicateRequestIntercepted: false,
    eventHandlerStartMs: 0,
    experienceVersion: '0.1.0-test@abc1234',
    facetsOrReleaseWaitMs: 2,
    facetsReady: true,
    firstSearchInPageSession: index === 0,
    hasFilters: false,
    hasNextPage: false,
    inFlightRequestReuse: false,
    miniProgramVersion: '1.2.3',
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
    networkType: 'wifi',
    outcome: 'success',
    publishedBatchConfirmed: true,
    recordedAt: 2_000 + index,
    requestId: `request-${index}`,
    responseBytes: 888,
    responseToConversionMs: 2,
    resultCount: 3,
    resultVisibleMs: 28,
    sdkVersion: '3.17.1',
    searchTermLength: 5,
    searchType: 'employee-code',
    setDataCallbackMs: 26,
    setDataCallCount: 2,
    setDataMaxBytes: 500,
    setDataTotalBytes: 700,
    systemVersion: 'Android 15 employee-secret account-1 group-1 permission-x cursor-x',
    totalMs: 28,
    wechatVersion: '8.0.60',
    deviceModel: 'Xiaomi 14 林医生 13800138000',
  };
}

function createWx(envVersion, request) {
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
