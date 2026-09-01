import { createRuntimeClientCapabilityStore } from './platform/client-capabilities.js';
import { consumeRuntimeDirectoryLaunchMarker } from './platform/runtime-diagnostics-launch.js';
import type { RuntimeDiagnosticsSlot } from './platform/runtime-diagnostics-types.js';
import { isTestToolsRuntimeEnabled } from './platform/runtime-environment.js';
import { createRuntimeMiniTelemetryEmitter } from './platform/telemetry.js';
import { createWechatSessionRuntimeState } from './platform/wechat-session-runtime.js';

const clientCapabilityStore = createRuntimeClientCapabilityStore();
const telemetryEmitter = createRuntimeMiniTelemetryEmitter(clientCapabilityStore);
const wechatSessionRuntimeState = createWechatSessionRuntimeState();
const diagnosticsEnabled = isTestToolsRuntimeEnabled();
const runtimeDiagnostics: RuntimeDiagnosticsSlot | undefined = diagnosticsEnabled
  ? {
      appLaunchAt: 0,
      directorySearchRecording: false,
      directorySearches: [],
      errors: [],
      initialShowPending: false,
      launchMarkerConsumed: false,
      launchObserved: false,
      performance: [],
      requests: [],
      warmResumeObserved: false,
    }
  : undefined;

App({
  globalData: {
    clientCapabilityStore,
    ...(runtimeDiagnostics === undefined ? {} : { runtimeDiagnostics }),
    telemetryEmitter,
    wechatSessionRuntimeState,
  },

  onLaunch(): void {
    const appLaunchAt = Date.now();
    const launchMarkerConsumed = consumeRuntimeDirectoryLaunchMarker(diagnosticsEnabled);
    if (runtimeDiagnostics !== undefined) {
      runtimeDiagnostics.appLaunchAt = appLaunchAt;
      runtimeDiagnostics.directorySearchRecording = launchMarkerConsumed;
      runtimeDiagnostics.launchMarkerConsumed = launchMarkerConsumed;
      runtimeDiagnostics.launchObserved = true;
      runtimeDiagnostics.initialShowPending = true;
      runtimeDiagnostics.warmResumeObserved = false;
    }
    void clientCapabilityStore.refresh({ force: true });
  },

  onShow(): void {
    if (runtimeDiagnostics !== undefined) {
      if (runtimeDiagnostics.initialShowPending) runtimeDiagnostics.initialShowPending = false;
      else if (runtimeDiagnostics.launchObserved) runtimeDiagnostics.warmResumeObserved = true;
    }
    void clientCapabilityStore.refresh({ force: true });
  },

  onError(error: string): void {
    telemetryEmitter.recordError('app', 'MINI_RUNTIME_ERROR', error);
  },

  onUnhandledRejection(event: { readonly reason?: unknown }): void {
    telemetryEmitter.recordError('app', 'MINI_RUNTIME_ERROR', event.reason);
  },
});
