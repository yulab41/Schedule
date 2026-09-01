import { fileURLToPath } from 'node:url';

import { runQueryBenchmark } from './run-legacy-baseline.mjs';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runQueryBenchmark('candidate', 'covering-index').catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : 'Candidate index benchmark failed.'}\n`,
    );
    process.exitCode = 1;
  });
}
