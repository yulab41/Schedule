import { createMemberActivityRuntime } from './platform/member-activity-runtime.js';
import { createOperationId } from './platform/operation-id.js';
import { getStoredWechatToken, getStoredWechatProfile } from './platform/wechat-identity.js';
import { createRuntimeAccountOpenClient } from './platform/client-core-calendar.js';
import { createPasswordReminderRuntime } from './platform/password-reminder-runtime.js';
import { clearRuntimeDirectoryLaunchMarker } from './platform/runtime-diagnostics-launch.js';
import { isTestToolsRuntimeEnabled } from './platform/runtime-environment.js';
import type { RuntimeDiagnosticsSlot } from './platform/runtime-diagnostics-types.js';
import { createRuntimeClientCapabilityStore } from './platform/client-capabilities.js';
import { createRuntimeMiniTelemetryEmitter, resolveTelemetryPage } from './platform/telemetry.js';
import { createWechatSessionRuntimeState } from './platform/wechat-session-runtime.js';
import { initializeClientUpdate } from './platform/client-update.js';

declare function getCurrentPages(): Array<{ readonly route?: string }>;

const clientCapabilityStore = createRuntimeClientCapabilityStore();
const telemetryEmitter = createRuntimeMiniTelemetryEmitter(clientCapabilityStore);
const wechatSessionRuntimeState = createWechatSessionRuntimeState();
const memberActivityRuntime = createMemberActivityRuntime({
  createEventId: createOperationId,
  currentAccount: () =>
    getStoredWechatToken() === undefined ? undefined : getStoredWechatProfile()?.id,
  report: async (event, accountId) => {
    if (getStoredWechatProfile()?.id === accountId)
      await createRuntimeAccountOpenClient(
        getStoredWechatToken,
        () => getStoredWechatProfile()?.id === accountId,
      ).open(event);
  },
  onError: () =>
    telemetryEmitter.recordError('app', 'MINI_RUNTIME_ERROR', 'ACCOUNT_ACTIVITY_OPEN_FAILED'),
});
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
    memberActivityRuntime,
  },

  onLaunch(): void {
    initializeClientUpdate();
    passwordReminderRuntime.checkedAccounts.clear();
    passwordReminderRuntime.activeEditors.clear();
    if (!isTestToolsRuntimeEnabled()) clearRuntimeDirectoryLaunchMarker();
    diagnosticsLaunch.appLaunchAt = Date.now();
    diagnosticsLaunch.launchObserved = true;
    diagnosticsLaunch.initialShowPending = true;
    void clientCapabilityStore.refresh({ force: true });
  },

  onShow(this: { globalData: { runtimeDiagnostics?: RuntimeDiagnosticsSlot } }): void {
    memberActivityRuntime.onShow();
    if (diagnosticsLaunch.initialShowPending) diagnosticsLaunch.initialShowPending = false;
    else if (diagnosticsLaunch.launchObserved) diagnosticsLaunch.warmResumeObserved = true;
    if (this.globalData.runtimeDiagnostics !== undefined) {
      this.globalData.runtimeDiagnostics.initialShowPending = diagnosticsLaunch.initialShowPending;
      this.globalData.runtimeDiagnostics.warmResumeObserved = diagnosticsLaunch.warmResumeObserved;
    }
    void clientCapabilityStore.refresh({ force: true });
  },

  onHide(): void {
    memberActivityRuntime.onHide();
  },

  onError(error: string): void {
    telemetryEmitter.recordError(resolveCurrentRuntimeErrorPage(), 'MINI_RUNTIME_ERROR', error);
  },

  onUnhandledRejection(event: { readonly reason?: unknown }): void {
    telemetryEmitter.recordError(
      resolveCurrentRuntimeErrorPage(),
      'MINI_RUNTIME_ERROR',
      event.reason,
    );
  },
});

function resolveCurrentRuntimeErrorPage() {
  try {
    const pages = getCurrentPages();
    const currentRouteEntry = pages[pages.length - 1];
    return resolveTelemetryPage(currentRouteEntry?.route ?? '');
  } catch {
    return 'app' as const;
  }
}
