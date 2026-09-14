interface RuntimeAppBaseInfo {
  readonly SDKVersion?: unknown;
}

const SKYLINE_GRID_REGRESSION_VERSION = '3.17.2';

export function needsSkyline3172UiCompatibility(
  appBaseInfo: RuntimeAppBaseInfo | undefined,
): boolean {
  return appBaseInfo?.SDKVersion === SKYLINE_GRID_REGRESSION_VERSION;
}

export function needsCurrentRuntimeSkyline3172UiCompatibility(): boolean {
  if (typeof wx === 'undefined' || typeof wx.getAppBaseInfo !== 'function') return false;
  try {
    return needsSkyline3172UiCompatibility(wx.getAppBaseInfo());
  } catch {
    return false;
  }
}
