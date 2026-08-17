#!/usr/bin/env node

import { parseCiArguments, runCiCommand } from './miniprogram-ci-helpers.mjs';

try {
  const result = await runCiCommand(parseCiArguments(process.argv.slice(2)));
  const artifactSuffix = result.artifact ? `; artifact=${result.artifact}` : '';
  const versionSuffix = result.version ? `; version=${result.version}` : '';
  console.log(
    `[miniprogram-ci] ${result.action} ${result.externalStateChanged ? 'completed' : 'dry-run passed'}; profile=${result.profile}; manifest=${result.manifestDigest}${artifactSuffix}${versionSuffix}`,
  );
} catch (error) {
  console.error(
    `[miniprogram-ci] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
