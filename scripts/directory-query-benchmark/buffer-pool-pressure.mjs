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

const mib = 1024 * 1024;
const outputPath = resolve('runtime/audit/directory-query-isolation/buffer-pool-pressure.json');
const pressureStatements = Object.freeze([
  'SELECT COUNT(*) FROM directory_search_aliases FORCE INDEX (PRIMARY)',
  'SELECT COUNT(*) FROM directory_search_aliases FORCE INDEX (directory_search_aliases_entry_hash_unique)',
  'SELECT COUNT(*) FROM directory_search_aliases FORCE INDEX (directory_search_aliases_entry_type_idx)',
  'SELECT COUNT(*) FROM directory_search_aliases FORCE INDEX (directory_search_aliases_normalized_idx)',
  'SELECT SUM(LENGTH(search_text) + LENGTH(notes)) FROM directory_entries FORCE INDEX (PRIMARY)',
  'SELECT COUNT(*) FROM directory_entries FORCE INDEX (directory_entries_batch_key_unique)',
  'SELECT COUNT(*) FROM directory_entries FORCE INDEX (directory_entries_batch_campus_order_idx)',
  'SELECT COUNT(*) FROM directory_entries FORCE INDEX (directory_entries_batch_department_idx)',
  'SELECT COUNT(*) FROM directory_entries FORCE INDEX (directory_entries_batch_kind_idx)',
  'SELECT SUM(LENGTH(full_number) + LENGTH(internal_extension)) FROM directory_contact_methods FORCE INDEX (PRIMARY)',
  'SELECT COUNT(*) FROM directory_contact_methods FORCE INDEX (directory_contact_methods_entry_hash_unique)',
  'SELECT COUNT(*) FROM directory_contact_methods FORCE INDEX (directory_contact_methods_full_number_idx)',
  'SELECT COUNT(*) FROM directory_contact_methods FORCE INDEX (directory_contact_methods_extension_idx)',
]);

export async function runBufferPoolPressure() {
  const scenario = baseScenarios.find((candidate) => candidate.id === 'initials-member');
  if (scenario === undefined) throw new Error('Initials scenario is missing.');
  const runs = [];
  for (const sizeMiB of [128, 512]) {
    for (let round = 0; round < 5; round += 1) {
      await resetBenchmarkDatabaseCold();
      const runtime = await createBenchmarkRuntime('legacy');
      try {
        await assertCandidateIndexAbsent(runtime.rootConnection);
        await resizeBufferPool(runtime.rootConnection, sizeMiB * mib);
        const orderedPressure = rotate(pressureStatements, round * 3);
        const pressureStartedAt = performance.now();
        for (const statement of orderedPressure) await runtime.rootConnection.query(statement);
        const pressureMs = roundMilliseconds(performance.now() - pressureStartedAt);
        const capture = stripSql(await captureScenario(runtime, scenario));
        runs.push({ bufferPoolMiB: sizeMiB, pressureMs, round: round + 1, ...capture });
      } finally {
        await runtime.close();
      }
      process.stdout.write(`[buffer] size=${sizeMiB}MiB round=${round + 1}/5\n`);
    }
  }

  await resetBenchmarkDatabaseCold();
  const report = {
    completedAt: new Date().toISOString(),
    definition: {
      coldResetBeforeEachRound: true,
      pressure: 'all benchmark directory primary and secondary indexes, rotated per round',
      scope: 'dedicated-local-benchmark-database-only',
      testMeaning: 'post-pressure cache residency; not a fully cold first-query benchmark',
    },
    runs,
    summary: Object.fromEntries(
      [128, 512].map((sizeMiB) => {
        const group = runs.filter((run) => run.bufferPoolMiB === sizeMiB);
        return [
          String(sizeMiB),
          {
            mainMs: distribution(group.map((run) => run.timing.rowsMs)),
            physicalReads: distribution(group.map((run) => run.bufferIo.physicalReads)),
            pressureMs: distribution(group.map((run) => run.pressureMs)),
            totalMs: distribution(group.map((run) => run.timing.totalMs)),
          },
        ];
      }),
    ),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
  return report;
}

async function assertCandidateIndexAbsent(connection) {
  const [rows] = await connection.query(`
    SELECT COUNT(*) AS count
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'directory_search_aliases'
      AND index_name = 'directory_search_aliases_entry_type_normalized_candidate_idx'
  `);
  if (Number(rows[0]?.count ?? 0) !== 0) {
    throw new Error('Buffer-pool benchmark requires the no-candidate-index schema.');
  }
}

async function resizeBufferPool(connection, bytes) {
  await connection.query(`SET GLOBAL innodb_buffer_pool_size = ${bytes}`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const [rows] = await connection.query('SELECT @@GLOBAL.innodb_buffer_pool_size AS bytes');
    if (Number(rows[0]?.bytes ?? 0) === bytes) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('InnoDB buffer-pool resize did not reach the requested size.');
}

function rotate(values, offset) {
  const normalized = offset % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

function distribution(values) {
  const sorted = [...values].sort((first, second) => first - second);
  return {
    max: roundMilliseconds(sorted.at(-1) ?? 0),
    p50: roundMilliseconds(sorted[Math.floor(sorted.length / 2)] ?? 0),
    p95: roundMilliseconds(sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0),
  };
}

function roundMilliseconds(value) {
  return Math.round(value * 1_000) / 1_000;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBufferPoolPressure()
    .then((report) => process.stdout.write(`${JSON.stringify(report.summary)}\n`))
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.stack : 'Buffer benchmark failed.'}\n`,
      );
      process.exitCode = 1;
    });
}
