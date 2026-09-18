const buildCommit =
  typeof __MINIPROGRAM_BUILD_COMMIT__ === 'string' ? __MINIPROGRAM_BUILD_COMMIT__ : 'test';
const buildVersion =
  typeof __MINIPROGRAM_BUILD_VERSION__ === 'string' ? __MINIPROGRAM_BUILD_VERSION__ : 'test';
const buildDescription =
  typeof __MINIPROGRAM_BUILD_DESCRIPTION__ === 'string'
    ? __MINIPROGRAM_BUILD_DESCRIPTION__
    : 'local-test-build';
const buildTime =
  typeof __MINIPROGRAM_BUILD_TIME__ === 'string' ? __MINIPROGRAM_BUILD_TIME__ : '未提供';
const buildProfile =
  typeof __MINIPROGRAM_BUILD_PROFILE__ === 'string' ? __MINIPROGRAM_BUILD_PROFILE__ : 'production';
const requestedRenderer =
  typeof __MINIPROGRAM_RENDERER__ === 'string' ? __MINIPROGRAM_RENDERER__ : 'skyline';

export const buildInfo = Object.freeze({
  apiEnvironment: buildProfile,
  buildCommit,
  buildDescription,
  buildDirty:
    typeof __MINIPROGRAM_BUILD_DIRTY__ === 'boolean' ? __MINIPROGRAM_BUILD_DIRTY__ : false,
  buildLabel: `${buildVersion}@${buildCommit}`,
  buildProfile,
  buildTime,
  buildVersion,
  cloudEnvironment: '未使用 CloudBase',
  npmBuildArtifact: '未使用独立小程序 npm 构建产物',
  primaryWorkspaceSwipeEnabled: false,
  // Report what the shipped app actually asks the platform for: the diagnostics are
  // used to judge real-device rendering, so a stale hard-coded value misleads.
  renderer: requestedRenderer === 'webview' ? 'WebView（应用请求）' : 'Skyline（应用请求）',
});
