import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  readBenchmarkDatabaseConfig,
  seedSyntheticDirectoryFixture,
} from './synthetic-fixture.mjs';
import { removeCoveringIndex } from './remove-covering-index.mjs';

const dockerDirectory = fileURLToPath(new URL('./docker', import.meta.url));
const composeFile = fileURLToPath(new URL('./docker/compose.yml', import.meta.url));
const dockerfile = fileURLToPath(new URL('./docker/Dockerfile.cache-evictor', import.meta.url));
const containerName = 'schedule-directory-query-isolation-mysql-1';

export async function setupIsolation() {
  command('docker', ['compose', '-f', composeFile, 'up', '-d', 'mysql']);
  await waitForHealth();
  command('docker', [
    'build',
    '-f',
    dockerfile,
    '-t',
    'schedule-directory-cache-evictor:local',
    dockerDirectory,
  ]);
  let databaseModule;
  try {
    databaseModule = await import('../../packages/database/dist/index.js');
  } catch {
    throw new Error('Build @schedule/database before running isolation setup.');
  }
  const { createTestDatabaseClient, migrateDatabase } = databaseModule;
  const client = createTestDatabaseClient(readBenchmarkDatabaseConfig());
  try {
    await migrateDatabase(client);
  } finally {
    await client.close();
  }
  await removeCoveringIndex();
  const fixture = await seedSyntheticDirectoryFixture();
  const serverVersion = command('docker', ['exec', containerName, 'mysqld', '--version'], false);
  return { fixture, serverVersion };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const health = command(
      'docker',
      ['inspect', '--format', '{{.State.Health.Status}}', containerName],
      false,
    );
    if (health === 'healthy') return;
    if (health === 'unhealthy') throw new Error('Benchmark MySQL failed its health check.');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Benchmark MySQL did not become healthy.');
}

function command(executable, arguments_, inherit = true) {
  const output = execFileSync(executable, arguments_, {
    encoding: 'utf8',
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
  });
  return typeof output === 'string' ? output.trim() : '';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupIsolation()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : 'Isolation setup failed.'}\n`);
      process.exitCode = 1;
    });
}
