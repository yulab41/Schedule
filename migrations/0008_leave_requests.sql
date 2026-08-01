ALTER TABLE `groups`
  ADD COLUMN `leave_reflow_strategy` ENUM('keep-original-order', 'shift-forward')
    NOT NULL DEFAULT 'keep-original-order' AFTER `schedule_publish_mode`;
--> statement-breakpoint
CREATE TABLE `leave_requests` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `membership_id` CHAR(36) NOT NULL,
  `leave_type` ENUM('training', 'rotation', 'sick', 'maternity', 'other') NOT NULL,
  `starts_at` TIMESTAMP(3) NOT NULL,
  `ends_at` TIMESTAMP(3) NOT NULL,
  `is_all_day` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `reason` VARCHAR(1000) NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `reflow_strategy` ENUM('keep-original-order', 'shift-forward') NOT NULL DEFAULT 'keep-original-order',
  `decided_at` TIMESTAMP(3) NULL,
  `approver_user_id` CHAR(36) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `leave_requests_group_status_idx` (`group_id`, `status`),
  KEY `leave_requests_membership_status_idx` (`membership_id`, `status`),
  CONSTRAINT `leave_requests_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `leave_requests_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `leave_requests_approver_user_id_fk` FOREIGN KEY (`approver_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `leave_requests_time_range_check` CHECK (`ends_at` > `starts_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
