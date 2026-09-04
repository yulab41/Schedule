/** Explicitly authorized install path for a dependency environment MISS. */

/* global console, process */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installCurrentDependencyEnvironmentIfNeeded } from './dependency-environment.mjs';

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
  const result = installCurrentDependencyEnvironmentIfNeeded(options.root);
  if (options.json) console.log(JSON.stringify(result));
  else {
    console.log(`DEPENDENCY_ENVIRONMENT=${result.action === 'reused' ? 'MATCH' : 'INSTALLED'}`);
    for (const reason of result.initialReasons) console.log(`INITIAL_REASON=${reason}`);
  }
  return result;
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
