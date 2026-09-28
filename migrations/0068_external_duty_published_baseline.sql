ALTER TABLE `external_duty_checks`
  ADD COLUMN `baseline_name` varchar(100) NULL AFTER `remote_name`,
  ADD COLUMN `schedule_period_id` char(36) NULL AFTER `local_name`,
  ADD COLUMN `assignment_version` int unsigned NULL AFTER `assignment_id`,
  ADD COLUMN `is_in_scope` tinyint unsigned NOT NULL DEFAULT 1 AFTER `assignment_version`;
--> statement-breakpoint

CREATE TABLE `external_duty_actions` (
  `id` char(36) NOT NULL,
  `business_date` date NOT NULL,
  `group_id` char(36) NOT NULL,
  `schedule_period_id` char(36) NOT NULL,
  `assignment_id` char(36) NOT NULL,
  `side` enum('external','local') NOT NULL,
  `baseline_name` varchar(100) NOT NULL,
  `before_name` varchar(100) NULL,
  `after_name` varchar(100) NULL,
  `workflow_kind` enum('duty','swap') NULL,
  `workflow_id` char(36) NULL,
  `status` enum('applying','applied','reverting','reverted') NOT NULL DEFAULT 'applied',
  `actor_user_id` char(36) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `reverted_at` timestamp(3) NULL,
  PRIMARY KEY (`id`),
  KEY `external_duty_actions_date_idx` (`business_date`, `created_at`)
);
