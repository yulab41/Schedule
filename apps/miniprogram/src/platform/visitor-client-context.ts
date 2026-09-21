import type { VisitorClientContext } from '@schedule/contracts';

interface Runtime {
  readonly getAccountInfoSync?: typeof wx.getAccountInfoSync;
  readonly getAppBaseInfo?: typeof wx.getAppBaseInfo;
  readonly getDeviceInfo?: typeof wx.getDeviceInfo;
  readonly getNetworkType?: typeof wx.getNetworkType;
  readonly getWindowInfo?: typeof wx.getWindowInfo;
  readonly login?: typeof wx.login;
}

export async function createVisitorCalendarRequestContext(
  runtime: Runtime = wx,
): Promise<{ readonly clientContext: VisitorClientContext; readonly loginCode?: string }> {
  const [networkType, loginCode] = await Promise.all([
    readNetworkType(runtime),
    readLoginCode(runtime),
  ]);
  const app = (safeRead(runtime.getAppBaseInfo) ?? {}) as Partial<MiniProgramAppBaseInfo> & {
    readonly enableDebug?: boolean;
  };
  const device = (safeRead(runtime.getDeviceInfo) ?? {}) as Partial<MiniProgramDeviceInfo> & {
    readonly abi?: string;
    readonly cpuType?: string;
    readonly memorySize?: number;
  };
  const windowInfo = (safeRead(runtime.getWindowInfo) ?? {}) as Partial<MiniProgramWindowInfo> & {
    readonly fontSizeSetting?: number;
    readonly pixelRatio?: number;
    readonly screenWidth?: number;
  };
  const miniProgram = safeRead(runtime.getAccountInfoSync)?.miniProgram;
  const context: Record<string, unknown> = { version: 1 };
  add(context, 'abi', device.abi);
  add(context, 'appVersion', miniProgram?.version);
  add(context, 'benchmarkLevel', device.benchmarkLevel);
  add(context, 'brand', device.brand);
  add(context, 'cpuType', device.cpuType);
  add(context, 'debug', app.enableDebug);
  addEnvironment(context, miniProgram?.envVersion);
  add(context, 'fontSizeSetting', app.fontSizeSetting ?? windowInfo.fontSizeSetting);
  add(context, 'language', app.language);
  add(context, 'memorySize', device.memorySize);
  add(context, 'model', device.model);
  add(context, 'networkType', networkType);
  add(context, 'pixelRatio', windowInfo.pixelRatio);
  add(context, 'platform', device.platform);
  add(context, 'safeArea', windowInfo.safeArea);
  add(context, 'sdkVersion', app.SDKVersion);
  add(context, 'screenHeight', windowInfo.screenHeight);
  add(context, 'screenWidth', windowInfo.screenWidth);
  add(context, 'system', device.system);
  add(context, 'theme', app.theme);
  add(context, 'wechatVersion', app.version);
  add(context, 'windowHeight', windowInfo.windowHeight);
  add(context, 'windowWidth', windowInfo.windowWidth);
  return {
    clientContext: context as unknown as VisitorClientContext,
    ...(loginCode === undefined ? {} : { loginCode }),
  };
}

function add(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined && value !== null && value !== '') target[key] = value;
}

function addEnvironment(target: Record<string, unknown>, value: string | undefined): void {
  if (value === 'develop' || value === 'trial' || value === 'release') target.envVersion = value;
}

function safeRead<T>(reader: (() => T) | undefined): T | undefined {
  try {
    return reader?.();
  } catch {
    return undefined;
  }
}

function readLoginCode(runtime: Runtime): Promise<string | undefined> {
  if (runtime.login === undefined) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    runtime.login?.({
      fail: () => resolve(undefined),
      success: (response) => resolve(response.code.trim() || undefined),
    });
  });
}

function readNetworkType(runtime: Runtime): Promise<string | undefined> {
  if (runtime.getNetworkType === undefined) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    runtime.getNetworkType?.({
      fail: () => resolve(undefined),
      success: (response) =>
        resolve(typeof response.networkType === 'string' ? response.networkType : undefined),
    });
  });
}
