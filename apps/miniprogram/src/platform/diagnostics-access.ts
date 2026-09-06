import {
  hasDiagnosticsPermission,
  invalidateDiagnosticsPermission,
  setDiagnosticsPermission,
  subscribeDiagnosticsPermission,
} from './diagnostics-permission-state.js';
import { consumeRuntimeDirectoryLaunchMarker } from './runtime-diagnostics-launch.js';
import type { RuntimeDiagnosticsSlot } from './runtime-diagnostics-types.js';
import { isTestToolsRuntimeEnabled } from './runtime-environment.js';
import { runtimeConfig } from './runtime-config.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
  getWechatSessionGeneration,
} from './wechat-identity.js';
import { executeWxJsonRequest } from './wx-request-executor.js';

export { subscribeDiagnosticsPermission };

let accessSerial = 0;

export function canUseDiagnostics(): boolean {
  return (
    isTestToolsRuntimeEnabled() &&
    getStoredWechatToken() !== undefined &&
    hasDiagnosticsPermission(getStoredWechatProfile()?.id, getWechatSessionGeneration())
  );
}

export async function refreshDiagnosticsAccess(): Promise<boolean> {
  const serial = ++accessSerial;
  const profile = getStoredWechatProfile();
  const accessToken = getStoredWechatToken();
  const generation = getWechatSessionGeneration();
  if (!isTestToolsRuntimeEnabled() || profile === undefined || accessToken === undefined) {
    invalidateDiagnosticsPermission();
    return false;
  }
  try {
    const authentication = getWechatRequestAuthentication();
    const response = await executeWxJsonRequest({
      capability: 'core',
      method: 'GET',
      authentication: { accessToken, ...authentication, sessionGeneration: generation },
      request: (options) => wx.request(options),
      url: runtimeConfig.apiBaseUrl.replace(/\/$/u, '') + '/me/diagnostics-access',
    });
    if (
      serial !== accessSerial ||
      generation !== getWechatSessionGeneration() ||
      getStoredWechatProfile()?.id !== profile.id
    )
      return false;
    if (
      response.statusCode !== 200 ||
      response.data === null ||
      typeof response.data !== 'object' ||
      (response.data as { allowed?: unknown }).allowed !== true
    ) {
      invalidateDiagnosticsPermission();
      return false;
    }
    activateDiagnosticsSlot();
    setDiagnosticsPermission(profile.id, generation);
    return true;
  } catch {
    if (serial === accessSerial && generation === getWechatSessionGeneration())
      invalidateDiagnosticsPermission();
    return false;
  }
}

function activateDiagnosticsSlot(): void {
  try {
    const globalData = getApp<{
      globalData?: {
        runtimeDiagnostics?: RuntimeDiagnosticsSlot;
        diagnosticsLaunch?: Pick<
          RuntimeDiagnosticsSlot,
          'appLaunchAt' | 'launchObserved' | 'warmResumeObserved' | 'initialShowPending'
        >;
      };
    }>().globalData;
    if (globalData === undefined || globalData.runtimeDiagnostics !== undefined) return;
    const launchMarkerConsumed = consumeRuntimeDirectoryLaunchMarker(true);
    globalData.runtimeDiagnostics = {
      appLaunchAt: globalData.diagnosticsLaunch?.appLaunchAt ?? 0,
      directorySearchRecording: launchMarkerConsumed,
      directorySearches: [],
      errors: [],
      initialShowPending: globalData.diagnosticsLaunch?.initialShowPending ?? false,
      launchMarkerConsumed,
      launchObserved: globalData.diagnosticsLaunch?.launchObserved ?? false,
      performance: [],
      requests: [],
      warmResumeObserved: globalData.diagnosticsLaunch?.warmResumeObserved ?? false,
    };
  } catch {
    /* A diagnostic slot is optional and never blocks navigation. */
  }
}
