CREATE TABLE `group_code_attempts` (
  `user_id` CHAR(36) NOT NULL,
  `window_started_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `group_code_attempts_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `group_join_requests` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `requesting_user_id` CHAR(36) NOT NULL,
  `requested_real_name` VARCHAR(100) NOT NULL,
  `status` ENUM('pending', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
  `pending_request_key` VARCHAR(73) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL AND `status` = 'pending', CONCAT(`group_id`, ':', `requesting_user_id`), NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_join_requests_pending_request_unique` (`pending_request_key`),
  KEY `group_join_requests_group_status_idx` (`group_id`, `status`),
  KEY `group_join_requests_user_status_idx` (`requesting_user_id`, `status`),
  CONSTRAINT `group_join_requests_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `group_join_requests_requesting_user_id_fk` FOREIGN KEY (`requesting_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
