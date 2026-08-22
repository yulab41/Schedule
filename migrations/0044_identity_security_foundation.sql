-- P3-A is deliberately additive. Validate the bounded locator backfill and
-- legacy UnionID shape before persistent DDL so a conflict fails closed.
CREATE TEMPORARY TABLE `_identity_foundation_validation` (
  `ok` TINYINT UNSIGNED NOT NULL,
  CONSTRAINT `identity_foundation_preflight_check` CHECK (`ok` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
INSERT INTO `_identity_foundation_validation` (`ok`)
SELECT 0
FROM (
  SELECT `target`.`id` AS `violation_key`
  FROM `users` AS `target`
  INNER JOIN `user_password_credentials`
    ON `user_password_credentials`.`user_id` = `target`.`id`
  INNER JOIN `users` AS `collision`
    ON `collision`.`cloudbase_uid` = CONCAT('password_', `target`.`id`)
   AND `collision`.`id` <> `target`.`id`
  WHERE `target`.`cloudbase_uid` IS NULL
    AND `target`.`status` = 'active'
    AND `target`.`deleted_at` IS NULL

  UNION ALL

  SELECT `user_id` AS `violation_key`
  FROM `user_auth_identities`
  WHERE `union_id` IS NOT NULL
  GROUP BY `user_id`
  HAVING COUNT(DISTINCT `union_id`) > 1

  UNION ALL

  SELECT `union_id` AS `violation_key`
  FROM `user_auth_identities`
  WHERE `union_id` IS NOT NULL
  GROUP BY `union_id`
  HAVING COUNT(DISTINCT `user_id`) > 1
) AS `identity_foundation_violations`
LIMIT 1;
--> statement-breakpoint
DROP TEMPORARY TABLE `_identity_foundation_validation`;
--> statement-breakpoint

UPDATE `users`
INNER JOIN `user_password_credentials`
  ON `user_password_credentials`.`user_id` = `users`.`id`
SET `users`.`cloudbase_uid` = CONCAT('password_', `users`.`id`)
WHERE `users`.`cloudbase_uid` IS NULL
  AND `users`.`status` = 'active'
  AND `users`.`deleted_at` IS NULL;
--> statement-breakpoint

ALTER TABLE `users`
  ADD COLUMN `auth_version` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `is_developer_admin`;
--> statement-breakpoint

ALTER TABLE `user_password_credentials`
  MODIFY COLUMN `password_hash` VARCHAR(255) NULL;
--> statement-breakpoint

ALTER TABLE `user_auth_identities`
  ADD COLUMN `app_id` VARCHAR(64) NULL AFTER `provider`,
  ADD KEY `user_auth_identities_provider_app_subject_idx` (`provider`, `app_id`, `subject`);
--> statement-breakpoint

CREATE TABLE `wechat_union_accounts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `union_id` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `wechat_union_accounts_union_id_unique` (`union_id`),
  UNIQUE KEY `wechat_union_accounts_user_id_unique` (`user_id`),
  CONSTRAINT `wechat_union_accounts_user_id_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint

INSERT INTO `wechat_union_accounts` (`id`, `user_id`, `union_id`)
SELECT UUID(), `user_id`, `union_id`
FROM `user_auth_identities`
WHERE `union_id` IS NOT NULL;
