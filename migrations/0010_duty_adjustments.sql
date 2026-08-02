ALTER TABLE `groups`
  ADD COLUMN `duty_adjustment_approval_required` TINYINT UNSIGNED NOT NULL DEFAULT 1
    AFTER `swap_approval_required`;
--> statement-breakpoint
CREATE TABLE `duty_adjustments` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `covered_assignment_id` CHAR(36) NOT NULL,
  `overtime_membership_id` CHAR(36) NOT NULL,
  `deducted_membership_id` CHAR(36) NOT NULL,
  `assignment_version` INT UNSIGNED NOT NULL,
  `status` ENUM('pending_target', 'pending_approval', 'completed', 'rejected', 'cancelled', 'revoked')
    NOT NULL DEFAULT 'pending_target',
  `active_covered_assignment_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL AND `status` IN ('pending_target', 'pending_approval', 'completed'),
       `covered_assignment_id`, NULL)
  ) STORED,
  `decided_at` TIMESTAMP(3) NULL,
  `approver_user_id` CHAR(36) NULL,
  `reason` VARCHAR(1000) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `duty_adjustments_active_covered_assignment_unique` (`active_covered_assignment_id`),
  KEY `duty_adjustments_group_status_idx` (`group_id`, `status`),
  KEY `duty_adjustments_overtime_status_idx` (`overtime_membership_id`, `status`),
  KEY `duty_adjustments_deducted_status_idx` (`deducted_membership_id`, `status`),
  CONSTRAINT `duty_adjustments_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `duty_adjustments_covered_assignment_id_fk`
    FOREIGN KEY (`covered_assignment_id`) REFERENCES `shift_assignments` (`id`),
  CONSTRAINT `duty_adjustments_overtime_membership_id_fk`
    FOREIGN KEY (`overtime_membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `duty_adjustments_deducted_membership_id_fk`
    FOREIGN KEY (`deducted_membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `duty_adjustments_approver_user_id_fk`
    FOREIGN KEY (`approver_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `duty_adjustments_assignment_version_check`
    CHECK (`assignment_version` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
