ALTER TABLE `swap_requests`
  MODIFY COLUMN `status`
    ENUM('pending_target', 'pending_approval', 'completed', 'rejected', 'cancelled', 'revoked')
    NOT NULL DEFAULT 'pending_target',
  ADD COLUMN `revocation_reason` VARCHAR(1000) NULL AFTER `approver_user_id`;
--> statement-breakpoint
ALTER TABLE `duty_adjustments`
  ADD COLUMN `revocation_reason` VARCHAR(1000) NULL AFTER `reason`;
--> statement-breakpoint
CREATE TABLE `guest_schedule_access_attempts` (
  `access_key` CHAR(64) NOT NULL,
  `window_started_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`access_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
