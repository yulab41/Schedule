import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  baseScenarios,
  captureScenario,
  createBenchmarkRuntime,
  explainScenario,
  stripSql,
} from './benchmark-runtime.mjs';

const rounds = Number(process.env.DIRECTORY_PLAN_ROUNDS ?? 20);
const outputPath = fileURLToPath(
  new URL('../../runtime/audit/directory-query-readiness/plan-audit.json', import.meta.url),
);

if (!Number.isInteger(rounds) || rounds < 20 || rounds > 100) {
  throw new Error('DIRECTORY_PLAN_ROUNDS must be an integer from 20 to 100.');
}

export async function runPlanAudit() {
  const plans = ['legacy', 'candidate'];
  const runtimes = new Map();
  const capturesByPlan = new Map(plans.map((plan) => [plan, []]));
  try {
    for (const plan of plans) {
      const runtime = await createBenchmarkRuntime(plan);
      runtimes.set(plan, runtime);
      for (const scenario of baseScenarios) await captureScenario(runtime, scenario);
    }
    for (let round = 0; round < rounds; round += 1) {
      for (const [scenarioIndex, scenario] of interleave(baseScenarios, round).entries()) {
        const planOrder = (round + scenarioIndex) % 2 === 0 ? plans : [...plans].reverse();
        for (const plan of planOrder) {
          const runtime = runtimes.get(plan);
          if (runtime === undefined) throw new Error(`Missing ${plan} benchmark runtime.`);
          capturesByPlan.get(plan)?.push({
            round: round + 1,
            ...stripSql(await captureScenario(runtime, scenario)),
          });
        }
      }
    }
    const variants = [];
    for (const plan of plans) {
      const runtime = runtimes.get(plan);
      if (runtime === undefined) throw new Error(`Missing ${plan} benchmark runtime.`);
      const explanations = [];
      for (const scenario of baseScenarios.filter((item) => !item.expectedPermissionDenied)) {
        explanations.push({
          scenarioId: scenario.id,
          ...(await explainScenario(runtime, scenario)),
        });
      }
      variants.push({
        explanations,
        plan,
        summary: summarizeCaptures(capturesByPlan.get(plan) ?? []),
      });
      process.stdout.write(`[directory-readiness] paired plan audit ${plan} complete\n`);
    }
    const report = {
      completedAt: new Date().toISOString(),
      pairedPlanOrder: true,
      rounds,
      schema: 2,
      variants,
    };
    await mkdir(
      fileURLToPath(new URL('../../runtime/audit/directory-query-readiness/', import.meta.url)),
      {
        recursive: true,
      },
    );
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return { outputPath, report };
  } finally {
    await Promise.all([...runtimes.values()].map((runtime) => runtime.close()));
  }
}

function summarizeCaptures(captures) {
  return Object.fromEntries(
    [...Map.groupBy(captures, (capture) => capture.scenarioId).entries()].map(
      ([scenarioId, values]) => [
        scenarioId,
        {
          countExaminedRows: distribution(values.map((value) => value.count?.examinedRows ?? 0)),
          countMs: distribution(values.map((value) => value.timing.countMs)),
          errors: values.filter((value) => value.outcome !== 'success').length,
          mainExaminedRows: distribution(values.map((value) => value.main?.examinedRows ?? 0)),
          mainMs: distribution(values.map((value) => value.timing.rowsMs)),
          physicalReads: distribution(values.map((value) => value.bufferIo.physicalReads)),
          queryPlans: [...new Set(values.map((value) => value.timing.directoryQueryPlan))],
          resultCounts: [...new Set(values.map((value) => value.page?.resultCount ?? 0))],
          totalCounts: [...new Set(values.map((value) => value.page?.totalCount ?? 0))],
          totalMs: distribution(values.map((value) => value.timing.totalMs)),
        },
      ],
    ),
  );
}

function interleave(scenarios, seed) {
  const offset = seed % scenarios.length;
  const rotated = [...scenarios.slice(offset), ...scenarios.slice(0, offset)];
  return seed % 2 === 0 ? rotated : rotated.reverse();
}

function distribution(values) {
  const sorted = [...values].sort((first, second) => first - second);
  return {
    max: round(sorted.at(-1) ?? 0),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
  };
}

function percentile(sorted, quantile) {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPlanAudit()
    .then(({ outputPath: path }) => process.stdout.write(`[directory-readiness] output=${path}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : 'Plan audit failed.'}\n`);
      process.exitCode = 1;
    });
}
