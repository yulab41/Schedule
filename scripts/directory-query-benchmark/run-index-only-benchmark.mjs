import { fileURLToPath } from 'node:url';

import { runQueryBenchmark } from './run-legacy-baseline.mjs';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runQueryBenchmark('legacy', 'covering-index').catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : 'Index-only benchmark failed.'}\n`,
    );
    process.exitCode = 1;
  });
}
