import { pathToFileURL } from 'node:url';

import { loadEnvironment } from './config/env.js';
import { createRuntimeApp } from './runtime.js';

export async function startLocalServer(): Promise<void> {
  const environment = loadEnvironment();
  const app = createRuntimeApp(environment);

  try {
    await app.listen({
      host: environment.API_HOST,
      port: environment.API_PORT,
    });
  } catch (error) {
    app.log.error({ event: 'server_start_failed' }, 'API server failed to start');
    await app.close();
    throw error;
  }
}

const entrypoint = process.argv[1];

if (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href) {
  void startLocalServer().catch(() => {
    process.stderr.write('API server failed to start. Check configuration and server logs.\n');
    process.exitCode = 1;
  });
}
