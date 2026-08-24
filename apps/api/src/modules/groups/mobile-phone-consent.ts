import { createHash } from 'node:crypto';

export interface MobilePhoneConsentFields {
  readonly mobilePhone: string | null;
  readonly mobilePhoneConsentFingerprint: string | null;
  readonly mobilePhoneConsentNoticeVersion: string | null;
  readonly mobilePhoneConsentRevokedAt: Date | null;
  readonly mobilePhoneConsentedAt: Date | null;
}

export function createMobilePhoneConsentFingerprint(
  groupId: string,
  membershipId: string,
  mobilePhone: string,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        groupId,
        membershipId,
        mobilePhone: normalizeMobilePhone(mobilePhone),
      }),
    )
    .digest('hex');
}

export function isMobilePhoneConsentEffective(
  groupId: string,
  membershipId: string,
  contact: MobilePhoneConsentFields,
): boolean {
  void groupId;
  void membershipId;
  const explicitlyRevoked =
    contact.mobilePhoneConsentFingerprint === null && contact.mobilePhoneConsentRevokedAt !== null;
  return contact.mobilePhone !== null && !explicitlyRevoked;
}

export function maskMobilePhone(mobilePhone: string): string {
  const normalized = normalizeMobilePhone(mobilePhone);
  if (normalized.length <= 7) {
    return `${normalized.slice(0, 1)}${'*'.repeat(Math.max(1, normalized.length - 2))}${normalized.slice(-1)}`;
  }
  return `${normalized.slice(0, 3)} **** ${normalized.slice(-4)}`;
}

function normalizeMobilePhone(mobilePhone: string): string {
  return mobilePhone
    .normalize('NFKC')
    .trim()
    .replaceAll(/[\s()-]/gu, '');
}
