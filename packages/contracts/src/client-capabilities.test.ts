import { describe, expect, it } from 'vitest';

import {
  CLIENT_CAPABILITY_NAMES,
  CLIENT_PLATFORM_HEADER_NAME,
  CLIENT_VERSION_HEADER_NAME,
  clientCapabilityQuerySchema,
  clientCapabilityResponseSchema,
  clientVersionSchema,
} from './client-capabilities.js';

const version = '0.1.0-p6.20260824.79';
const response = {
  core: true,
  externalMessages: false,
  global: true,
  guest: true,
  insights: false,
  organization: true,
  platform: 'miniprogram',
  version,
  workflows: true,
} as const;

describe('client capability contracts', () => {
  it('freezes the seven dimensions and schedule-prefixed request headers', () => {
    expect(CLIENT_CAPABILITY_NAMES).toEqual([
      'global',
      'core',
      'workflows',
      'organization',
      'insights',
      'externalMessages',
      'guest',
    ]);
    expect(CLIENT_PLATFORM_HEADER_NAME).toBe('x-schedule-client-platform');
    expect(CLIENT_VERSION_HEADER_NAME).toBe('x-schedule-client-version');
  });

  it('accepts bounded semver-like deployed versions and rejects malformed values', () => {
    for (const value of ['0.1.0', version, '12.34.56-rc.1+build.20260824', '999.999.999']) {
      expect(clientVersionSchema.safeParse(value).success).toBe(true);
    }

    for (const value of [
      '',
      '1.2',
      'v1.2.3',
      '01.2.3',
      '1.02.3',
      '1.2.03',
      '1.2.3-',
      '1.2.3 beta',
      `1.2.3-${'a'.repeat(64)}`,
    ]) {
      expect(clientVersionSchema.safeParse(value).success).toBe(false);
    }
  });

  it('requires only the supported platform and exact public query fields', () => {
    expect(clientCapabilityQuerySchema.parse({ platform: 'miniprogram', version })).toEqual({
      platform: 'miniprogram',
      version,
    });
    for (const value of [
      { platform: 'web', version },
      { platform: 'miniprogram' },
      { platform: 'miniprogram', version, extra: true },
    ]) {
      expect(clientCapabilityQuerySchema.safeParse(value).success).toBe(false);
    }
  });

  it('requires every boolean dimension and rejects every unknown response field', () => {
    expect(clientCapabilityResponseSchema.parse(response)).toEqual(response);
    const missingGuest: Record<string, unknown> = { ...response };
    delete missingGuest['guest'];
    expect(clientCapabilityResponseSchema.safeParse(missingGuest).success).toBe(false);
    expect(
      clientCapabilityResponseSchema.safeParse({ ...response, guest: 'enabled' }).success,
    ).toBe(false);
    expect(
      clientCapabilityResponseSchema.safeParse({ ...response, unexpected: true }).success,
    ).toBe(false);
    expect(clientCapabilityResponseSchema.safeParse({ ...response, platform: 'web' }).success).toBe(
      false,
    );
  });
});
