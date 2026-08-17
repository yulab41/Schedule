import { createHash } from 'node:crypto';

import { createDatabaseClient } from '@schedule/database';

import {
  activateDirectorySnapshot,
  DirectoryImportError,
  parseDirectoryImportArgs,
  previewDirectorySnapshot,
  publishDirectorySnapshot,
  validateDirectoryManifest,
} from './directory-import-core.js';

const maximumManifestBytes = 10 * 1024 * 1024;

try {
  const command = parseDirectoryImportArgs(process.argv.slice(2));
  const database = createDatabaseClient({
    database: readRequiredEnvironment('MYSQL_DATABASE'),
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    password: readRequiredEnvironment('MYSQL_PASSWORD'),
    port: readPort(process.env.MYSQL_PORT ?? '3306'),
    user: readRequiredEnvironment('MYSQL_USER'),
  });

  try {
    if (command.action === 'activate') {
      const result = await activateDirectorySnapshot(database, command.batchId ?? '');
      console.log(JSON.stringify({ action: 'activate', ...result }));
    } else {
      const rawManifest = await readStandardInput();
      const manifestSha256 = createHash('sha256').update(rawManifest).digest('hex');
      const manifest = validateDirectoryManifest(parseManifest(rawManifest));
      if (command.action === 'dry-run') {
        const result = await previewDirectorySnapshot(database, manifest);
        console.log(
          JSON.stringify({
            action: 'dry-run',
            importVersion: manifest.importVersion,
            manifestSha256,
            ...result,
          }),
        );
      } else {
        const result = await publishDirectorySnapshot(database, manifest, manifestSha256);
        console.log(
          JSON.stringify({
            action: 'publish',
            importVersion: manifest.importVersion,
            manifestSha256,
            ...result,
          }),
        );
      }
    }
  } finally {
    await database.close();
  }
} catch (error) {
  if (error instanceof DirectoryImportError) {
    console.error(`Directory import rejected: ${error.message}`);
  } else {
    console.error('Directory import failed without exposing manifest content.');
  }
  process.exitCode = 1;
}

async function readStandardInput(): Promise<string> {
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input, 'utf8') > maximumManifestBytes) {
      throw new DirectoryImportError('The stdin manifest exceeds the 10 MiB limit.');
    }
  }
  if (input.trim().length === 0) {
    throw new DirectoryImportError('The stdin manifest is empty.');
  }
  return input;
}

function parseManifest(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new DirectoryImportError('The stdin manifest is not valid JSON.');
  }
}

function readRequiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new DirectoryImportError(`Missing required environment variable ${name}.`);
  }
  return value;
}

function readPort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new DirectoryImportError('MYSQL_PORT must be a valid TCP port.');
  }
  return port;
}
