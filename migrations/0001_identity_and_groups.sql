CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `cloudbase_uid` VARCHAR(128) NOT NULL,
  `status` ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_cloudbase_uid_unique` (`cloudbase_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `user_profiles` (
  `user_id` CHAR(36) NOT NULL,
  `real_name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_profiles_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `groups` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `group_code` CHAR(4) NOT NULL,
  `owner_user_id` CHAR(36) NOT NULL,
  `rules_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `groups_group_code_unique` (`group_code`),
  KEY `groups_owner_user_id_idx` (`owner_user_id`),
  CONSTRAINT `groups_owner_user_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `roster_entries` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `real_name` VARCHAR(100) NOT NULL,
  `status` ENUM('pending', 'claimed', 'removed') NOT NULL DEFAULT 'pending',
  `claimed_by_user_id` CHAR(36) NULL,
  `pending_real_name` VARCHAR(100) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL AND `status` = 'pending', `real_name`, NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roster_entries_pending_name_unique` (`group_id`, `pending_real_name`),
  KEY `roster_entries_group_status_idx` (`group_id`, `status`),
  CONSTRAINT `roster_entries_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `roster_entries_claimed_by_user_id_fk` FOREIGN KEY (`claimed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `group_memberships` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('owner', 'administrator', 'member') NOT NULL DEFAULT 'member',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `auto_accept_swaps` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `active_user_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL AND `status` = 'active', `user_id`, NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_memberships_active_user_unique` (`group_id`, `active_user_id`),
  KEY `group_memberships_user_status_idx` (`user_id`, `status`),
  CONSTRAINT `group_memberships_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `group_memberships_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `group_member_contacts` (
  `id` CHAR(36) NOT NULL,
  `membership_id` CHAR(36) NOT NULL,
  `mobile_phone` VARCHAR(32) NULL,
  `short_phone` VARCHAR(32) NULL,
  `is_confirmed` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `active_membership_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL, `membership_id`, NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_member_contacts_active_membership_unique` (`active_membership_id`),
  CONSTRAINT `group_member_contacts_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `group_memberships` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
  `id` CHAR(36) NOT NULL,
  `actor_user_id` CHAR(36) NOT NULL,
  `scope` VARCHAR(64) NOT NULL,
  `operation_key` VARCHAR(128) NOT NULL,
  `request_fingerprint` CHAR(64) NOT NULL,
  `status` ENUM('processing', 'completed') NOT NULL DEFAULT 'processing',
  `completed_at` TIMESTAMP(3) NULL,
  `expires_at` TIMESTAMP(3) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idempotency_keys_actor_scope_operation_unique` (`actor_user_id`, `scope`, `operation_key`),
  KEY `idempotency_keys_expires_at_idx` (`expires_at`),
  CONSTRAINT `idempotency_keys_actor_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
