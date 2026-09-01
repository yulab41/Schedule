import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { readBenchmarkDatabaseConfig } from './synthetic-fixture.mjs';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const mysql = require('mysql2/promise');
const indexName = 'directory_search_aliases_entry_type_normalized_candidate_idx';

export async function removeCoveringIndex() {
  const config = readBenchmarkDatabaseConfig();
  const connection = await mysql.createConnection({
    database: config.database,
    host: config.host,
    password: 'local-benchmark-root',
    port: config.port,
    user: 'root',
  });
  try {
    const [existing] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'directory_search_aliases'
         AND index_name = ?`,
      [indexName],
    );
    if (Number(existing[0]?.count ?? 0) === 0) return { removed: false };
    await connection.query(`DROP INDEX \`${indexName}\` ON directory_search_aliases`);
    await connection.query('ANALYZE TABLE directory_search_aliases');
    return { removed: true };
  } finally {
    await connection.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  removeCoveringIndex()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Index removal failed.'}\n`);
      process.exitCode = 1;
    });
}
