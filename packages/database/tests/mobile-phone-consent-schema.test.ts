import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { groupMemberContacts } from '../src/index.js';

const migrationUrl = new URL(
  '../../../migrations/0049_mobile_phone_consent_evidence.sql',
  import.meta.url,
);
const journal = readFileSync(
  new URL('../../../migrations/meta/_journal.json', import.meta.url),
  'utf8',
);

describe('P5 mobile phone consent evidence schema', () => {
  it('registers an additive migration without granting consent to existing contacts', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    expect(journal).toContain('0049_mobile_phone_consent_evidence');
    expect(migration).toContain('ADD COLUMN `mobile_phone_consent_fingerprint` CHAR(64) NULL');
    expect(migration).toContain(
      'ADD COLUMN `mobile_phone_consent_notice_version` VARCHAR(32) NULL',
    );
    expect(migration).toContain('ADD COLUMN `mobile_phone_consented_at` TIMESTAMP(3) NULL');
    expect(migration).toContain('ADD COLUMN `mobile_phone_consent_revoked_at` TIMESTAMP(3) NULL');
    expect(migration).not.toMatch(/\b(?:INSERT|UPDATE)\b/iu);
  });

  it('maps all four nullable consent evidence columns in Drizzle', () => {
    expect(groupMemberContacts.mobilePhoneConsentFingerprint.getSQLType()).toBe('char(64)');
    expect(groupMemberContacts.mobilePhoneConsentNoticeVersion.getSQLType()).toBe('varchar(32)');
    expect(groupMemberContacts.mobilePhoneConsentedAt.getSQLType()).toBe('timestamp(3)');
    expect(groupMemberContacts.mobilePhoneConsentRevokedAt.getSQLType()).toBe('timestamp(3)');

    expect(groupMemberContacts.mobilePhoneConsentFingerprint.notNull).toBe(false);
    expect(groupMemberContacts.mobilePhoneConsentNoticeVersion.notNull).toBe(false);
    expect(groupMemberContacts.mobilePhoneConsentedAt.notNull).toBe(false);
    expect(groupMemberContacts.mobilePhoneConsentRevokedAt.notNull).toBe(false);
  });
});
