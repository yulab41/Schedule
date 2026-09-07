import { createPasswordReminderRuntime } from './platform/password-reminder-runtime.js';
import { clearRuntimeDirectoryLaunchMarker } from './platform/runtime-diagnostics-launch.js';
import { isTestToolsRuntimeEnabled } from './platform/runtime-environment.js';
import type { RuntimeDiagnosticsSlot } from './platform/runtime-diagnostics-types.js';
import { createRuntimeClientCapabilityStore } from './platform/client-capabilities.js';
import { createRuntimeMiniTelemetryEmitter } from './platform/telemetry.js';
import { createWechatSessionRuntimeState } from './platform/wechat-session-runtime.js';

const clientCapabilityStore = createRuntimeClientCapabilityStore();
const telemetryEmitter = createRuntimeMiniTelemetryEmitter(clientCapabilityStore);
const wechatSessionRuntimeState = createWechatSessionRuntimeState();
// Only lifecycle provenance is retained before authorization, never diagnostic payloads.
const passwordReminderRuntime = createPasswordReminderRuntime();
const diagnosticsLaunch = {
  appLaunchAt: 0,
  initialShowPending: false,
  launchObserved: false,
  warmResumeObserved: false,
};

App({
  globalData: {
    clientCapabilityStore,
    telemetryEmitter,
    wechatSessionRuntimeState,
    diagnosticsLaunch,
    passwordReminderRuntime,
  },

  onLaunch(): void {
    passwordReminderRuntime.checkedAccounts.clear();
    passwordReminderRuntime.activeEditors.clear();
    if (!isTestToolsRuntimeEnabled()) clearRuntimeDirectoryLaunchMarker();
    diagnosticsLaunch.appLaunchAt = Date.now();
    diagnosticsLaunch.launchObserved = true;
    diagnosticsLaunch.initialShowPending = true;
    void clientCapabilityStore.refresh({ force: true });
  },

  onShow(this: { globalData: { runtimeDiagnostics?: RuntimeDiagnosticsSlot } }): void {
    if (diagnosticsLaunch.initialShowPending) diagnosticsLaunch.initialShowPending = false;
    else if (diagnosticsLaunch.launchObserved) diagnosticsLaunch.warmResumeObserved = true;
    if (this.globalData.runtimeDiagnostics !== undefined) {
      this.globalData.runtimeDiagnostics.initialShowPending = diagnosticsLaunch.initialShowPending;
      this.globalData.runtimeDiagnostics.warmResumeObserved = diagnosticsLaunch.warmResumeObserved;
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
