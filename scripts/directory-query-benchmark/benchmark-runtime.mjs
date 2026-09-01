import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import { DirectoryQuery } from '../../apps/api/dist/modules/directory/directory-query.js';
import { createTestDatabaseClient } from '../../packages/database/dist/index.js';

import { benchmarkFixture, readBenchmarkDatabaseConfig } from './synthetic-fixture.mjs';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const timerDivisor = 1_000_000_000;

export const baseScenarios = Object.freeze([
  scenario('initials-member', 'member', benchmarkFixture.queries.pinyinInitials),
  scenario('chinese-member', 'member', benchmarkFixture.queries.chineseName),
  scenario('full-pinyin-member', 'member', benchmarkFixture.queries.fullPinyin),
  scenario('partial-pinyin-member', 'member', benchmarkFixture.queries.partialPinyin),
  scenario('employee-code-member', 'member', benchmarkFixture.queries.employeeCodeExact),
  scenario(
    'employee-code-without-prefix-member',
    'member',
    benchmarkFixture.queries.employeeCodeWithoutPrefix,
  ),
  scenario('phone-member', 'member', benchmarkFixture.queries.phoneExact),
  scenario('no-result-member', 'member', benchmarkFixture.queries.noResult),
  scenario('single-character-member', 'member', benchmarkFixture.queries.asciiSingle),
  scenario('seven-filter-member', 'member', {
    ...benchmarkFixture.queries.pinyinInitials,
    ...benchmarkFixture.filters,
  }),
  scenario('single-character-owner', 'owner', benchmarkFixture.queries.asciiSingle),
  scenario('single-character-administrator', 'administrator', benchmarkFixture.queries.asciiSingle),
  scenario('single-character-no-permission', 'guest', benchmarkFixture.queries.asciiSingle, {
    expectedPermissionDenied: true,
  }),
]);

export async function createBenchmarkRuntime(searchStrategy = 'legacy') {
  const config = readBenchmarkDatabaseConfig();
  const databaseClient = createTestDatabaseClient(config);
  const rootConnection = await mysql.createConnection({
    database: config.database,
    host: config.host,
    password: 'local-benchmark-root',
    port: config.port,
    user: 'root',
  });
  await configurePerformanceSchema(rootConnection);
  return {
    close: async () => {
      await databaseClient.close();
      await rootConnection.end();
    },
    directoryQuery: new DirectoryQuery(databaseClient, { searchStrategy }),
    rootConnection,
  };
}

export async function captureScenario(runtime, inputScenario) {
  await resetPerformanceSchema(runtime.rootConnection);
  const before = await readGlobalIo(runtime.rootConnection);
  const trace = {
    coldStart: false,
    instanceAgeMs: 120_000,
    requestStartedAt: performance.now(),
  };
  const startedAt = performance.now();
  let page;
  let errorCode;
  try {
    page = await runtime.directoryQuery.list(
      benchmarkFixture.identities[inputScenario.role],
      benchmarkFixture.groupId,
      inputScenario.query,
      'employee',
      trace,
    );
  } catch (error) {
    errorCode = readApiErrorCode(error);
    if (!inputScenario.expectedPermissionDenied) throw error;
  }
  const totalMs = roundMilliseconds(performance.now() - startedAt);
  const after = await readGlobalIo(runtime.rootConnection);
  const [digests, indexIo, fileIo] = await Promise.all([
    readStatementDigests(runtime.rootConnection),
    readIndexIo(runtime.rootConnection),
    readFileIo(runtime.rootConnection),
  ]);
  const main = digests.find(isMainDirectoryDigest);
  const count = digests.find(isCountDirectoryDigest);
  if (inputScenario.expectedPermissionDenied) {
    if (
      page !== undefined ||
      errorCode !== 'FORBIDDEN' ||
      main !== undefined ||
      count !== undefined
    ) {
      throw new Error('No-permission scenario crossed the directory query boundary.');
    }
  } else if (page === undefined || main === undefined || count === undefined) {
    throw new Error(`Scenario ${inputScenario.id} did not produce main and count statements.`);
  }
  return Object.freeze({
    bufferIo: diffIo(before, after),
    count: count === undefined ? undefined : summarizeDigest(count),
    errorCode,
    fileIo,
    indexIo,
    main: main === undefined ? undefined : summarizeDigest(main),
    outcome: page === undefined ? 'denied' : 'success',
    page:
      page === undefined
        ? undefined
        : Object.freeze({
            entryIds: page.entries.map((entry) => entry.id),
            hasNext: page.nextCursor !== undefined,
            nextCursor: page.nextCursor,
            resultCount: page.entries.length,
            totalCount: page.totalCount,
          }),
    scenarioId: inputScenario.id,
    timing: Object.freeze({
      aliasMs: trace.aliasMs ?? 0,
      batchMs: trace.batchMs ?? 0,
      contactsMs: trace.contactsMs ?? 0,
      countMs: trace.countMs ?? 0,
      databaseWaitMs: trace.databaseWaitMs ?? 0,
      permissionMs: trace.permissionMs ?? 0,
      queryMs: trace.queryMs ?? 0,
      rowsMs: trace.rowsMs ?? 0,
      totalMs,
      transformMs: trace.transformMs ?? 0,
    }),
  });
}

