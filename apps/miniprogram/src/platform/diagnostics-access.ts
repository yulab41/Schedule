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

export function canUseDiagnostics(): boolean {
  return (
    isTestToolsRuntimeEnabled() &&
    hasDiagnosticsPermission(getStoredWechatProfile()?.id, getWechatSessionGeneration())
  );
}

export async function refreshDiagnosticsAccess(): Promise<boolean> {
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
    if (generation !== getWechatSessionGeneration() || getStoredWechatProfile()?.id !== profile.id)
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
    if (generation === getWechatSessionGeneration()) invalidateDiagnosticsPermission();
    return false;
  }
}

function activateDiagnosticsSlot(): void {
  try {
    const globalData = getApp<{ globalData?: { runtimeDiagnostics?: RuntimeDiagnosticsSlot } }>()
      .globalData;
    if (globalData === undefined || globalData.runtimeDiagnostics !== undefined) return;
    const launchMarkerConsumed = consumeRuntimeDirectoryLaunchMarker(true);
    globalData.runtimeDiagnostics = {
      appLaunchAt: Date.now(),
      directorySearchRecording: launchMarkerConsumed,
      directorySearches: [],
      errors: [],
      initialShowPending: false,
      launchMarkerConsumed,
      launchObserved: true,
      performance: [],
      requests: [],
      warmResumeObserved: false,
    };
  } catch {
    /* A diagnostic slot is optional and never blocks navigation. */
  }
}
