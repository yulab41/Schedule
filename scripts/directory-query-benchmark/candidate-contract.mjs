import { fileURLToPath } from 'node:url';

import { baseScenarios, captureScenario, createBenchmarkRuntime } from './benchmark-runtime.mjs';

export async function verifyCandidateQueryContract() {
  const scenario = baseScenarios.find((candidate) => candidate.id === 'initials-member');
  if (scenario === undefined) throw new Error('Initials scenario is missing.');
  const legacyRuntime = await createBenchmarkRuntime('legacy');
  const candidateRuntime = await createBenchmarkRuntime('candidate');
  try {
    const legacy = await captureScenario(legacyRuntime, scenario);
    const candidate = await captureScenario(candidateRuntime, scenario);
    if (legacy.main?.digest === candidate.main?.digest) {
      throw new Error('Candidate query still uses the legacy SQL digest.');
    }
    if (!candidate.main?.sampleSql.toLowerCase().includes('union all')) {
      throw new Error('Candidate query does not materialize branch candidates with UNION ALL.');
    }
    return {
      candidateDigest: candidate.main.digest,
      legacyDigest: legacy.main.digest,
    };
  } finally {
    await candidateRuntime.close();
    await legacyRuntime.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyCandidateQueryContract()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Candidate contract failed.'}\n`,
      );
      process.exitCode = 1;
    });
}
