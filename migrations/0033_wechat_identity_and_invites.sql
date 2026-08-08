ALTER TABLE `users`
  ADD COLUMN `wechat_openid` VARCHAR(64) NULL AFTER `cloudbase_uid`,
  ADD UNIQUE KEY `users_wechat_openid_unique` (`wechat_openid`);
--> statement-breakpoint
ALTER TABLE `groups`
  ADD COLUMN `visitor_key` VARCHAR(64) NULL AFTER `group_code`;
--> statement-breakpoint
UPDATE `groups`
  SET `visitor_key` = LOWER(REPLACE(UUID(), '-', ''))
  WHERE `visitor_key` IS NULL;
--> statement-breakpoint
ALTER TABLE `groups`
  MODIFY COLUMN `visitor_key` VARCHAR(64) NOT NULL,
  ADD UNIQUE KEY `groups_visitor_key_unique` (`visitor_key`);
--> statement-breakpoint
CREATE TABLE `invite_tokens` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `target_membership_id` CHAR(36) NULL,
  `target_roster_entry_id` CHAR(36) NULL,
  `invitee_real_name` VARCHAR(100) NOT NULL,
  `permission_role` ENUM('member', 'administrator') NOT NULL DEFAULT 'member',
  `schedule_role_id` CHAR(36) NULL,
  `created_by_user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` TIMESTAMP(3) NOT NULL,
  `used_by_user_id` CHAR(36) NULL,
  `used_at` TIMESTAMP(3) NULL,
  `status` ENUM('pending', 'used', 'revoked', 'expired') NOT NULL DEFAULT 'pending',
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invite_tokens_token_hash_unique` (`token_hash`),
  KEY `invite_tokens_group_status_idx` (`group_id`, `status`),
  KEY `invite_tokens_target_membership_idx` (`target_membership_id`),
  KEY `invite_tokens_target_roster_entry_idx` (`target_roster_entry_id`),
  KEY `invite_tokens_created_by_idx` (`created_by_user_id`),
  KEY `invite_tokens_expires_at_idx` (`expires_at`),
  CONSTRAINT `invite_tokens_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `invite_tokens_target_membership_id_fk`
    FOREIGN KEY (`target_membership_id`) REFERENCES `group_memberships` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invite_tokens_target_roster_entry_id_fk`
    FOREIGN KEY (`target_roster_entry_id`) REFERENCES `roster_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invite_tokens_created_by_user_id_fk`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `invite_tokens_used_by_user_id_fk`
    FOREIGN KEY (`used_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invite_tokens_target_exactly_one` CHECK (
    (`target_membership_id` IS NULL) <> (`target_roster_entry_id` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
