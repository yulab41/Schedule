import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseScenarios, captureScenario, createBenchmarkRuntime } from './benchmark-runtime.mjs';

const defaultOutput = resolve(
  'runtime/audit/directory-query-isolation/candidate-semantic-equivalence.json',
);

export async function verifySemanticEquivalence(outputPath = defaultOutput) {
  const legacyRuntime = await createBenchmarkRuntime('legacy');
  const candidateRuntime = await createBenchmarkRuntime('candidate');
  const checks = [];
  try {
    for (const inputScenario of baseScenarios) {
      checks.push(
        await comparePage(
          legacyRuntime,
          candidateRuntime,
          inputScenario,
          `${inputScenario.id}:first`,
        ),
      );
    }

    for (const scenarioId of [
      'single-character-member',
      'single-character-owner',
      'single-character-administrator',
    ]) {
      const base = baseScenarios.find((scenario) => scenario.id === scenarioId);
      if (base === undefined) throw new Error(`Missing pagination scenario ${scenarioId}.`);
      checks.push(...(await compareAllPages(legacyRuntime, candidateRuntime, base)));
    }
  } finally {
    await candidateRuntime.close();
    await legacyRuntime.close();
  }

  const result = Object.freeze({
    checks: checks.map((check) =>
      Object.fromEntries(Object.entries(check).filter(([key]) => key !== 'detail')),
    ),
    differenceCount: 0,
    pageChecks: checks.length,
    scenarios: [...new Set(checks.map((check) => check.scenarioId))].length,
    status: 'passed',
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, undefined, 2)}\n`, 'utf8');
  return result;
}

async function compareAllPages(legacyRuntime, candidateRuntime, baseScenario) {
  const checks = [];
  let cursor;
  let page = 1;
  let expectedTotal;
  const accumulated = [];
  do {
    const query = {
      ...baseScenario.query,
      pageSize: 100,
      ...(cursor === undefined ? {} : { cursor }),
    };
    const scenario = { ...baseScenario, id: `${baseScenario.id}-page-${page}`, query };
    const check = await comparePage(
      legacyRuntime,
      candidateRuntime,
      scenario,
      `${baseScenario.id}:page:${page}`,
    );
    checks.push(check);
    if (check.detail.page === undefined) throw new Error('Paginated scenario returned no page.');
    expectedTotal ??= check.detail.page.totalCount;
    accumulated.push(...check.detail.page.entryIds);
    cursor = check.detail.page.nextCursor;
    page += 1;
    if (page > 100) throw new Error(`Pagination did not terminate for ${baseScenario.id}.`);
  } while (cursor !== undefined);

  if (new Set(accumulated).size !== accumulated.length || accumulated.length !== expectedTotal) {
    throw new Error(`Full pagination integrity failed for ${baseScenario.id}.`);
  }
  return checks;
}

async function comparePage(legacyRuntime, candidateRuntime, inputScenario, label) {
  const legacy = await captureScenario(legacyRuntime, inputScenario);
  const candidate = await captureScenario(candidateRuntime, inputScenario);
  assertEqual(candidate.outcome, legacy.outcome, label, 'outcome');
  assertEqual(candidate.errorCode, legacy.errorCode, label, 'error code');

  if (legacy.page === undefined || candidate.page === undefined) {
    if (legacy.page !== candidate.page) throw new Error(`${label}: permission outcome differs.`);
    return {
      detail: { page: undefined },
      outcome: legacy.outcome,
      scenarioId: baseScenarioId(inputScenario.id),
      status: 'passed',
    };
  }

  assertJsonEqual(candidate.page.entryIds, legacy.page.entryIds, label, 'entry order');
  assertEqual(candidate.page.totalCount, legacy.page.totalCount, label, 'exact count');
  assertEqual(candidate.page.hasNext, legacy.page.hasNext, label, 'hasNext');
  assertEqual(candidate.page.nextCursor, legacy.page.nextCursor, label, 'next cursor');

  const [legacyRows, candidateRows] = await Promise.all([
    executeCapturedMain(legacyRuntime, legacy),
    executeCapturedMain(candidateRuntime, candidate),
  ]);
  assertJsonEqual(
    candidateRows.map((row) => row.id),
    legacyRows.map((row) => row.id),
    label,
    'raw entry order',
  );
  assertJsonEqual(candidateRows.map(readRank), legacyRows.map(readRank), label, 'rank');

  return {
    detail: { page: legacy.page },
    hasNext: legacy.page.hasNext,
    resultCount: legacy.page.resultCount,
    scenarioId: baseScenarioId(inputScenario.id),
    status: 'passed',
    totalCount: legacy.page.totalCount,
  };
}

async function executeCapturedMain(runtime, capture) {
  if (capture.main?.sampleSql === undefined) throw new Error('Captured main SQL is unavailable.');
  const [rows] = await runtime.rootConnection.query(capture.main.sampleSql);
  return rows;
}

function readRank(row) {
  const expressionKey = Object.keys(row).find((key) => key.startsWith('CASE\n'));
  const value =
    row.rank ?? row.searchRank ?? (expressionKey === undefined ? undefined : row[expressionKey]);
  const rank = Number(value);
  if (!Number.isFinite(rank)) throw new Error('Captured row has no finite rank.');
  return rank;
}

function baseScenarioId(value) {
  return value.replace(/-page-\d+$/u, '');
}

function assertEqual(actual, expected, label, field) {
  if (actual !== expected) throw new Error(`${label}: ${field} differs.`);
}

function assertJsonEqual(actual, expected, label, field) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: ${field} differs.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifySemanticEquivalence(
    process.argv[2] === undefined ? defaultOutput : resolve(process.argv[2]),
  )
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Semantic gate failed.'}\n`);
      process.exitCode = 1;
    });
}
