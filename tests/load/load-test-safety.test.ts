import { describe, expect, it } from 'vitest';
import { assertLoadTestIdentity, requireLoadTestDatabaseOptions } from './load-test-safety.js';
const valid = {
  NODE_ENV: 'test',
  TEST_MYSQL_HOST: '127.0.0.1',
  TEST_MYSQL_PORT: '3318',
  TEST_MYSQL_DATABASE: 'schedule_load_test',
  TEST_MYSQL_USER: 'schedule_load_test',
  TEST_MYSQL_PASSWORD: 'synthetic',
  LOAD_TEST_EXTERNAL_MESSAGES: 'disabled',
};
describe('destructive load-test guard', () => {
  it.each([
    { TEST_MYSQL_HOST: '10.0.0.1' },
    { TEST_MYSQL_HOST: 'production.example' },
    { TEST_MYSQL_DATABASE: 'schedule' },
    { TEST_MYSQL_DATABASE: 'schedule_test' },
    { TEST_MYSQL_USER: 'root' },
    { NODE_ENV: 'production' },
    { TEST_MYSQL_PORT: '0' },
    { LOAD_TEST_EXTERNAL_MESSAGES: 'enabled' },
    { WECHAT_APPSECRET: 'synthetic-real-key' },
    { WEB_PUSH_VAPID_PRIVATE_KEY: 'synthetic-real-key' },
  ])('rejects an unsafe target before connecting: %j', (patch) => {
    expect(() => requireLoadTestDatabaseOptions({ ...valid, ...patch })).toThrow();
  });
  it('requires independently provisioned database and marker identities', () => {
    expect(() => assertLoadTestIdentity('schedule_load_test', undefined)).toThrow();
    expect(() => assertLoadTestIdentity('schedule', 'schedule-synthetic-load-v1')).toThrow();
    expect(() =>
      assertLoadTestIdentity('schedule_load_test', 'schedule-synthetic-load-v1'),
    ).not.toThrow();
    expect(requireLoadTestDatabaseOptions(valid).database).toBe('schedule_load_test');
  });
});
