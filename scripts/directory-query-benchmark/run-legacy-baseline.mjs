import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  baseScenarios,
  captureScenario,
  createBenchmarkRuntime,
  explainScenario,
  stripSql,
} from './benchmark-runtime.mjs';
import { resetBenchmarkDatabaseCold } from './cold-reset.mjs';

const outputDirectory = fileURLToPath(
  new URL('../../runtime/audit/directory-query-isolation', import.meta.url),
);
const warmRounds = Number(process.env.DIRECTORY_BENCHMARK_WARM_ROUNDS ?? 30);
const coldRounds = Number(process.env.DIRECTORY_BENCHMARK_COLD_ROUNDS ?? 3);

export async function runQueryBenchmark(strategy = 'legacy', variant = '') {
  if (!['candidate', 'legacy'].includes(strategy)) throw new Error('Unknown query strategy.');
  if (!/^[a-z0-9-]*$/u.test(variant)) throw new Error('Invalid benchmark variant.');
  const outputStem =
    variant.length > 0
      ? `${strategy}-${variant}-benchmark`
      : strategy === 'legacy'
        ? 'legacy-baseline'
        : 'candidate-benchmark';
  const outputPath = fileURLToPath(
    new URL(`../../runtime/audit/directory-query-isolation/${outputStem}.json`, import.meta.url),
  );
  assertRoundCount(warmRounds, 20, 'warm');
  assertRoundCount(coldRounds, 3, 'cold');
  const startedAt = new Date().toISOString();
  const warmRuntime = await createBenchmarkRuntime(strategy);
  let scenarios;
  let warmRuns;
  let plans;
  try {
    scenarios = await createPaginationScenarios(warmRuntime);
    process.stdout.write(`[${strategy}] warmup scenarios=${scenarios.length}\n`);
    for (const scenario of interleave(scenarios, 0)) await captureScenario(warmRuntime, scenario);

    warmRuns = [];
    for (let round = 0; round < warmRounds; round += 1) {
      const ordered = interleave(scenarios, round);
      for (const scenario of ordered) {
        const capture = await captureScenario(warmRuntime, scenario);
        warmRuns.push({ round: round + 1, ...stripSql(capture) });
      }
      process.stdout.write(`[${strategy}] warm round=${round + 1}/${warmRounds}\n`);
    }

    plans = [];
    for (const scenario of scenarios.filter((candidate) => !candidate.expectedPermissionDenied)) {
      const explained = await explainScenario(warmRuntime, scenario);
      plans.push({ scenarioId: scenario.id, ...explained });
      process.stdout.write(`[${strategy}] plan scenario=${scenario.id}\n`);
    }
  } finally {
    await warmRuntime.close();
  }

  const coldRuns = [];
  const coldScenarios = scenarios.filter((scenario) => !scenario.expectedPermissionDenied);
  let coldDefinition;
  for (let round = 0; round < coldRounds; round += 1) {
    for (const scenario of interleave(coldScenarios, round * 3 + 1)) {
      const reset = await resetBenchmarkDatabaseCold();
      coldDefinition ??= reset;
      const runtime = await createBenchmarkRuntime(strategy);
      try {
        const capture = await captureScenario(runtime, scenario);
        coldRuns.push({ round: round + 1, ...stripSql(capture) });
      } finally {
        await runtime.close();
      }
      process.stdout.write(
        `[${strategy}] cold round=${round + 1}/${coldRounds} scenario=${scenario.id}\n`,
      );
    }
  }

  const permissionRuns = [];
  const denied = scenarios.find((scenario) => scenario.expectedPermissionDenied);
  if (denied !== undefined) {
    const runtime = await createBenchmarkRuntime(strategy);
    try {
      for (let round = 0; round < coldRounds; round += 1) {
        permissionRuns.push({
          round: round + 1,
          ...stripSql(await captureScenario(runtime, denied)),
        });
      }
    } finally {
      await runtime.close();
    }
  }

  const report = {
    coldDefinition: {
      ...coldDefinition,
      innodbBufferPoolCleared: 'mysql_process_stopped',
      mysqlBufferPoolDumpAtShutdown: false,
      mysqlBufferPoolLoadAtStartup: false,
      scope: 'dedicated_benchmark_volume_only',
    },
    coldRounds,
    coldRuns,
    coldSummary: summarizeRuns(coldRuns),
    completedAt: new Date().toISOString(),
    gitSha: git(['rev-parse', 'HEAD']),
    label: `${strategy}-query-isolated-synthetic${variant.length === 0 ? '' : `-${variant}`}`,
    permissionRuns,
    plans,
    startedAt,
    warmRounds,
    warmRuns,
    warmSummary: summarizeRuns(warmRuns),
  };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`[${strategy}] output=${outputPath}\n`);
  return report;
}

export function runLegacyBaseline() {
  return runQueryBenchmark('legacy');
}

async function createPaginationScenarios(runtime) {
  const first = Object.freeze({
    id: 'pagination-first-member',
    query: Object.freeze({
      ...baseScenarios.find((scenario) => scenario.id === 'single-character-member').query,
      pageSize: 30,
    }),
    role: 'member',
  });
  const firstCapture = await captureScenario(runtime, first);
  const cursor = firstCapture.page?.nextCursor;
  if (cursor === undefined) throw new Error('Pagination fixture did not produce a next cursor.');
  const next = Object.freeze({
    id: 'pagination-next-member',
    query: Object.freeze({ ...first.query, cursor }),
    role: 'member',
  });
  return Object.freeze([...baseScenarios, first, next]);
}

function interleave(scenarios, seed) {
  const offset = seed % scenarios.length;
  const rotated = [...scenarios.slice(offset), ...scenarios.slice(0, offset)];
  return seed % 2 === 0 ? rotated : rotated.reverse();
}

function summarizeRuns(runs) {
  const groups = Map.groupBy(runs, (run) => run.scenarioId);
  return Object.fromEntries(
    [...groups.entries()].map(([scenarioId, scenarioRuns]) => [
      scenarioId,
      {
        count: scenarioRuns.length,
        countExaminedRows: distribution(scenarioRuns.map((run) => run.count?.examinedRows ?? 0)),
        countMs: distribution(scenarioRuns.map((run) => run.timing.countMs)),
        logicalReads: distribution(scenarioRuns.map((run) => run.bufferIo.logicalReads)),
        mainExaminedRows: distribution(scenarioRuns.map((run) => run.main?.examinedRows ?? 0)),
        mainMs: distribution(scenarioRuns.map((run) => run.timing.rowsMs)),
        physicalReads: distribution(scenarioRuns.map((run) => run.bufferIo.physicalReads)),
        resultCounts: [...new Set(scenarioRuns.map((run) => run.page?.resultCount ?? 0))],
        totalCounts: [...new Set(scenarioRuns.map((run) => run.page?.totalCount ?? 0))],
        totalMs: distribution(scenarioRuns.map((run) => run.timing.totalMs)),
      },
    ]),
  );
}

function distribution(values) {
  const sorted = [...values].sort((first, second) => first - second);
  return {
    max: round(sorted.at(-1) ?? 0),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
  };
}

function percentile(sorted, percentileValue) {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index];
}

function assertRoundCount(value, minimum, label) {
  if (!Number.isInteger(value) || value < minimum || value > 100) {
    throw new Error(`${label} rounds must be an integer between ${minimum} and 100.`);
  }
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

function git(arguments_) {
  return execFileSync('git', arguments_, { encoding: 'utf8' }).trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLegacyBaseline().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : 'Legacy baseline failed.'}\n`);
    process.exitCode = 1;
  });
}
