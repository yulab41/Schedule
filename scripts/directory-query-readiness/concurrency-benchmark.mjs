import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { fileURLToPath } from 'node:url';

import { DirectoryQuery } from '../../apps/api/dist/modules/directory/directory-query.js';
import { createDatabaseClient } from '../../packages/database/dist/index.js';

import { baseScenarios } from './benchmark-runtime.mjs';
import { benchmarkFixture, readBenchmarkDatabaseConfig } from './synthetic-fixture.mjs';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const mysql = require('mysql2/promise');
const outputDirectory = fileURLToPath(
  new URL('../../runtime/audit/directory-query-readiness/', import.meta.url),
);
const containerName = 'schedule-directory-query-readiness-mysql-1';
const concurrencyLevels = [1, 5, 10, 20];
const measuredRequests = Number(process.env.DIRECTORY_CONCURRENCY_REQUESTS ?? 120);

if (!Number.isInteger(measuredRequests) || measuredRequests < 60 || measuredRequests > 1_000) {
  throw new Error('DIRECTORY_CONCURRENCY_REQUESTS must be an integer from 60 to 1000.');
}

export async function runConcurrencyBenchmark() {
  const config = readBenchmarkDatabaseConfig();
  const rootConnection = await mysql.createConnection({
    database: config.database,
    host: config.host,
    password: 'local-readiness-root',
    port: config.port,
    user: 'root',
  });
  try {
    await configurePerformanceSchema(rootConnection);
    const runs = [];
    for (const plan of ['legacy', 'candidate']) {
      for (const concurrency of concurrencyLevels) {
        const result = await runLoad(rootConnection, config, plan, concurrency);
        runs.push(result);
        process.stdout.write(
          `[directory-readiness] plan=${plan} concurrency=${concurrency} p95=${result.totalMs.p95}ms throughput=${result.throughputPerSecond}/s\n`,
        );
      }
    }
    const report = {
      completedAt: new Date().toISOString(),
      concurrencyLevels,
      measuredRequests,
      mysqlVersion: await readMysqlVersion(rootConnection),
      runs,
      schema: 1,
    };
    await mkdir(outputDirectory, { recursive: true });
    const outputPath = fileURLToPath(
      new URL('../../runtime/audit/directory-query-readiness/concurrency.json', import.meta.url),
    );
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return { outputPath, report };
  } finally {
    await rootConnection.end();
  }
}

async function runLoad(rootConnection, config, plan, concurrency) {
  const databaseClient = createDatabaseClient({ ...config, connectionLimit: concurrency + 2 });
  const query = new DirectoryQuery(databaseClient, { configuredPlan: plan });
  try {
    const scenarios = await createMixedScenarios(query);
    for (const scenario of scenarios) await runOne(query, scenario);
    await resetPerformanceSchema(rootConnection);
    const beforeIo = await readGlobalIo(rootConnection);
    const beforeMysqlCpu = readContainerCpuUsec();
    const beforeApiCpu = process.cpuUsage();
    const beforeLoad = readLoadAverage();
    const startedAt = performance.now();
    const results = new Array(measuredRequests);
    let nextIndex = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= measuredRequests) return;
          results[index] = await runOne(query, scenarios[index % scenarios.length]);
        }
      }),
    );
    const wallMs = performance.now() - startedAt;
    const afterApiCpu = process.cpuUsage(beforeApiCpu);
    const afterMysqlCpu = readContainerCpuUsec();
    const afterIo = await readGlobalIo(rootConnection);
    const digests = await readDirectoryDigests(rootConnection);
    const successful = results.filter((result) => result.error === undefined);
    return {
      apiCpuMs: round((afterApiCpu.system + afterApiCpu.user) / 1_000),
      concurrency,
      connectionWaitMs: distribution(successful.map((result) => result.databaseWaitMs)),
      countMs: distribution(successful.map((result) => result.countMs)),
      errors: results.length - successful.length,
      loadAverage: { after: readLoadAverage(), before: beforeLoad },
      mainMs: distribution(successful.map((result) => result.rowsMs)),
      mysqlCpuMs: round((afterMysqlCpu - beforeMysqlCpu) / 1_000),
      mysqlIo: diffIo(beforeIo, afterIo),
      plan,
      queryPlanCounts: Object.fromEntries(
        [...Map.groupBy(successful, (result) => result.directoryQueryPlan).entries()].map(
          ([key, values]) => [key, values.length],
        ),
      ),
      requestCount: results.length,
      scenarioCounts: Object.fromEntries(
        [...Map.groupBy(results, (result) => result.scenarioId).entries()].map(([key, values]) => [
          key,
          values.length,
        ]),
      ),
      sql: summarizeDigests(digests),
      throughputPerSecond: round((results.length * 1_000) / wallMs),
      timeouts: results.filter((result) => result.error === 'timeout').length,
      totalMs: distribution(successful.map((result) => result.totalMs)),
      wallMs: round(wallMs),
    };
  } finally {
    await databaseClient.close();
  }
}

