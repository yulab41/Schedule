ALTER TABLE `notifications`
  ADD COLUMN `list_hidden_at` timestamp(3) NULL,
  ADD INDEX `notifications_list_visible_idx` (`recipient_user_id`, `list_hidden_at`, `created_at`, `id`),
  ADD INDEX `notifications_unread_visible_idx` (`recipient_user_id`, `list_hidden_at`, `is_read`, `created_at`),
  ADD INDEX `notifications_expiry_idx` (`list_hidden_at`, `created_at`);
--> statement-breakpoint
UPDATE `notifications`
SET `list_hidden_at` = UTC_TIMESTAMP(3), `updated_at` = `updated_at`
WHERE `list_hidden_at` IS NULL
  AND `created_at` < DATE_SUB(DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 8 HOUR)), INTERVAL 30 DAY), INTERVAL 8 HOUR);
