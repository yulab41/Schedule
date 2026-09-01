import { fileURLToPath } from 'node:url';

import {
  baseScenarios,
  captureScenario,
  createBenchmarkRuntime,
  explainScenario,
  stripSql,
} from './benchmark-runtime.mjs';

export async function runLegacyProbe() {
  const runtime = await createBenchmarkRuntime();
  try {
    const scenarioId = process.env.DIRECTORY_BENCHMARK_SCENARIO ?? 'initials-member';
    const scenario = baseScenarios.find((candidate) => candidate.id === scenarioId);
    if (scenario === undefined) throw new Error(`Scenario is missing: ${scenarioId}.`);
    const capture = await captureScenario(runtime, scenario);
    const explain = await explainScenario(runtime, scenario);
    return { capture: stripSql(capture), explain };
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLegacyProbe()
    .then((result) => {
      const output =
        process.env.DIRECTORY_BENCHMARK_SUMMARY === '1'
          ? {
              bufferIo: result.capture.bufferIo,
              count: result.capture.count,
              main: result.capture.main,
              outcome: result.capture.outcome,
              page: result.capture.page,
              scenarioId: result.capture.scenarioId,
              timing: result.capture.timing,
            }
          : result;
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : 'Legacy probe failed.'}\n`);
      process.exitCode = 1;
    });
}
