ALTER TABLE `users`
  ADD COLUMN `short_phone` varchar(32) NULL,
  ADD COLUMN `short_phone_updated_at` timestamp(3) NULL;
--> statement-breakpoint
UPDATE `users` u JOIN (
  SELECT user_id, short_phone, updated_at FROM (
    SELECT m.user_id, TRIM(c.short_phone) AS short_phone, c.updated_at,
      ROW_NUMBER() OVER (PARTITION BY m.user_id ORDER BY c.updated_at DESC, c.id ASC) AS selection_rank
    FROM group_member_contacts c JOIN group_memberships m ON m.id = c.membership_id
    WHERE c.deleted_at IS NULL AND m.deleted_at IS NULL AND NULLIF(TRIM(c.short_phone), '') IS NOT NULL
  ) ranked WHERE selection_rank = 1
) chosen ON chosen.user_id = u.id
SET u.short_phone = chosen.short_phone,
  u.short_phone_updated_at = chosen.updated_at,
  u.updated_at = u.updated_at
WHERE u.deleted_at IS NULL;
--> statement-breakpoint
UPDATE group_member_contacts c
JOIN group_memberships m ON m.id = c.membership_id
JOIN users u ON u.id = m.user_id
SET c.version = c.version + IF(c.short_phone <=> u.short_phone, 0, 1),
  c.is_confirmed = IF(c.short_phone <=> u.short_phone, c.is_confirmed, 0),
  c.short_phone = u.short_phone,
  c.updated_at = c.updated_at
WHERE c.deleted_at IS NULL AND m.deleted_at IS NULL AND u.deleted_at IS NULL;
--> statement-breakpoint
ALTER TABLE `visitor_access_logs`
  ADD COLUMN `wechat_openid` varchar(64) NULL AFTER `business_month`,
  ADD COLUMN `client_context_version` tinyint unsigned NULL AFTER `wechat_openid`,
  ADD COLUMN `client_context` json NULL AFTER `client_context_version`;
--> statement-breakpoint
ALTER TABLE `group_member_contacts`
  DROP COLUMN `short_phone`;
--> statement-breakpoint
DROP TABLE `invite_tokens`;
--> statement-breakpoint
DROP TABLE `group_code_attempts`;
--> statement-breakpoint
ALTER TABLE `groups`
  DROP INDEX `groups_group_code_unique`,
  DROP COLUMN `group_code`;
