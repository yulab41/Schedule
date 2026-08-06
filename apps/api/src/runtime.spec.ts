import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './config/env.js';
import { isDevAuthEnabled } from './runtime.js';

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

  it('never enables dev auth outside development even with the switch on', () => {
    expect(
      isDevAuthEnabled(
        loadEnvironment({
          ...validEnvironment,
          NODE_ENV: 'production',
          AUTH_DEV_MODE: 'true',
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
