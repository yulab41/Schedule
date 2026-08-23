import type { GroupMobilePhoneConsent } from '@schedule/contracts';

export const groupMobilePhoneConsentGoldenResponse = {
  contactVersion: 3,
  groupId: '11111111-1111-4111-8111-111111111111',
  maskedMobilePhone: '138 **** 7926',
  membershipId: '22222222-2222-4222-8222-222222222222',
  noticeVersion: 'v1',
  state: 'not-consented',
} as const satisfies GroupMobilePhoneConsent;