async function createMixedScenarios(query) {
  const firstQuery = { ...benchmarkFixture.queries.asciiSingle, pageSize: 30 };
  const firstPage = await query.list(
    benchmarkFixture.identities.member,
    benchmarkFixture.groupId,
    firstQuery,
    'employee',
  );
  if (firstPage.nextCursor === undefined) throw new Error('Concurrency fixture needs page two.');
  return [
    ...baseScenarios.filter((scenario) => !scenario.expectedPermissionDenied),
    { id: 'pagination-first-member', query: firstQuery, role: 'member' },
    {
      id: 'pagination-next-member',
      query: { ...firstQuery, cursor: firstPage.nextCursor },
      role: 'member',
    },
  ];
}

async function runOne(query, scenario) {
  const trace = {
    coldStart: false,
    instanceAgeMs: 120_000,
    requestStartedAt: performance.now(),
  };
  const startedAt = performance.now();
  try {
    await query.list(
      benchmarkFixture.identities[scenario.role],
      benchmarkFixture.groupId,
      scenario.query,
      'employee',
      trace,
    );
    return {
      countMs: trace.countMs ?? 0,
      databaseWaitMs: trace.databaseWaitMs ?? 0,
      directoryQueryPlan: trace.directoryQueryPlan ?? 'unsupported',
      rowsMs: trace.rowsMs ?? 0,
      scenarioId: scenario.id,
      totalMs: round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      countMs: 0,
      databaseWaitMs: trace.databaseWaitMs ?? 0,
      directoryQueryPlan: trace.directoryQueryPlan ?? 'unsupported',
      error: readErrorKind(error),
      rowsMs: 0,
      scenarioId: scenario.id,
      totalMs: round(performance.now() - startedAt),
    };
  }
}

async function configurePerformanceSchema(connection) {
  await connection.query(`
    UPDATE performance_schema.setup_consumers
    SET ENABLED = 'YES'
    WHERE NAME IN ('events_statements_history_long', 'statements_digest')
  `);
  await connection.query(`
    UPDATE performance_schema.setup_instruments
    SET ENABLED = 'YES', TIMED = 'YES'
    WHERE NAME LIKE 'wait/io/file/innodb/%'
       OR NAME LIKE 'wait/io/table/sql/%'
  `);
}

async function resetPerformanceSchema(connection) {
  await connection.query('TRUNCATE TABLE performance_schema.events_statements_summary_by_digest');
}

async function readDirectoryDigests(connection) {
  const [rows] = await connection.query(`
    SELECT DIGEST_TEXT, COUNT_STAR, SUM_TIMER_WAIT, MAX_TIMER_WAIT, SUM_LOCK_TIME,
           SUM_ROWS_EXAMINED, SUM_ROWS_SENT, SUM_CREATED_TMP_TABLES,
           SUM_CREATED_TMP_DISK_TABLES, SUM_SORT_ROWS, SUM_SORT_MERGE_PASSES,
           SUM_ERRORS, SUM_NO_INDEX_USED, SUM_NO_GOOD_INDEX_USED
    FROM performance_schema.events_statements_summary_by_digest
    WHERE SCHEMA_NAME = DATABASE()
      AND DIGEST_TEXT LIKE 'SELECT%'
  `);
  return rows.filter((row) => {
    const text = String(row.DIGEST_TEXT ?? '');
    return text.includes('directory_entries') || text.includes('directory_candidate_rows');
  });
}

