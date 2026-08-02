CREATE TABLE `export_jobs` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `requested_by_user_id` CHAR(36) NOT NULL,
  `export_type` ENUM('schedule', 'statistics') NOT NULL,
  `period_type` ENUM('month', 'year') NOT NULL,
  `period` VARCHAR(7) NOT NULL,
  `schedule_role_id` CHAR(36) NULL,
  `membership_id` CHAR(36) NULL,
  `status` ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `file_content` LONGTEXT NULL,
  `row_count` INT UNSIGNED NULL,
  `error` VARCHAR(500) NULL,
  `expires_at` TIMESTAMP(3) NULL,
  `downloaded_at` TIMESTAMP(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `started_at` TIMESTAMP(3) NULL,
  `completed_at` TIMESTAMP(3) NULL,
  PRIMARY KEY (`id`),
  KEY `export_jobs_group_created_idx` (`group_id`, `created_at`),
  KEY `export_jobs_status_created_idx` (`status`, `created_at`),
  CONSTRAINT `export_jobs_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `export_jobs_requested_by_user_id_fk`
    FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `export_jobs_schedule_role_id_fk`
    FOREIGN KEY (`schedule_role_id`) REFERENCES `schedule_roles` (`id`),
  CONSTRAINT `export_jobs_membership_id_fk`
    FOREIGN KEY (`membership_id`) REFERENCES `group_memberships` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
