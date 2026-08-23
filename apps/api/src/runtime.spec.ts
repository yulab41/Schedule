import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './config/env.js';
import { createClientCapabilityPolicy, isDevAuthEnabled } from './runtime.js';

const validEnvironment = {
  MYSQL_DATABASE: 'schedule_dev',
  MYSQL_USER: 'schedule_app',
  MYSQL_PASSWORD: 'local-only-password',
};

describe('isDevAuthEnabled', () => {
  it('enables dev auth only in development with the explicit switch on', () => {
    expect(
      isDevAuthEnabled(
        loadEnvironment({
          ...validEnvironment,
          NODE_ENV: 'development',
          AUTH_DEV_MODE: 'true',
        }),
      ),
    ).toBe(true);
  });

  it('keeps dev auth off when the switch is off or missing', () => {
    expect(
      isDevAuthEnabled(loadEnvironment({ ...validEnvironment, NODE_ENV: 'development' })),
    ).toBe(false);
    expect(
      isDevAuthEnabled(
        loadEnvironment({
          ...validEnvironment,
          NODE_ENV: 'development',
          AUTH_DEV_MODE: 'false',
        }),
      ),
    ).toBe(false);
  });

  it('never enables dev auth outside development', () => {
    expect(
      isDevAuthEnabled(
        loadEnvironment({
          ...validEnvironment,
          NODE_ENV: 'production',
          AUTH_DEV_MODE: 'false',
          AUTH_PASSWORD_ENABLED: 'true',
          WECHAT_SESSION_SECRET: 's'.repeat(32),
        }),
      ),
    ).toBe(false);
    expect(
      isDevAuthEnabled(
        loadEnvironment({
          NODE_ENV: 'test',
          TEST_MYSQL_DATABASE: 'schedule_test',
          TEST_MYSQL_USER: 'schedule_test_app',
          TEST_MYSQL_PASSWORD: 'test-only-password',
          AUTH_DEV_MODE: 'true',
        }),
      ),
    ).toBe(false);
  });
});

describe('createClientCapabilityPolicy', () => {
  it('keeps the runtime deny-all with an empty allowlist by default', () => {
    const policy = createClientCapabilityPolicy(loadEnvironment(validEnvironment));
    expect(policy.resolve('miniprogram', '0.1.0-p6.20260824.79')).toBeUndefined();
    expect(policy.resolveLegacyMini()).toBeUndefined();
  });

  it('uses only explicitly configured exact versions and effective switches', () => {
    const policy = createClientCapabilityPolicy(
      loadEnvironment({
        ...validEnvironment,
        MINIPROGRAM_CAPABILITY_CORE_ENABLED: 'true',
        MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED: 'true',
        MINIPROGRAM_LEGACY_CLIENT_VERSION: '0.1.0-p6.20260824.78',
        MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS: '0.1.0-p6.20260824.78,0.1.0-p6.20260824.79',
      }),
    );
    expect(policy.resolveLegacyMini()).toMatchObject({ core: true, global: true });
    expect(policy.resolve('miniprogram', '0.1.0-p6.20260824.79')).toMatchObject({
      core: true,
      global: true,
      workflows: false,
    });
  });
});
