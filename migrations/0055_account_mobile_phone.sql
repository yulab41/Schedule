ALTER TABLE `users` ADD COLUMN `mobile_phone` varchar(32) NULL, ADD COLUMN `mobile_phone_updated_at` timestamp(3) NULL;
--> statement-breakpoint
ALTER TABLE `group_member_contacts` ADD COLUMN `mobile_phone_before_account_sync` varchar(32) NULL;
--> statement-breakpoint
UPDATE `group_member_contacts` SET `mobile_phone_before_account_sync` = `mobile_phone`, `updated_at` = `updated_at`;
--> statement-breakpoint
UPDATE `users` u JOIN (
  SELECT user_id, mobile_phone, updated_at FROM (
    SELECT m.user_id, REGEXP_REPLACE(TRIM(c.mobile_phone), '[ ()-]', '') AS mobile_phone, c.updated_at,
      ROW_NUMBER() OVER (PARTITION BY m.user_id ORDER BY c.updated_at DESC, c.id ASC) AS selection_rank
    FROM group_member_contacts c JOIN group_memberships m ON m.id = c.membership_id
    WHERE c.deleted_at IS NULL AND m.deleted_at IS NULL AND NULLIF(TRIM(c.mobile_phone), '') IS NOT NULL
  ) ranked WHERE selection_rank = 1
) chosen ON chosen.user_id = u.id
SET u.mobile_phone = chosen.mobile_phone, u.mobile_phone_updated_at = chosen.updated_at, u.updated_at = u.updated_at
WHERE u.deleted_at IS NULL;
--> statement-breakpoint
UPDATE group_member_contacts c JOIN group_memberships m ON m.id = c.membership_id JOIN users u ON u.id = m.user_id
SET c.version = c.version + IF(c.mobile_phone <=> u.mobile_phone, 0, 1), c.mobile_phone = u.mobile_phone, c.updated_at = c.updated_at
WHERE c.deleted_at IS NULL AND m.deleted_at IS NULL AND u.deleted_at IS NULL;
