import { createDatabaseClient } from '@schedule/database';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  createCloudbaseAuthPort,
  createCloudbaseHttpAuthPort,
} from './adapters/auth/cloudbase-auth.js';
import { createDevAuthPort } from './adapters/auth/dev-auth.js';
import { createApp } from './app.js';
import { loadEnvironment, type Environment } from './config/env.js';
import { WorkflowSelfHealingService } from './modules/workflows/workflow-self-healing-service.js';

interface RuntimeAppOptions {
  readonly cloudbaseHttpGateway?: boolean;
}

/**
 * Dev auth accepts any Bearer token as a CloudBase UID, so it must never
 * activate outside an explicitly opted-in development process.
 */
export function isDevAuthEnabled(environment: Environment): boolean {
  return environment.NODE_ENV === 'development' && environment.AUTH_DEV_MODE === 'true';
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
      : isDevAuthEnabled(environment)
        ? createDevAuthPort()
        : createCloudbaseAuthPort(),
    databaseClient,
    ...(options.cloudbaseHttpGateway
      ? { readTrustedCloudbaseContext: readCloudbaseGatewayContext }
      : {}),
  });

  const workflowSelfHealingService = new WorkflowSelfHealingService(databaseClient);
  void workflowSelfHealingService.runStartupSweep().catch((error: unknown) => {
    app.log.error(
      { error, event: 'startup_workflow_sweep_failed' },
      'Startup stale workflow sweep failed.',
    );
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
