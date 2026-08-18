#!/usr/bin/env node

import { parseMiniTestArguments, runMiniTestCommand } from './minitest-helpers.mjs';

try {
  const result = await runMiniTestCommand(parseMiniTestArguments(process.argv.slice(2)));
  if (result.action === 'submit') {
    const suffix = result.planId ? `; plan=${result.planId}` : '';
    console.log(
      `[minitest] submit ${result.externalStateChanged ? 'completed' : 'dry-run passed'}; cases=${result.caseCount ?? 4}${suffix}`,
    );
  } else {
    console.log(`[minitest] plan=${result.planId}; status=${result.status} (${result.statusCode})`);
  }
} catch (error) {
  console.error(`[minitest] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
