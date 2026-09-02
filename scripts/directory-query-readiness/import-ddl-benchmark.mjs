import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { DirectoryQuery } from '../../apps/api/dist/modules/directory/directory-query.js';
import { createDatabaseClient } from '../../packages/database/dist/index.js';

import { benchmarkFixture, readBenchmarkDatabaseConfig } from './synthetic-fixture.mjs';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const mysql = require('mysql2/promise');
const rounds = Number(process.env.DIRECTORY_IMPORT_ROUNDS ?? 3);
const containerName = 'schedule-directory-query-readiness-mysql-1';
const indexName = 'directory_search_aliases_entry_type_normalized_idx';
const outputPath = fileURLToPath(
  new URL('../../runtime/audit/directory-query-readiness/import-ddl.json', import.meta.url),
);

if (!Number.isInteger(rounds) || rounds < 3 || rounds > 10) {
  throw new Error('DIRECTORY_IMPORT_ROUNDS must be an integer from 3 to 10.');
}

export async function runImportAndDdlBenchmark() {
  const config = readBenchmarkDatabaseConfig();
  const root = await mysql.createConnection({
    database: config.database,
    host: config.host,
    password: 'local-readiness-root',
    port: config.port,
    user: 'root',
  });
  try {
    await root.query("SET GLOBAL innodb_monitor_enable = 'all'");
    await prepareMappingTable(root);
    const importVariants = [];
    for (const indexPresent of [false, true]) {
      await setCoveringIndex(root, indexPresent);
      const runs = [];
      for (let round = 1; round <= rounds; round += 1) {
        runs.push(await runImportRound(root, config, indexPresent, round));
        process.stdout.write(
          `[directory-readiness] import index=${indexPresent} round=${round}/${rounds}\n`,
        );
      }
      importVariants.push({
        indexPresent,
        runs,
        summary: summarizeImportRuns(runs),
      });
    }
    const ddl = await runOnlineDdlProbe(root, config);
    const report = {
      completedAt: new Date().toISOString(),
      comparison: compareVariants(importVariants),
      ddl,
      importVariants,
      mysqlVersion: await readMysqlVersion(root),
      rounds,
      schema: 1,
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
    await root.end();
  }
}

async function runImportRound(root, config, indexPresent, round) {
  const sourceBatchId = await readPublishedEmployeeBatchId(root);
  const writeBefore = await readWriteStats(root);
  await root.query('TRUNCATE TABLE readiness_entry_map');
  const rollbackStartedAt = performance.now();
  await root.beginTransaction();
  let rollbackPhases;
  try {
    rollbackPhases = await clonePublishedBatch(
      root,
      sourceBatchId,
      `rollback-${indexPresent}-${round}`,
    );
    const rollbackCallStartedAt = performance.now();
    await root.rollback();
    rollbackPhases.rollbackMs = roundMs(performance.now() - rollbackCallStartedAt);
  } catch (error) {
    await root.rollback();
    throw error;
  }
  rollbackPhases.failedImportTotalMs = roundMs(performance.now() - rollbackStartedAt);

  await root.query('TRUNCATE TABLE readiness_entry_map');
  const databaseClient = createDatabaseClient({ ...config, connectionLimit: 4 });
  const directoryQuery = new DirectoryQuery(databaseClient, { configuredPlan: 'legacy' });
  const searchControl = { stopped: false };
  const concurrentSearchPromise = runConcurrentSearch(directoryQuery, searchControl);
  const importStartedAt = performance.now();
  await root.beginTransaction();
  let committed;
  try {
    committed = await clonePublishedBatch(root, sourceBatchId, `commit-${indexPresent}-${round}`);
    await root.commit();
  } catch (error) {
    await root.rollback();
    throw error;
  } finally {
    searchControl.stopped = true;
  }
  const concurrentSearch = await concurrentSearchPromise;
  await databaseClient.close();
  committed.fullImportMs = roundMs(performance.now() - importStartedAt);

  const publishStartedAt = performance.now();
  await root.beginTransaction();
  try {
    await root.query(
      "UPDATE directory_import_batches SET status='superseded', superseded_at=CURRENT_TIMESTAMP(3) WHERE id=?",
      [sourceBatchId],
    );
    await root.query(
      "UPDATE directory_import_batches SET status='published', published_at=CURRENT_TIMESTAMP(3) WHERE id=?",
      [committed.batchId],
    );
    await root.commit();
  } catch (error) {
    await root.rollback();
    throw error;
  }
  const publishMs = roundMs(performance.now() - publishStartedAt);

  await root.beginTransaction();
  try {
    await root.query(
      "UPDATE directory_import_batches SET status='superseded', superseded_at=CURRENT_TIMESTAMP(3) WHERE id=?",
      [committed.batchId],
    );
    await root.query(
      "UPDATE directory_import_batches SET status='published', superseded_at=NULL WHERE id=?",
      [sourceBatchId],
    );
    await root.commit();
  } catch (error) {
    await root.rollback();
    throw error;
  }

  const cleanupStartedAt = performance.now();
  await cleanupBatch(root, committed.batchId);
  const cleanupMs = roundMs(performance.now() - cleanupStartedAt);
  const writeAfter = await readWriteStats(root);
  return {
    aliasInsertMs: committed.aliasInsertMs,
    cleanupMs,
    concurrentSearch,
    fullImportMs: committed.fullImportMs,
    indexPresent,
    publishMs,
    rollbackFailedImportMs: rollbackPhases.failedImportTotalMs,
    rollbackOnlyMs: rollbackPhases.rollbackMs,
    round,
    space: await readDirectorySpace(root),
    writeDelta: diffCounters(writeBefore, writeAfter),
  };
}

async function clonePublishedBatch(connection, sourceBatchId, label) {
  const batchId = await readUuid(connection);
  const documentId = await readUuid(connection);
  const [counts] = await connection.query(
    `
    SELECT
      (SELECT COUNT(*) FROM directory_entries WHERE batch_id = ?) AS entries,
      (SELECT COUNT(*) FROM directory_contact_methods AS contacts
       INNER JOIN directory_entries AS entries ON entries.id = contacts.entry_id
       WHERE entries.batch_id = ?) AS contacts,
      (SELECT COUNT(*) FROM directory_search_aliases AS aliases
       INNER JOIN directory_entries AS entries ON entries.id = aliases.entry_id
       WHERE entries.batch_id = ?) AS aliases
  `,
    [sourceBatchId, sourceBatchId, sourceBatchId],
  );
  const count = counts[0];
  await connection.query(
    `
    INSERT INTO directory_import_batches
      (id, import_version, schema_version, directory_kind, status, effective_on, manifest_sha256,
       source_document_count, entry_count, contact_method_count, warning_count,
       diff_summary, warning_summary)
    VALUES (?, ?, 1, 'employee', 'draft', '2026-09-02', SHA2(?, 256), 1, ?, ?, 0, JSON_OBJECT(), JSON_OBJECT())
  `,
    [
      batchId,
      `readiness-${label}-${batchId}`,
      `manifest-${batchId}`,
      count.entries,
      count.contacts,
    ],
  );
  await connection.query(
    `
    INSERT INTO directory_source_documents
      (id, batch_id, campus_id, document_key, title, source_sha256,
       effective_on, page_count, display_order)
    SELECT ?, ?, campus_id, 'readiness-source', 'Readiness source', SHA2(?, 256),
           '2026-09-02', 1, 10
    FROM directory_source_documents
    WHERE batch_id = ?
    ORDER BY display_order
    LIMIT 1
  `,
    [documentId, batchId, `document-${batchId}`, sourceBatchId],
  );
  await connection.query(
    'INSERT INTO readiness_entry_map (old_id, new_id) SELECT id, UUID() FROM directory_entries WHERE batch_id = ?',
    [sourceBatchId],
  );
  const entryStartedAt = performance.now();
  await connection.query(
    `
    INSERT INTO directory_entries
      (id, batch_id, source_document_id, campus_id, entry_key, source_page, source_locator,
       section_name, department_name, subunit_name, contact_name, employee_code, job_title,
       building_name, floor_name, room_name, entry_kind, notes, visibility,
       verification_status, display_order, search_text, content_sha256)
    SELECT map.new_id, ?, ?, source.campus_id, source.entry_key, source.source_page,
           source.source_locator, source.section_name, source.department_name,
           source.subunit_name, source.contact_name, source.employee_code, source.job_title,
           source.building_name, source.floor_name, source.room_name, source.entry_kind,
           source.notes, source.visibility, source.verification_status, source.display_order,
           source.search_text, source.content_sha256
    FROM directory_entries AS source
    INNER JOIN readiness_entry_map AS map ON map.old_id = source.id
  `,
    [batchId, documentId],
  );
  const entryInsertMs = roundMs(performance.now() - entryStartedAt);
  const contactStartedAt = performance.now();
  await connection.query(`
    INSERT INTO directory_contact_methods
      (id, entry_id, type, label, full_number, internal_extension, normalized_full_number,
       normalized_internal_extension, contact_sha256, is_primary, display_order)
    SELECT UUID(), map.new_id, source.type, source.label, source.full_number,
           source.internal_extension, source.normalized_full_number,
           source.normalized_internal_extension, source.contact_sha256,
           source.is_primary, source.display_order
    FROM directory_contact_methods AS source
    INNER JOIN readiness_entry_map AS map ON map.old_id = source.entry_id
  `);
  const contactInsertMs = roundMs(performance.now() - contactStartedAt);
  const aliasStartedAt = performance.now();
  await connection.query(`
    INSERT INTO directory_search_aliases
      (id, entry_id, type, alias_value, normalized_value, alias_sha256)
    SELECT UUID(), map.new_id, source.type, source.alias_value,
           source.normalized_value, source.alias_sha256
    FROM directory_search_aliases AS source
    INNER JOIN readiness_entry_map AS map ON map.old_id = source.entry_id
  `);
  const aliasInsertMs = roundMs(performance.now() - aliasStartedAt);
  return { aliasInsertMs, batchId, contactInsertMs, entryInsertMs };
}

async function cleanupBatch(connection, batchId) {
  await connection.query(
    `
    DELETE aliases FROM directory_search_aliases AS aliases
    INNER JOIN directory_entries AS entries ON entries.id = aliases.entry_id
    WHERE entries.batch_id = ?
  `,
    [batchId],
  );
  await connection.query(
    `
    DELETE contacts FROM directory_contact_methods AS contacts
    INNER JOIN directory_entries AS entries ON entries.id = contacts.entry_id
    WHERE entries.batch_id = ?
  `,
    [batchId],
  );
  await connection.query('DELETE FROM directory_entries WHERE batch_id = ?', [batchId]);
  await connection.query('DELETE FROM directory_source_documents WHERE batch_id = ?', [batchId]);
  await connection.query('DELETE FROM directory_import_batches WHERE id = ?', [batchId]);
}

async function runConcurrentSearch(query, control) {
  const durations = [];
  let errors = 0;
  while (!control.stopped) {
    const startedAt = performance.now();
    try {
      await query.list(
        benchmarkFixture.identities.member,
        benchmarkFixture.groupId,
        benchmarkFixture.queries.pinyinInitials,
        'employee',
      );
      durations.push(roundMs(performance.now() - startedAt));
    } catch {
      errors += 1;
    }
  }
  return { errors, latencyMs: distribution(durations), requests: durations.length + errors };
}

async function runOnlineDdlProbe(root, config) {
  await setCoveringIndex(root, false);
  let rejectedInstant = false;
  try {
    await root.query(`
      ALTER TABLE directory_search_aliases
        ADD INDEX directory_search_aliases_entry_type_normalized_idx
          (entry_id, type, normalized_value),
        ALGORITHM=INSTANT,
        LOCK=NONE
    `);
  } catch {
    rejectedInstant = true;
  }
  const absentAfterFailure = !(await hasCoveringIndex(root));
  const monitor = await mysql.createConnection({
    database: config.database,
    host: config.host,
    password: 'local-readiness-root',
    port: config.port,
    user: 'root',
  });
  const writer = await mysql.createConnection(config);
  const databaseClient = createDatabaseClient({ ...config, connectionLimit: 4 });
  const query = new DirectoryQuery(databaseClient, { configuredPlan: 'legacy' });
  const control = { stopped: false };
  const probeEntryId = await readProbeEntryId(root);
  const readPromise = runDdlReadLoop(query, control);
  const writePromise = runDdlWriteLoop(writer, probeEntryId, control);
  const monitorPromise = runDdlMonitor(monitor, control);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const startedAt = performance.now();
  await root.query(`
    ALTER TABLE directory_search_aliases
      ADD INDEX directory_search_aliases_entry_type_normalized_idx
        (entry_id, type, normalized_value),
      ALGORITHM=INPLACE,
      LOCK=NONE
  `);
  const durationMs = roundMs(performance.now() - startedAt);
  control.stopped = true;
  const [reads, writes, monitored] = await Promise.all([readPromise, writePromise, monitorPromise]);
  await databaseClient.close();
  await writer.end();
  await monitor.end();
  return {
    absentAfterFailure,
    algorithm: 'INPLACE',
    concurrentReads: reads,
    concurrentWrites: writes,
    durationMs,
    indexDefinitionValid: await hasCoveringIndex(root),
    lock: 'NONE',
    metadataLockPendingMax: monitored.metadataLockPendingMax,
    rejectedInstant,
    retrySafe: rejectedInstant && absentAfterFailure && (await hasCoveringIndex(root)),
    space: monitored.space,
  };
}

async function runDdlReadLoop(query, control) {
  const durations = [];
  let errors = 0;
  while (!control.stopped) {
    const startedAt = performance.now();
    try {
      await query.list(
        benchmarkFixture.identities.member,
        benchmarkFixture.groupId,
        benchmarkFixture.queries.pinyinInitials,
        'employee',
      );
      durations.push(roundMs(performance.now() - startedAt));
    } catch {
      errors += 1;
    }
  }
  return { errors, latencyMs: distribution(durations), requests: durations.length + errors };
}

async function runDdlWriteLoop(connection, entryId, control) {
  const durations = [];
  let errors = 0;
  while (!control.stopped) {
    const startedAt = performance.now();
    try {
      const aliasId = await readUuid(connection);
      await connection.query(
        `
        INSERT INTO directory_search_aliases
          (id, entry_id, type, alias_value, normalized_value, alias_sha256)
        VALUES (?, ?, 'manual', 'readiness-ddl-probe', 'readiness-ddl-probe',
                SHA2(CONCAT(UUID(), RAND()), 256))
      `,
        [aliasId, entryId],
      );
      await connection.query('DELETE FROM directory_search_aliases WHERE id = ?', [aliasId]);
      durations.push(roundMs(performance.now() - startedAt));
    } catch {
      errors += 1;
    }
  }
  await connection.query(
    "DELETE FROM directory_search_aliases WHERE entry_id = ? AND alias_value = 'readiness-ddl-probe'",
    [entryId],
  );
  return { errors, latencyMs: distribution(durations), requests: durations.length + errors };
}

async function runDdlMonitor(connection, control) {
  const baseBytes = readMysqlDirectoryBytes();
  let peakBytes = baseBytes;
  let metadataLockPendingMax = 0;
  while (!control.stopped) {
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS pending
      FROM performance_schema.metadata_locks
      WHERE OBJECT_SCHEMA = DATABASE()
        AND OBJECT_NAME = 'directory_search_aliases'
        AND LOCK_STATUS = 'PENDING'
    `);
    metadataLockPendingMax = Math.max(metadataLockPendingMax, Number(rows[0]?.pending ?? 0));
    peakBytes = Math.max(peakBytes, readMysqlDirectoryBytes());
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const finalBytes = readMysqlDirectoryBytes();
  return {
    metadataLockPendingMax,
    space: {
      baseBytes,
      finalBytes,
      peakBytes,
      temporaryPeakAboveFinalBytes: Math.max(0, peakBytes - Math.max(baseBytes, finalBytes)),
    },
  };
}

async function prepareMappingTable(connection) {
  await connection.query(`
    CREATE TEMPORARY TABLE IF NOT EXISTS readiness_entry_map (
      old_id CHAR(36) NOT NULL PRIMARY KEY,
      new_id CHAR(36) NOT NULL UNIQUE
    ) ENGINE=InnoDB
  `);
}

async function setCoveringIndex(connection, present) {
  const exists = await hasCoveringIndex(connection);
  if (present === exists) return;
  if (present) {
    await connection.query(`
      ALTER TABLE directory_search_aliases
        ADD INDEX directory_search_aliases_entry_type_normalized_idx
          (entry_id, type, normalized_value),
        ALGORITHM=INPLACE,
        LOCK=NONE
    `);
  } else {
    await connection.query(`
      ALTER TABLE directory_search_aliases
        DROP INDEX directory_search_aliases_entry_type_normalized_idx,
        ALGORITHM=INPLACE,
        LOCK=NONE
    `);
  }
}

async function hasCoveringIndex(connection) {
  const [rows] = await connection.query(
    `
    SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns_value,
           GROUP_CONCAT(DISTINCT NON_UNIQUE) AS non_unique
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'directory_search_aliases'
      AND INDEX_NAME = ?
  `,
    [indexName],
  );
  return rows[0]?.columns_value === 'entry_id,type,normalized_value' && rows[0]?.non_unique === '1';
}

async function readPublishedEmployeeBatchId(connection) {
  const [rows] = await connection.query(
    "SELECT id FROM directory_import_batches WHERE directory_kind='employee' AND status='published' LIMIT 1",
  );
  if (rows[0]?.id === undefined) throw new Error('Published employee fixture is missing.');
  return rows[0].id;
}

async function readProbeEntryId(connection) {
  const batchId = await readPublishedEmployeeBatchId(connection);
  const [rows] = await connection.query(
    'SELECT id FROM directory_entries WHERE batch_id = ? ORDER BY id LIMIT 1',
    [batchId],
  );
  if (rows[0]?.id === undefined) throw new Error('DDL probe entry is missing.');
  return rows[0].id;
}

async function readUuid(connection) {
  const [rows] = await connection.query('SELECT UUID() AS id');
  return rows[0].id;
}

async function readWriteStats(connection) {
  const [rows] = await connection.query(`
    SHOW GLOBAL STATUS WHERE Variable_name IN (
      'Innodb_data_written', 'Innodb_pages_written', 'Innodb_os_log_written'
    )
  `);
  const result = Object.fromEntries(rows.map((row) => [row.Variable_name, Number(row.Value)]));
  const [metrics] = await connection.query(`
    SELECT NAME, COUNT
    FROM information_schema.INNODB_METRICS
    WHERE NAME IN (
      'buffer_page_written_rseg_array',
      'buffer_page_written_undo_log',
      'trx_rseg_history_len',
      'trx_undo_slots_used'
    )
  `);
  for (const metric of metrics) result[metric.NAME] = Number(metric.COUNT ?? 0);
  return result;
}

function diffCounters(before, after) {
  return Object.fromEntries(
    Object.keys(after).map((key) => [key, Number(after[key] ?? 0) - Number(before[key] ?? 0)]),
  );
}

async function readDirectorySpace(connection) {
  const [tableRows] = await connection.query(`
    SELECT TABLE_NAME, DATA_LENGTH, INDEX_LENGTH
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('directory_entries', 'directory_contact_methods', 'directory_search_aliases')
    ORDER BY TABLE_NAME
  `);
  const [indexRows] = await connection.query(`
    SELECT INDEX_NAME, STAT_VALUE * @@innodb_page_size AS size_bytes
    FROM mysql.innodb_index_stats
    WHERE DATABASE_NAME = DATABASE()
      AND TABLE_NAME = 'directory_search_aliases'
      AND STAT_NAME = 'size'
    ORDER BY INDEX_NAME
  `);
  return {
    indexes: indexRows.map((row) => ({
      index: row.INDEX_NAME,
      sizeBytes: Number(row.size_bytes),
    })),
    tables: tableRows.map((row) => ({
      dataBytes: Number(row.DATA_LENGTH),
      indexBytes: Number(row.INDEX_LENGTH),
      table: row.TABLE_NAME,
    })),
  };
}

function summarizeImportRuns(runs) {
  const phases = [
    'aliasInsertMs',
    'cleanupMs',
    'fullImportMs',
    'publishMs',
    'rollbackFailedImportMs',
    'rollbackOnlyMs',
  ];
  return {
    phases: Object.fromEntries(
      phases.map((phase) => [phase, distribution(runs.map((run) => run[phase]))]),
    ),
    searchDuringImport: {
      errors: runs.reduce((total, run) => total + run.concurrentSearch.errors, 0),
      maxMs: Math.max(...runs.map((run) => run.concurrentSearch.latencyMs.max)),
      p50Ms: median(runs.map((run) => run.concurrentSearch.latencyMs.p50)),
      p95Ms: Math.max(...runs.map((run) => run.concurrentSearch.latencyMs.p95)),
    },
    writeDelta: Object.fromEntries(
      Object.keys(runs[0]?.writeDelta ?? {}).map((key) => [
        key,
        distribution(runs.map((run) => run.writeDelta[key])),
      ]),
    ),
  };
}

function compareVariants(variants) {
  const withoutIndex = variants.find((variant) => !variant.indexPresent)?.summary;
  const withIndex = variants.find((variant) => variant.indexPresent)?.summary;
  if (withoutIndex === undefined || withIndex === undefined) return {};
  return Object.fromEntries(
    Object.keys(withIndex.phases).map((phase) => [
      phase,
      percentChange(withoutIndex.phases[phase].p50, withIndex.phases[phase].p50),
    ]),
  );
}

function percentChange(baseline, candidate) {
  return baseline === 0 ? null : roundMs(((candidate - baseline) / baseline) * 100);
}

function distribution(values) {
  const sorted = [...values].sort((first, second) => first - second);
  return {
    max: roundMs(sorted.at(-1) ?? 0),
    p50: roundMs(percentile(sorted, 0.5)),
    p95: roundMs(percentile(sorted, 0.95)),
    p99: roundMs(percentile(sorted, 0.99)),
  };
}

function percentile(sorted, quantile) {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)];
}

function median(values) {
  return distribution(values).p50;
}

function readMysqlDirectoryBytes() {
  const output = execFileSync('docker', ['exec', containerName, 'du', '-sb', '/var/lib/mysql'], {
    encoding: 'utf8',
  });
  return Number(output.trim().split(/\s+/u)[0]);
}

async function readMysqlVersion(connection) {
  const [rows] = await connection.query('SELECT VERSION() AS version');
  return String(rows[0]?.version ?? 'unknown');
}

function roundMs(value) {
  return Math.round(value * 1_000) / 1_000;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runImportAndDdlBenchmark()
    .then(({ outputPath: path }) => process.stdout.write(`[directory-readiness] output=${path}\n`))
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.stack : 'Import/DDL benchmark failed.'}\n`,
      );
      process.exitCode = 1;
    });
}
