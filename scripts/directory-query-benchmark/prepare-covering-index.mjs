import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { readBenchmarkDatabaseConfig } from './synthetic-fixture.mjs';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const mysql = require('mysql2/promise');
const indexName = 'directory_search_aliases_entry_type_normalized_candidate_idx';
const outputPath = resolve('runtime/audit/directory-query-isolation/covering-index-space.json');

export async function prepareCoveringIndex() {
  const config = readBenchmarkDatabaseConfig();
  const connection = await mysql.createConnection({
    database: config.database,
    host: config.host,
    password: 'local-benchmark-root',
    port: config.port,
    user: 'root',
  });
  try {
    const before = await readIndexStats(connection);
    const [existing] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'directory_search_aliases'
         AND index_name = ?`,
      [indexName],
    );
    if (Number(existing[0]?.count ?? 0) > 0) {
      await connection.query(`DROP INDEX \`${indexName}\` ON directory_search_aliases`);
    }
    const startedAt = performance.now();
    await connection.query(
      `CREATE INDEX \`${indexName}\`
       ON directory_search_aliases (entry_id, type, normalized_value)`,
    );
    const createMs = Math.round((performance.now() - startedAt) * 1_000) / 1_000;
    await connection.query('ANALYZE TABLE directory_search_aliases');
    const after = await readIndexStats(connection);
    const result = {
      after,
      before,
      createMs,
      indexBytes: after[indexName] ?? 0,
      indexColumns: ['entry_id', 'type', 'normalized_value'],
      indexName,
      scope: 'dedicated-local-benchmark-database-only',
    };
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, undefined, 2)}\n`, 'utf8');
    return result;
  } finally {
    await connection.end();
  }
}

async function readIndexStats(connection) {
  const [rows] = await connection.query(`
    SELECT index_name AS indexName, stat_value * @@innodb_page_size AS bytes
    FROM mysql.innodb_index_stats
    WHERE database_name = DATABASE()
      AND table_name = 'directory_search_aliases'
      AND stat_name = 'size'
    ORDER BY index_name
  `);
  return Object.fromEntries(rows.map((row) => [row.indexName, Number(row.bytes)]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepareCoveringIndex()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Index preparation failed.'}\n`,
      );
      process.exitCode = 1;
    });
}
