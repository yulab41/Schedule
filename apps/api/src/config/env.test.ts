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
      AUTH_DEV_MODE: 'false',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: 3306,
      NODE_ENV: 'development',
      WECHAT_MOCK_MODE: 'false',
      WECHAT_QR_ENV_VERSION: 'release',
    });
    expect(loadEnvironment(validEnvironment).WECHAT_APPID).toBeUndefined();
  });

  it('validates the development auth switch as a strict boolean string', () => {
    expect(loadEnvironment({ ...validEnvironment, AUTH_DEV_MODE: 'true' })).toMatchObject({
      AUTH_DEV_MODE: 'true',
    });
    expect(() => loadEnvironment({ ...validEnvironment, AUTH_DEV_MODE: 'yes' })).toThrow(
      /AUTH_DEV_MODE/,
    );
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

  it('accepts WeChat mock mode in development but forbids it in production', () => {
    expect(loadEnvironment({ ...validEnvironment, WECHAT_MOCK_MODE: 'true' })).toMatchObject({
      WECHAT_MOCK_MODE: 'true',
    });
    expect(
      loadEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        WECHAT_MOCK_MODE: 'false',
      }),
    ).toMatchObject({ WECHAT_MOCK_MODE: 'false' });
    expect(() =>
      loadEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        WECHAT_MOCK_MODE: 'true',
      }),
    ).toThrow(/WECHAT_MOCK_MODE/);
  });

  it('validates the WeChat QR environment version', () => {
    expect(
      loadEnvironment({ ...validEnvironment, WECHAT_QR_ENV_VERSION: 'develop' }),
    ).toMatchObject({ WECHAT_QR_ENV_VERSION: 'develop' });
    expect(() =>
      loadEnvironment({ ...validEnvironment, WECHAT_QR_ENV_VERSION: 'staging' }),
    ).toThrow(/WECHAT_QR_ENV_VERSION/);
  });

  it('keeps WeChat credentials and template ids optional outside production', () => {
    expect(
      loadEnvironment({
        ...validEnvironment,
        WECHAT_APPID: 'wx-test',
        WECHAT_APPSECRET: 'secret-test',
        WECHAT_DUTY_REMINDER_TEMPLATE_ID: 'template-1',
      }),
    ).toMatchObject({
      WECHAT_APPID: 'wx-test',
      WECHAT_APPSECRET: 'secret-test',
      WECHAT_DUTY_REMINDER_TEMPLATE_ID: 'template-1',
    });
  });

  it('treats empty optional WeChat values as unset (compose defaults)', () => {
    const environment = loadEnvironment({
      ...validEnvironment,
      WECHAT_APPID: '',
      WECHAT_APPSECRET: '   ',
      WECHAT_SESSION_SECRET: '',
      WECHAT_DUTY_REMINDER_TEMPLATE_ID: '',
      WECHAT_APPROVAL_RESULT_TEMPLATE_ID: '',
      WECHAT_STATUS_CHANGE_TEMPLATE_ID: '',
    });
    expect(environment.WECHAT_APPID).toBeUndefined();
    expect(environment.WECHAT_APPSECRET).toBeUndefined();
    expect(environment.WECHAT_SESSION_SECRET).toBeUndefined();
    expect(environment.WECHAT_DUTY_REMINDER_TEMPLATE_ID).toBeUndefined();
    expect(environment.WECHAT_APPROVAL_RESULT_TEMPLATE_ID).toBeUndefined();
    expect(environment.WECHAT_STATUS_CHANGE_TEMPLATE_ID).toBeUndefined();
  });

  it('applies WeChat defaults in test mode too', () => {
    expect(
      loadEnvironment({
        NODE_ENV: 'test',
        TEST_MYSQL_DATABASE: 'schedule_test',
        TEST_MYSQL_USER: 'schedule_test_app',
        TEST_MYSQL_PASSWORD: 'test-only-password',
      }),
    ).toMatchObject({ WECHAT_MOCK_MODE: 'false', WECHAT_QR_ENV_VERSION: 'release' });
  });
});
