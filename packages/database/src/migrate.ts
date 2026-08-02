import { fileURLToPath, pathToFileURL } from 'node:url';

import { migrate } from 'drizzle-orm/mysql2/migrator';

import type { DatabaseClient } from './client.js';

declare const __filename: string | undefined;

export const defaultMigrationsDirectory = resolveMigrationsDirectory();

export async function migrateDatabase(
  client: DatabaseClient,
  migrationsDirectory = defaultMigrationsDirectory,
): Promise<void> {
  await migrate(client.database, {
    migrationsFolder: migrationsDirectory,
  });
}

function resolveMigrationsDirectory(): string {
  const baseUrl = typeof __filename === 'string' ? pathToFileURL(__filename) : import.meta.url;
  return fileURLToPath(new URL('../../../migrations', baseUrl));
}
