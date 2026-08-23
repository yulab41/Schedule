import { createDatabaseClient } from '@schedule/database';
import type { FastifyInstance } from 'fastify';

import type { AuthPort } from './adapters/auth/auth-port.js';
import { createDevAuthPort } from './adapters/auth/dev-auth.js';
import { createWechatAuthPort } from './adapters/auth/wechat-auth.js';
import { createApp } from './app.js';
import { loadEnvironment, type Environment } from './config/env.js';
import { createWechatGateway, createWechatWebGateway } from './modules/wechat/wechat-gateway.js';
import { WechatWebAuthService } from './modules/wechat/wechat-web-auth-service.js';
import { WorkflowSelfHealingService } from './modules/workflows/workflow-self-healing-service.js';
import { createPushDispatcher } from './modules/notifications/notification-dispatcher.js';
import { PasswordAuthService } from './modules/auth/password-auth-service.js';
import { ClientCapabilityPolicy } from './modules/client-capabilities/client-capability-policy.js';

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

export function createClientCapabilityPolicy(environment: Environment): ClientCapabilityPolicy {
  return new ClientCapabilityPolicy({
    capabilities: {
      core: environment.MINIPROGRAM_CAPABILITY_CORE_ENABLED === 'true',
      externalMessages: environment.MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED === 'true',
      global: environment.MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED === 'true',
      guest: environment.MINIPROGRAM_CAPABILITY_GUEST_ENABLED === 'true',
      insights: environment.MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED === 'true',
      organization: environment.MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED === 'true',
      workflows: environment.MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED === 'true',
    },
    ...(environment.MINIPROGRAM_LEGACY_CLIENT_VERSION === undefined
      ? {}
      : { legacyVersion: environment.MINIPROGRAM_LEGACY_CLIENT_VERSION }),
    supportedVersions: environment.MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS,
  });
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
  const wechatGateway = createWechatGateway(environment);
  const wechatWebGateway = createWechatWebGateway(environment);
  const passwordAuthService =
    environment.AUTH_PASSWORD_ENABLED === 'true'
      ? new PasswordAuthService({
          databaseClient,
          gateway: wechatGateway,
          sessionSecret: environment.WECHAT_SESSION_SECRET,
        })
      : undefined;
  const wechatAuthPort =
    wechatGateway.isConfigured ||
    wechatWebGateway?.isConfigured === true ||
    passwordAuthService !== undefined
      ? createWechatAuthPort({
          allowDevTokens: isDevAuthEnabled(environment),
          databaseClient,
          sessionSecret: environment.WECHAT_SESSION_SECRET,
        })
      : undefined;
  const authPort =
    options.authPort ??
    wechatAuthPort ??
    (isDevAuthEnabled(environment) ? createDevAuthPort() : undefined);
  if (authPort === undefined) {
    throw new Error(
      'No authentication port configured. Enable AUTH_PASSWORD_ENABLED or AUTH_DEV_MODE in development, or pass an authPort.',
    );
  }

  const wechatWebAuthService =
    wechatWebGateway === undefined
      ? undefined
      : new WechatWebAuthService({
          databaseClient,
          gateway: wechatWebGateway,
          redirectUri: environment.WECHAT_WEB_REDIRECT_URI,
          sessionSecret: environment.WECHAT_SESSION_SECRET,
        });
  const app = createApp({
    authPort,
    clientCapabilityPolicy: createClientCapabilityPolicy(environment),
    databaseClient,
    pushDispatcher: createPushDispatcher(environment),
    ...(passwordAuthService === undefined ? {} : { passwordAuthService }),
    wechatGateway,
    ...(wechatWebAuthService === undefined ? {} : { wechatWebAuthService }),
    wechatSessionSecret: environment.WECHAT_SESSION_SECRET,
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
