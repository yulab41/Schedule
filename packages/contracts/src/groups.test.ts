import { describe, expect, it } from 'vitest';

import {
  GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
  groupMobilePhoneConsentSchema,
  updateGroupMobilePhoneConsentRequestSchema,
  groupCatalogEntrySchema,
  groupCatalogRelationSchema,
  groupRoleSchema,
  updateGroupNameRequestSchema,
} from './groups.js';

describe('group membership contracts', () => {
  it('accepts guest in the role enum', () => {
    expect(groupRoleSchema.safeParse('guest').success).toBe(true);
  });

  it('rejects unknown catalog relations', () => {
    expect(groupCatalogRelationSchema.safeParse('banned').success).toBe(false);
  });

  it('rejects extra fields in catalog entries', () => {
    expect(
      groupCatalogEntrySchema.safeParse({
        id: 'g1',
        name: '内科',
        relation: 'none',
        groupCode: '1234',
      }).success,
    ).toBe(false);
  });

  it('rejects empty group names in update requests', () => {
    expect(updateGroupNameRequestSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it('defines strict mobile-phone consent states and the current notice version', () => {
    expect(GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION).toBe('v1');
    expect(
      groupMobilePhoneConsentSchema.safeParse({
        contactVersion: 2,
        groupId: '11111111-1111-4111-8111-111111111111',
        maskedMobilePhone: '138 **** 8000',
        membershipId: '22222222-2222-4222-8222-222222222222',
        noticeVersion: 'v1',
        state: 'consented',
        consentedAt: '2026-08-24T01:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      groupMobilePhoneConsentSchema.safeParse({
        contactVersion: 0,
        groupId: '11111111-1111-4111-8111-111111111111',
        membershipId: '22222222-2222-4222-8222-222222222222',
        noticeVersion: 'v1',
        state: 'missing-phone',
        phoneFingerprint: 'must-never-cross-the-contract',
      }).success,
    ).toBe(false);
  });

  it('accepts only strict version-bound consent updates', () => {
    const operationId = '33333333-3333-4333-8333-333333333333';
    expect(
      updateGroupMobilePhoneConsentRequestSchema.safeParse({
        consented: true,
        expectedContactVersion: 2,
        noticeVersion: 'v1',
        operationId,
      }).success,
    ).toBe(true);
    for (const invalid of [
      { consented: true, expectedContactVersion: -1, noticeVersion: 'v1' },
      { consented: true, expectedContactVersion: 1, noticeVersion: '' },
      {
        consented: true,
        expectedContactVersion: 1,
        membershipId: '22222222-2222-4222-8222-222222222222',
        noticeVersion: 'v1',
      },
    ]) {
      expect(updateGroupMobilePhoneConsentRequestSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
