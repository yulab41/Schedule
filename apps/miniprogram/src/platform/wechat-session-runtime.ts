export interface WechatSessionRuntimeState {
  generation: number;
  invalidated: boolean;
  recoveryPromise: Promise<string | undefined> | undefined;
}

interface WechatSessionRuntimeGlobalData {
  wechatSessionRuntimeState?: WechatSessionRuntimeState;
}

interface WechatSessionRuntimeApp {
  readonly globalData?: WechatSessionRuntimeGlobalData;
}

const fallbackRuntimeState = createWechatSessionRuntimeState();

export function createWechatSessionRuntimeState(): WechatSessionRuntimeState {
  return {
    generation: 0,
    invalidated: false,
    recoveryPromise: undefined,
  };
}

export function getWechatSessionRuntimeState(): WechatSessionRuntimeState {
  if (typeof getApp !== 'function') return fallbackRuntimeState;
  try {
    const globalData = getApp<WechatSessionRuntimeApp>().globalData;
    if (globalData === undefined) return fallbackRuntimeState;
    const existing = globalData.wechatSessionRuntimeState;
    if (existing !== undefined) return existing;
    const created = createWechatSessionRuntimeState();
    globalData.wechatSessionRuntimeState = created;
    return created;
  } catch {
    return fallbackRuntimeState;
  }
}
