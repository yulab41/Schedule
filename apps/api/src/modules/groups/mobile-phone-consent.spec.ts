import { describe, expect, it } from 'vitest';

import { GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION } from '@schedule/contracts';

import {
  createMobilePhoneConsentFingerprint,
  isMobilePhoneConsentEffective,
  maskMobilePhone,
} from './mobile-phone-consent.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const mobilePhone = '13800008000';

describe('mobile phone consent privacy primitives', () => {
  it('treats a never-configured phone as visible and only an explicit revocation as hidden', () => {
    const defaultVisible = {
      mobilePhone: '13800138000',
      mobilePhoneConsentFingerprint: null,
      mobilePhoneConsentNoticeVersion: null,
      mobilePhoneConsentRevokedAt: null,
      mobilePhoneConsentedAt: null,
    };
    const explicitlyHidden = {
      ...defaultVisible,
      mobilePhoneConsentRevokedAt: new Date('2026-08-24T00:00:00.000Z'),
    };

    expect(isMobilePhoneConsentEffective(groupId, membershipId, defaultVisible)).toBe(true);
    expect(isMobilePhoneConsentEffective(groupId, membershipId, explicitlyHidden)).toBe(false);
  });
  it('binds fingerprints to the group, membership, and normalized current number', () => {
    const fingerprint = createMobilePhoneConsentFingerprint(groupId, membershipId, mobilePhone);

    expect(fingerprint).toMatch(/^[a-f\d]{64}$/u);
    expect(createMobilePhoneConsentFingerprint(groupId, membershipId, ` ${mobilePhone} `)).toBe(
      fingerprint,
    );
    expect(createMobilePhoneConsentFingerprint(groupId, membershipId, '138 0000-8000')).toBe(
      fingerprint,
    );
    expect(
      createMobilePhoneConsentFingerprint(
        '33333333-3333-4333-8333-333333333333',
        membershipId,
        mobilePhone,
      ),
    ).not.toBe(fingerprint);
    expect(
      createMobilePhoneConsentFingerprint(
        groupId,
        '44444444-4444-4444-8444-444444444444',
        mobilePhone,
      ),
    ).not.toBe(fingerprint);
    expect(createMobilePhoneConsentFingerprint(groupId, membershipId, '13900008000')).not.toBe(
      fingerprint,
    );
  });

  it('keeps legacy evidence visible and only hides an explicit fingerprint-clearing revocation', () => {
    const fingerprint = createMobilePhoneConsentFingerprint(groupId, membershipId, mobilePhone);
    const valid = {
      mobilePhone,
      mobilePhoneConsentFingerprint: fingerprint,
      mobilePhoneConsentNoticeVersion: GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
      mobilePhoneConsentRevokedAt: null,
      mobilePhoneConsentedAt: new Date(),
    };

    expect(isMobilePhoneConsentEffective(groupId, membershipId, valid)).toBe(true);
    expect(
      isMobilePhoneConsentEffective(groupId, membershipId, {
        ...valid,
        mobilePhoneConsentedAt: null,
      }),
    ).toBe(true);
    expect(
      isMobilePhoneConsentEffective(groupId, membershipId, {
        ...valid,
        mobilePhoneConsentNoticeVersion: 'v0',
      }),
    ).toBe(true);
    expect(
      isMobilePhoneConsentEffective(groupId, membershipId, {
        ...valid,
        mobilePhoneConsentRevokedAt: new Date(),
      }),
    ).toBe(true);
    expect(
      isMobilePhoneConsentEffective(groupId, membershipId, {
        ...valid,
        mobilePhone: '13900008000',
      }),
    ).toBe(true);
    expect(
      isMobilePhoneConsentEffective(groupId, membershipId, {
        ...valid,
        mobilePhoneConsentFingerprint: null,
        mobilePhoneConsentRevokedAt: new Date(),
      }),
    ).toBe(false);
  });

  it('masks short and eleven-digit numbers without returning the raw value', () => {
    expect(maskMobilePhone('12345')).toBe('1***5');
    expect(maskMobilePhone(mobilePhone)).toBe('138 **** 8000');
  });
});
