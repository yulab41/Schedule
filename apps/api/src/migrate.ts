import { createDatabaseClient, migrateDatabase } from '@schedule/database';

import { loadEnvironment } from './config/env.js';

async function run(): Promise<void> {
  const environment = loadEnvironment();
  const client = createDatabaseClient({
    database: environment.MYSQL_DATABASE,
    host: environment.MYSQL_HOST,
    password: environment.MYSQL_PASSWORD,
    port: environment.MYSQL_PORT,
    user: environment.MYSQL_USER,
  });

  try {
    await migrateDatabase(client);
  } finally {
    await client.close();
  }
}

void run().catch(() => {
  process.stderr.write('Database migration failed.\n');
  process.exitCode = 1;
});
