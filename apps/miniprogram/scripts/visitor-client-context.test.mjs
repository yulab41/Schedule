import { describe, expect, it } from 'vitest';

import { createVisitorCalendarRequestContext } from '../src/platform/visitor-client-context.ts';

function createRuntime({ failLogin = false } = {}) {
  return {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial', version: '2.8.0' } }),
    getAppBaseInfo: () => ({
      SDKVersion: '3.7.12',
      enableDebug: false,
      fontSizeSetting: 18,
      language: 'zh_CN',
      theme: 'light',
      version: '8.0.64',
    }),
    getDeviceInfo: () => ({
      abi: 'arm64-v8a',
      benchmarkLevel: 35,
      brand: 'Xiaomi',
      cpuType: 'arm64',
      memorySize: 12288,
      model: 'Xiaomi 14',
      platform: 'android',
      system: 'Android 15',
    }),
    getNetworkType: ({ success }) => success({ networkType: 'wifi' }),
    getWindowInfo: () => ({
      pixelRatio: 3,
      safeArea: { bottom: 852, height: 828, left: 0, right: 393, top: 24, width: 393 },
      screenHeight: 852,
      screenWidth: 393,
      windowHeight: 804,
      windowWidth: 393,
    }),
    login: ({ fail, success }) =>
      failLogin ? fail(new Error('offline')) : success({ code: 'temporary-code' }),
  };
}

describe('visitor client context', () => {
  it('collects the strict allowlisted environment and a disposable login code', async () => {
    await expect(createVisitorCalendarRequestContext(createRuntime())).resolves.toMatchObject({
      clientContext: {
        abi: 'arm64-v8a',
        appVersion: '2.8.0',
        brand: 'Xiaomi',
        envVersion: 'trial',
        model: 'Xiaomi 14',
        networkType: 'wifi',
        sdkVersion: '3.7.12',
        version: 1,
        wechatVersion: '8.0.64',
      },
      loginCode: 'temporary-code',
    });
  });

  it('keeps the visitor read available when wx.login fails', async () => {
    const result = await createVisitorCalendarRequestContext(createRuntime({ failLogin: true }));
    expect(result.loginCode).toBeUndefined();
    expect(result.clientContext.model).toBe('Xiaomi 14');
  });
});
