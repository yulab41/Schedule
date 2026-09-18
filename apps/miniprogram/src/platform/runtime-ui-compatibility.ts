interface RuntimeAppBaseInfo {
  readonly SDKVersion?: unknown;
}

const SKYLINE_GRID_REGRESSION_VERSION = '3.17.2';

/**
 * The compatibility surface exists to make the Skyline renderer behave like WebView.
 * It must never run on WebView itself, otherwise a build that requests WebView would
 * still be carrying Skyline workarounds (its own scoped styles, its own scroller
 * pager and its own wheel twin). The requested renderer is a build-time fact from
 * `src/app.json`, so it is injected as `__MINIPROGRAM_RENDERER__`.
 */
function requestsSkylineRenderer(): boolean {
  return typeof __MINIPROGRAM_RENDERER__ !== 'string' || __MINIPROGRAM_RENDERER__ === 'skyline';
}

export function needsSkyline3172UiCompatibility(
  appBaseInfo: RuntimeAppBaseInfo | undefined,
): boolean {
  return requestsSkylineRenderer() && appBaseInfo?.SDKVersion === SKYLINE_GRID_REGRESSION_VERSION;
}

export function needsCurrentRuntimeSkyline3172UiCompatibility(): boolean {
  if (typeof wx === 'undefined' || typeof wx.getAppBaseInfo !== 'function') return false;
  try {
    return needsSkyline3172UiCompatibility(wx.getAppBaseInfo());
  } catch {
    return false;
  }
}
