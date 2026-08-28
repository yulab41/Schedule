import { createRuntimeClientCapabilityStore } from './platform/client-capabilities.js';
import { createRuntimeMiniTelemetryEmitter } from './platform/telemetry.js';
import { createWechatSessionRuntimeState } from './platform/wechat-session-runtime.js';

const clientCapabilityStore = createRuntimeClientCapabilityStore();
const telemetryEmitter = createRuntimeMiniTelemetryEmitter(clientCapabilityStore);
const wechatSessionRuntimeState = createWechatSessionRuntimeState();

App({
  globalData: { clientCapabilityStore, telemetryEmitter, wechatSessionRuntimeState },

  onLaunch(): void {
    void clientCapabilityStore.refresh({ force: true });
  },

  onShow(): void {
    void clientCapabilityStore.refresh({ force: true });
  },

  onError(error: string): void {
    telemetryEmitter.recordError('app', 'MINI_RUNTIME_ERROR', error);
  },

  onUnhandledRejection(event: { readonly reason?: unknown }): void {
    telemetryEmitter.recordError('app', 'MINI_RUNTIME_ERROR', event.reason);
  },
});
