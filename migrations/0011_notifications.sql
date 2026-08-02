CREATE TABLE `notifications` (
  `id` CHAR(36) NOT NULL,
  `recipient_user_id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NULL,
  `notification_type` VARCHAR(64) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `body` VARCHAR(500) NOT NULL,
  `object_type` VARCHAR(64) NULL,
  `object_id` CHAR(36) NULL,
  `schedule_event_id` CHAR(36) NULL,
  `shift_assignment_id` CHAR(36) NULL,
  `payload` JSON NULL,
  `is_read` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `read_at` TIMESTAMP(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_recipient_created_idx` (`recipient_user_id`, `created_at`, `id`),
  KEY `notifications_recipient_unread_idx` (`recipient_user_id`, `is_read`, `created_at`),
  KEY `notifications_group_idx` (`group_id`),
  KEY `notifications_event_idx` (`schedule_event_id`),
  CONSTRAINT `notifications_recipient_user_id_fk`
    FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `notifications_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `notifications_schedule_event_id_fk`
    FOREIGN KEY (`schedule_event_id`) REFERENCES `schedule_events` (`id`),
  CONSTRAINT `notifications_shift_assignment_id_fk`
    FOREIGN KEY (`shift_assignment_id`) REFERENCES `shift_assignments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
  `id` CHAR(36) NOT NULL,
  `notification_id` CHAR(36) NOT NULL,
  `channel` ENUM('browser') NOT NULL DEFAULT 'browser',
  `status` ENUM('pending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
  `attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts` INT UNSIGNED NOT NULL DEFAULT 3,
  `next_attempt_at` TIMESTAMP(3) NULL,
  `last_error` VARCHAR(500) NULL,
  `sent_at` TIMESTAMP(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_deliveries_notification_channel_unique` (`notification_id`, `channel`),
  KEY `notification_deliveries_retry_idx` (`status`, `next_attempt_at`),
  CONSTRAINT `notification_deliveries_notification_id_fk`
    FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `notification_settings` (
  `group_id` CHAR(36) NOT NULL,
  `duty_reminder_hours` JSON NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`group_id`),
  CONSTRAINT `notification_settings_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
  `id` CHAR(36) NOT NULL,
  `membership_id` CHAR(36) NOT NULL,
  `duty_reminder_hours` JSON NULL,
  `browser_notifications_enabled` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_preferences_membership_unique` (`membership_id`),
  CONSTRAINT `notification_preferences_membership_id_fk`
    FOREIGN KEY (`membership_id`) REFERENCES `group_memberships` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `web_push_subscriptions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `endpoint` VARCHAR(1000) NOT NULL,
  `p256dh` VARCHAR(256) NOT NULL,
  `auth` VARCHAR(256) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `web_push_subscriptions_user_endpoint_unique` (`user_id`, `endpoint`(191)),
  CONSTRAINT `web_push_subscriptions_user_id_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `notification_batches` (
  `id` CHAR(36) NOT NULL,
  `batch_key` VARCHAR(191) NOT NULL,
  `job_type` VARCHAR(64) NOT NULL,
  `processed_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_batches_batch_key_unique` (`batch_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
