/** Read-only CLI for the complete worktree dependency environment check. */

/* global console, process */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectCurrentDependencyEnvironment } from './dependency-environment.mjs';

function parseArguments(arguments_) {
  const options = { json: false, root: process.cwd() };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--root') {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error('--root requires a path');
      options.root = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

export function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const result = inspectCurrentDependencyEnvironment(options.root);
  const output = {
    fingerprint: result.context.fingerprint,
    health: result.healthIssues.length === 0 ? 'PASS' : 'FAIL',
    reasons: result.reasons,
    status: result.status,
  };
  if (options.json) console.log(JSON.stringify(output));
  else {
    console.log(`DEPENDENCY_ENVIRONMENT=${output.status}`);
    console.log(`FINGERPRINT=${output.fingerprint}`);
    console.log(`HEALTH=${output.health}`);
    for (const reason of output.reasons) console.log(`REASON=${reason}`);
  }
  if (result.status !== 'MATCH') process.exitCode = 2;
  return output;
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
