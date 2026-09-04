'use strict';

const { assertInstallAuthorized } = require('./scripts/codex/install-tripwire.cjs');

// This module is loaded by pnpm before dependency resolution. It is deliberately independent of
// Codex project Hooks and has no environment-variable bypass.
assertInstallAuthorized();

module.exports = {
  hooks: {
    readPackage(packageManifest) {
      return packageManifest;
    },
  },
};
