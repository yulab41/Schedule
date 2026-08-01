ALTER TABLE `groups`
  ADD COLUMN `swap_approval_required` TINYINT UNSIGNED NOT NULL DEFAULT 1
    AFTER `leave_reflow_strategy`;
--> statement-breakpoint
CREATE TABLE `swap_requests` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `initiator_membership_id` CHAR(36) NOT NULL,
  `target_membership_id` CHAR(36) NOT NULL,
  `initiator_assignment_id` CHAR(36) NOT NULL,
  `target_assignment_id` CHAR(36) NOT NULL,
  `initiator_assignment_version` INT UNSIGNED NOT NULL,
  `target_assignment_version` INT UNSIGNED NOT NULL,
  `status` ENUM('pending_target', 'pending_approval', 'completed', 'rejected', 'cancelled')
    NOT NULL DEFAULT 'pending_target',
  `active_initiator_assignment_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL AND `status` IN ('pending_target', 'pending_approval'),
       `initiator_assignment_id`, NULL)
  ) STORED,
  `active_target_assignment_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL AND `status` IN ('pending_target', 'pending_approval'),
       `target_assignment_id`, NULL)
  ) STORED,
  `decided_at` TIMESTAMP(3) NULL,
  `approver_user_id` CHAR(36) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `swap_requests_active_initiator_assignment_unique` (`active_initiator_assignment_id`),
  UNIQUE KEY `swap_requests_active_target_assignment_unique` (`active_target_assignment_id`),
  KEY `swap_requests_group_status_idx` (`group_id`, `status`),
  KEY `swap_requests_initiator_status_idx` (`initiator_membership_id`, `status`),
  KEY `swap_requests_target_status_idx` (`target_membership_id`, `status`),
  CONSTRAINT `swap_requests_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `swap_requests_initiator_membership_id_fk`
    FOREIGN KEY (`initiator_membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `swap_requests_target_membership_id_fk`
    FOREIGN KEY (`target_membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `swap_requests_initiator_assignment_id_fk`
    FOREIGN KEY (`initiator_assignment_id`) REFERENCES `shift_assignments` (`id`),
  CONSTRAINT `swap_requests_target_assignment_id_fk`
    FOREIGN KEY (`target_assignment_id`) REFERENCES `shift_assignments` (`id`),
  CONSTRAINT `swap_requests_approver_user_id_fk`
    FOREIGN KEY (`approver_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `swap_requests_versions_check`
    CHECK (`initiator_assignment_version` > 0 AND `target_assignment_version` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
