import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { restoreBackupArchive, deriveBackupKey } from '@schedule/api/backup-archive';
import {
  createDatabaseClient,
  migrateDatabase,
  type DatabaseConnectionOptions,
} from '@schedule/database';

const migrationsDirectory = fileURLToPath(new URL('../../../migrations', import.meta.url));
const backupPath = getBackupPath(process.argv.slice(2));
if (backupPath === undefined) {
  console.error('Usage: node dist/restore-backup.js --backup=/absolute/path.backup');
  process.exit(1);
}

const databaseOptions = getRestoreDatabaseOptions(process.env);
if (databaseOptions === undefined) {
  console.error(
    'RESTORE_MYSQL_HOST, RESTORE_MYSQL_PORT, RESTORE_MYSQL_DATABASE, RESTORE_MYSQL_USER, and RESTORE_MYSQL_PASSWORD are required.',
  );
  process.exit(1);
}

const encryptionKeyValue = process.env.BACKUP_ENCRYPTION_KEY;
if (encryptionKeyValue === undefined || encryptionKeyValue.trim().length === 0) {
  console.error('BACKUP_ENCRYPTION_KEY is required to decrypt the backup.');
  process.exit(1);
}

const client = createDatabaseClient(databaseOptions);
try {
  await migrateDatabase(client, migrationsDirectory);
  const content = await readFile(backupPath);
  const result = await restoreBackupArchive(client, content, deriveBackupKey(encryptionKeyValue));
  if (result.mismatches.length > 0) {
    console.error(JSON.stringify({ restored: false, ...result }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ restored: true, ...result }, null, 2));
  }
} finally {
  await client.close();
}

function getBackupPath(args: readonly string[]): string | undefined {
  return args.find((argument) => argument.startsWith('--backup='))?.slice('--backup='.length);
}

function getRestoreDatabaseOptions(
  values: NodeJS.ProcessEnv,
): DatabaseConnectionOptions | undefined {
  const {
    RESTORE_MYSQL_DATABASE,
    RESTORE_MYSQL_HOST,
    RESTORE_MYSQL_PASSWORD,
    RESTORE_MYSQL_PORT,
    RESTORE_MYSQL_USER,
  } = values;
  const port = Number(RESTORE_MYSQL_PORT ?? '3306');
  if (
    RESTORE_MYSQL_DATABASE === undefined ||
    RESTORE_MYSQL_PASSWORD === undefined ||
    RESTORE_MYSQL_USER === undefined ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    return undefined;
  }

  return {
    database: RESTORE_MYSQL_DATABASE,
    host: RESTORE_MYSQL_HOST ?? '127.0.0.1',
    password: RESTORE_MYSQL_PASSWORD,
    port,
    user: RESTORE_MYSQL_USER,
  };
}
