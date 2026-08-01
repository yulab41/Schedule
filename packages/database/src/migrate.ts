import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/mysql2/migrator';

import type { DatabaseClient } from './client.js';

export const defaultMigrationsDirectory = fileURLToPath(
  new URL('../../../migrations', import.meta.url),
);

export async function migrateDatabase(
  client: DatabaseClient,
  migrationsDirectory = defaultMigrationsDirectory,
): Promise<void> {
  await migrate(client.database, {
    migrationsFolder: migrationsDirectory,
  });
}
