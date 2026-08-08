import { createDatabaseClient } from '@schedule/database';
import type { FastifyInstance } from 'fastify';

import type { AuthPort } from './adapters/auth/auth-port.js';
import { createDevAuthPort } from './adapters/auth/dev-auth.js';
import { createApp } from './app.js';
import { loadEnvironment, type Environment } from './config/env.js';
import { createWechatGateway } from './modules/wechat/wechat-gateway.js';
import { WorkflowSelfHealingService } from './modules/workflows/workflow-self-healing-service.js';

interface RuntimeAppOptions {
  readonly authPort?: AuthPort;
}

/**
 * Dev auth accepts any Bearer token as an external UID, so it must never
 * activate outside an explicitly opted-in development process.
 */
export function isDevAuthEnabled(environment: Environment): boolean {
  return environment.NODE_ENV === 'development' && environment.AUTH_DEV_MODE === 'true';
}

export function createRuntimeApp(
  environment: Environment = loadEnvironment(),
  options: RuntimeAppOptions = {},
): FastifyInstance {
  const authPort =
    options.authPort ?? (isDevAuthEnabled(environment) ? createDevAuthPort() : undefined);
  if (authPort === undefined) {
    throw new Error(
      'No authentication port configured. Enable AUTH_DEV_MODE in development or pass an authPort.',
    );
  }

  const databaseClient = createDatabaseClient({
    database: environment.MYSQL_DATABASE,
    host: environment.MYSQL_HOST,
    password: environment.MYSQL_PASSWORD,
    port: environment.MYSQL_PORT,
    user: environment.MYSQL_USER,
  });
  const app = createApp({
    authPort,
    databaseClient,
    wechatGateway: createWechatGateway(environment),
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
