import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  baseScenarios,
  captureScenario,
  createBenchmarkRuntime,
  stripSql,
} from './benchmark-runtime.mjs';
import { resetBenchmarkDatabaseCold } from './cold-reset.mjs';

export async function runFilterRoutingBenchmark(variant) {
  if (!['covering-index', 'no-index'].includes(variant)) throw new Error('Invalid variant.');
  const scenario = baseScenarios.find((candidate) => candidate.id === 'seven-filter-member');
  if (scenario === undefined) throw new Error('Seven-filter scenario is missing.');
  const warmRuns = [];
  const warmRuntime = await createBenchmarkRuntime('candidate');
  try {
    await captureScenario(warmRuntime, scenario);
    for (let round = 0; round < 30; round += 1) {
      warmRuns.push(stripSql(await captureScenario(warmRuntime, scenario)));
    }
  } finally {
    await warmRuntime.close();
  }
  const coldRuns = [];
  for (let round = 0; round < 3; round += 1) {
    await resetBenchmarkDatabaseCold();
    const runtime = await createBenchmarkRuntime('candidate');
    try {
      coldRuns.push(stripSql(await captureScenario(runtime, scenario)));
    } finally {
      await runtime.close();
    }
  }
  const report = {
    cold: summarize(coldRuns),
    scenarioId: scenario.id,
    strategy: 'candidate-filter-routes-to-legacy',
    variant,
    warm: summarize(warmRuns),
  };
  const outputPath = resolve(
    `runtime/audit/directory-query-isolation/filter-routing-${variant}.json`,
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
  return report;
}

function summarize(runs) {
  return {
    countExaminedRows: distribution(runs.map((run) => run.count?.examinedRows ?? 0)),
    mainExaminedRows: distribution(runs.map((run) => run.main?.examinedRows ?? 0)),
    mainMs: distribution(runs.map((run) => run.timing.rowsMs)),
    physicalReads: distribution(runs.map((run) => run.bufferIo.physicalReads)),
    totalMs: distribution(runs.map((run) => run.timing.totalMs)),
  };
}

function distribution(values) {
  const sorted = [...values].sort((first, second) => first - second);
  return {
    max: round(sorted.at(-1) ?? 0),
    p50: round(sorted[Math.floor(sorted.length / 2)] ?? 0),
    p95: round(sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0),
  };
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runFilterRoutingBenchmark(process.argv[2] ?? '')
    .then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.stack : 'Filter benchmark failed.'}\n`,
      );
      process.exitCode = 1;
    });
}
