import type { DatabaseConnectionOptions } from '@schedule/database';

export const loadTestDatabaseName = 'schedule_load_test';
export const loadTestMarker = 'schedule-synthetic-load-v1';

export function requireLoadTestDatabaseOptions(
  values: NodeJS.ProcessEnv,
): DatabaseConnectionOptions {
  const host = values.TEST_MYSQL_HOST ?? '127.0.0.1';
  const port = Number(values.TEST_MYSQL_PORT);
  if (
    values.NODE_ENV !== 'test' ||
    !['127.0.0.1', '::1', 'localhost'].includes(host) ||
    values.TEST_MYSQL_DATABASE !== loadTestDatabaseName ||
    values.TEST_MYSQL_USER !== loadTestDatabaseName ||
    !values.TEST_MYSQL_PASSWORD ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    values.LOAD_TEST_EXTERNAL_MESSAGES !== 'disabled' ||
    values.WECHAT_APPSECRET ||
    values.VAPID_PRIVATE_KEY ||
    values.WEB_PUSH_VAPID_PRIVATE_KEY
  )
    throw new Error(
      'Load test requires NODE_ENV=test, a loopback schedule_load_test database/user, an explicit port and disabled external messages.',
    );
  return {
    host,
    port,
    database: loadTestDatabaseName,
    user: loadTestDatabaseName,
    password: values.TEST_MYSQL_PASSWORD,
  };
}

export function assertLoadTestIdentity(database: unknown, marker: unknown): void {
  if (database !== loadTestDatabaseName || marker !== loadTestMarker)
    throw new Error(
      'Refusing destructive reset: synthetic load database identity/marker mismatch.',
    );
}