export async function explainScenario(runtime, inputScenario) {
  const capture = await captureScenario(runtime, inputScenario);
  if (capture.main === undefined || capture.count === undefined) {
    return Object.freeze({ capture, countPlan: undefined, mainPlan: undefined });
  }
  const mainPlan = await explainAnalyze(runtime.rootConnection, capture.main.sampleSql);
  const countPlan = await explainAnalyze(runtime.rootConnection, capture.count.sampleSql);
  return Object.freeze({
    capture: stripSql(capture),
    countPlan: sanitizePlan(countPlan),
    mainPlan: sanitizePlan(mainPlan),
  });
}

export function stripSql(capture) {
  return {
    ...capture,
    count: capture.count === undefined ? undefined : { ...capture.count, sampleSql: undefined },
    main: capture.main === undefined ? undefined : { ...capture.main, sampleSql: undefined },
    page:
      capture.page === undefined
        ? undefined
        : {
            entryOrderFingerprint: fingerprint(capture.page.entryIds.join('|')),
            hasNext: capture.page.hasNext,
            resultCount: capture.page.resultCount,
            totalCount: capture.page.totalCount,
          },
  };
}

function scenario(id, role, query, options = {}) {
  return Object.freeze({ id, query: Object.freeze({ ...query }), role, ...options });
}

