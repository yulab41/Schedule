-- P5 records current mobile-phone consent evidence on the group-scoped contact row.
-- Existing contacts are deliberately not granted consent by this additive migration.
ALTER TABLE `group_member_contacts`
  ADD COLUMN `mobile_phone_consent_fingerprint` CHAR(64) NULL,
  ADD COLUMN `mobile_phone_consent_notice_version` VARCHAR(32) NULL,
  ADD COLUMN `mobile_phone_consented_at` TIMESTAMP(3) NULL,
  ADD COLUMN `mobile_phone_consent_revoked_at` TIMESTAMP(3) NULL;
