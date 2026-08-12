#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const localTestHosts = new Set(['127.0.0.1', '::1', 'localhost']);
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const testDatabaseName = 'schedule_test';
const vitestEntrypoint = fileURLToPath(
  new URL('../node_modules/vitest/vitest.mjs', import.meta.url),
);

export const workflowIntegrationTestFiles = [
  'apps/api/src/modules/leaves/leaves.integration.test.ts',
  'apps/api/src/modules/swaps/swaps.integration.test.ts',
  'apps/api/src/modules/duty-adjustments/duty-adjustments.integration.test.ts',
];

export const task10IntegrationTestFiles = [
  'apps/api/src/modules/calendar/calendar.integration.test.ts',
  'apps/api/src/modules/calendar/visitor-access.integration.test.ts',
  'apps/api/src/modules/groups/group-routes.integration.test.ts',
  'apps/api/src/modules/groups/group-permissions.integration.test.ts',
  'apps/api/src/modules/groups/membership-claims.integration.test.ts',
  'apps/api/src/modules/groups/invite-service.integration.test.ts',
  'apps/api/src/modules/notifications/notifications.integration.test.ts',
  'apps/api/src/modules/wechat/wechat-notifications.integration.test.ts',
  'apps/api/src/modules/users/user-routes.integration.test.ts',
];

export const manualScheduleIntegrationTestFiles = [
  'apps/api/src/modules/manual-schedules/templates.integration.test.ts',
  'apps/api/src/modules/manual-schedules/manual-apply.integration.test.ts',
];

export function findApiIntegrationEnvironmentIssues(environment) {
  const issues = [];
  const database = environment.TEST_MYSQL_DATABASE;
  const host = environment.TEST_MYSQL_HOST ?? '127.0.0.1';
  const password = environment.TEST_MYSQL_PASSWORD;
  const port = Number(environment.TEST_MYSQL_PORT ?? '3307');
  const user = environment.TEST_MYSQL_USER;

  if (database !== testDatabaseName)
    issues.push(`TEST_MYSQL_DATABASE must equal ${testDatabaseName}`);
  if (typeof user !== 'string' || user.length === 0) issues.push('TEST_MYSQL_USER must be set');
  if (typeof password !== 'string' || password.length === 0)
    issues.push('TEST_MYSQL_PASSWORD must be set');
  if (!localTestHosts.has(host))
    issues.push('TEST_MYSQL_HOST must be local (127.0.0.1, ::1, or localhost)');
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    issues.push('TEST_MYSQL_PORT must be an integer between 1 and 65535');

  return issues;
}

export function runApiIntegrationTests({
  environment = process.env,
  spawn = spawnSync,
  testFiles = workflowIntegrationTestFiles,
} = {}) {
  const issues = findApiIntegrationEnvironmentIssues(environment);
  if (issues.length > 0) {
    console.error('[api-integration] refused to run');
    for (const issue of issues) console.error(`- ${issue}`);
    return 1;
  }

  const result = spawn(process.execPath, [vitestEntrypoint, 'run', ...testFiles], {
    cwd: repositoryRoot,
    env: { ...environment, NODE_ENV: 'test' },
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    console.error('[api-integration] could not start Vitest');
    return 1;
  }

  return typeof result.status === 'number' ? result.status : 1;
}

export function runWorkflowIntegrationTests(options = {}) {
  return runApiIntegrationTests({ ...options, testFiles: workflowIntegrationTestFiles });
}

export function runTask10IntegrationTests(options = {}) {
  return runApiIntegrationTests({ ...options, testFiles: task10IntegrationTestFiles });
}

export function runManualScheduleIntegrationTests(options = {}) {
  return runApiIntegrationTests({ ...options, testFiles: manualScheduleIntegrationTestFiles });
}

const invokedUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedUrl === import.meta.url) process.exitCode = runWorkflowIntegrationTests();
