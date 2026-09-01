import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const composeFile = fileURLToPath(new URL('./docker/compose.yml', import.meta.url));
const containerName = 'schedule-directory-query-isolation-mysql-1';
const volumeName = 'schedule_directory_query_isolation_data';

export async function resetBenchmarkDatabaseCold() {
  docker(['compose', '-f', composeFile, 'stop', 'mysql']);
  const eviction = JSON.parse(
    docker([
      'run',
      '--rm',
      '--mount',
      `type=volume,source=${volumeName},target=/data,readonly`,
      'schedule-directory-cache-evictor:local',
      '/data',
    ]),
  );
  if (eviction.failures !== 0 || eviction.files === 0 || eviction.bytes === 0) {
    throw new Error('Benchmark volume cache eviction did not cover the data volume.');
  }
  docker(['compose', '-f', composeFile, 'start', 'mysql']);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const health = docker(['inspect', '--format', '{{.State.Health.Status}}', containerName]);
    if (health === 'healthy') {
      return Object.freeze({
        bufferPoolRestored: false,
        bytesAdvisedDontNeed: Number(eviction.bytes),
        filesAdvisedDontNeed: Number(eviction.files),
        osPageCacheEviction: 'posix_fadvise_dontneed_on_benchmark_volume',
      });
    }
    if (health === 'unhealthy')
      throw new Error('Benchmark MySQL became unhealthy after cold reset.');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Benchmark MySQL did not become healthy after cold reset.');
}

function docker(arguments_) {
  return execFileSync('docker', arguments_, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  resetBenchmarkDatabaseCold()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Cold reset failed.'}\n`);
      process.exitCode = 1;
    });
}