async function configurePerformanceSchema(connection) {
  await connection.query(`
    UPDATE performance_schema.setup_consumers
    SET ENABLED = 'YES'
    WHERE NAME IN (
      'events_statements_history',
      'events_statements_history_long',
      'events_waits_history',
      'events_waits_history_long',
      'statements_digest'
    )
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
  await connection.query('TRUNCATE TABLE performance_schema.table_io_waits_summary_by_index_usage');
  await connection.query('TRUNCATE TABLE performance_schema.file_summary_by_instance');
}

async function readGlobalIo(connection) {
  const [rows] = await connection.query(`
    SHOW GLOBAL STATUS WHERE Variable_name IN (
      'Innodb_buffer_pool_read_requests',
      'Innodb_buffer_pool_reads',
      'Innodb_buffer_pool_wait_free',
      'Innodb_data_read',
      'Innodb_data_reads'
    )
  `);
  return Object.fromEntries(rows.map((row) => [row.Variable_name, Number(row.Value)]));
}

async function readStatementDigests(connection) {
  const [rows] = await connection.query(`
    SELECT DIGEST, DIGEST_TEXT, COUNT_STAR,
           SUM_TIMER_WAIT, MAX_TIMER_WAIT, SUM_LOCK_TIME,
           SUM_ROWS_EXAMINED, SUM_ROWS_SENT,
           SUM_CREATED_TMP_TABLES, SUM_CREATED_TMP_DISK_TABLES,
           SUM_SORT_ROWS, SUM_SORT_SCAN, SUM_SORT_MERGE_PASSES,
           SUM_NO_INDEX_USED, SUM_NO_GOOD_INDEX_USED,
           QUERY_SAMPLE_TEXT
    FROM performance_schema.events_statements_summary_by_digest
    WHERE SCHEMA_NAME = DATABASE()
    ORDER BY SUM_TIMER_WAIT DESC
  `);
  return rows;
}

async function readIndexIo(connection) {
  const [rows] = await connection.query(`
    SELECT OBJECT_NAME, COALESCE(INDEX_NAME, 'NONE') AS INDEX_NAME,
           COUNT_READ, COUNT_FETCH, SUM_TIMER_READ
    FROM performance_schema.table_io_waits_summary_by_index_usage
    WHERE OBJECT_SCHEMA = DATABASE()
      AND OBJECT_NAME IN (
        'directory_entries',
        'directory_search_aliases',
        'directory_contact_methods',
        'directory_campuses'
      )
      AND COUNT_READ > 0
    ORDER BY OBJECT_NAME, INDEX_NAME
  `);
  return rows.map((row) => ({
    fetches: Number(row.COUNT_FETCH),
    index: row.INDEX_NAME,
    reads: Number(row.COUNT_READ),
    table: row.OBJECT_NAME,
    waitMs: timerToMilliseconds(row.SUM_TIMER_READ),
  }));
}

async function readFileIo(connection) {
  const [rows] = await connection.query(`
    SELECT EVENT_NAME, COUNT_READ, SUM_NUMBER_OF_BYTES_READ, SUM_TIMER_READ
    FROM performance_schema.file_summary_by_event_name
    WHERE EVENT_NAME LIKE 'wait/io/file/innodb/%'
      AND COUNT_READ > 0
    ORDER BY EVENT_NAME
  `);
  return rows.map((row) => ({
    bytesRead: Number(row.SUM_NUMBER_OF_BYTES_READ),
    event: row.EVENT_NAME,
    reads: Number(row.COUNT_READ),
    waitMs: timerToMilliseconds(row.SUM_TIMER_READ),
  }));
}

function isMainDirectoryDigest(row) {
  const text = String(row.DIGEST_TEXT ?? '');
  return text.startsWith('SELECT `directory_entries` . `building_name`');
}

function isCountDirectoryDigest(row) {
  const text = String(row.DIGEST_TEXT ?? '');
  return (
    (text.startsWith('SELECT COUNT ( * ) FROM `directory_entries`') && text.includes('CASE')) ||
    (text.startsWith('SELECT COUNT ( * ) AS `count` FROM ( SELECT `directory_candidate_rows`') &&
      text.includes('`search_rank`'))
  );
}

function summarizeDigest(row) {
  const sampleSql = String(row.QUERY_SAMPLE_TEXT ?? '');
  if (sampleSql.length === 0 || sampleSql.length >= 16_384) {
    throw new Error('Performance Schema did not retain a complete sample SQL statement.');
  }
  return Object.freeze({
    count: Number(row.COUNT_STAR),
    digest: row.DIGEST,
    examinedRows: Number(row.SUM_ROWS_EXAMINED),
    lockMs: timerToMilliseconds(row.SUM_LOCK_TIME),
    maxMs: timerToMilliseconds(row.MAX_TIMER_WAIT),
    noGoodIndexUsed: Number(row.SUM_NO_GOOD_INDEX_USED),
    noIndexUsed: Number(row.SUM_NO_INDEX_USED),
    sampleSql,
    sentRows: Number(row.SUM_ROWS_SENT),
    sortMergePasses: Number(row.SUM_SORT_MERGE_PASSES),
    sortRows: Number(row.SUM_SORT_ROWS),
    sortScans: Number(row.SUM_SORT_SCAN),
    temporaryDiskTables: Number(row.SUM_CREATED_TMP_DISK_TABLES),
    temporaryTables: Number(row.SUM_CREATED_TMP_TABLES),
    totalMs: timerToMilliseconds(row.SUM_TIMER_WAIT),
  });
}

async function explainAnalyze(connection, sqlText) {
  const [rows] = await connection.query(`EXPLAIN ANALYZE ${sqlText}`);
  return String(rows[0]?.EXPLAIN ?? '');
}

function sanitizePlan(plan) {
  const sanitized = plan
    .replaceAll(/'[\s\S]*?'/gu, '?')
    .replaceAll(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/giu, '?');
  return Object.freeze({
    nodes: sanitized
      .split('\n')
      .map((line) => {
        const metrics = /actual time=([0-9.]+)\.\.([0-9.]+) rows=([0-9]+) loops=([0-9]+)/u.exec(
          line,
        );
        return metrics === null
          ? undefined
          : {
              firstRowMs: Number(metrics[1]),
              loops: Number(metrics[4]),
              node: line
                .replace(/\(cost=[\s\S]*$/u, '')
                .replace(/^\s*(?:->\s*)?/u, '')
                .trim(),
              rows: Number(metrics[3]),
              totalMs: Number(metrics[2]),
            };
      })
      .filter(Boolean),
    text: sanitized,
  });
}

function diffIo(before, after) {
  return Object.freeze({
    dataReadBytes: (after.Innodb_data_read ?? 0) - (before.Innodb_data_read ?? 0),
    dataReads: (after.Innodb_data_reads ?? 0) - (before.Innodb_data_reads ?? 0),
    logicalReads:
      (after.Innodb_buffer_pool_read_requests ?? 0) -
      (before.Innodb_buffer_pool_read_requests ?? 0),
    physicalReads: (after.Innodb_buffer_pool_reads ?? 0) - (before.Innodb_buffer_pool_reads ?? 0),
    waitFree:
      (after.Innodb_buffer_pool_wait_free ?? 0) - (before.Innodb_buffer_pool_wait_free ?? 0),
  });
}

function readApiErrorCode(error) {
  if (error !== null && typeof error === 'object' && 'code' in error) return String(error.code);
  return undefined;
}

function timerToMilliseconds(value) {
  return Math.round((Number(value) / timerDivisor) * 1_000) / 1_000;
}

function roundMilliseconds(value) {
  return Math.round(value * 1_000) / 1_000;
}

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex');
}
