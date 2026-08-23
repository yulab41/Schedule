import { describe, expect, it } from 'vitest';

import { ClientCapabilityPolicy } from './client-capability-policy.js';

const LEGACY_VERSION = '0.1.0-p6.20260824.78';
const CURRENT_VERSION = '0.1.0-p6.20260824.79';

describe('ClientCapabilityPolicy', () => {
  it('uses exact version matches and maps an unsigned legacy mini session explicitly', () => {
    const policy = new ClientCapabilityPolicy({
      capabilities: {
        core: true,
        externalMessages: false,
        global: true,
        guest: false,
        insights: false,
        organization: false,
        workflows: false,
      },
      legacyVersion: LEGACY_VERSION,
      supportedVersions: [LEGACY_VERSION, CURRENT_VERSION],
    });

    expect(policy.resolve('miniprogram', CURRENT_VERSION)).toEqual({
      core: true,
      externalMessages: false,
      global: true,
      guest: false,
      insights: false,
      organization: false,
      platform: 'miniprogram',
      version: CURRENT_VERSION,
      workflows: false,
    });
    expect(policy.resolve('miniprogram', `${CURRENT_VERSION}.1`)).toBeUndefined();
    expect(policy.resolveLegacyMini()).toMatchObject({
      platform: 'miniprogram',
      version: LEGACY_VERSION,
    });
  });

  it('returns only effective false values when the global kill switch is off', () => {
    const policy = new ClientCapabilityPolicy({
      capabilities: {
        core: true,
        externalMessages: true,
        global: false,
        guest: true,
        insights: true,
        organization: true,
        workflows: true,
      },
      legacyVersion: LEGACY_VERSION,
      supportedVersions: [LEGACY_VERSION, CURRENT_VERSION],
    });

    expect(policy.resolve('miniprogram', CURRENT_VERSION)).toEqual({
      core: false,
      externalMessages: false,
      global: false,
      guest: false,
      insights: false,
      organization: false,
      platform: 'miniprogram',
      version: CURRENT_VERSION,
      workflows: false,
    });
  });

  it('fails construction when legacy is not an exact supported version', () => {
    expect(
      () =>
        new ClientCapabilityPolicy({
          capabilities: {
            core: false,
            externalMessages: false,
            global: false,
            guest: false,
            insights: false,
            organization: false,
            workflows: false,
          },
          legacyVersion: LEGACY_VERSION,
          supportedVersions: [CURRENT_VERSION],
        }),
    ).toThrow(/legacy/i);
  });
});
