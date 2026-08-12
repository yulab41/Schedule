import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  findApiIntegrationEnvironmentIssues,
  runTask10IntegrationTests,
  runWorkflowIntegrationTests,
  task10IntegrationTestFiles,
  workflowIntegrationTestFiles,
} from './run-api-integration.mjs';

const safeEnvironment = {
  TEST_MYSQL_DATABASE: 'schedule_test',
  TEST_MYSQL_HOST: '127.0.0.1',
  TEST_MYSQL_PASSWORD: 'test-password',
  TEST_MYSQL_PORT: '3307',
  TEST_MYSQL_USER: 'schedule_test_app',
};

describe('API integration test runtime guard', () => {
  it('rejects missing, unsafe, remote, and malformed test database configuration', () => {
    expect(findApiIntegrationEnvironmentIssues({})).toEqual([
      'TEST_MYSQL_DATABASE must equal schedule_test',
      'TEST_MYSQL_USER must be set',
      'TEST_MYSQL_PASSWORD must be set',
    ]);
    expect(
      findApiIntegrationEnvironmentIssues({
        ...safeEnvironment,
        TEST_MYSQL_DATABASE: 'schedule_dev',
        TEST_MYSQL_HOST: 'mysql.example.test',
        TEST_MYSQL_PORT: '0',
      }),
    ).toEqual([
      'TEST_MYSQL_DATABASE must equal schedule_test',
      'TEST_MYSQL_HOST must be local (127.0.0.1, ::1, or localhost)',
      'TEST_MYSQL_PORT must be an integer between 1 and 65535',
    ]);
  });

  it('accepts the isolated local test database contract', () => {
    expect(findApiIntegrationEnvironmentIssues(safeEnvironment)).toEqual([]);
  });

  it('limits the command to the three workflow integration suites', () => {
    expect(workflowIntegrationTestFiles).toEqual([
      'apps/api/src/modules/leaves/leaves.integration.test.ts',
      'apps/api/src/modules/swaps/swaps.integration.test.ts',
      'apps/api/src/modules/duty-adjustments/duty-adjustments.integration.test.ts',
    ]);
  });

  it('keeps the Task 10 command on an explicit security integration allowlist', () => {
    expect(task10IntegrationTestFiles).toEqual([
      'apps/api/src/modules/calendar/calendar.integration.test.ts',
      'apps/api/src/modules/calendar/visitor-access.integration.test.ts',
      'apps/api/src/modules/groups/group-routes.integration.test.ts',
      'apps/api/src/modules/groups/group-permissions.integration.test.ts',
      'apps/api/src/modules/groups/membership-claims.integration.test.ts',
      'apps/api/src/modules/groups/invite-service.integration.test.ts',
      'apps/api/src/modules/notifications/notifications.integration.test.ts',
      'apps/api/src/modules/wechat/wechat-notifications.integration.test.ts',
      'apps/api/src/modules/users/user-routes.integration.test.ts',
    ]);
  });

  it('starts the local Vitest entrypoint with a child-only test environment and propagates exit status', () => {
    const spawn = vi.fn(() => ({ status: 7 }));

    expect(runWorkflowIntegrationTests({ environment: safeEnvironment, spawn })).toBe(7);
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
        'run',
        ...workflowIntegrationTestFiles,
      ],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...safeEnvironment, NODE_ENV: 'test' },
        stdio: 'inherit',
      },
    );
  });

  it('starts Task 10 only with its fixed allowlist', () => {
    const spawn = vi.fn(() => ({ status: 0 }));

    expect(runTask10IntegrationTests({ environment: safeEnvironment, spawn })).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
        'run',
        ...task10IntegrationTestFiles,
      ],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...safeEnvironment, NODE_ENV: 'test' },
        stdio: 'inherit',
      },
    );
  });

  it('does not start Vitest when the safety guard rejects configuration', () => {
    const spawn = vi.fn();

    expect(
      runWorkflowIntegrationTests({
        environment: { ...safeEnvironment, TEST_MYSQL_DATABASE: 'schedule_dev' },
        spawn,
      }),
    ).toBe(1);
    expect(spawn).not.toHaveBeenCalled();
  });
});
