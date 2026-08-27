import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const BUILD_VERSION = '0.1.0-p6.20260824.81';
const enabledCapabilities = Object.freeze({
  core: true,
  externalMessages: false,
  global: true,
  guest: true,
  insights: false,
  organization: false,
  platform: 'miniprogram',
  version: BUILD_VERSION,
  workflows: false,
});

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'telemetry');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', BUILD_VERSION);
});

describe('P6 anonymous Mini telemetry', () => {
  it('accepts only fixed once-per-session boundary markers without leaking marker text', async () => {
    let coreEnabled = false;
    const store = { isEnabled: vi.fn(() => coreEnabled) };
    const recordError = vi.fn();
    const telemetry = await import('../src/platform/telemetry.ts');
    vi.stubGlobal('getApp', () => ({
      globalData: {
        clientCapabilityStore: store,
        telemetryEmitter: { flush: vi.fn(), recordError, recordPerformance: vi.fn() },
      },
    }));

    telemetry.recordMiniTelemetryBoundary('visitor-access:page-onload');
    coreEnabled = true;
    telemetry.recordMiniTelemetryBoundary('visitor-access:page-onload');
    telemetry.recordMiniTelemetryBoundary('visitor-access:page-onload');
    telemetry.recordMiniTelemetryBoundary('secret-user-123');

    expect(telemetry.MINI_TELEMETRY_BOUNDARY_MARKERS).toContain('visitor-access:page-onload');
    expect(recordError).toHaveBeenCalledTimes(1);
    expect(recordError).toHaveBeenCalledWith('unknown', 'UNKNOWN', 'visitor-access:page-onload');
    const serializedEvent = JSON.stringify({
      stackFingerprint: telemetry.createTelemetryStackFingerprint('visitor-access:page-onload'),
    });
    expect(serializedEvent).not.toMatch(/visitor-access|secret-user/u);
  });

  it('batches fixed anonymous fields, deduplicates, and never retries or authenticates failures', async () => {
    const request = vi.fn((options) => options.fail({ errMsg: 'network unavailable' }));
    const storage = createStorageSpies();
    const store = createCapabilityStore(true);
    vi.stubGlobal('getApp', () => ({ globalData: { clientCapabilityStore: store } }));
    vi.stubGlobal('wx', { ...storage, request });
    const { createMiniTelemetryEmitter, createTelemetryStackFingerprint } =
      await import('../src/platform/telemetry.ts');
    const emitter = createMiniTelemetryEmitter({
      capabilityStore: store,
      getDeviceInfo: () => ({ benchmarkLevel: 4, brand: 'private-brand', model: 'private-model' }),
      getNetworkType: (options) => options.success({ networkType: 'wifi' }),
      request,
    });
    const rawStack =
      'Error: failed user 123 at https://example.test/a?token=secret 123e4567-e89b-12d3-a456-426614174000';

    emitter.recordError('app', 'MINI_RUNTIME_ERROR', rawStack);
    emitter.recordError('app', 'MINI_RUNTIME_ERROR', rawStack);
    emitter.recordPerformance('workbench', 'core-ready', 420.4);
    await emitter.flush();

    expect(request).toHaveBeenCalledTimes(1);
    const options = request.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      header: {
        'X-Schedule-Client-Platform': 'miniprogram',
        'X-Schedule-Client-Version': BUILD_VERSION,
      },
      method: 'POST',
      timeout: 3000,
      url: 'https://example.test/api/client-telemetry',
    });
    expect(options.header).not.toHaveProperty('Authorization');
    expect(options.header).not.toHaveProperty('Idempotency-Key');
    expect(options.data).toEqual({
      events: [
        {
          deviceTier: 'medium',
          errorCode: 'MINI_RUNTIME_ERROR',
          networkType: 'wifi',
          page: 'app',
          stackFingerprint: createTelemetryStackFingerprint(rawStack),
        },
        {
          deviceTier: 'medium',
          networkType: 'wifi',
          page: 'workbench',
          performance: { durationMs: 420, metric: 'core-ready' },
        },
      ],
    });
    expect(JSON.stringify(options.data)).not.toMatch(
      /private-brand|private-model|token=secret|123e4567|failed user/u,
    );
    for (const spy of Object.values(storage)) expect(spy).not.toHaveBeenCalled();
    await emitter.flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('caps the in-memory queue at ten events and drops duplicates before the request', async () => {
    const request = vi.fn((options) => options.success({ data: undefined, statusCode: 204 }));
    const store = createCapabilityStore(true);
    vi.stubGlobal('getApp', () => ({ globalData: { clientCapabilityStore: store } }));
    vi.stubGlobal('wx', { request });
    const { createMiniTelemetryEmitter } = await import('../src/platform/telemetry.ts');
    const emitter = createMiniTelemetryEmitter({
      capabilityStore: store,
      getDeviceInfo: () => ({ benchmarkLevel: 8 }),
      getNetworkType: (options) => options.success({ networkType: '5g' }),
      request,
    });

    for (const suffix of 'abcdefghijkl') {
      emitter.recordError('unknown', 'UNKNOWN', `Error: unique-${suffix}`);
    }
    emitter.recordError('unknown', 'UNKNOWN', 'Error: unique-a');
    await emitter.flush();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0].data.events).toHaveLength(10);
    expect(
      new Set(request.mock.calls[0]?.[0].data.events.map((event) => event.stackFingerprint)).size,
    ).toBe(10);
  });

  it('counts in-flight events toward the ten-event memory ceiling', async () => {
    let finishRequest;
    const request = vi.fn((options) => {
      finishRequest = options.success;
    });
    const store = createCapabilityStore(true);
    vi.stubGlobal('getApp', () => ({ globalData: { clientCapabilityStore: store } }));
    vi.stubGlobal('wx', { request });
    const { createMiniTelemetryEmitter } = await import('../src/platform/telemetry.ts');
    const emitter = createMiniTelemetryEmitter({
      capabilityStore: store,
      getDeviceInfo: () => ({ benchmarkLevel: 2 }),
      getNetworkType: (options) => options.success({ networkType: 'wifi' }),
      request,
    });

    for (const suffix of 'abcdefghij') {
      emitter.recordError('app', 'UNKNOWN', `Error: first-${suffix}`);
    }
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    for (const suffix of 'klmnopqrst') {
      emitter.recordError('app', 'UNKNOWN', `Error: second-${suffix}`);
    }
    finishRequest({ data: undefined, statusCode: 204 });
    await emitter.flush();
    await Promise.resolve();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('makes zero platform or HTTP requests while global or core capability is disabled', async () => {
    const request = vi.fn();
    const getDeviceInfo = vi.fn();
    const getNetworkType = vi.fn();
    const store = createCapabilityStore(false);
    vi.stubGlobal('getApp', () => ({ globalData: { clientCapabilityStore: store } }));
    vi.stubGlobal('wx', { request });
    const { createMiniTelemetryEmitter } = await import('../src/platform/telemetry.ts');
    const emitter = createMiniTelemetryEmitter({
      capabilityStore: store,
      getDeviceInfo,
      getNetworkType,
      request,
    });

    emitter.recordError('app', 'MINI_RUNTIME_ERROR', 'Error: disabled');
    emitter.recordPerformance('workbench', 'foreground-ready', 33);
    await emitter.flush();

    expect(request).not.toHaveBeenCalled();
    expect(getDeviceInfo).not.toHaveBeenCalled();
    expect(getNetworkType).not.toHaveBeenCalled();
  });

  it('never throws back into App error handling for hostile rejection objects', async () => {
    const request = vi.fn((options) => options.success({ data: undefined, statusCode: 204 }));
    const store = createCapabilityStore(true);
    vi.stubGlobal('getApp', () => ({ globalData: { clientCapabilityStore: store } }));
    vi.stubGlobal('wx', { request });
    const { createMiniTelemetryEmitter } = await import('../src/platform/telemetry.ts');
    const emitter = createMiniTelemetryEmitter({
      capabilityStore: store,
      getDeviceInfo: () => ({ benchmarkLevel: 1 }),
      getNetworkType: (options) => options.success({ networkType: 'unknown' }),
      request,
    });
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('hostile getter');
        },
      },
    );

    expect(() => emitter.recordError('app', 'MINI_RUNTIME_ERROR', hostile)).not.toThrow();
    await emitter.flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('normalizes sensitive stack variability before pure TypeScript SHA-256', async () => {
    const { createTelemetryStackFingerprint, sha256Hex } =
      await import('../src/platform/telemetry.ts');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('值班错误')).toBe(
      createHash('sha256').update('值班错误', 'utf8').digest('hex'),
    );
    const first = createTelemetryStackFingerprint(
      'Error at https://one.example/a.js?token=secret:123:45 id 123e4567-e89b-12d3-a456-426614174000',
    );
    const second = createTelemetryStackFingerprint(
      'Error at https://two.example/b.js?token=other:987:65 id 223e4567-e89b-12d3-a456-426614174999',
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(createTelemetryStackFingerprint('Error\n at run (C:\\Users\\alice\\app.js:12:3)')).toBe(
      createTelemetryStackFingerprint('Error\n at run (D:\\Profiles\\bob\\bundle.js:99:7)'),
    );
  });

  it('maps only frozen page aliases and coarse device/network values', async () => {
    const { normalizeNetworkType, resolveDeviceTier, resolveTelemetryPage } =
      await import('../src/platform/telemetry.ts');
    expect(resolveDeviceTier(undefined)).toBe('unknown');
    expect(resolveDeviceTier(-1)).toBe('unknown');
    expect(resolveDeviceTier(2)).toBe('low');
    expect(resolveDeviceTier(4)).toBe('medium');
    expect(resolveDeviceTier(8)).toBe('high');
    expect(normalizeNetworkType('wifi')).toBe('wifi');
    expect(normalizeNetworkType('ethernet')).toBe('unknown');
    expect(resolveTelemetryPage('pages/identity/unbind')).toBe('identity');
    expect(resolveTelemetryPage('pages/workbench/index')).toBe('workbench');
    expect(resolveTelemetryPage('pages/manual-matrix-poc/index')).toBe('manual-matrix');
    expect(resolveTelemetryPage('subpackages/scheduling/pages/manual/index')).toBe(
      'manual-schedule',
    );
    expect(resolveTelemetryPage('subpackages/scheduling/pages/backfill/index')).toBe('backfill');
    expect(resolveTelemetryPage('subpackages/organization/pages/group-settings/index')).toBe(
      'group-settings',
    );
    expect(resolveTelemetryPage('unmapped/private-route')).toBe('unknown');
  });

  it('registers App errors and unhandled rejections without sending raw reasons', async () => {
    let appDefinition;
    const requests = [];
    vi.stubGlobal('App', (definition) => {
      appDefinition = definition;
    });
    vi.stubGlobal('wx', {
      getDeviceInfo: () => ({ benchmarkLevel: 4 }),
      getNetworkType: (options) => options.success({ networkType: '4g' }),
      request: vi.fn((options) => {
        requests.push(options);
        if (options.url.includes('/client-capabilities')) {
          options.success({ data: enabledCapabilities, statusCode: 200 });
          return;
        }
        options.success({ data: undefined, statusCode: 204 });
      }),
    });
    await import('../src/app.ts');
    vi.stubGlobal('getApp', () => appDefinition);

    appDefinition.onLaunch();
    await vi.waitFor(() =>
      expect(appDefinition.globalData.clientCapabilityStore.isEnabled('core')).toBe(true),
    );
    appDefinition.onError('private runtime reason 123');
    appDefinition.onUnhandledRejection({ reason: new Error('private rejection 456') });
    await appDefinition.globalData.telemetryEmitter.flush();

    const telemetryRequests = requests.filter((options) =>
      options.url.endsWith('/client-telemetry'),
    );
    expect(telemetryRequests).toHaveLength(1);
    expect(telemetryRequests[0].data.events).toHaveLength(2);
    expect(telemetryRequests[0].data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ errorCode: 'MINI_RUNTIME_ERROR', page: 'app' }),
      ]),
    );
    expect(JSON.stringify(telemetryRequests[0].data)).not.toMatch(
      /private runtime|private rejection/u,
    );
  });

  it('emits existing callback-delimited performance metrics without default visual patches', () => {
    const workbench = readSource('pages/workbench/index.ts');
    const matrix = readSource('pages/manual-matrix-poc/index.ts');
    for (const source of [workbench, matrix]) {
      expect(source).toContain('_performanceDiagnosticsEnabled');
      expect(source).toContain('recordMiniTelemetryPerformance');
    }
    expect(workbench).toContain("recordMiniTelemetryPerformance('workbench'");
    expect(matrix).toContain("recordMiniTelemetryPerformance('manual-matrix'");
    expect(workbench).toMatch(
      /recordMiniTelemetryPerformance[\s\S]*if \(!page\._performanceDiagnosticsEnabled\) return;[\s\S]*performanceEvidence/u,
    );
    expect(matrix).toMatch(
      /recordMiniTelemetryPerformance[\s\S]*if \(!page\._performanceDiagnosticsEnabled\) return;[\s\S]*performanceEvidence/u,
    );
  });

  it('contains no storage, offline queue, raw device identity, or recursive error reporting', () => {
    const source = readSource('platform/telemetry.ts');
    expect(source).not.toMatch(/getStorage|setStorage|removeStorage|localStorage|sessionStorage/u);
    expect(source).not.toMatch(/\b(?:brand|model|system|abi)\b|Authorization|Idempotency-Key/u);
    expect(source).not.toMatch(/retry|setInterval|onError|onUnhandledRejection/u);
    expect(source).toContain("method: 'POST'");
    expect(source).toContain('const requestTimeoutMs = 3_000');
    expect(source).toContain('executeWxJsonRequest');
  });
});

function createCapabilityStore(enabled) {
  return {
    getSnapshot: () => ({ ...enabledCapabilities, core: enabled, global: enabled }),
    isEnabled: (capability) => enabled && (capability === 'core' || capability === 'global'),
    refresh: () => Promise.resolve({ ...enabledCapabilities, core: enabled, global: enabled }),
    require: (capability) =>
      enabled && (capability === 'core' || capability === 'global')
        ? Promise.resolve()
        : Promise.reject(new Error('disabled')),
  };
}

function createStorageSpies() {
  return {
    getStorageInfoSync: vi.fn(),
    getStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
  };
}

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}
