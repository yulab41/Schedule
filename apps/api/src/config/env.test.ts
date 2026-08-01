import { describe, expect, it } from 'vitest';

import { EnvironmentValidationError, loadEnvironment } from './env.js';

const validEnvironment = {
  MYSQL_DATABASE: 'schedule_dev',
  MYSQL_USER: 'schedule_app',
  MYSQL_PASSWORD: 'local-only-password',
};

describe('loadEnvironment', () => {
  it('uses local defaults for optional network settings', () => {
    expect(loadEnvironment(validEnvironment)).toMatchObject({
      API_HOST: '127.0.0.1',
      API_PORT: 3000,
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: 3306,
      NODE_ENV: 'development',
    });
  });

  it('maps test database settings without falling back to development values', () => {
    expect(
      loadEnvironment({
        NODE_ENV: 'test',
        TEST_MYSQL_DATABASE: 'schedule_test',
        TEST_MYSQL_USER: 'schedule_test_app',
        TEST_MYSQL_PASSWORD: 'test-only-password',
      }),
    ).toMatchObject({
      MYSQL_DATABASE: 'schedule_test',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: 3307,
      MYSQL_USER: 'schedule_test_app',
      NODE_ENV: 'test',
    });
  });

  it('stops startup with a named error when a required database value is missing', () => {
    expect(() =>
      loadEnvironment({
        ...validEnvironment,
        MYSQL_PASSWORD: undefined,
      }),
    ).toThrow(EnvironmentValidationError);
    expect(() =>
      loadEnvironment({
        ...validEnvironment,
        MYSQL_PASSWORD: undefined,
      }),
    ).toThrow(/MYSQL_PASSWORD/);
  });

  it('rejects invalid port values without including secret values in the error', () => {
    expect(() =>
      loadEnvironment({
        ...validEnvironment,
        API_PORT: 'not-a-port',
      }),
    ).toThrow(/API_PORT/);
  });

  it('requires test-specific database credentials in test mode', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'test',
        TEST_MYSQL_DATABASE: 'schedule_test',
        TEST_MYSQL_USER: 'schedule_test_app',
        TEST_MYSQL_PASSWORD: undefined,
      }),
    ).toThrow(/TEST_MYSQL_PASSWORD/);
  });
});
