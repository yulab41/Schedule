import { createDatabaseClient } from '@schedule/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  createCloudbaseAuthPort,
  createCloudbaseHttpAuthPort,
} from './adapters/auth/cloudbase-auth.js';
import { createDevAuthPort } from './adapters/auth/dev-auth.js';
import { createApp } from './app.js';
import { loadEnvironment, type Environment } from './config/env.js';

interface RuntimeAppOptions {
  readonly cloudbaseHttpGateway?: boolean;
}

export function createRuntimeApp(
  environment: Environment = loadEnvironment(),
  options: RuntimeAppOptions = {},
): FastifyInstance {
  const databaseClient = createDatabaseClient({
    database: environment.MYSQL_DATABASE,
    host: environment.MYSQL_HOST,
    password: environment.MYSQL_PASSWORD,
    port: environment.MYSQL_PORT,
    user: environment.MYSQL_USER,
  });
  const app = createApp({
    authPort: options.cloudbaseHttpGateway
      ? createCloudbaseHttpAuthPort()
      : process.env.AUTH_DEV_MODE === 'true'
        ? createDevAuthPort()
        : createCloudbaseAuthPort(),
    databaseClient,
    ...(options.cloudbaseHttpGateway
      ? { readTrustedCloudbaseContext: readCloudbaseGatewayContext }
      : {}),
  });

  app.addHook('onClose', async () => databaseClient.close());

  return app;
}

export function createCloudbaseRuntimeApp(
  environment: Environment = loadEnvironment(),
): FastifyInstance {
  return createRuntimeApp(environment, { cloudbaseHttpGateway: true });
}

function readCloudbaseGatewayContext(request: FastifyRequest): string | undefined {
  const context = request.headers['x-cloudbase-context'];
  return typeof context === 'string' ? context : undefined;
}
