const buildCommit =
  typeof __MINIPROGRAM_BUILD_COMMIT__ === 'string' ? __MINIPROGRAM_BUILD_COMMIT__ : 'test';
const buildVersion =
  typeof __MINIPROGRAM_BUILD_VERSION__ === 'string' ? __MINIPROGRAM_BUILD_VERSION__ : 'test';

export const buildInfo = Object.freeze({
  buildCommit,
  buildLabel: `${buildVersion}@${buildCommit}`,
  buildVersion,
});
