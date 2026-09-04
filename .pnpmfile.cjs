'use strict';

const { assertInstallAuthorized } = require('./scripts/codex/install-tripwire.cjs');

// This module is loaded by pnpm before dependency resolution. It is deliberately independent of
// Codex project Hooks and has no environment-variable bypass. It intentionally exports no pnpm
// package hook, so pnpm does not add a pnpmfileChecksum requirement to the existing lockfile.
assertInstallAuthorized();

module.exports = {};