function summarizeDigests(rows) {
  const main = rows.filter((row) => isMainDigest(String(row.DIGEST_TEXT ?? '')));
  const count = rows.filter((row) => isCountDigest(String(row.DIGEST_TEXT ?? '')));
  return { count: sumDigests(count), main: sumDigests(main) };
}

function sumDigests(rows) {
  return {
    errors: sum(rows, 'SUM_ERRORS'),
    examinedRows: sum(rows, 'SUM_ROWS_EXAMINED'),
    lockMs: round(sum(rows, 'SUM_LOCK_TIME') / 1_000_000_000),
    maxMs: round(Math.max(0, ...rows.map((row) => Number(row.MAX_TIMER_WAIT))) / 1_000_000_000),
    noGoodIndexUsed: sum(rows, 'SUM_NO_GOOD_INDEX_USED'),
    noIndexUsed: sum(rows, 'SUM_NO_INDEX_USED'),
    sentRows: sum(rows, 'SUM_ROWS_SENT'),
    sortMergePasses: sum(rows, 'SUM_SORT_MERGE_PASSES'),
    sortRows: sum(rows, 'SUM_SORT_ROWS'),
    temporaryDiskTables: sum(rows, 'SUM_CREATED_TMP_DISK_TABLES'),
    temporaryTables: sum(rows, 'SUM_CREATED_TMP_TABLES'),
    totalMs: round(sum(rows, 'SUM_TIMER_WAIT') / 1_000_000_000),
  };
}

function isMainDigest(text) {
  return (
    text.startsWith('SELECT `directory_entries` . `building_name`') ||
    text.startsWith('SELECT `directory_entries` . `building_name` AS `building`')
  );
}

function isCountDigest(text) {
  return text.startsWith('SELECT COUNT ( * )') && text.includes('directory_entries');
}

async function readGlobalIo(connection) {
  const [rows] = await connection.query(`
    SHOW GLOBAL STATUS WHERE Variable_name IN (
      'Innodb_buffer_pool_read_requests', 'Innodb_buffer_pool_reads',
      'Innodb_buffer_pool_wait_free', 'Innodb_data_read', 'Innodb_data_reads'
    )
  `);
  return Object.fromEntries(rows.map((row) => [row.Variable_name, Number(row.Value)]));
}

function diffIo(before, after) {
  return {
    dataReadBytes: after.Innodb_data_read - before.Innodb_data_read,
    dataReads: after.Innodb_data_reads - before.Innodb_data_reads,
    logicalReads: after.Innodb_buffer_pool_read_requests - before.Innodb_buffer_pool_read_requests,
    physicalReads: after.Innodb_buffer_pool_reads - before.Innodb_buffer_pool_reads,
    waitFree: after.Innodb_buffer_pool_wait_free - before.Innodb_buffer_pool_wait_free,
  };
}

function readContainerCpuUsec() {
  const value = execFileSync(
    'docker',
    ['exec', containerName, 'sh', '-c', "awk '/usage_usec/ {print $2}' /sys/fs/cgroup/cpu.stat"],
    { encoding: 'utf8' },
  ).trim();
  return Number(value);
}

function readLoadAverage() {
  return loadavg().map(round);
}

async function readMysqlVersion(connection) {
  const [rows] = await connection.query('SELECT VERSION() AS version');
  return String(rows[0]?.version ?? 'unknown');
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

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function readErrorKind(error) {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    return String(error.code).toLowerCase().includes('timeout') ? 'timeout' : String(error.code);
  }
  return error instanceof Error && error.message.toLowerCase().includes('timeout')
    ? 'timeout'
    : 'error';
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runConcurrencyBenchmark()
    .then(({ outputPath }) => process.stdout.write(`[directory-readiness] output=${outputPath}\n`))
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.stack : 'Concurrency benchmark failed.'}\n`,
      );
      process.exitCode = 1;
    });
}
