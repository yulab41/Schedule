import { createRuntimeClientCapabilityStore } from './platform/client-capabilities.js';
import { createRuntimeMiniTelemetryEmitter } from './platform/telemetry.js';

const clientCapabilityStore = createRuntimeClientCapabilityStore();
const telemetryEmitter = createRuntimeMiniTelemetryEmitter(clientCapabilityStore);

App({
  globalData: { clientCapabilityStore, telemetryEmitter },

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
